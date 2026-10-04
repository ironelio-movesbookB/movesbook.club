import { prisma } from '@/lib/prisma';
import { COUNTRIES_WITH_CODES } from '@/lib/news/countries';
import { ensurePromocodeMetaTables } from './ensureMetaTables';

export type PromocodeStatisticsResult = {
  year: number;
  months: Array<{
    month: number;
    invitesSent: number;
    registrations: number;
    successRate: number;
  }>;
  countryMatrix: Array<{
    countryId: number;
    countryCode: string;
    countryName: string;
    /** No country recorded (country id 0, no code) — the "ID 0" row; invites always land here. */
    isUnknown: boolean;
    months: Record<number, { invitesSent: number; registrations: number }>;
  }>;
  totals: {
    invitesSent: number;
    registrations: number;
    successRate: number;
  };
};

function countryByCode(code: string) {
  const cc = (code || '').trim().toUpperCase();
  return cc ? COUNTRIES_WITH_CODES.find((c) => c.id.toUpperCase() === cc) : undefined;
}

function countryByName(name: string) {
  const n = (name || '').trim().toLowerCase();
  return n ? COUNTRIES_WITH_CODES.find((c) => c.name.toLowerCase() === n) : undefined;
}

/** Legacy `countries` rows (name + code when the column exists), for stats rows saved with an id only. */
async function loadCountriesById(
  ids: number[]
): Promise<Map<number, { name: string; code: string }>> {
  const map = new Map<number, { name: string; code: string }>();
  if (ids.length === 0) return map;
  try {
    const { getCountriesTable } = await import('./legacyDb');
    const table = await getCountriesTable();
    if (!table) return map;
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM \`${table}\` WHERE id IN (${ids.map(() => '?').join(', ')})`,
      ...ids
    );
    for (const row of rows) {
      const name = String(row.name ?? '').trim();
      const code = String(row.code ?? '').trim().toUpperCase();
      if (name || code) map.set(Number(row.id), { name, code });
    }
  } catch {
    /* legacy countries table optional */
  }
  return map;
}

function ymdParts(date?: Date | string | null): { year: number; month: number } {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

async function tableExists(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ c: number | bigint }[]>(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'promocode_monthly_stats'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}

async function bumpStat(
  field: 'invites_sent' | 'registrations',
  countryId: number,
  countryCode: string,
  date?: Date | string | null
): Promise<void> {
  await ensurePromocodeMetaTables();
  if (!(await tableExists())) return;

  const { year, month } = ymdParts(date);
  const cid = Number.isFinite(countryId) ? Math.max(0, Math.floor(countryId)) : 0;
  const code = (countryCode || '').slice(0, 8);

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO promocode_monthly_stats
         (year, month, invites_sent, registrations, country_id, country_code)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`${field}\` = \`${field}\` + 1,
         country_code = IF(VALUES(country_code) <> '', VALUES(country_code), country_code)`,
      year,
      month,
      field === 'invites_sent' ? 1 : 0,
      field === 'registrations' ? 1 : 0,
      cid,
      code
    );
  } catch (err) {
    console.warn(`promocodeMonthlyStats ${field} increment skipped:`, err);
  }
}

export async function incrementInviteStat(
  countryId: number,
  countryCode?: string | null,
  date?: Date | string | null
): Promise<void> {
  await bumpStat('invites_sent', countryId, countryCode ?? '', date);
}

export async function incrementRegistrationStat(
  countryId: number,
  countryCode?: string | null,
  date?: Date | string | null
): Promise<void> {
  await bumpStat('registrations', countryId, countryCode ?? '', date);
}

export async function getStatistics(year: number): Promise<PromocodeStatisticsResult> {
  await ensurePromocodeMetaTables();

  const emptyMonths = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    invitesSent: 0,
    registrations: 0,
    successRate: 0,
  }));

  if (!(await tableExists())) {
    return {
      year,
      months: emptyMonths,
      countryMatrix: [],
      totals: { invitesSent: 0, registrations: 0, successRate: 0 },
    };
  }

  const rows = await prisma.$queryRawUnsafe<
    {
      year: number;
      month: number;
      invites_sent: number | bigint;
      registrations: number | bigint;
      country_id: number | bigint;
      country_code: string | null;
    }[]
  >(
    `SELECT year, month, invites_sent, registrations, country_id, country_code
     FROM promocode_monthly_stats
     WHERE year = ?
     ORDER BY country_id ASC, month ASC`,
    year
  );

  const legacyById = await loadCountriesById(
    [...new Set(rows.map((r) => Number(r.country_id ?? 0)).filter((id) => id > 0))]
  );

  const monthTotals = new Map<number, { invitesSent: number; registrations: number }>();
  const countryMap = new Map<string, PromocodeStatisticsResult['countryMatrix'][number]>();

  let totalInvites = 0;
  let totalRegs = 0;

  for (const row of rows) {
    const month = Number(row.month);
    const invites = Number(row.invites_sent ?? 0);
    const regs = Number(row.registrations ?? 0);
    const countryId = Number(row.country_id ?? 0);
    const countryCode = row.country_code != null ? String(row.country_code) : '';

    totalInvites += invites;
    totalRegs += regs;

    const mt = monthTotals.get(month) ?? { invitesSent: 0, registrations: 0 };
    mt.invitesSent += invites;
    mt.registrations += regs;
    monthTotals.set(month, mt);

    // One row per real country, whether it was saved by code, by legacy id, or both.
    const legacy = countryId > 0 ? legacyById.get(countryId) : undefined;
    const legacyName = legacy?.name ?? '';
    const known =
      countryByCode(countryCode) ?? countryByName(legacyName) ?? countryByCode(legacy?.code ?? '');
    const code = known?.id ?? countryCode.trim().toUpperCase();
    const isUnknown = !code && countryId <= 0;
    const key = isUnknown ? 'unknown' : code ? `code:${code}` : `id:${countryId}`;
    const entry = countryMap.get(key) ?? {
      countryId,
      countryCode: code,
      countryName: isUnknown
        ? 'ID 0'
        : known?.name || legacyName || code || `Country #${countryId}`,
      isUnknown,
      months: {},
    };
    if (entry.countryId <= 0 && countryId > 0) entry.countryId = countryId;
    const cm = entry.months[month] ?? { invitesSent: 0, registrations: 0 };
    cm.invitesSent += invites;
    cm.registrations += regs;
    entry.months[month] = cm;
    countryMap.set(key, entry);
  }

  const months = emptyMonths.map((m) => {
    const t = monthTotals.get(m.month) ?? { invitesSent: 0, registrations: 0 };
    return {
      month: m.month,
      invitesSent: t.invitesSent,
      registrations: t.registrations,
      successRate: t.invitesSent > 0 ? (t.registrations / t.invitesSent) * 100 : 0,
    };
  });

  return {
    year,
    months,
    countryMatrix: Array.from(countryMap.values()).sort((a, b) => {
      if (a.isUnknown !== b.isUnknown) return a.isUnknown ? -1 : 1;
      const regs = (r: typeof a) =>
        Object.values(r.months).reduce((s, m) => s + m.registrations, 0);
      return regs(b) - regs(a) || a.countryName.localeCompare(b.countryName);
    }),
    totals: {
      invitesSent: totalInvites,
      registrations: totalRegs,
      successRate: totalInvites > 0 ? (totalRegs / totalInvites) * 100 : 0,
    },
  };
}
