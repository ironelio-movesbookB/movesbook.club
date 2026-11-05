import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { getAdminRegistrationCredits } from './adminRegistrationCredits';
import {
  getLegacyUsersTable,
  getPromocodeSettingsTable,
  getSubscriptionSettingsTable,
} from './legacyDb';

function positiveCredit(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Admin friend-of-friend box for the version, then the legacy credit1 column. */
async function friendOfFriendCreditForSetting(
  settingsTable: string,
  settingId: number
): Promise<number> {
  if (settingId <= 0) return 0;
  const admin = await getAdminRegistrationCredits(settingId).catch(() => null);
  if (admin) return admin.friendOfFriend;

  const cols = await getTableColumns(settingsTable);
  if (!cols.has('credit1')) return 0;
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT credit1 FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
    settingId
  );
  return positiveCredit(rows[0]?.credit1);
}

async function settingIdByVersionLabel(settingsTable: string, versionLabel: string): Promise<number> {
  const label = versionLabel.trim();
  if (!label) return 0;
  const cols = await getTableColumns(settingsTable);
  const orParts: string[] = [];
  const params: unknown[] = [];
  for (const col of ['subscription_name', 'short_name', 'code_no']) {
    if (!cols.has(col)) continue;
    orParts.push(`LOWER(\`${col}\`) = LOWER(?)`);
    params.push(label);
  }
  if (orParts.length === 0) return 0;

  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${settingsTable}\` WHERE (${orParts.join(' OR ')}) LIMIT 1`,
    ...params
  );
  return rows[0]?.id != null ? Number(rows[0].id) : 0;
}

async function receiverSettingId(receiverId: number): Promise<number> {
  if (receiverId <= 0) return 0;
  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return 0;
  const rows = await prisma.$queryRawUnsafe<{ subscription_setting_id: number | null }[]>(
    `SELECT subscription_setting_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    receiverId
  );
  return rows[0]?.subscription_setting_id != null ? Number(rows[0].subscription_setting_id) : 0;
}

async function promocodeSettingId(promocodeId: number): Promise<number> {
  if (promocodeId <= 0) return 0;
  const promoTable = await getPromocodeSettingsTable();
  if (!promoTable) return 0;
  const promoCols = await getTableColumns(promoTable);
  if (!promoCols.has('version_id')) return 0;
  const promoRows = await prisma.$queryRawUnsafe<{ version_id: unknown }[]>(
    `SELECT version_id FROM \`${promoTable}\` WHERE id = ? LIMIT 1`,
    promocodeId
  );
  const versionIdStr = String(promoRows[0]?.version_id ?? '').trim();
  return (
    versionIdStr
      .split(',')
      .map((part) => Number(part.trim()))
      .find((id) => Number.isFinite(id) && id > 0) ?? 0
  );
}

/**
 * Friend-of-friend (secondary sender) credit for a registration apply row.
 * Uses the stored secondary_sender_credit, otherwise the admin version setting
 * ("For the sender user", second box) of the registered version.
 */
export async function resolveSecondaryCreditAmount(params: {
  storedCredit: number;
  receiverId?: number;
  receiverVersionName?: string;
  promocodeId?: number;
}): Promise<number> {
  const stored = positiveCredit(params.storedCredit);
  if (stored > 0) return stored;

  const settingsTable = await getSubscriptionSettingsTable();
  if (!settingsTable) return 0;

  const lookups: (() => Promise<number>)[] = [
    () => settingIdByVersionLabel(settingsTable, params.receiverVersionName ?? ''),
    () => receiverSettingId(params.receiverId ?? 0),
    () => promocodeSettingId(params.promocodeId ?? 0),
  ];
  for (const lookup of lookups) {
    try {
      const settingId = await lookup();
      if (settingId <= 0) continue;
      return await friendOfFriendCreditForSetting(settingsTable, settingId);
    } catch {
      /* try next */
    }
  }
  return 0;
}
