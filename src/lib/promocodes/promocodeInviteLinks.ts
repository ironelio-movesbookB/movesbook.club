import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { getLegacyUsersTable, getPromocodeAppliesTable } from './legacyDb';

type InviteLinkField = 'other_info' | 'adv_page';

function isEmpty(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === '';
}

async function fetchLegacyUserEmail(legacyUserId: number): Promise<string | null> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable || legacyUserId <= 0) return null;
  const columns = await getTableColumns(usersTable);
  if (!columns.has('email')) return null;
  const rows = await prisma.$queryRawUnsafe<{ email: string | null }[]>(
    `SELECT email FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    legacyUserId
  );
  const email = rows[0]?.email;
  return email?.trim() ? String(email).trim() : null;
}

function extractFromMalformedJson(rawSettings: string, field: InviteLinkField): string {
  const pattern =
    field === 'other_info'
      ? /"other_info"\s*:\s*(?:"([^"]*)"|'([^']*)')/
      : /"adv_page"\s*:\s*(?:"([^"]*)"|'([^']*)')/;
  const match = rawSettings.match(pattern);
  if (!match) return '';
  if (match[1] !== undefined && match[1] !== '') return match[1];
  return match[2] ?? '';
}

function nestedSettingValue(
  settings: Record<string, unknown>,
  field: InviteLinkField
): string {
  const topKey =
    field === 'other_info'
      ? 'promocode_invite_last_other_info'
      : 'promocode_invite_last_adv_page';

  if (Object.prototype.hasOwnProperty.call(settings, topKey)) {
    return String(settings[topKey] ?? '');
  }

  const mode = settings.last_retrieved_mode;
  if (typeof mode === 'string') {
    const modeValue = settings[mode];
    if (modeValue && typeof modeValue === 'object' && !Array.isArray(modeValue)) {
      const nested = (modeValue as Record<string, unknown>)[field];
      if (nested != null && String(nested) !== '') return String(nested);
    }
  }

  for (const modeName of ['mode1', 'mode2', 'mode3']) {
    const modeValue = settings[modeName];
    if (modeValue && typeof modeValue === 'object' && !Array.isArray(modeValue)) {
      const nested = (modeValue as Record<string, unknown>)[field];
      if (nested != null && String(nested) !== '') return String(nested);
    }
  }

  for (const value of Object.values(settings)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = (value as Record<string, unknown>)[field];
      if (nested != null && String(nested) !== '') return String(nested);
    }
  }

  return '';
}

async function resolveFieldFromUserSettings(
  legacyUserId: number,
  field: InviteLinkField,
  currentValue: string
): Promise<string> {
  if (!isEmpty(currentValue)) return currentValue;

  const usersTable = await getLegacyUsersTable();
  if (!usersTable || legacyUserId <= 0) return currentValue;

  const columns = await getTableColumns(usersTable);
  if (!columns.has('user_settings')) return currentValue;

  const rows = await prisma.$queryRawUnsafe<{ user_settings: string | null }[]>(
    `SELECT user_settings FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    legacyUserId
  );
  const rawSettings = rows[0]?.user_settings;
  if (rawSettings == null || String(rawSettings).trim() === '') return currentValue;

  const raw = String(rawSettings);
  let userSettings: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      userSettings = parsed as Record<string, unknown>;
    } else {
      return extractFromMalformedJson(raw, field) || currentValue;
    }
  } catch {
    const fromRegex = extractFromMalformedJson(raw, field);
    return fromRegex || currentValue;
  }

  const nested = nestedSettingValue(userSettings, field);
  return nested || currentValue;
}

