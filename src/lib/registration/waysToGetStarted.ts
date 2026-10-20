import {
  PACKAGE_TYPE_CONFIGS,
  getGlobalPackages,
  getPackageViewMode,
  getTiersForUserType,
} from '@/lib/admin/packageSettingsMock';
import { getManagementSettingsData } from '@/lib/admin/managementFunctionSettingsMock';
import { getPackageDisplayTitle, getPackageDisplayDescription, getPackageDescriptionPreview, hasPackageFullOverview, getPackageFullOverviewHtml } from '@/lib/admin/packageSettingsLang';
import {
  isPackageIncludedInVersion,
  resolveSubscriptionTierMapping,
} from '@/lib/registration/packageReviewTierMapping';
import type { PackageItem, PackageSection, PackageTypeId, PackageViewMode } from '@/types/adminPackageSettings';
import { PACKAGE_SECTIONS } from '@/types/adminPackageSettings';
import type { SubscriptionUserType } from '@/types/adminSubscriptionSettings';
import {
  getSubscriptionById,
  getSubscriptionRowsByUserType,
} from '@/lib/admin/subscriptionSettingsMock';

export type RegistrationUserType = 'athlete' | 'coach' | 'team' | 'club' | 'group';

export const REGISTRATION_USER_TYPE_TABS: {
  key: RegistrationUserType;
  label: string;
  subscriptionType: SubscriptionUserType;
  packageTypeId: PackageTypeId;
}[] = [
  { key: 'athlete', label: 'Single User', subscriptionType: 'athlete', packageTypeId: 5 },
  { key: 'coach', label: 'Coach', subscriptionType: 'coach', packageTypeId: 6 },
  { key: 'team', label: 'Team', subscriptionType: 'team', packageTypeId: 7 },
  { key: 'club', label: 'Club', subscriptionType: 'club', packageTypeId: 8 },
  { key: 'group', label: 'Group', subscriptionType: 'group', packageTypeId: 9 },
];

export type RegistrationSubscriptionVersion = {
  id: number;
  listOrder: number;
  name: string;
  price: number;
  durationDays: number;
  isDefault?: boolean;
};

export function getRegistrationVersions(
  userType: RegistrationUserType,
): RegistrationSubscriptionVersion[] {
  const tab = REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType);
  if (!tab) return [];

  return getSubscriptionRowsByUserType(tab.subscriptionType)
    .filter((row) => !row.isTemplate && row.name)
    .map((row) => ({
      id: row.id,
      listOrder: row.listOrder,
      name: row.name,
      price: row.price1,
      durationDays: row.days1,
      isDefault: row.isDefault,
    }));
}

export function getDefaultVersionId(userType: RegistrationUserType): number | null {
  const versions = getRegistrationVersions(userType);
  return versions.find((v) => v.isDefault)?.id ?? versions[0]?.id ?? null;
}

export function getPackageTypeIdForUserType(userType: RegistrationUserType): PackageTypeId {
  return REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType)?.packageTypeId ?? 5;
}

