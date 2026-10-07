import { parseAdminSettingsJson } from '@/lib/admin/userProfilePanelSettings';
import {
  classifyClubSubscriptionEnd,
  inferMembershipEndDateYmd,
  MEMBERSHIP_RENEWAL_DURATION_DAYS,
  MEMBERSHIP_STATUS_NOT_YET_ACTIVE,
  parseClubSubscriptionEndDate,
  parseClubSubscriptionStartDate,
} from '@/lib/admin/clubSubscriptionStatus';
import {
  mergePcuAccessIntoAdminSettings,
  readPcuAccessSettings,
} from '@/lib/admin/userPcuAccessSettings';
import type { RegisteredUserListRow } from '@/lib/admin/expandRegisteredUserListRows';
import { membershipStatusToneFromLabel } from '@/lib/admin/clubSubscriptionStatus';

/** One Movesbook network membership period (typically 6 months or 1 year). */
export type NetworkSubscriptionPeriod = {
  id: string;
  dateStart: string;
  dateEnd: string | null;
  version?: string;
  entityId?: string | null;
  companyName?: string;
  username?: string;
  status?: string;
  archivedAt?: string;
  paymentMethod?: string;
  amountPaid?: string;
  /** Same payment in the user's local currency, e.g. "3,818 ALL". */
  amountLocal?: string;
  discountPercent?: string;
  /** Club whose admin purchased this account for one of his members (Club accounts). */
  purchasedByClubId?: string | null;
};

export type MembershipViewMode = 'all' | 'current' | 'last' | 'lastPerUser';

/** Default list sort per membership toolbar button. */
export type MembershipListSortOrder =
  | 'fullname'
  | 'date_start_desc'
  | 'date_end_asc'
  | 'username'
  | 'date';

const HISTORY_KEY = 'networkSubscriptionHistory';
const DELETED_SUBSCRIPTIONS_KEY = 'deletedSubscriptionPeriods';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function parseYmdMs(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  const t = new Date(value.trim()).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function sliceYmd(value: string | null | undefined): string {
  return value?.trim().slice(0, 10) ?? '';
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd.trim());
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns an error message when end is before start; otherwise null. */
export function validateSubscriptionDateRange(
  dateStart: string | null | undefined,
  dateEnd: string | null | undefined,
): string | null {
  const startMs = parseYmdMs(dateStart);
  const endMs = parseYmdMs(dateEnd);
  if (!startMs || !endMs) return null;
  if (endMs < startMs) return 'End date cannot be earlier than start date';
  return null;
}

/**
 * Movesbook renewal start date:
 * - previous subscription already expired → today
 * - previous subscription still valid → day after previous end
 */
export function computeRenewalStartDate(
  previousEnd: string | null | undefined,
  now: Date = new Date(),
): string {
  const today = now.toISOString().slice(0, 10);
  const todayMs = parseYmdMs(today);
  const prevEndMs = parseYmdMs(previousEnd);
  if (!prevEndMs || prevEndMs < todayMs) return today;
  return addDaysYmd(sliceYmd(previousEnd), 1);
}

export type PcuAccessWindow = {
  accessStartIso: string;
  accessEndIso: string;
};

export function isNotYetActiveMembershipPeriod(
  period: Pick<NetworkSubscriptionPeriod, 'dateStart' | 'dateEnd'>,
  now?: Date,
): boolean {
  return periodStatusFromDates(period, now) === MEMBERSHIP_STATUS_NOT_YET_ACTIVE;
}

function sortPeriodsByStartDesc(periods: NetworkSubscriptionPeriod[]): NetworkSubscriptionPeriod[] {
  return [...periods].sort((a, b) => {
    const startDiff = parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart);
    if (startDiff !== 0) return startDiff;
    return parseYmdMs(b.dateEnd) - parseYmdMs(a.dateEnd);
  });
}

/** PCU top Start/End: latest membership that is active, expiring, or expired — never not-yet-active. */
export function pickPcuDisplayMembershipPeriod(
  periods: NetworkSubscriptionPeriod[],
  now?: Date,
): NetworkSubscriptionPeriod | null {
  if (periods.length === 0) return null;
  const eligible = periods.filter((p) => !isNotYetActiveMembershipPeriod(p, now));
  if (eligible.length === 0) return null;
  return sortPeriodsByStartDesc(eligible)[0]!;
}

export function membershipPeriodRangeMs(
  period: Pick<NetworkSubscriptionPeriod, 'dateStart' | 'dateEnd'>,
): { startMs: number; endMs: number } | null {
  const startMs = parseYmdMs(period.dateStart);
  const endYmd = inferMembershipEndDateYmd(period.dateStart, period.dateEnd);
  const endMs = endYmd ? parseYmdMs(endYmd) : null;
  if (!startMs || !endMs) return null;
  return { startMs, endMs };
}

export function membershipPeriodsOverlap(
  a: Pick<NetworkSubscriptionPeriod, 'dateStart' | 'dateEnd'>,
  b: Pick<NetworkSubscriptionPeriod, 'dateStart' | 'dateEnd'>,
): boolean {
  const ra = membershipPeriodRangeMs(a);
  const rb = membershipPeriodRangeMs(b);
  if (!ra || !rb) return false;
  return ra.startMs <= rb.endMs && rb.startMs <= ra.endMs;
}

export function validateMembershipPeriodNoOverlap(
  period: Pick<NetworkSubscriptionPeriod, 'id' | 'dateStart' | 'dateEnd'>,
  others: NetworkSubscriptionPeriod[],
): string | null {
  for (const other of others) {
    if (other.id === period.id) continue;
    if (
      sliceYmd(other.dateStart) === sliceYmd(period.dateStart) &&
      sliceYmd(other.dateEnd) === sliceYmd(period.dateEnd)
    ) {
      continue;
    }
    if (membershipPeriodsOverlap(period, other)) {
      return 'Date range overlaps an existing membership period';
    }
  }
  return null;
}

export function appendMembershipPeriodToHistory(
  adminSettingsRaw: string | null | undefined,
  period: NetworkSubscriptionPeriod,
): string {
  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const key = periodDedupeKey(period);
  if (history.some((p) => periodDedupeKey(p) === key)) {
    return adminSettingsRaw?.trim() || '{}';
  }
  return mergeNetworkSubscriptionHistory(adminSettingsRaw, [...history, period]);
}