/** PHP SearchresultsController::send_email_with_promocode — Other info / Visit also defaults. */
export async function resolveInviteOtherInfoAndAdvPage(params: {
  otherInfo?: string;
  advPage?: string;
  senderLegacyUserId?: number | null;
  senderEmail?: string | null;
  /** Prefer links from the invite received for this specific promocode. */
  promocodeId?: number | null;
}): Promise<{ otherInfo: string; advPage: string }> {
  let otherInfo = params.otherInfo?.trim() ?? '';
  let advPage = params.advPage?.trim() ?? '';

  const legacyUserId = Number(params.senderLegacyUserId) || 0;
  if (legacyUserId <= 0) {
    return { otherInfo, advPage };
  }

  let senderEmail = params.senderEmail?.trim() ?? '';
  if (!senderEmail) {
    senderEmail = (await fetchLegacyUserEmail(legacyUserId)) ?? '';
  }

  const appliesTable = await getPromocodeAppliesTable();
  if (appliesTable) {
    const applyColumns = await getTableColumns(appliesTable);
    const orParts: string[] = [];
    const values: unknown[] = [];

    if (applyColumns.has('receiver_email') && senderEmail) {
      orParts.push('LOWER(`receiver_email`) = ?');
      values.push(senderEmail.toLowerCase());
    }
    if (applyColumns.has('receiver_id')) {
      orParts.push('`receiver_id` = ?');
      values.push(legacyUserId);
    }

    if (orParts.length > 0) {
      const selectFields: string[] = [];
      if (applyColumns.has('other_info')) selectFields.push('other_info');
      if (applyColumns.has('adv_page')) selectFields.push('adv_page');

      if (selectFields.length > 0) {
        const promocodeId = Number(params.promocodeId) || 0;
        const promoClause =
          promocodeId > 0 && applyColumns.has('promocode_id')
            ? ' AND promocode_id = ?'
            : '';
        const promoParams = promocodeId > 0 && applyColumns.has('promocode_id') ? [promocodeId] : [];

        const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT ${selectFields.map((f) => `\`${f}\``).join(', ')}
           FROM \`${appliesTable}\`
           WHERE delete_status = 2 AND (${orParts.join(' OR ')})${promoClause}
           ORDER BY id DESC LIMIT 1`,
          ...values,
          ...promoParams
        );

        const received = rows[0];
        if (received) {
          if (isEmpty(otherInfo) && received.other_info != null && String(received.other_info).trim()) {
            otherInfo = String(received.other_info);
          }
          if (isEmpty(advPage) && received.adv_page != null && String(received.adv_page).trim()) {
            advPage = String(received.adv_page);
          }
        }
      }
    }
  }

  if (isEmpty(otherInfo) || isEmpty(advPage)) {
    otherInfo = await resolveFieldFromUserSettings(legacyUserId, 'other_info', otherInfo);
    advPage = await resolveFieldFromUserSettings(legacyUserId, 'adv_page', advPage);
  }

  return { otherInfo, advPage };
}

/** PHP inviteEmail — persist last-sent Other info / Visit also on sender user_settings. */
export async function saveInviteOtherInfoAndAdvPageToUserSettings(
  senderLegacyUserId: number,
  otherInfo: string,
  advPage: string
): Promise<void> {
  if (senderLegacyUserId <= 0) return;

  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return;

  const columns = await getTableColumns(usersTable);
  if (!columns.has('user_settings')) return;

  const rows = await prisma.$queryRawUnsafe<{ user_settings: string | null }[]>(
    `SELECT user_settings FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    senderLegacyUserId
  );
  if (rows.length === 0) return;

  const rawSettings = rows[0]?.user_settings;
  let userSettings: Record<string, unknown> = {};
  if (rawSettings != null && String(rawSettings).trim() !== '') {
    try {
      const parsed = JSON.parse(String(rawSettings)) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        userSettings = parsed as Record<string, unknown>;
      }
    } catch {
      userSettings = {};
    }
  }

  userSettings.promocode_invite_last_other_info = otherInfo;
  userSettings.promocode_invite_last_adv_page = advPage;

  await prisma.$executeRawUnsafe(
    `UPDATE \`${usersTable}\` SET user_settings = ? WHERE id = ?`,
    JSON.stringify(userSettings),
    senderLegacyUserId
  );
}

export async function loadSenderIntroMessage(legacyUserId: number): Promise<string> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable || legacyUserId <= 0) return '';
  const columns = await getTableColumns(usersTable);
  if (!columns.has('promocode_intro')) return '';
  const rows = await prisma.$queryRawUnsafe<{ promocode_intro: string | null }[]>(
    `SELECT promocode_intro FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    legacyUserId
  ).catch(() => [] as { promocode_intro: string | null }[]);
  return rows[0]?.promocode_intro ? String(rows[0].promocode_intro) : '';
}

export async function saveSenderIntroMessage(legacyUserId: number, intro: string): Promise<void> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable || legacyUserId <= 0) return;
  const columns = await getTableColumns(usersTable);
  if (!columns.has('promocode_intro')) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${usersTable}\` ADD COLUMN promocode_intro TEXT NULL`
    );
  }
  await prisma.$executeRawUnsafe(
    `UPDATE \`${usersTable}\` SET promocode_intro = ? WHERE id = ?`,
    intro,
    legacyUserId
  );
}
