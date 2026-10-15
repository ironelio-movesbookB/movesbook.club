import type { SubscriptionUserType } from '@/types/adminSubscriptionSettings';

/** Coach, team, and club use the updated sharing layout (not single-user athlete or group). */
export function usesCoachTeamClubSharingLayout(userType: SubscriptionUserType): boolean {
  return userType === 'coach' || userType === 'team' || userType === 'club';
}

export function getCoachVariantIntroText(userType: SubscriptionUserType): string {
  if (userType === 'club') {
    return 'Coaches or Teams can have one or more coaches and can invite coaches to be trained....';
  }
  if (userType === 'team') {
    return 'Team can have one or more coaches and can invite coaches to be trained....';
  }
  return 'Coach can have one or more coaches and can invite coaches to be trained....';
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