export function updateMembershipPeriodInHistory(
  adminSettingsRaw: string | null | undefined,
  periodId: string,
  patch: { dateStart: string; dateEnd: string | null },
): { adminSettings: string; period: NetworkSubscriptionPeriod | null } {
  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  let updated: NetworkSubscriptionPeriod | null = null;
  const next = history.map((p) => {
    if (p.id !== periodId) return p;
    updated = {
      ...p,
      dateStart: patch.dateStart.trim().slice(0, 10),
      dateEnd: patch.dateEnd?.trim().slice(0, 10) || null,
    };
    return updated;
  });
  if (!updated) {
    return { adminSettings: adminSettingsRaw?.trim() || '{}', period: null };
  }
  return { adminSettings: mergeNetworkSubscriptionHistory(adminSettingsRaw, next), period: updated };
}

/** The single current membership among historical + live periods. */
export function pickCurrentSubscriptionPeriod(
  periods: NetworkSubscriptionPeriod[],
  pcuAccess?: PcuAccessWindow | null,
): NetworkSubscriptionPeriod | null {
  if (periods.length === 0) return null;
  const accessStart = sliceYmd(pcuAccess?.accessStartIso);
  const accessEnd = sliceYmd(pcuAccess?.accessEndIso);
  if (accessStart) {
    const exact = periods.find(
      (p) =>
        sliceYmd(p.dateStart) === accessStart &&
        sliceYmd(p.dateEnd) === accessEnd &&
        !isNotYetActiveMembershipPeriod(p),
    );
    if (exact) return exact;
  }
  const eligible = periods.filter(
    (p) => periodStatusFromDates(p) !== 'Expired' && !isNotYetActiveMembershipPeriod(p),
  );
  if (eligible.length > 0) {
    return sortPeriodsByStartDesc(eligible)[0]!;
  }
  return sortPeriodsByStartDesc(periods.filter((p) => !isNotYetActiveMembershipPeriod(p)))[0] ?? null;
}

function periodDedupeKey(period: NetworkSubscriptionPeriod): string {
  return `${period.entityId ?? ''}|${sliceYmd(period.dateStart)}|${sliceYmd(period.dateEnd)}`;
}

function pickPreferredSubscriptionPeriod(
  a: NetworkSubscriptionPeriod,
  b: NetworkSubscriptionPeriod,
): NetworkSubscriptionPeriod {
  const aCurrent = a.id.startsWith('current-');
  const bCurrent = b.id.startsWith('current-');
  if (aCurrent && !bCurrent) return a;
  if (bCurrent && !aCurrent) return b;
  const aArchived = parseYmdMs(a.archivedAt);
  const bArchived = parseYmdMs(b.archivedAt);
  if (bArchived > aArchived) return b;
  return a;
}

/** Collapse duplicate history rows that share the same entity + start + end dates. */
export function dedupeSubscriptionPeriods(
  periods: NetworkSubscriptionPeriod[],
): NetworkSubscriptionPeriod[] {
  const byKey = new Map<string, NetworkSubscriptionPeriod>();
  for (const period of periods) {
    const key = periodDedupeKey(period);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredSubscriptionPeriod(existing, period) : period);
  }
  return Array.from(byKey.values());
}

/**
 * Active / Expired / Expiring / Not yet active from subscription dates.
 * Not yet active when start is strictly after today; expired only after the end date.
 */
export function periodStatusFromDates(
  period: Pick<NetworkSubscriptionPeriod, 'dateStart' | 'dateEnd'>,
  now: Date = new Date(),
): string {
  const todayMs = parseYmdMs(now.toISOString().slice(0, 10));
  const startMs = parseYmdMs(period.dateStart);
  if (startMs && todayMs < startMs) {
    return MEMBERSHIP_STATUS_NOT_YET_ACTIVE;
  }

  const effectiveEnd = inferMembershipEndDateYmd(period.dateStart, period.dateEnd);
  const endMs = effectiveEnd ? parseYmdMs(effectiveEnd) : null;

  if (endMs && todayMs > endMs) return 'Expired';

  return periodDisplayStatus(effectiveEnd);
}

/** Derive list/profile status from dates (never from stored status flags). */
export function resolveMembershipPeriodStatus(
  period: NetworkSubscriptionPeriod,
  _current?: NetworkSubscriptionPeriod | null,
  now?: Date,
): string {
  void _current;
  return periodStatusFromDates(period, now);
}

function withResolvedMembershipStatuses(
  periods: NetworkSubscriptionPeriod[],
  _pcuAccess?: PcuAccessWindow | null,
): NetworkSubscriptionPeriod[] {
  void _pcuAccess;
  return dedupeSubscriptionPeriods(periods).map((p) => ({
    ...p,
    status: periodStatusFromDates(p),
  }));
}

export function computeRenewalEndDate(
  startYmd: string,
  durationDays: number = MEMBERSHIP_RENEWAL_DURATION_DAYS,
): string {
  return addDaysYmd(startYmd, durationDays);
}

export type MembershipRenewalInput = {
  dateStart: string;
  dateEnd: string | null;
  version?: string;
  entityId?: string | null;
  companyName?: string;
  username?: string;
};

/** Archive the previous period and prepare admin settings for a renewed membership. */
export function applyMembershipRenewalToAdminSettings(
  adminSettingsRaw: string | null | undefined,
  previous: MembershipRenewalInput,
  nextStart: string,
  nextEnd: string,
): string {
  return appendArchivedPeriodIfChanged(
    adminSettingsRaw,
    { accessStartIso: previous.dateStart, accessEndIso: previous.dateEnd ?? '' },
    { accessStartIso: nextStart, accessEndIso: nextEnd },
    {
      version: previous.version,
      entityId: previous.entityId ?? null,
      companyName: previous.companyName,
      username: previous.username,
    },
  );
}

/** Whether global PCU access dates should move forward with this entity renewal. */
export function shouldSyncPcuAccessOnRenewal(
  entityId: string | null | undefined,
  primaryEntityId: string | null | undefined,
  previous: MembershipRenewalInput,
  pcuAccess: PcuAccessWindow,
): boolean {
  if (!entityId) return true;
  if (primaryEntityId && entityId === primaryEntityId) return true;
  const prevStart = sliceYmd(previous.dateStart);
  const prevEnd = sliceYmd(previous.dateEnd);
  const pcuStart = sliceYmd(pcuAccess.accessStartIso);
  const pcuEnd = sliceYmd(pcuAccess.accessEndIso);
  return prevStart === pcuStart && prevEnd === pcuEnd;
}

