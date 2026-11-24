import type { PackageTypeId } from '@/types/adminPackageSettings';
import {
  getGlobalPackages,
  getPackageTypeConfig,
  PACKAGE_TYPE_CONFIGS,
  saveGlobalPackages,
} from '@/lib/admin/packageSettingsMock';

type TierFamily = 'base' | 'prem' | 'pro' | 'trial';

function isPfuTierKey(key: string): boolean {
  return key.includes('pfu');
}

function tierFamily(key: string): TierFamily | null {
  if (isPfuTierKey(key)) return null;
  if (key === 'trial') return 'trial';
  if (key === 'pro') return 'pro';
  if (key === 'prem' || key === 'premium' || key === 'trail_premium') return 'prem';
  if (key === 'base' || key === 'basic' || key === 'trail_base') return 'base';
  if (key === 'standard') return 'base';
  return null;
}

/** Copy Base / Prem / Pro / Trial tier flags only — never PFU columns. */
export function copyTiersBetweenUserTypes(
  sourceTiers: Record<string, boolean>,
  targetTierKeys: string[],
  targetExisting: Record<string, boolean>,
): Record<string, boolean> {
  const result = { ...targetExisting };
  const families: TierFamily[] = ['base', 'prem', 'pro', 'trial'];

  for (const family of families) {
    const sourceKey = Object.keys(sourceTiers).find((k) => tierFamily(k) === family);
    const targetKey = targetTierKeys.find((k) => tierFamily(k) === family);
    if (sourceKey !== undefined && targetKey !== undefined) {
      result[targetKey] = sourceTiers[sourceKey] ?? false;
    }
  }

  return result;
}

export function getPackageCopyTargetOptions(sourceUserTypeId: PackageTypeId) {
  return PACKAGE_TYPE_CONFIGS.filter((c) => c.id !== sourceUserTypeId);
}

export function copyAllPackageSettingsToUserType(
  sourceUserTypeId: PackageTypeId,
  targetUserTypeId: PackageTypeId,
): void {
  const targetConfig = getPackageTypeConfig(targetUserTypeId);
  if (!targetConfig) return;

  const targetKeys = targetConfig.tiers.map((t) => t.key);
  const packages = getGlobalPackages().map((pkg) => {
    const sourceTiers = pkg.tiersByUserType[sourceUserTypeId] ?? {};
    const resetTarget = Object.fromEntries(targetKeys.map((key) => [key, false]));
    const merged = copyTiersBetweenUserTypes(sourceTiers, targetKeys, resetTarget);
    return {
      ...pkg,
      tiersByUserType: {
        ...pkg.tiersByUserType,
        [targetUserTypeId]: merged,
      },
    };
  });

  saveGlobalPackages(packages);
}

export function copySinglePackageToUserType(
  sourceUserTypeId: PackageTypeId,
  targetUserTypeId: PackageTypeId,
  itemId: number,
): void {
  const targetConfig = getPackageTypeConfig(targetUserTypeId);
  if (!targetConfig) return;

  const targetKeys = targetConfig.tiers.map((t) => t.key);
  const packages = getGlobalPackages().map((pkg) => {
    if (pkg.id !== itemId) return pkg;
    const sourceTiers = pkg.tiersByUserType[sourceUserTypeId] ?? {};
    const existingTarget = pkg.tiersByUserType[targetUserTypeId] ?? {};
    const merged = copyTiersBetweenUserTypes(sourceTiers, targetKeys, existingTarget);
    return {
      ...pkg,
      tiersByUserType: {
        ...pkg.tiersByUserType,
        [targetUserTypeId]: merged,
      },
    };
  });

  saveGlobalPackages(packages);
}

export function buildCopyAllSettingsWarning(
  sourceLabel: string,
  targetLabel: string,
): string {
  return (
    `WARNING: This will RESET and REPLACE all package version settings for "${targetLabel}".\n\n` +
    `All existing tier settings on "${targetLabel}" will be removed and replaced with copies from "${sourceLabel}".\n\n` +
    `Only Base, Premium, Pro and Trial tiers are copied (when they exist on both sides).\n` +
    `PFU tier data is NEVER copied.\n\n` +
    `Do you want to continue?`
  );
}

export function buildCopySinglePackageWarning(
  packageTitle: string,
  sourceLabel: string,
  targetLabel: string,
): string {
  return (
    `Copy version settings for "${packageTitle}" from "${sourceLabel}" to "${targetLabel}"?\n\n` +
    `This package will be merged into the existing packages on "${targetLabel}". ` +
    `Other packages on "${targetLabel}" will not be affected.\n\n` +
    `Only Base, Premium, Pro and Trial tiers are copied (when they exist on both sides).\n` +
    `PFU tier data is NEVER copied.\n\n` +
    `Continue?`
  );
}
