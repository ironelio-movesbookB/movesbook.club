export type PackageTypeId = 5 | 6 | 7 | 8 | 9;

export type PackageSection = 'management' | 'social' | 'training' | 'nutrition';

export type PackageCatalog = 'packages' | 'athlete_accounts';

export type PackageKind = 'package' | 'separator';

export type PackageViewMode = 'standard' | 'black';

export const PACKAGE_SECTIONS: { key: PackageSection; label: string }[] = [
  { key: 'management', label: 'Management' },
  { key: 'social', label: 'Social' },
  { key: 'training', label: 'Training' },
  { key: 'nutrition', label: 'Nutrition' },
];

export type PackageTierColumn = {
  key: string;
  label: string;
};

export type PackageTypeConfig = {
  id: PackageTypeId;
  label: string;
  tiers: PackageTierColumn[];
};

export type PackageItem = {
  id: number;
  sortOrder: number;
  section: PackageSection;
  catalog: PackageCatalog;
  kind: PackageKind;
  /** Separator icon (emoji or short text). */
  icon: string;
  titleColor: string;
  backgroundColor: string;
  /** A – title per language */
  titlesByLang: Record<string, string>;
  /** B – short description per language */
  descriptionsByLang: Record<string, string>;
  /** C – HTML overview per language */
  htmlByLang: Record<string, string>;
  /** D – three pictures shared across all languages */
  pictures: [string, string, string];
  /** E – general publish status */
  published: boolean;
  /** F – enabled versions per user type */
  tiersByUserType: Record<PackageTypeId, Record<string, boolean>>;
};

export type PackageSettingsView = {
  userTypeId: PackageTypeId;
  lang: string;
  packages: PackageItem[];
};

export type PackageItemEditData = {
  userTypeId: PackageTypeId;
  lang: string;
  item: PackageItem;
};