export function periodDisplayStatus(dateEnd: string | null | undefined): string {
  if (!dateEnd?.trim()) return 'Active';
  const end = new Date(dateEnd);
  if (Number.isNaN(end.getTime())) return 'Active';
  const tone = classifyClubSubscriptionEnd(end);
  if (tone === 'expired') return 'Expired';
  if (tone === 'expiring') return 'Expiring';
  return 'Active';
}

export function isActiveMembershipPeriod(
  dateStart: string | null | undefined,
  dateEnd?: string | null | undefined,
): boolean {
  return periodStatusFromDates({ dateStart: dateStart ?? '', dateEnd: dateEnd ?? null }) !== 'Expired';
}

/**
 * Last valid subscription to inspect = the period with the highest expiry date
 * (open-ended / null dateEnd ranks highest). Ties broken by latest start.
 */
export function pickLatestSubscriptionByExpiry(
  periods: NetworkSubscriptionPeriod[],
): NetworkSubscriptionPeriod | null {
  if (periods.length === 0) return null;
  return [...periods].sort((a, b) => {
    const ae = a.dateEnd?.trim() ? parseYmdMs(a.dateEnd) : Number.MAX_SAFE_INTEGER;
    const be = b.dateEnd?.trim() ? parseYmdMs(b.dateEnd) : Number.MAX_SAFE_INTEGER;
    if (be !== ae) return be - ae;
    return parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart);
  })[0]!;
}

/** True only when the user’s last subscription (highest expiry) is still active. */
export function hasActiveLastSubscription(
  adminSettingsRaw: string | null | undefined,
): boolean {
  return resolveStatsSubscription(adminSettingsRaw).active;
}

/** "100", "100.50", "1.234,50", "1.200", "€ 80" → number of euros; anything else → 0. */
export function parseAmountPaid(raw: string | null | undefined): number {
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Both separators: the last one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    const sep = lastComma >= 0 ? ',' : '.';
    const groups = s.split(sep);
    // One kind only: "1.200" / "12,500,000" are thousands, "12,5" / "80.50" are decimals.
    const thousands = groups.length > 2 || (groups.length === 2 && groups[1]!.length === 3);
    s = thousands ? groups.join('') : groups.join('.');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export type StatsSubscription = {
  /** Counted as a current user: the last subscription (highest expiry) has not expired. */
  active: boolean;
  /** Version of the subscription running today, when stored on it. */
  version: string | null;
  /** Latest version found anywhere in the history (fallback after the account's own version). */
  historyVersion: string | null;
  /** € recorded as paid for the subscription running today (0 when nothing was recorded). */
  amountPaid: number;
  /** The user had a previous subscription that ended before the current one started. */
  renewal: boolean;
  /** The current subscription was purchased by a club admin for his member. */
  clubAccount: boolean;
};

/**
 * Every subscription of one user: the stored history (minus admin-deleted periods) plus the live
 * access window when no history row matches it.
 */
export function listStatsSubscriptionPeriods(
  adminSettingsRaw: string | null | undefined,
): NetworkSubscriptionPeriod[] {
  const deleted = readDeletedSubscriptionPeriods(adminSettingsRaw);
  const history = readNetworkSubscriptionHistory(adminSettingsRaw).filter(
    (p) => !isSubscriptionPeriodDeleted(p, deleted),
  );
  const periods = [...history];
  const access = readPcuAccessSettings(adminSettingsRaw, { accessStartIso: '', accessEndIso: '' });
  const accessStart = sliceYmd(access.accessStartIso);
  if (accessStart) {
    const accessPeriod: NetworkSubscriptionPeriod = {
      id: 'pcu-access-account',
      dateStart: accessStart,
      dateEnd: sliceYmd(access.accessEndIso) || null,
      entityId: null,
    };
    if (
      !history.some(
        (p) =>
          sliceYmd(p.dateStart) === accessStart &&
          sliceYmd(p.dateEnd) === sliceYmd(accessPeriod.dateEnd),
      ) &&
      !isSubscriptionPeriodDeleted(accessPeriod, deleted)
    ) {
      periods.push(accessPeriod);
    }
  }
  return periods;
}

/**
 * One user's current subscription for statistics: the stored history (minus admin-deleted
 * periods) plus the live access window, which renewals move without adding a history row.
 */
export function resolveStatsSubscription(
  adminSettingsRaw: string | null | undefined,
): StatsSubscription {
  const deleted = readDeletedSubscriptionPeriods(adminSettingsRaw);
  const history = readNetworkSubscriptionHistory(adminSettingsRaw).filter(
    (p) => !isSubscriptionPeriodDeleted(p, deleted),
  );
  const candidates = [...history];
  const access = readPcuAccessSettings(adminSettingsRaw, { accessStartIso: '', accessEndIso: '' });
  const accessStart = sliceYmd(access.accessStartIso);
  if (accessStart) {
    const accessPeriod: NetworkSubscriptionPeriod = {
      id: 'pcu-access-account',
      dateStart: accessStart,
      dateEnd: sliceYmd(access.accessEndIso) || null,
      entityId: null,
    };
    // The account window is shared with the primary club, whose rows carry the club id.
    if (
      !history.some(
        (p) =>
          sliceYmd(p.dateStart) === accessStart &&
          sliceYmd(p.dateEnd) === sliceYmd(accessPeriod.dateEnd),
      ) &&
      !isSubscriptionPeriodDeleted(accessPeriod, deleted)
    ) {
      candidates.push(accessPeriod);
    }
  }

  // Legacy accounts with no history yet: keep counted (cannot prove expiry), nothing paid on record.
  if (candidates.length === 0) {
    return {
      active: true,
      version: null,
      historyVersion: null,
      amountPaid: 0,
      renewal: false,
      clubAccount: false,
    };
  }

  // A missing end means start + standard duration (as in the admin lists), not "never expires".
  const effectiveEndMs = (p: NetworkSubscriptionPeriod) =>
    parseYmdMs(inferMembershipEndDateYmd(p.dateStart, p.dateEnd));
  const last = [...candidates].sort(
    (a, b) =>
      effectiveEndMs(b) - effectiveEndMs(a) || parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart),
  )[0]!;
  if (!isActiveMembershipPeriod(last.dateStart, last.dateEnd)) {
    return {
      active: false,
      version: null,
      historyVersion: null,
      amountPaid: 0,
      renewal: false,
      clubAccount: false,
    };
  }

  const runningToday = candidates.filter(
    (p) => periodStatusFromDates(p) !== 'Expired' && !isNotYetActiveMembershipPeriod(p),
  );
  const current = runningToday.length > 0 ? sortPeriodsByStartDesc(runningToday)[0]! : last;
  // A renewal starts the day after the previous end (or later when it had already expired).
  const currentStartMs = parseYmdMs(sliceYmd(current.dateStart));
  const renewal =
    currentStartMs > 0 &&
    candidates.some(
      (p) =>
        p !== current &&
        parseYmdMs(sliceYmd(p.dateStart)) < currentStartMs &&
        effectiveEndMs(p) > 0 &&
        effectiveEndMs(p) <= currentStartMs + 24 * 60 * 60 * 1000,
    );
  return {
    active: true,
    version: current.version?.trim() || null,
    historyVersion:
      sortPeriodsByStartDesc(history).find((p) => p.version?.trim())?.version?.trim() || null,
    amountPaid: parseAmountPaid(current.amountPaid),
    renewal,
    clubAccount: Boolean(current.purchasedByClubId?.trim()),
  };
}

