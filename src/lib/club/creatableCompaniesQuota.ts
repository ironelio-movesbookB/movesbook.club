import { prisma } from '@/lib/prisma';
import { isClubCreatedFromForm } from '@/lib/club/clubSidebarLabel';
import {
  canCreateAnotherCompany,
  isCreatableCompaniesUnlimited,
  remainingCreatableCompanies,
} from '@/lib/admin/subscriptionManageableUsers';
import { hasCreatableCompaniesSetting } from '@/lib/admin/subscriptionEditSettingsLayout';
import {
  getUserVersionSettings,
  subscriptionUserTypeForUser,
} from '@/lib/admin/versionSettingsStore';
import type { CreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota.shared';

export type { CreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota.shared';
export { formatCreatableCompaniesSidebarLabel } from '@/lib/club/creatableCompaniesQuota.shared';

async function countFormCreated(
  rows: Promise<{ description: string | null }[]>,
): Promise<number> {
  return (await rows).filter((row) => isClubCreatedFromForm(row)).length;
}

export async function countFormCreatedClubsForAdmin(userId: string): Promise<number> {
  return countFormCreated(
    prisma.club.findMany({ where: { adminId: userId }, select: { description: true } }),
  );
}

/**
 * Companies created from the form, of every kind.
 * The subscription limit is one pool: a club, a team, a group, and a group trained all count.
 */
export async function countFormCreatedCompaniesForAdmin(
  userId: string,
  _userType: string,
): Promise<number> {
  const [clubs, teams, groups, trained] = await Promise.all([
    countFormCreatedClubsForAdmin(userId),
    countFormCreated(
      prisma.team.findMany({ where: { adminId: userId }, select: { description: true } }),
    ),
    countFormCreated(
      prisma.group.findMany({ where: { adminId: userId }, select: { description: true } }),
    ),
    countFormCreated(
      prisma.coachingGroup.findMany({ where: { coachId: userId }, select: { description: true } }),
    ),
  ]);
  return clubs + teams + groups + trained;
}

/** Max companies the admin can create — read from the user's PCU version settings. */
export async function getCreatableCompaniesQuota(
  userId: string,
  userType: string,
): Promise<CreatableCompaniesQuota | null> {
  if (!hasCreatableCompaniesSetting(subscriptionUserTypeForUser(userType))) return null;

  const pcu = await getUserVersionSettings(userId);
  const limit = pcu?.data.settings.creatableCompanies;
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return null;

  const created = await countFormCreatedCompaniesForAdmin(userId, userType);
  return {
    limit,
    created,
    remaining: remainingCreatableCompanies(limit, created),
    canCreate: canCreateAnotherCompany(limit, created),
    unlimited: isCreatableCompaniesUnlimited(limit),
  };
}

/** @deprecated Use getCreatableCompaniesQuota (works for every company admin type). */
export const getClubCreatableCompaniesQuota = getCreatableCompaniesQuota;

export function companyLimitReachedMessage(quota: CreatableCompaniesQuota): string {
  return `You cannot create more companies: limit ${quota.limit}, already created ${quota.created}.`;
}
