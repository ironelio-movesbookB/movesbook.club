import {
  getFunctionSettingsData,
  SOCIAL_FUNCTIONS,
  TRAINING_FUNCTIONS,
} from '@/lib/admin/functionSettingsMock';
import type { PackageTypeId } from '@/types/adminPackageSettings';

export type SubscriptionTierMapping = {
  /** Key used in package tiersByUserType[userTypeId] */
  packageTierKey: string;
  /** Key used in function settings availability (Single User / Coach / … categories) */
  functionSettingsKey: string;
};

/** Maps subscription list row id → package tier + function-settings version keys. */
const SUBSCRIPTION_TIER_MAP: Partial<
  Record<PackageTypeId, Record<number, SubscriptionTierMapping>>
> = {
  5: {
    1: { packageTierKey: 'trail_base', functionSettingsKey: 'trial_base' },
    2: { packageTierKey: 'trail_premium', functionSettingsKey: 'trial_club' },
    3: { packageTierKey: 'basic', functionSettingsKey: 'user_base' },
    4: { packageTierKey: 'prem', functionSettingsKey: 'user_premium' },
    5: { packageTierKey: 'pro', functionSettingsKey: 'user_professional' },
  },
  6: {
    6: { packageTierKey: 'basic_pfu', functionSettingsKey: 'coach_base_pfu' },
    7: { packageTierKey: 'basic', functionSettingsKey: 'coach_base_no_pfu' },
    8: { packageTierKey: 'prem_pfu', functionSettingsKey: 'coach_premium_pfu' },
    9: { packageTierKey: 'prem', functionSettingsKey: 'coach_premium' },
    19: { packageTierKey: 'pro_pfu', functionSettingsKey: 'coach_pro_pfu' },
  },
  7: {
    10: { packageTierKey: 'basic_pfu', functionSettingsKey: 'team_base_pfu' },
    11: { packageTierKey: 'basic', functionSettingsKey: 'team_base_no_pfu' },
    12: { packageTierKey: 'prem_pfu', functionSettingsKey: 'team_premium_pfu' },
    22: { packageTierKey: 'prem', functionSettingsKey: 'team_premium' },
    23: { packageTierKey: 'pro_pfu', functionSettingsKey: 'team_pro_pfu' },
  },
  8: {
    15: { packageTierKey: 'base', functionSettingsKey: 'club_base' },
    16: { packageTierKey: 'prem', functionSettingsKey: 'club_premium' },
    17: { packageTierKey: 'pro', functionSettingsKey: 'club_pro' },
    18: { packageTierKey: 'trial', functionSettingsKey: 'club_trial' },
  },
  9: {
    13: { packageTierKey: 'standard', functionSettingsKey: 'group_standard' },
    14: { packageTierKey: 'standard', functionSettingsKey: 'group_standard' },
  },
};

export function resolveSubscriptionTierMapping(
  userTypeId: PackageTypeId,
  subscriptionId: number,
  fallbackPackageTierKey: string,
  fallbackFunctionSettingsKey = fallbackPackageTierKey,
): SubscriptionTierMapping {
  return (
    SUBSCRIPTION_TIER_MAP[userTypeId]?.[subscriptionId] ?? {
      packageTierKey: fallbackPackageTierKey,
      functionSettingsKey: fallbackFunctionSettingsKey,
    }
  );
}

export function normalizePackageFunctionName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const left = normalizePackageFunctionName(a);
  const right = normalizePackageFunctionName(b);
  return left.includes(right) || right.includes(left);
}

/** Match package title to social/training function list entry by normalized name. */
export function findFunctionSettingsTabForPackageTitle(
  title: string,
): { tab: 'social' | 'training'; functionId: number } | null {
  for (const fn of TRAINING_FUNCTIONS) {
    if (namesMatch(title, fn.name)) {
      return { tab: 'training', functionId: fn.id };
    }
  }

  for (const fn of SOCIAL_FUNCTIONS) {
    if (namesMatch(title, fn.name)) {
      return { tab: 'social', functionId: fn.id };
    }
  }

  return null;
}

export function isFunctionAvailableForVersion(
  tab: 'social' | 'training',
  functionId: number,
  functionSettingsKey: string,
): boolean {
  const settings = getFunctionSettingsData(tab, functionId);
  if (!settings) return true;
  return settings.availability[functionSettingsKey] ?? false;
}

/** Green check in Product Review mirrors package settings tier toggles only. */
export function isPackageIncludedInVersion(
  packageTiers: Record<string, boolean>,
  packageTierKey: string,
): boolean {
  return packageTiers[packageTierKey] ?? false;
}