/**
 * Records what was paid for one membership window. Updates the history row with the same
 * entity + dates, or adds one (hidden in the admin lists, which show the live row for it).
 */
export function setMembershipPeriodAmountPaid(
  adminSettingsRaw: string | null | undefined,
  window: Pick<NetworkSubscriptionPeriod, 'entityId' | 'dateStart' | 'dateEnd' | 'version' | 'username' | 'companyName'>,
  amountPaid: string,
): string {
  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const period: NetworkSubscriptionPeriod = {
    id: `payment-${Date.now()}`,
    dateStart: sliceYmd(window.dateStart),
    dateEnd: sliceYmd(window.dateEnd) || null,
    entityId: window.entityId ?? null,
    version: window.version,
    username: window.username,
    companyName: window.companyName,
  };
  const key = periodDedupeKey(period);
  const existing = history.find((p) => periodDedupeKey(p) === key);
  if (existing) {
    return mergeNetworkSubscriptionHistory(
      adminSettingsRaw,
      history.map((p) => (p === existing ? { ...p, amountPaid } : p)),
    );
  }
  if (!amountPaid) return adminSettingsRaw?.trim() || '{}';
  return mergeNetworkSubscriptionHistory(adminSettingsRaw, [
    ...history,
    { ...period, status: periodDisplayStatus(period.dateEnd), amountPaid },
  ]);
}

/** When only the end date of a window is corrected, its recorded payment moves with it. */
export function moveMembershipPeriodEnd(
  adminSettingsRaw: string | null | undefined,
  window: { entityId: string | null; dateStart: string; previousEnd: string | null; nextEnd: string | null },
): string {
  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const fromKey = periodDedupeKey({
    entityId: window.entityId,
    dateStart: window.dateStart,
    dateEnd: window.previousEnd,
  } as NetworkSubscriptionPeriod);
  const target = history.find((p) => periodDedupeKey(p) === fromKey && p.amountPaid?.trim());
  if (!target || sliceYmd(window.previousEnd) === sliceYmd(window.nextEnd)) {
    return adminSettingsRaw?.trim() || '{}';
  }
  return mergeNetworkSubscriptionHistory(
    adminSettingsRaw,
    history.map((p) => (p === target ? { ...p, dateEnd: sliceYmd(window.nextEnd) || null } : p)),
  );
}

/** Amount recorded for one membership window ('' when none). */
export function readMembershipPeriodAmountPaid(
  adminSettingsRaw: string | null | undefined,
  window: { entityId: string | null; dateStart: string; dateEnd: string | null },
): string {
  const key = periodDedupeKey(window as NetworkSubscriptionPeriod);
  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const exact = history.find((p) => periodDedupeKey(p) === key);
  if (exact || window.entityId) return exact?.amountPaid ?? '';
  // The account window is shared with the primary club, whose rows carry the club id.
  return (
    history.find(
      (p) =>
        sliceYmd(p.dateStart) === sliceYmd(window.dateStart) &&
        sliceYmd(p.dateEnd) === sliceYmd(window.dateEnd) &&
        p.amountPaid?.trim(),
    )?.amountPaid ?? ''
  );
}

export function readNetworkSubscriptionHistory(
  adminSettingsRaw: string | null | undefined,
): NetworkSubscriptionPeriod[] {
  const adminSettings = parseAdminSettingsJson(adminSettingsRaw);
  const block = adminSettings[HISTORY_KEY];
  if (!block || typeof block !== 'object') return [];
  const periods = (block as { periods?: unknown }).periods;
  if (!Array.isArray(periods)) return [];
  const parsed = periods
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map((p, index) => ({
      id: String(p.id ?? `hist-${index}`),
      dateStart: String(p.dateStart ?? '').slice(0, 10),
      dateEnd: p.dateEnd != null && String(p.dateEnd).trim() ? String(p.dateEnd).slice(0, 10) : null,
      version: typeof p.version === 'string' ? p.version : undefined,
      entityId: typeof p.entityId === 'string' ? p.entityId : null,
      companyName: typeof p.companyName === 'string' ? p.companyName : undefined,
      username: typeof p.username === 'string' ? p.username : undefined,
      status: typeof p.status === 'string' ? p.status : undefined,
      archivedAt: typeof p.archivedAt === 'string' ? p.archivedAt : undefined,
      paymentMethod: typeof p.paymentMethod === 'string' ? p.paymentMethod : undefined,
      amountPaid: typeof p.amountPaid === 'string' ? p.amountPaid : undefined,
      amountLocal: typeof p.amountLocal === 'string' ? p.amountLocal : undefined,
      discountPercent: typeof p.discountPercent === 'string' ? p.discountPercent : undefined,
      purchasedByClubId:
        typeof p.purchasedByClubId === 'string' && p.purchasedByClubId.trim()
          ? p.purchasedByClubId
          : undefined,
    }))
    .filter((p) => Boolean(p.dateStart));
  return dedupeSubscriptionPeriods(parsed);
}

