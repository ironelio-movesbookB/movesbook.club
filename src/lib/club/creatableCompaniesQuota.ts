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

/** Companies created by the admin from the create form (clubs, teams, groups trained, groups). */
export async function countFormCreatedCompaniesForAdmin(
  userId: string,
  userType: string,
): Promise<number> {
  switch (subscriptionUserTypeForUser(userType)) {
    case 'club':
      return countFormCreatedClubsForAdmin(userId);
    case 'team':
      return countFormCreated(
        prisma.team.findMany({ where: { adminId: userId }, select: { description: true } }),
      );
    case 'group':
      return countFormCreated(
        prisma.group.findMany({ where: { adminId: userId }, select: { description: true } }),
      );
    case 'coach':
      return countFormCreated(
        prisma.coachingGroup.findMany({ where: { coachId: userId }, select: { description: true } }),
      );
    default:
      return 0;
  }
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
