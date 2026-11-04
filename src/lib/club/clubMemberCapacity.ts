import {
  getMemberDatabaseAllowance,
  isMemberDatabaseUnlimited,
} from '@/lib/admin/subscriptionManageableUsers';
import { parseClubSubscriptionEndDate } from '@/lib/admin/clubSubscriptionStatus';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import {
  computeMemberRenameQuota,
  readMemberRenamesQuotaA,
  readMemberRenamesUsed,
  renameQuotaFromSlotCount,
  type MemberRenameQuotaStats,
} from '@/lib/club/clubMemberRenameQuota';

export type ClubMemberCapacityPhase = 'first' | 'renewal';

export type ClubMemberCapacityStats = {
  /** Live roster size — decreases when a member is removed. */
  currentMembers: number;
  /** Progressive adds — increases on add only; never on remove/archive. */
  membersAdded: number;
  membersPurchasedBase: number;
  subscriptionAllowance: number;
  /** Total available slots (UI label). */
  membersPurchased: number;
  /** Residual slots = total available − members added (null when unlimited). */
  availableSlots: number | null;
  unlimited: boolean;
  subscriptionPhase: ClubMemberCapacityPhase;
  subscriptionExpirationLabel: string | null;
  subscriptionEndDateIso: string | null;
  usersAllowanceFirst: number;
  usersAllowanceRenewal: number;
  canInsertMember: boolean;
  /** Member name/surname rename allowance (stored A − B). */
  renameQuota: MemberRenameQuotaStats;
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
  /** Live roster size (decreases on remove). */
  currentMembers: number;
  /** Progressive adds counter (never decreases on remove). */
  membersAdded: number;
  membersPurchasedBase: number;
  subscriptionSettingId: number | null;
  subscriptionPhase: ClubMemberCapacityPhase;
  subscriptionEndDate: Date | null;
  usersAllowanceFirst?: number | null;
  usersAllowanceRenewal?: number | null;
  /** B — renames already performed. */
  renamesUsed?: number;
  /**
   * A — stored rename allowance. When omitted, bootstraps as floor(10% × total).
   * After slot purchases, A is persisted and must be passed explicitly.
   */
  renameQuotaA?: number;
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
  /** Total available slots (subscription allowance + purchased packs). */
  const membersPurchased = unlimited
    ? params.membersPurchasedBase
    : params.membersPurchasedBase + Math.max(0, subscriptionAllowance);

  /** Residual slots = total available − members already added. */
  const availableSlots = unlimited
    ? null
    : Math.max(0, membersPurchased - params.membersAdded);

  const renameQuota = computeMemberRenameQuota({
    quotaA: unlimited
      ? null
      : params.renameQuotaA !== undefined
        ? params.renameQuotaA
        : renameQuotaFromSlotCount(membersPurchased),
    renamesUsed: params.renamesUsed ?? 0,
  });

  return {
    currentMembers: Math.max(0, params.currentMembers),
    membersAdded: Math.max(0, params.membersAdded),
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
    renameQuota,
  };
}

export function computeClubMemberCapacityFromClub(params: {
  description: string | null | undefined;
  createdAt?: Date | string | null;
  currentMembers: number;
  membersAdded: number;
  subscriptionSettingId: number | null;
}): ClubMemberCapacityStats {
  const meta = parseClubDescriptionMeta(params.description);
  const subscriptionPhase = resolveClubMemberCapacityPhase(meta);
  const subscriptionEndDate = parseClubSubscriptionEndDate(params.description, params.createdAt);
  const storedA = readMemberRenamesQuotaA(meta);

  return computeClubMemberCapacity({
    currentMembers: params.currentMembers,
    membersAdded: params.membersAdded,
    membersPurchasedBase: meta.membersPurchasedBase ?? 0,
    subscriptionSettingId: params.subscriptionSettingId,
    subscriptionPhase,
    subscriptionEndDate,
    renamesUsed: readMemberRenamesUsed(meta),
    ...(storedA !== undefined ? { renameQuotaA: storedA } : {}),
  });
}