export function mergeNetworkSubscriptionHistory(
  adminSettingsRaw: string | null | undefined,
  periods: NetworkSubscriptionPeriod[],
): string {
  const adminSettings = parseAdminSettingsJson(adminSettingsRaw);
  return JSON.stringify({
    ...adminSettings,
    [HISTORY_KEY]: {
      periods: dedupeSubscriptionPeriods(periods),
      updatedAt: new Date().toISOString(),
    },
  });
}

/** Archive the previous access window when admin changes subscription start date. */
export function appendArchivedPeriodIfChanged(
  adminSettingsRaw: string | null | undefined,
  previous: { accessStartIso: string; accessEndIso: string },
  next: { accessStartIso: string; accessEndIso: string },
  meta?: Pick<NetworkSubscriptionPeriod, 'version' | 'entityId' | 'companyName' | 'username'>,
): string {
  const prevStart = previous.accessStartIso.trim().slice(0, 10);
  const prevEnd = previous.accessEndIso.trim().slice(0, 10) || null;
  const nextStart = next.accessStartIso.trim().slice(0, 10);
  const nextEnd = next.accessEndIso.trim().slice(0, 10) || null;
  if (!prevStart || prevStart === nextStart) {
    return adminSettingsRaw?.trim() || '{}';
  }

  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const archived: NetworkSubscriptionPeriod = {
    id: `archived-${Date.now()}`,
    dateStart: prevStart,
    dateEnd: prevEnd,
    version: meta?.version,
    entityId: meta?.entityId ?? null,
    companyName: meta?.companyName,
    username: meta?.username,
    status: periodDisplayStatus(prevEnd),
    archivedAt: new Date().toISOString(),
  };
  const samePeriod = (p: NetworkSubscriptionPeriod) =>
    p.dateStart === archived.dateStart &&
    (p.dateEnd ?? '') === (archived.dateEnd ?? '') &&
    (p.entityId ?? null) === (archived.entityId ?? null);

  if (history.some(samePeriod)) {
    return adminSettingsRaw?.trim() || '{}';
  }

  const deduped = history.filter((p) => !samePeriod(p));
  return mergeNetworkSubscriptionHistory(adminSettingsRaw, [...deduped, archived]);
}

function rowUsesPcuAccessDates(
  row: RegisteredUserListRow,
  pcuAccess?: PcuAccessWindow | null,
): boolean {
  if (!sliceYmd(pcuAccess?.accessStartIso)) return false;
  if (!row.entityId) return true;
  if (row.primaryClubId && row.entityId === row.primaryClubId) return true;
  return false;
}

function rowToPeriod(
  row: RegisteredUserListRow,
  pcuAccess?: PcuAccessWindow | null,
): NetworkSubscriptionPeriod {
  const usePcu = rowUsesPcuAccessDates(row, pcuAccess);
  const dateStart = usePcu ? sliceYmd(pcuAccess!.accessStartIso) : row.dateStart;
  const dateEnd = usePcu
    ? sliceYmd(pcuAccess!.accessEndIso) || null
    : row.dateEnd;
  return {
    id: `current-${row.rowKey}`,
    dateStart,
    dateEnd,
    version: row.version,
    entityId: row.entityId ?? null,
    companyName: row.companyName,
    username: row.username,
    status: periodDisplayStatus(dateEnd),
  };
}

export function readDeletedSubscriptionPeriods(
  adminSettingsRaw: string | null | undefined,
): SubscriptionPeriodDeletion[] {
  const adminSettings = parseAdminSettingsJson(adminSettingsRaw);
  const arr = adminSettings[DELETED_SUBSCRIPTIONS_KEY];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map((p) => ({
      periodId: String(p.periodId ?? '').trim(),
      entityId:
        p.entityId === null || p.entityId === undefined
          ? undefined
          : String(p.entityId).trim() || null,
      dateStart: typeof p.dateStart === 'string' ? p.dateStart.trim() : undefined,
      dateEnd:
        p.dateEnd === null
          ? null
          : typeof p.dateEnd === 'string'
            ? p.dateEnd.trim() || null
            : undefined,
    }))
    .filter((p) => Boolean(p.periodId));
}

function deletionRecordKey(del: SubscriptionPeriodDeletion): string {
  return [
    del.periodId,
    del.entityId ?? '',
    del.dateStart ?? '',
    del.dateEnd ?? '',
  ].join('|');
}

function mergeDeletedSubscriptionPeriods(
  adminSettingsRaw: string | null | undefined,
  deletions: SubscriptionPeriodDeletion[],
): string {
  const adminSettings = parseAdminSettingsJson(adminSettingsRaw);
  const existing = readDeletedSubscriptionPeriods(adminSettingsRaw);
  const seen = new Set(existing.map(deletionRecordKey));
  const merged = [...existing];
  for (const del of deletions) {
    const key = deletionRecordKey(del);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(del);
  }
  return JSON.stringify({
    ...adminSettings,
    [DELETED_SUBSCRIPTIONS_KEY]: merged,
  });
}

export function isSubscriptionPeriodDeleted(
  period: NetworkSubscriptionPeriod,
  deletions: SubscriptionPeriodDeletion[],
  rowKey?: string,
): boolean {
  if (deletions.length === 0) return false;
  return deletions.some((del) => {
    if (periodMatchesDeletion(period, del)) return true;
    if (rowKey && del.periodId === `current-${rowKey}` && period.id === `current-${rowKey}`) {
      return true;
    }
    if (
      del.dateStart &&
      period.dateStart === del.dateStart.slice(0, 10) &&
      (period.dateEnd ?? '') === (del.dateEnd?.trim().slice(0, 10) ?? '') &&
      (del.entityId === undefined || (period.entityId ?? null) === (del.entityId ?? null))
    ) {
      return (
        del.periodId === period.id ||
        del.periodId.startsWith('current-') ||
        del.periodId.startsWith('account-')
      );
    }
    return false;
  });
}

