export type PackageTypeId = 5 | 6 | 7 | 8 | 9;

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
