import type {
  SubscriptionEditSettings,
  SubscriptionTier,
  SubscriptionUserType,
} from '@/types/adminSubscriptionSettings';

export const SUBSCRIPTION_TIERS: { key: SubscriptionTier; label: string }[] = [
  { key: 'trial', label: 'Trial' },
  { key: 'base', label: 'Base' },
  { key: 'premium', label: 'Premium' },
  { key: 'pro', label: 'Pro' },
];

/** Coach, team, and club use the updated sharing layout (not single-user athlete or group). */
export function usesCoachTeamClubSharingLayout(userType: SubscriptionUserType): boolean {
  return userType === 'coach' || userType === 'team' || userType === 'club';
}

export function getCoachVariantIntroText(userType: SubscriptionUserType): string {
  const role = userType === 'club' ? 'Club' : userType === 'team' ? 'Team' : 'Coach';
  return `${role} can give free athlete accounts for each athlete version and can share with coaches, teams, groups and clubs....`;
}

/** Free athlete accounts per tier; older settings used one limit for every checked tier. */
export function getAthleteTierLimits(
  settings: Pick<SubscriptionEditSettings, 'athletesLimit' | 'athleteTiers' | 'athleteTierLimits'>,
): Record<SubscriptionTier, number> {
  if (settings.athleteTierLimits) {
    return {
      trial: Number(settings.athleteTierLimits.trial) || 0,
      base: Number(settings.athleteTierLimits.base) || 0,
      premium: Number(settings.athleteTierLimits.premium) || 0,
      pro: Number(settings.athleteTierLimits.pro) || 0,
    };
  }
  const limit = Number(settings.athletesLimit) || 0;
  return {
    trial: settings.athleteTiers?.trial ? limit : 0,
    base: settings.athleteTiers?.base ? limit : 0,
    premium: settings.athleteTiers?.premium ? limit : 0,
    pro: settings.athleteTiers?.pro ? limit : 0,
  };
}

/** Total free athlete accounts (-1 when any tier is unlimited). */
export function totalAthleteTierLimit(limits: Record<SubscriptionTier, number>): number {
  const values = Object.values(limits);
  if (values.some((v) => v === -1)) return -1;
  return values.reduce((sum, v) => sum + Math.max(0, v), 0);
}

export function getMembershipSectionLabel(
  userType: SubscriptionUserType,
  roleLabel: string,
): string {
  if (usesCoachTeamClubSharingLayout(userType)) {
    return `${roleLabel} can share with....`;
  }
  return `${roleLabel} can be member of....`;
}

/** Company admins (club, team, coach groups trained, group) — single users cannot create companies. */
export function hasCreatableCompaniesSetting(userType: SubscriptionUserType): boolean {
  return usesCoachTeamClubSharingLayout(userType) || userType === 'group';
}

export function getDefaultManageableUsersForUserType(userType: SubscriptionUserType): {
  creatableCompanies: number;
  usersFirstSubscription: number;
  usersRenewal: number;
} {
  if (!hasCreatableCompaniesSetting(userType)) {
    return { creatableCompanies: 0, usersFirstSubscription: 0, usersRenewal: 0 };
  }
  return { creatableCompanies: 1, usersFirstSubscription: 10, usersRenewal: 10 };
}