/** Historical + live membership periods for one owned entity (admin list / profile). */
export function periodsForRow(
  row: RegisteredUserListRow,
  userHistory: NetworkSubscriptionPeriod[],
  deleted: SubscriptionPeriodDeletion[] = [],
  pcuAccess?: PcuAccessWindow | null,
): NetworkSubscriptionPeriod[] {
  const entityId = row.entityId ?? null;
  const matching = userHistory.filter((p) => {
    const pEntity = p.entityId ?? null;
    return entityId ? pEntity === entityId : !pEntity;
  });

  const live = rowToPeriod(row, pcuAccess);
  const sameAsCurrent = (p: NetworkSubscriptionPeriod) =>
    p.dateStart === live.dateStart && (p.dateEnd ?? '') === (live.dateEnd ?? '');
  const stored = matching.find(sameAsCurrent);
  const current: NetworkSubscriptionPeriod = stored
    ? {
        ...live,
        paymentMethod: stored.paymentMethod,
        amountPaid: stored.amountPaid,
        amountLocal: stored.amountLocal,
      }
    : live;

  const merged = [...matching.filter((p) => !sameAsCurrent(p)), current].filter(
    (p) => !isSubscriptionPeriodDeleted(p, deleted, row.rowKey),
  );
  const sorted = merged.sort((a, b) => parseYmdMs(a.dateStart) - parseYmdMs(b.dateStart));
  return withResolvedMembershipStatuses(sorted, pcuAccess);
}

/** Same membership window as the admin grid / list (history + PCU access + entity description). */
export function resolveMembershipDatesForEntity(args: {
  userId: string;
  entityId: string | null;
  adminSettingsRaw?: string | null;
  entityDescription: string | null;
  entityCreatedAt: Date;
  companyName?: string;
  username?: string;
  version?: string;
}): { dateStart: string; dateEnd: string | null } {
  const descriptionStart =
    parseClubSubscriptionStartDate(args.entityDescription, args.entityCreatedAt) ||
    args.entityCreatedAt.toISOString().slice(0, 10);
  const parsedEnd = parseClubSubscriptionEndDate(args.entityDescription, args.entityCreatedAt);
  const descriptionEnd = inferMembershipEndDateYmd(
    descriptionStart,
    parsedEnd?.toISOString().slice(0, 10) ?? null,
  );

  const entityPart = args.entityId?.trim() || 'account';
  const row: RegisteredUserListRow = {
    rowKey: `${args.userId}-${entityPart}`,
    id: args.userId,
    username: args.username ?? '',
    email: '',
    displayName: '',
    userType: '',
    country: null,
    location: null,
    dateStart: descriptionStart,
    dateEnd: descriptionEnd,
    version: args.version ?? '',
    amount: '—',
    status: 'Active',
    entityId: args.entityId,
    primaryClubId: args.entityId,
    companyName: args.companyName,
  };

  const pcu = readPcuAccessSettings(args.adminSettingsRaw, {
    accessStartIso: '',
    accessEndIso: '',
  });
  const pcuAccess =
    pcu.accessStartIso.trim() && pcu.accessEndIso.trim()
      ? { accessStartIso: pcu.accessStartIso, accessEndIso: pcu.accessEndIso }
      : undefined;

  const periods = periodsForRow(
    row,
    readNetworkSubscriptionHistory(args.adminSettingsRaw),
    readDeletedSubscriptionPeriods(args.adminSettingsRaw),
    pcuAccess,
  );

  if (periods.length === 0) {
    return { dateStart: descriptionStart, dateEnd: descriptionEnd };
  }

  const latest = [...periods].sort((a, b) => parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart))[0]!;
  return {
    dateStart: latest.dateStart,
    dateEnd: inferMembershipEndDateYmd(latest.dateStart, latest.dateEnd),
  };
}

export type PcuDisplayMembershipDates = {
  dateStart: string;
  dateEnd: string | null;
  /** True when a not-yet-active (renewed) membership exists alongside the displayed period. */
  alreadyRenewed: boolean;
};

/** PCU top / modal display dates — last active or expired membership, never not-yet-active. */
export function resolvePcuDisplayMembershipDatesForEntity(args: {
  userId: string;
  entityId: string | null;
  adminSettingsRaw?: string | null;
  entityDescription: string | null;
  entityCreatedAt: Date;
  companyName?: string;
  username?: string;
  version?: string;
}): PcuDisplayMembershipDates {
  const descriptionStart =
    parseClubSubscriptionStartDate(args.entityDescription, args.entityCreatedAt) ||
    args.entityCreatedAt.toISOString().slice(0, 10);
  const parsedEnd = parseClubSubscriptionEndDate(args.entityDescription, args.entityCreatedAt);
  const descriptionEnd = inferMembershipEndDateYmd(
    descriptionStart,
    parsedEnd?.toISOString().slice(0, 10) ?? null,
  );

  const entityPart = args.entityId?.trim() || 'account';
  const row: RegisteredUserListRow = {
    rowKey: `${args.userId}-${entityPart}`,
    id: args.userId,
    username: args.username ?? '',
    email: '',
    displayName: '',
    userType: '',
    country: null,
    location: null,
    dateStart: descriptionStart,
    dateEnd: descriptionEnd,
    version: args.version ?? '',
    amount: '—',
    status: 'Active',
    entityId: args.entityId,
    primaryClubId: args.entityId,
    companyName: args.companyName,
  };

  const pcu = readPcuAccessSettings(args.adminSettingsRaw, {
    accessStartIso: '',
    accessEndIso: '',
  });
  const pcuAccess =
    pcu.accessStartIso.trim() && pcu.accessEndIso.trim()
      ? { accessStartIso: pcu.accessStartIso, accessEndIso: pcu.accessEndIso }
      : undefined;

  const periods = periodsForRow(
    row,
    readNetworkSubscriptionHistory(args.adminSettingsRaw),
    readDeletedSubscriptionPeriods(args.adminSettingsRaw),
    pcuAccess,
  );

  const pcuStart = pcu.accessStartIso.trim().slice(0, 10);
  const pcuEnd = pcu.accessEndIso.trim().slice(0, 10);
  const pcuPeriodEligible =
    pcuStart &&
    pcuEnd &&
    !isNotYetActiveMembershipPeriod({ dateStart: pcuStart, dateEnd: pcuEnd });
  const periodsForDisplay =
    pcuPeriodEligible && pcuAccess
      ? [
          ...periods,
          {
            id: `pcu-access-${args.entityId ?? 'account'}`,
            dateStart: pcuStart,
            dateEnd: pcuEnd,
            entityId: args.entityId ?? null,
            version: args.version,
            companyName: args.companyName,
            username: args.username,
          },
        ]
      : periods;

  const livePeriod = { dateStart: descriptionStart, dateEnd: descriptionEnd };
  const alreadyRenewed =
    periods.some((p) => isNotYetActiveMembershipPeriod(p)) ||
    isNotYetActiveMembershipPeriod(livePeriod);
  const liveIsPending = isNotYetActiveMembershipPeriod(livePeriod);

  const display = pickPcuDisplayMembershipPeriod(periodsForDisplay);
  if (display) {
    return {
      dateStart: display.dateStart,
      dateEnd: inferMembershipEndDateYmd(display.dateStart, display.dateEnd),
      alreadyRenewed,
    };
  }

  if (!liveIsPending) {
    return {
      dateStart: descriptionStart,
      dateEnd: descriptionEnd,
      alreadyRenewed,
    };
  }

  return {
    dateStart: '',
    dateEnd: null,
    alreadyRenewed: true,
  };
}

