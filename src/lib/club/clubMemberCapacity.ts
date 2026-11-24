import {
  getMemberDatabaseAllowance,
  isMemberDatabaseUnlimited,
} from '@/lib/admin/subscriptionManageableUsers';
import { parseClubSubscriptionEndDate } from '@/lib/admin/clubSubscriptionStatus';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';

export type ClubMemberCapacityPhase = 'first' | 'renewal';

export type ClubMemberCapacityStats = {
  currentMembers: number;
  membersAdded: number;
  membersPurchasedBase: number;
  subscriptionAllowance: number;
  membersPurchased: number;
  availableSlots: number | null;
  unlimited: boolean;
  subscriptionPhase: ClubMemberCapacityPhase;
  subscriptionExpirationLabel: string | null;
  subscriptionEndDateIso: string | null;
  usersAllowanceFirst: number;
  usersAllowanceRenewal: number;
  canInsertMember: boolean;
};

function formatExpirationLabel(endDate: Date | null): string | null {
  if (!endDate || Number.isNaN(endDate.getTime())) return null;
  return endDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function resolveClubMemberCapacityPhase(meta: {
  subscriptionRenewalCount?: number;
}): ClubMemberCapacityPhase {
  return (meta.subscriptionRenewalCount ?? 0) > 0 ? 'renewal' : 'first';
}

export function computeClubMemberCapacity(params: {
  membersAdded: number;
  membersPurchasedBase: number;
  subscriptionSettingId: number | null;
  subscriptionPhase: ClubMemberCapacityPhase;
  subscriptionEndDate: Date | null;
  usersAllowanceFirst?: number | null;
  usersAllowanceRenewal?: number | null;
}): ClubMemberCapacityStats {
  const usersAllowanceFirst =
    params.usersAllowanceFirst ??
    getMemberDatabaseAllowance(params.subscriptionSettingId, 'first') ??
    0;
  const usersAllowanceRenewal =
    params.usersAllowanceRenewal ??
    getMemberDatabaseAllowance(params.subscriptionSettingId, 'renewal') ??
    0;

  const subscriptionAllowance =
    params.subscriptionPhase === 'renewal' ? usersAllowanceRenewal : usersAllowanceFirst;

  const unlimited = isMemberDatabaseUnlimited(subscriptionAllowance);
  const membersPurchased = unlimited
    ? params.membersPurchasedBase
    : params.membersPurchasedBase + Math.max(0, subscriptionAllowance);

  const availableSlots = unlimited
    ? null
    : Math.max(0, membersPurchased - params.membersAdded);

  return {
    currentMembers: params.membersAdded,
    membersAdded: params.membersAdded,
    membersPurchasedBase: params.membersPurchasedBase,
    subscriptionAllowance,
    membersPurchased,
    availableSlots,
    unlimited,
    subscriptionPhase: params.subscriptionPhase,
    subscriptionExpirationLabel: formatExpirationLabel(params.subscriptionEndDate),
    subscriptionEndDateIso:
      params.subscriptionEndDate && !Number.isNaN(params.subscriptionEndDate.getTime())
        ? params.subscriptionEndDate.toISOString().slice(0, 10)
        : null,
    usersAllowanceFirst,
    usersAllowanceRenewal,
    canInsertMember: unlimited || (availableSlots ?? 0) > 0,
  };
}

export function computeClubMemberCapacityFromClub(params: {
  description: string | null | undefined;
  createdAt?: Date | string | null;
  membersAdded: number;
  subscriptionSettingId: number | null;
}): ClubMemberCapacityStats {
  const meta = parseClubDescriptionMeta(params.description);
  const subscriptionPhase = resolveClubMemberCapacityPhase(meta);
  const subscriptionEndDate = parseClubSubscriptionEndDate(params.description, params.createdAt);

  return computeClubMemberCapacity({
    membersAdded: params.membersAdded,
    membersPurchasedBase: meta.membersPurchasedBase ?? 0,
    subscriptionSettingId: params.subscriptionSettingId,
    subscriptionPhase,
    subscriptionEndDate,
  });
}
