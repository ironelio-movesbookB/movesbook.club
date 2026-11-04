import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  getLegacyUsersTable,
  getPromocodeSettingsTable,
  getSubscriptionSettingsTable,
} from './legacyDb';

function positiveCredit(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function credit1FromVersionJson(settingId: number): Promise<number> {
  if (settingId <= 0) return 0;
  try {
    const { loadVersionSettings } = await import('@/lib/subscriptions/versionSettingsStore');
    const all = await loadVersionSettings();
    const data = all[String(settingId)];
    const n = Number(data?.general?.senderRegisterCredit1 ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function credit1FromSubscriptionSettingId(
  settingsTable: string,
  settingId: number
): Promise<number> {
  if (settingId <= 0) return 0;
  const cols = await getTableColumns(settingsTable);
  const selectCols = ['id'];
  if (cols.has('credit1')) selectCols.push('credit1');
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(', ')} FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
    settingId
  );
  const row = rows[0];
  if (!row) return 0;
  const fromColumn = cols.has('credit1') ? positiveCredit(row.credit1) : 0;
  if (fromColumn > 0) return fromColumn;
  return credit1FromVersionJson(settingId);
}

async function credit1ByVersionLabel(settingsTable: string, versionLabel: string): Promise<number> {
  const label = versionLabel.trim();
  if (!label) return 0;
  const cols = await getTableColumns(settingsTable);
  const nameCol = cols.has('subscription_name') ? 'subscription_name' : null;
  const shortCol = cols.has('short_name') ? 'short_name' : null;
  const codeCol = cols.has('code_no') ? 'code_no' : null;
  if (!nameCol && !shortCol && !codeCol) return 0;

  const orParts: string[] = [];
  const params: unknown[] = [];
  if (nameCol) {
    orParts.push(`LOWER(\`${nameCol}\`) = LOWER(?)`);
    params.push(label);
  }
  if (shortCol) {
    orParts.push(`LOWER(\`${shortCol}\`) = LOWER(?)`);
    params.push(label);
  }
  if (codeCol) {
    orParts.push(`LOWER(\`${codeCol}\`) = LOWER(?)`);
    params.push(label);
  }

  const selectCols = ['id'];
  if (cols.has('credit1')) selectCols.push('credit1');

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(', ')} FROM \`${settingsTable}\`
     WHERE (${orParts.join(' OR ')}) LIMIT 1`,
    ...params
  );
  const row = rows[0];
  if (!row) return 0;
  const settingId = Number(row.id ?? 0);
  const fromColumn = cols.has('credit1') ? positiveCredit(row.credit1) : 0;
  if (fromColumn > 0) return fromColumn;
  if (settingId > 0) return credit1FromVersionJson(settingId);
  return 0;
}

async function credit1FromPromocodeVersion(promocodeId: number): Promise<number> {
  if (promocodeId <= 0) return 0;
  const settingsTable = await getSubscriptionSettingsTable();
  const promoTable = await getPromocodeSettingsTable();
  if (!settingsTable || !promoTable) return 0;
  const promoCols = await getTableColumns(promoTable);
  if (!promoCols.has('version_id')) return 0;
  const promoRows = await prisma.$queryRawUnsafe<{ version_id: unknown }[]>(
    `SELECT version_id FROM \`${promoTable}\` WHERE id = ? LIMIT 1`,
    promocodeId
  );
  const versionIdStr = String(promoRows[0]?.version_id ?? '').trim();
  if (!versionIdStr) return 0;
  const firstSettingId = versionIdStr
    .split(',')
    .map((part) => Number(part.trim()))
    .find((id) => Number.isFinite(id) && id > 0);
  if (!firstSettingId) return 0;
  return credit1FromSubscriptionSettingId(settingsTable, firstSettingId);
}

/**
 * Friend-of-friend (secondary sender) credit for a registration apply row.
 * Uses stored secondary_sender_credit, then subscription credit1 / dashboard JSON,
 * then version label and promocode version fallbacks.
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

  const receiverId = params.receiverId ?? 0;
  if (receiverId > 0) {
    const usersTable = await getLegacyUsersTable();
    if (usersTable) {
      try {
        const userRows = await prisma.$queryRawUnsafe<{ subscription_setting_id: number | null }[]>(
          `SELECT subscription_setting_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          receiverId
        );
        const settingId =
          userRows[0]?.subscription_setting_id != null
            ? Number(userRows[0].subscription_setting_id)
            : 0;
        if (settingId > 0) {
          const n = await credit1FromSubscriptionSettingId(settingsTable, settingId);
          if (n > 0) return n;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const versionName = (params.receiverVersionName ?? '').trim();
  if (versionName) {
    try {
      const n = await credit1ByVersionLabel(settingsTable, versionName);
      if (n > 0) return n;
    } catch {
      /* ignore */
    }
  }

  const promocodeId = params.promocodeId ?? 0;
  if (promocodeId > 0) {
    try {
      const n = await credit1FromPromocodeVersion(promocodeId);
      if (n > 0) return n;
    } catch {
      /* ignore */
    }
  }

  return 0;
}