function periodToListRow(
  row: RegisteredUserListRow,
  period: NetworkSubscriptionPeriod,
): RegisteredUserListRow {
  const status = periodStatusFromDates(period);
  return {
    ...row,
    rowKey: `${row.rowKey}-period-${period.id}`,
    entityId: row.entityId ?? period.entityId ?? null,
    entityKind: row.entityKind,
    dateStart: period.dateStart,
    dateEnd: inferMembershipEndDateYmd(period.dateStart, period.dateEnd),
    version: period.version?.trim() || row.version,
    companyName: period.companyName?.trim() || row.companyName,
    username: period.username?.trim() || row.username,
    amount: formatMembershipAmount(period) ?? row.amount,
    status,
    statusTone: membershipStatusToneFromLabel(status),
  };
}

/** Admin list "amount" cell: "€ 42 (3,818 ALL)", "Test", "Free", "Unpaid"; null when nothing recorded. */
export function formatMembershipAmount(
  period: Pick<NetworkSubscriptionPeriod, 'paymentMethod' | 'amountPaid' | 'amountLocal'>,
): string | null {
  const method = period.paymentMethod?.trim().toLowerCase();
  if (method === 'test') return 'Test';
  if (method === 'free') return 'Free';
  if (method === 'pending') return 'Unpaid';
  const raw = period.amountPaid?.trim();
  if (!raw) return null;
  const euros = parseAmountPaid(raw);
  if (euros <= 0) return raw === '0' ? '€ 0' : raw;
  const eur = `€ ${Number.isInteger(euros) ? euros : euros.toFixed(2)}`;
  return period.amountLocal?.trim() ? `${eur} (${period.amountLocal.trim()})` : eur;
}

/** The chronologically last membership period (latest start date). */
export function pickLatestMembershipRow(
  rows: RegisteredUserListRow[],
): RegisteredUserListRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const startDiff = parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart);
    if (startDiff !== 0) return startDiff;
    return parseYmdMs(b.dateEnd) - parseYmdMs(a.dateEnd);
  })[0]!;
}

/** Latest membership row per owned entity (club/team/group). */
export function pickLatestMembershipRowPerEntity(
  rows: RegisteredUserListRow[],
): RegisteredUserListRow[] {
  const byEntity = new Map<string, RegisteredUserListRow[]>();
  for (const row of rows) {
    const key = membershipEntityGroupKey(row);
    const list = byEntity.get(key) ?? [];
    list.push(row);
    byEntity.set(key, list);
  }
  return Array.from(byEntity.values())
    .map((group) => pickLatestMembershipRow(group))
    .filter((r): r is RegisteredUserListRow => r != null);
}

function isMembershipStartedInLast30Days(dateStart: string): boolean {
  const startMs = parseYmdMs(dateStart);
  if (!startMs) return false;
  return startMs >= Date.now() - THIRTY_DAYS_MS;
}

export function getDefaultMembershipSortOrder(mode: MembershipViewMode): MembershipListSortOrder {
  switch (mode) {
    case 'lastPerUser':
      return 'fullname';
    case 'current':
      return 'date_end_asc';
    case 'last':
    case 'all':
    default:
      return 'date_start_desc';
  }
}

export function sortMembershipListRows(
  rows: RegisteredUserListRow[],
  order: string | null | undefined,
  mode?: MembershipViewMode,
): RegisteredUserListRow[] {
  const resolved =
    (order ?? '').trim() || (mode ? getDefaultMembershipSortOrder(mode) : 'date_start_desc');
  const sorted = [...rows];

  switch (resolved) {
    case 'fullname':
      sorted.sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || '', undefined, {
          sensitivity: 'base',
        }),
      );
      break;
    case 'date_end_asc':
    case 'date_end':
      sorted.sort((a, b) => {
        const ae = a.dateEnd?.trim() ? parseYmdMs(a.dateEnd) : Number.MAX_SAFE_INTEGER;
        const be = b.dateEnd?.trim() ? parseYmdMs(b.dateEnd) : Number.MAX_SAFE_INTEGER;
        return ae - be;
      });
      break;
    case 'username':
      sorted.sort((a, b) =>
        (a.accountUsername ?? a.username).localeCompare(
          b.accountUsername ?? b.username,
          undefined,
          { sensitivity: 'base' },
        ),
      );
      break;
    case 'date':
    case 'date_start_desc':
    default:
      sorted.sort((a, b) => parseYmdMs(b.dateStart) - parseYmdMs(a.dateStart));
      break;
  }

  return sorted;
}

/** Expand each list row into one row per stored + current membership period. */
export function expandListRowsWithMembershipPeriods(
  rows: RegisteredUserListRow[],
  historyByUserId: Map<string, NetworkSubscriptionPeriod[]>,
  deletedByUserId?: Map<string, SubscriptionPeriodDeletion[]>,
  pcuAccessByUserId?: Map<string, PcuAccessWindow>,
): RegisteredUserListRow[] {
  return rows.flatMap((row) => {
    const deleted = deletedByUserId?.get(row.id) ?? [];
    const periods = periodsForRow(
      row,
      historyByUserId.get(row.id) ?? [],
      deleted,
      pcuAccessByUserId?.get(row.id),
    );
    if (periods.length === 0) return [];
    if (periods.length <= 1) {
      const only = periods[0];
      return only ? [periodToListRow(row, only)] : [];
    }
    return periods.map((p) => periodToListRow(row, p));
  });
}

