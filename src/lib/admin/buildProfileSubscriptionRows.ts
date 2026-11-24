import { inferMembershipEndDateYmd } from '@/lib/admin/clubSubscriptionStatus';
import type { RegisteredUserListRow } from '@/lib/admin/expandRegisteredUserListRows';
import {
  isSubscriptionPeriodDeleted,
  periodStatusFromDates,
  periodsForRow,
  readDeletedSubscriptionPeriods,
  readNetworkSubscriptionHistory,
  type NetworkSubscriptionPeriod,
  type PcuAccessWindow,
} from '@/lib/admin/networkSubscriptionHistory';

export type ProfileSubscriptionRow = {
  id: string;
  dateStart: string;
  dateEnd: string | null;
  version: string;
  username: string;
  companyName: string;
  e: string;
  status: string;
};

function resolveProfileRowDateEnd(
  period: NetworkSubscriptionPeriod,
  isCurrent: boolean,
): string | null {
  if (isCurrent) {
    return inferMembershipEndDateYmd(period.dateStart, period.dateEnd);
  }
  if (period.dateEnd?.trim()) {
    return period.dateEnd.trim().slice(0, 10);
  }
  return inferMembershipEndDateYmd(period.dateStart, null);
}

function periodToProfileRow(
  period: NetworkSubscriptionPeriod,
  defaults: { username: string; companyName: string; e: string },
  isCurrent: boolean,
): ProfileSubscriptionRow {
  return {
    id: period.id,
    dateStart: period.dateStart,
    dateEnd: resolveProfileRowDateEnd(period, isCurrent),
    version: period.version?.trim() || '—',
    username: period.username?.trim() || defaults.username,
    companyName: period.companyName?.trim() || defaults.companyName,
    e: defaults.e,
    status: periodStatusFromDates(period),
  };
}

/** Historical + current Movesbook network memberships for the profile table. */
export function buildProfileSubscriptionRows(
  adminSettingsRaw: string | null | undefined,
  current: {
    id: string;
    userId?: string;
    dateStart: string;
    dateEnd: string | null;
    version: string;
    username: string;
    companyName: string;
    e: string;
    entityId?: string | null;
  },
  pcuAccess?: PcuAccessWindow | null,
): ProfileSubscriptionRow[] {
  const userId = current.userId ?? current.id.replace(/^account-/, '');
  const entityId = current.entityId ?? null;
  const entityPart = entityId?.trim() || 'account';
  const rowKey = `${userId}-${entityPart}`;

  const row: RegisteredUserListRow = {
    rowKey,
    id: userId,
    username: current.username,
    email: '',
    displayName: '',
    userType: '',
    country: null,
    location: null,
    dateStart: current.dateStart,
    dateEnd: current.dateEnd,
    version: current.version,
    amount: '—',
    status: 'Active',
    entityId,
    primaryClubId: entityId,
    companyName: current.companyName,
  };

  const deleted = readDeletedSubscriptionPeriods(adminSettingsRaw);
  const periods = periodsForRow(
    row,
    readNetworkSubscriptionHistory(adminSettingsRaw),
    deleted,
    pcuAccess ?? undefined,
  ).filter((p) => !isSubscriptionPeriodDeleted(p, deleted, rowKey));

  const defaults = {
    username: current.username,
    companyName: current.companyName,
    e: current.e,
  };

  return periods
    .map((period) => {
      const isLiveCurrent = period.id.startsWith('current-');
      const resolved = isLiveCurrent
        ? {
            ...period,
            dateStart: current.dateStart,
            dateEnd: current.dateEnd,
            version: current.version,
            username: current.username,
            companyName: current.companyName,
          }
        : period;
      return periodToProfileRow(resolved, defaults, isLiveCurrent);
    })
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());
}