export function formatRegistrationPrice(price: number): string {
  if (price === 0) return 'Free';
  return `€ ${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

export type RegistrationVersionColumn = {
  key: string;
  packageTierKey: string;
  functionSettingsKey: string;
  label: string;
  price: number;
  durationDays: number;
  subscriptionId: number;
};

export function getUserTypeReviewLabel(userType: RegistrationUserType): string {
  const tab = REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType);
  return tab?.label ?? 'Single User';
}

export function getVersionColumnsForUserType(
  userType: RegistrationUserType,
): RegistrationVersionColumn[] {
  const tab = REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType);
  if (!tab) return [];

  const config = PACKAGE_TYPE_CONFIGS.find((c) => c.id === tab.packageTypeId);
  const versions = getRegistrationVersions(userType);
  if (!config) return [];

  return versions.map((version, index) => {
    const fallbackKey = config.tiers[index]?.key ?? `version_${version.id}`;
    const mapping = resolveSubscriptionTierMapping(
      tab.packageTypeId,
      version.id,
      fallbackKey,
      fallbackKey,
    );

    return {
      key: mapping.packageTierKey,
      packageTierKey: mapping.packageTierKey,
      functionSettingsKey: mapping.functionSettingsKey,
      label: version.name,
      price: version.price,
      durationDays: version.durationDays,
      subscriptionId: version.id,
    };
  });
}

export type RegistrationPackageReviewRow = {
  id: number;
  sortOrder: number;
  title: string;
  description: string;
  fullDescription: string;
  html: string;
  pictures: [string, string, string];
  kind: 'package' | 'separator';
  icon: string;
  titleColor: string;
  backgroundColor: string;
  tiers: Record<string, boolean>;
};

export const REGISTRATION_PACKAGE_SECTIONS = PACKAGE_SECTIONS;

export function getRegistrationPackageViewMode(): PackageViewMode {
  return getPackageViewMode();
}

function comparePackageSortOrder(a: { sortOrder: number; id: number }, b: { sortOrder: number; id: number }) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

export function getPackageReviewRows(
  userType: RegistrationUserType,
  lang: string,
  section?: PackageSection,
): RegistrationPackageReviewRow[] {
  const userTypeId = getPackageTypeIdForUserType(userType);

  return getGlobalPackages()
    .filter((pkg) => pkg.published && (pkg.catalog ?? 'packages') === 'packages')
    .filter((pkg) => (section ? (pkg.section ?? 'training') === section : true))
    .sort(comparePackageSortOrder)
    .map((pkg) => packageToReviewRow(pkg, userTypeId, lang, userType));
}

export type RegistrationPackageCategory = PackageSection;

export type RegistrationSelectedEntity = {
  tierKey: string;
  columnIndex: number;
  versionLabel: string;
  subscriptionId: number | null;
};

export type RegistrationOverviewFeature = {
  id: number;
  title: string;
  description: string;
  pictures: [string, string, string];
  kind: 'package' | 'separator';
  icon: string;
  titleColor: string;
  backgroundColor: string;
  html: string;
};

export type RegistrationDetailedOverviewItem = {
  id: number;
  title: string;
  html: string;
};

export function getDetailedOverviewForEntity(
  userType: RegistrationUserType,
  tierKey: string,
  lang: string,
  category: RegistrationPackageCategory,
): RegistrationDetailedOverviewItem[] {
  const userTypeId = getPackageTypeIdForUserType(userType);

  return getGlobalPackages()
    .filter((pkg) => {
      if (!pkg.published) return false;
      if ((pkg.section ?? 'training') !== category) return false;
      if (pkg.kind === 'separator') return false;
      if (!hasPackageFullOverview(pkg.htmlByLang, lang)) return false;
      const userTiers = getTiersForUserType(pkg, userTypeId);
      const columns = getVersionColumnsForUserType(userType);
      const column = columns.find((col) => col.key === tierKey);
      if (!column) return userTiers[tierKey] ?? false;
      return isPackageIncludedInVersion(userTiers, column.packageTierKey);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pkg) => ({
      id: pkg.id,
      title: getPackageDisplayTitle(pkg.titlesByLang, lang),
      html: getPackageFullOverviewHtml(pkg.htmlByLang, lang),
    }));
}

export function getSubscriptionVersionForColumn(
  userType: RegistrationUserType,
  columnIndex: number,
): RegistrationSubscriptionVersion | null {
  const versions = getRegistrationVersions(userType);
  return versions[columnIndex] ?? null;
}

export function buildSelectedEntity(
  userType: RegistrationUserType,
  tierKey: string,
  columnIndex: number,
): RegistrationSelectedEntity {
  const columns = getVersionColumnsForUserType(userType);
  const column = columns[columnIndex];
  const version = getSubscriptionVersionForColumn(userType, columnIndex);
  return {
    tierKey,
    columnIndex,
    versionLabel: column?.label ?? tierKey,
    subscriptionId: column?.subscriptionId ?? version?.id ?? null,
  };
}

export function getOverviewFeaturesForEntity(
  userType: RegistrationUserType,
  tierKey: string,
  lang: string,
  category: RegistrationPackageCategory,
): RegistrationOverviewFeature[] {
  const userTypeId = getPackageTypeIdForUserType(userType);

  return getGlobalPackages()
    .filter((pkg) => {
      if (!pkg.published) return false;
      if ((pkg.section ?? 'training') !== category) return false;
      if (pkg.kind === 'separator') return true;
      const userTiers = getTiersForUserType(pkg, userTypeId);
      const columns = getVersionColumnsForUserType(userType);
      const column = columns.find((col) => col.key === tierKey);
      if (!column) return userTiers[tierKey] ?? false;
      return isPackageIncludedInVersion(userTiers, column.packageTierKey);
    })
    .sort(comparePackageSortOrder)
    .map((pkg) => ({
      id: pkg.id,
      title: getPackageDisplayTitle(pkg.titlesByLang, lang),
      description: getPackageDisplayDescription(pkg.descriptionsByLang, lang),
      pictures: pkg.pictures,
      kind: pkg.kind ?? 'package',
      icon: pkg.icon ?? '',
      titleColor: pkg.titleColor || '#111111',
      backgroundColor: pkg.backgroundColor || '#e8e8e8',
      html: getPackageFullOverviewHtml(pkg.htmlByLang, lang),
    }));
}

export function getManagementReviewRows(
  userType: RegistrationUserType,
  lang: string,
): RegistrationPackageReviewRow[] {
  const tierKeys = getVersionColumnsForUserType(userType).map((column) => column.key);
  const managementTierMap: Record<string, string[]> = {
    base: ['basic'],
    basic: ['basic'],
    basic_pfu: ['basic'],
    prem: ['premium'],
    prem_pfu: ['premium'],
    pro: ['pro'],
    pro_pfu: ['pro'],
    trial: ['basic'],
    standard: ['basic'],
  };

  return getManagementSettingsData(lang).features.map((feature) => {
    const tiers = Object.fromEntries(
      tierKeys.map((key) => {
        const mapped = managementTierMap[key] ?? ['basic'];
        return [key, mapped.some((field) => feature[field as 'basic' | 'premium' | 'pro'])];
      }),
    );

    return {
      id: feature.id,
      sortOrder: feature.id,
      title: feature.name,
      description: feature.optionalEnabled ? 'Optional module' : '',
      fullDescription: feature.optionalEnabled ? 'Optional module' : '',
      html: '',
      pictures: ['', '', ''] as [string, string, string],
      kind: 'package' as const,
      icon: '',
      titleColor: '#111111',
      backgroundColor: '#e8e8e8',
      tiers,
    };
  });
}

export function getPackageReviewRowsForCategory(
  userType: RegistrationUserType,
  lang: string,
  category: RegistrationPackageCategory,
): RegistrationPackageReviewRow[] {
  return getPackageReviewRows(userType, lang, category);
}

export function getEntityDisplayTitle(
  userType: RegistrationUserType,
  versionLabel: string,
): string {
  const userTypeLabel = getUserTypeReviewLabel(userType);
  return `${userTypeLabel} ${versionLabel} version`;
}

export function getSubscriptionRowForEntity(entity: RegistrationSelectedEntity) {
  if (!entity.subscriptionId) return null;
  return getSubscriptionById(entity.subscriptionId);
}

function packageToReviewRow(
  pkg: PackageItem,
  userTypeId: PackageTypeId,
  lang: string,
  userType: RegistrationUserType,
): RegistrationPackageReviewRow {
  const fullDescription = getPackageDisplayDescription(pkg.descriptionsByLang, lang);
  const description = getPackageDescriptionPreview(pkg.descriptionsByLang, lang);
  const title = getPackageDisplayTitle(pkg.titlesByLang, lang);
  const userTiers = getTiersForUserType(pkg, userTypeId);
  const columns = getVersionColumnsForUserType(userType);
  const tiers = Object.fromEntries(
    columns.map((column) => [
      column.key,
      isPackageIncludedInVersion(userTiers, column.packageTierKey),
    ]),
  );

  return {
    id: pkg.id,
    sortOrder: pkg.sortOrder,
    title,
    description,
    fullDescription,
    html: getPackageFullOverviewHtml(pkg.htmlByLang, lang),
    pictures: pkg.pictures ?? ['', '', ''],
    kind: pkg.kind ?? 'package',
    icon: pkg.icon ?? '',
    titleColor: pkg.titleColor || '#111111',
    backgroundColor: pkg.backgroundColor || '#e8e8e8',
    tiers,
  };
}