/** Stable key: one membership stream per user + owned entity (club/team/group). */
export function membershipEntityGroupKey(row: RegisteredUserListRow): string {
  const entityPart = row.entityId?.trim() || 'account';
  return `${row.id}:${entityPart}`;
}

/**
 * Apply admin membership toolbar mode (same rules for every segment).
 *
 * - **all**: every membership period (user may appear multiple times).
 * - **current**: only non-expired, currently valid memberships.
 * - **last**: memberships whose start date falls within the last 30 days.
 * - **lastPerUser**: latest renewal per owned entity (each club/team/group separately).
 */
export function applyMembershipView(
  rows: RegisteredUserListRow[],
  mode: MembershipViewMode,
): RegisteredUserListRow[] {
  if (rows.length === 0) return rows;

  if (mode === 'current') {
    return rows.filter((r) => isActiveMembershipPeriod(r.dateStart, r.dateEnd));
  }

  if (mode === 'last') {
    return rows.filter((r) => isMembershipStartedInLast30Days(r.dateStart));
  }

  if (mode === 'lastPerUser') {
    const byEntity = new Map<string, RegisteredUserListRow[]>();
    for (const row of rows) {
      const key = membershipEntityGroupKey(row);
      const list = byEntity.get(key) ?? [];
      list.push(row);
      byEntity.set(key, list);
    }
    return Array.from(byEntity.values())
      .map((group) => pickLatestMembershipRow(group))
      .filter((r): r is RegisteredUserListRow => r != null);
  }

  return rows;
}

export function buildMembershipListRows(
  rows: RegisteredUserListRow[],
  historyByUserId: Map<string, NetworkSubscriptionPeriod[]>,
  mode: MembershipViewMode,
  sortOrder?: string | null,
  deletedByUserId?: Map<string, SubscriptionPeriodDeletion[]>,
  pcuAccessByUserId?: Map<string, PcuAccessWindow>,
): RegisteredUserListRow[] {
  const withPeriods = expandListRowsWithMembershipPeriods(
    rows,
    historyByUserId,
    deletedByUserId,
    pcuAccessByUserId,
  );
  const filtered = mode === 'all' ? withPeriods : applyMembershipView(withPeriods, mode);
  return sortMembershipListRows(filtered, sortOrder, mode);
}

export type SubscriptionDateField = 'dateStart' | 'dateEnd';

export function parseSubscriptionDateField(
  raw: string | null | undefined,
): SubscriptionDateField {
  return raw?.trim() === 'dateEnd' ? 'dateEnd' : 'dateStart';
}

/** Filter list rows by Date Start or Date End within an inclusive YYYY-MM-DD range. */
export function filterListRowsBySubscriptionDateRange(
  rows: RegisteredUserListRow[],
  field: SubscriptionDateField,
  from: string,
  to: string,
): RegisteredUserListRow[] {
  if (!from.trim() && !to.trim()) return rows;
  const fromMs = from.trim() ? parseYmdMs(from.trim()) : 0;
  const toMs = to.trim() ? parseYmdMs(to.trim()) : 0;
  const fromBound = fromMs || null;
  const toBound = toMs || null;

  return rows.filter((row) => {
    const raw = field === 'dateStart' ? row.dateStart : row.dateEnd;
    const valMs = parseYmdMs(raw ?? '');
    if (!valMs) return false;
    if (fromBound && valMs < fromBound) return false;
    if (toBound && valMs > toBound) return false;
    return true;
  });
}

export type SubscriptionPeriodDeletion = {
  periodId: string;
  entityId?: string | null;
  dateStart?: string;
  dateEnd?: string | null;
};

function periodMatchesDeletion(
  period: NetworkSubscriptionPeriod,
  del: SubscriptionPeriodDeletion,
): boolean {
  if (period.id !== del.periodId) return false;
  if (del.entityId === undefined) return true;
  return (period.entityId ?? null) === (del.entityId ?? null);
}

function deletionTouchesCurrentAccess(
  del: SubscriptionPeriodDeletion,
  accessStartIso: string,
  accessEndIso: string,
): boolean {
  if (del.periodId.startsWith('account-') || del.periodId.startsWith('current-')) {
    return true;
  }
  const start = del.dateStart?.trim().slice(0, 10);
  if (!start) return false;
  const accessStart = accessStartIso.trim().slice(0, 10);
  const accessEnd = accessEndIso.trim().slice(0, 10) || null;
  const delEnd = del.dateEnd?.trim().slice(0, 10) || null;
  return start === accessStart && delEnd === accessEnd;
}

/** Remove selected subscription periods from admin settings (history + current access when needed). */
export function applySubscriptionPeriodDeletions(
  adminSettingsRaw: string | null | undefined,
  deletions: SubscriptionPeriodDeletion[],
  defaults?: { accessStartIso: string; accessEndIso: string },
): string {
  if (deletions.length === 0) return adminSettingsRaw?.trim() || '{}';

  const history = readNetworkSubscriptionHistory(adminSettingsRaw);
  const nextHistory = history.filter(
    (p) => !deletions.some((del) => periodMatchesDeletion(p, del)),
  );
  let next = mergeNetworkSubscriptionHistory(adminSettingsRaw, nextHistory);

  const pcu = readPcuAccessSettings(next, defaults ?? { accessStartIso: '', accessEndIso: '' });
  const clearAccess = deletions.some((del) =>
    deletionTouchesCurrentAccess(del, pcu.accessStartIso, pcu.accessEndIso),
  );
  if (clearAccess) {
    next = mergePcuAccessIntoAdminSettings(next, {
      accessStartIso: '',
      accessEndIso: '',
      suspend: true,
    });
  }

  return mergeDeletedSubscriptionPeriods(next, deletions);
}

export function parseMembershipViewMode(raw: string | null | undefined): MembershipViewMode {
  switch ((raw ?? '').trim()) {
    case 'current':
      return 'current';
    case 'last':
      return 'last';
    case 'lastPerUser':
      return 'lastPerUser';
    case 'all':
    default:
      return 'all';
  }
}
