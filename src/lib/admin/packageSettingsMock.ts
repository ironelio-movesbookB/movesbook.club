import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import type {
  PackageCatalog,
  PackageItem,
  PackageItemEditData,
  PackageKind,
  PackageSection,
  PackageSettingsView,
  PackageTypeConfig,
  PackageTypeId,
  PackageViewMode,
} from '@/types/adminPackageSettings';
import { emptyLangMap } from '@/lib/admin/packageSettingsLang';

export const PACKAGE_TYPE_CONFIGS: PackageTypeConfig[] = [
  {
    id: 5,
    label: 'Athletes',
    tiers: [
      { key: 'trail_base', label: 'Trail Base' },
      { key: 'trail_premium', label: 'Trail Premium' },
      { key: 'basic', label: 'Basic' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro', label: 'Pro' },
    ],
  },
  {
    id: 6,
    label: 'Coach',
    tiers: [
      { key: 'basic', label: 'Basic' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro', label: 'Pro' },
    ],
  },
  {
    id: 7,
    label: 'Team',
    tiers: [
      { key: 'basic', label: 'Basic' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro', label: 'Pro' },
    ],
  },
  {
    id: 8,
    label: 'Club',
    tiers: [
      { key: 'base', label: 'Base' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro', label: 'Pro' },
      { key: 'trial', label: 'Trial' },
    ],
  },
  {
    id: 9,
    label: 'Group',
    tiers: [{ key: 'standard', label: 'Standard' }],
  },
];

const GLOBAL_PACKAGE_NAMES = [
  'Online training diary',
  'Social Networking',
  'Advanced input forms for all sports',
  'Week plan builder',
  'All advanced options available',
  'View totals',
  'Setting goals and monitor progress',
  'Measures and weight tables',
  'aa Export and share workouts',
  'Complete reports Compare todo and done workouts',
  'Compare with your other periods',
  "Compare your friends' workouts",
  'Statistics and graphs',
  'Yearly and monthly total grids',
  'View workdata on smartphone',
  'Manage workouts by 1 to 3 coaches',
  'Build workout plans',
  "Download on athletes' plan",
  "Manage and control athletes' trainings",
  'Statistics among athletes',
  'E-newsletter',
  'Calendar Activities',
  'Press Media Center',
  'Customized diets and workouts',
  'Deletion of an account from Movesbook',
];

function tierFlags(tierKeys: string[], enabled: string[]): Record<string, boolean> {
  return Object.fromEntries(tierKeys.map((key) => [key, enabled.includes(key)]));
}

function emptyTiersByUserType(): Record<PackageTypeId, Record<string, boolean>> {
  return Object.fromEntries(
    PACKAGE_TYPE_CONFIGS.map((config) => [
      config.id,
      Object.fromEntries(config.tiers.map((t) => [t.key, false])),
    ]),
  ) as Record<PackageTypeId, Record<string, boolean>>;
}

function athleteTiers(index: number, name: string): Record<string, boolean> {
  const keys = ['trail_base', 'trail_premium', 'basic', 'prem', 'pro'];
  if (name === 'Online training diary') return tierFlags(keys, []);
  if (name === 'Social Networking') return tierFlags(keys, ['prem', 'pro']);
  if (name === 'View totals') return tierFlags(keys, keys);
  if (name === 'Week plan builder') return tierFlags(keys, ['basic', 'prem', 'pro']);
  if (index % 3 === 0) return tierFlags(keys, ['prem', 'pro']);
  if (index % 3 === 1) return tierFlags(keys, ['basic', 'prem']);
  return tierFlags(keys, ['pro']);
}

function coachTeamTiers(index: number, name: string): Record<string, boolean> {
  const keys = ['basic', 'prem', 'pro'];
  if (name === 'View totals') return tierFlags(keys, keys);
  if (name === 'E-newsletter') return tierFlags(keys, ['basic']);
  if (name === 'Online training diary' || name === 'Social Networking') return tierFlags(keys, []);
  if (index % 3 === 0) return tierFlags(keys, ['prem', 'pro']);
  if (index % 3 === 1) return tierFlags(keys, ['basic', 'prem']);
  return tierFlags(keys, ['pro']);
}

function sectionForName(name: string): PackageSection {
  const n = name.toLowerCase();
  if (/diet|nutrition|weight|measure/.test(n)) return 'nutrition';
  if (/social|friend|share|newsletter|press|calendar/.test(n)) return 'social';
  if (/manage|coach|deletion|account|staff|member/.test(n)) return 'management';
  return 'training';
}

function clubTiers(index: number, name: string): Record<string, boolean> {
  const keys = ['base', 'prem', 'pro', 'trial'];
  if (name === 'Social Networking') return tierFlags(keys, ['prem', 'trial']);
  if (name === 'Week plan builder') return tierFlags(keys, ['base']);
  if (name === 'All advanced options available') return tierFlags(keys, ['prem', 'pro']);
  if (name === 'View totals') return tierFlags(keys, ['base', 'prem']);
  if (index % 3 === 0) return tierFlags(keys, ['prem']);
  if (index % 3 === 1) return tierFlags(keys, ['base', 'prem']);
  return tierFlags(keys, []);
}

function groupTiers(index: number, name: string): Record<string, boolean> {
  const keys = ['standard'];
  if (
    name === 'Advanced input forms for all sports' ||
    name === 'All advanced options available' ||
    name === 'View totals' ||
    name === 'Statistics and graphs'
  ) {
    return tierFlags(keys, keys);
  }
  return tierFlags(keys, index % 2 === 0 ? keys : []);
}

function buildPackageItem(
  name: string,
  index: number,
  id: number,
  catalog: PackageCatalog,
): PackageItem {
  const titles = emptyLangMap(name);
  titles.en = name;
  const tiersByUserType = emptyTiersByUserType();
  tiersByUserType[5] = athleteTiers(index, name);
  tiersByUserType[6] = coachTeamTiers(index, name);
  tiersByUserType[7] = coachTeamTiers(index, name);
  tiersByUserType[8] = clubTiers(index, name);
  tiersByUserType[9] = groupTiers(index, name);
  return {
    id,
    sortOrder: index + 1,
    section: sectionForName(name),
    catalog,
    kind: 'package',
    icon: '',
    titleColor: '#111111',
    backgroundColor: '#e8e8e8',
    titlesByLang: titles,
    descriptionsByLang: emptyLangMap(''),
    htmlByLang: emptyLangMap(''),
    pictures: ['', '', ''],
    published: true,
    tiersByUserType,
  };
}

function buildGlobalPackages(): PackageItem[] {
  return GLOBAL_PACKAGE_NAMES.map((name, index) =>
    buildPackageItem(name, index, index + 1, 'packages'),
  );
}

function buildAthleteAccountPackages(): PackageItem[] {
  return buildGlobalPackages().map((pkg) => ({
    ...structuredClone(pkg),
    id: pkg.id + 10000,
    catalog: 'athlete_accounts' as const,
  }));
}

const STORAGE_KEY = 'movesbook.packageSettings.v3';

export const PACKAGE_PURCHASE_TABS = [
  { key: 'versions_features', label: 'Versions and features' },
  { key: 'optional_modules', label: 'Optional Modules' },
  { key: 'account_pricelist', label: 'Account pricelist' },
  { key: 'identification_devices', label: 'Identification devices' },
  { key: 'others', label: 'Others' },
] as const;

export type PackagePurchaseTabKey = (typeof PACKAGE_PURCHASE_TABS)[number]['key'];

function defaultPurchaseTabs(): Record<PackagePurchaseTabKey, boolean> {
  return {
    versions_features: true,
    optional_modules: true,
    account_pricelist: true,
    identification_devices: true,
    others: true,
  };
}

function blankItemFields(): Pick<
  PackageItem,
  'section' | 'catalog' | 'kind' | 'icon' | 'titleColor' | 'backgroundColor'
> {
  return {
    section: 'management',
    catalog: 'packages',
    kind: 'package',
    icon: '',
    titleColor: '#111111',
    backgroundColor: '#e8e8e8',
  };
}

function normalizeItem(raw: Partial<PackageItem> & { id: number }): PackageItem {
  const base = blankItemFields();
  return {
    ...base,
    id: raw.id,
    sortOrder: raw.sortOrder ?? raw.id,
    section: raw.section ?? sectionForName(raw.titlesByLang?.en || Object.values(raw.titlesByLang ?? {}).find(Boolean) || ''),
    catalog: raw.catalog ?? base.catalog,
    kind: raw.kind ?? base.kind,
    icon: raw.icon ?? '',
    titleColor: raw.titleColor ?? base.titleColor,
    backgroundColor: raw.backgroundColor ?? base.backgroundColor,
    titlesByLang: raw.titlesByLang ?? emptyLangMap(''),
    descriptionsByLang: raw.descriptionsByLang ?? emptyLangMap(''),
    htmlByLang: raw.htmlByLang ?? emptyLangMap(''),
    pictures: raw.pictures ?? ['', '', ''],
    published: raw.published ?? true,
    tiersByUserType: raw.tiersByUserType ?? emptyTiersByUserType(),
  };
}

let globalPackages: PackageItem[] = buildGlobalPackages();
let athleteAccountPackages: PackageItem[] = buildAthleteAccountPackages();
let packageViewMode: PackageViewMode = 'standard';
let purchaseTabs: Record<PackagePurchaseTabKey, boolean> = defaultPurchaseTabs();
let storageLoaded = false;

function persistPackageSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      packages: globalPackages,
      athletePackages: athleteAccountPackages,
      viewMode: packageViewMode,
      purchaseTabs,
    }),
  );
}

export function ensurePackageSettingsLoaded(): void {
  if (storageLoaded || typeof window === 'undefined') return;
  storageLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      packages?: PackageItem[];
      athletePackages?: PackageItem[];
      viewMode?: PackageViewMode;
      purchaseTabs?: Partial<Record<PackagePurchaseTabKey, boolean>>;
    };
    if (Array.isArray(parsed.packages) && parsed.packages.length > 0) {
      globalPackages = parsed.packages.map((item) => normalizeItem(item));
    }
    if (Array.isArray(parsed.athletePackages)) {
      athleteAccountPackages = parsed.athletePackages.map((item) =>
        normalizeItem({ ...item, catalog: 'athlete_accounts' }),
      );
    }
    if (parsed.viewMode === 'black' || parsed.viewMode === 'standard') {
      packageViewMode = parsed.viewMode;
    }
    purchaseTabs = { ...defaultPurchaseTabs(), ...parsed.purchaseTabs };
  } catch {
    storageLoaded = true;
  }
}

function catalogList(catalog: PackageCatalog): PackageItem[] {
  return catalog === 'athlete_accounts' ? athleteAccountPackages : globalPackages;
}

function setCatalogList(catalog: PackageCatalog, packages: PackageItem[]): void {
  const next = packages.map((pkg) => ({ ...pkg, catalog }));
  if (catalog === 'athlete_accounts') athleteAccountPackages = next;
  else globalPackages = next;
  persistPackageSettings();
}

export function getPackagesByCatalog(catalog: PackageCatalog): PackageItem[] {
  return catalogList(catalog);
}

export function getGlobalPackages(): PackageItem[] {
  return getPackagesByCatalog('packages');
}

export function getAthleteAccountPackages(): PackageItem[] {
  return getPackagesByCatalog('athlete_accounts');
}

export function saveGlobalPackages(packages: PackageItem[]): void {
  setCatalogList('packages', packages);
}

export function saveAthleteAccountPackages(packages: PackageItem[]): void {
  setCatalogList('athlete_accounts', packages);
}

export function getPackageViewMode(): PackageViewMode {
  return packageViewMode;
}

export function setPackageViewMode(mode: PackageViewMode): void {
  packageViewMode = mode;
  persistPackageSettings();
}

export function getPurchaseTabVisibility(): Record<PackagePurchaseTabKey, boolean> {
  return { ...purchaseTabs };
}

export function setPurchaseTabVisibility(
  next: Record<PackagePurchaseTabKey, boolean>,
): void {
  purchaseTabs = { ...next };
  persistPackageSettings();
}

export function isPurchaseTabVisible(key: PackagePurchaseTabKey): boolean {
  return getPurchaseTabVisibility()[key] !== false;
}

export function getPackageTypeConfig(userTypeId: number): PackageTypeConfig | undefined {
  return PACKAGE_TYPE_CONFIGS.find((c) => c.id === userTypeId);
}

export function getPackageSettingsView(
  userTypeId: PackageTypeId,
  lang: string,
): PackageSettingsView | null {
  if (!getPackageTypeConfig(userTypeId)) return null;
  return { userTypeId, lang, packages: getGlobalPackages() };
}

export function getTiersForUserType(
  item: PackageItem,
  userTypeId: PackageTypeId,
): Record<string, boolean> {
  return item.tiersByUserType[userTypeId] ?? {};
}

export function getPackageSettingsHref(userTypeId: PackageTypeId, lang: string): string {
  return `/subscriptions/package/${userTypeId}/${lang}`;
}

export function getPackageEditHref(
  userTypeId: PackageTypeId,
  itemId: number,
  lang: string,
): string {
  return `/subscriptions/edit/${itemId}/${lang}?userType=${userTypeId}`;
}

function findPackageItem(itemId: number): PackageItem | undefined {
  return (
    getGlobalPackages().find((p) => p.id === itemId) ??
    getAthleteAccountPackages().find((p) => p.id === itemId)
  );
}

function nextPackageId(): number {
  const ids = [...getGlobalPackages(), ...getAthleteAccountPackages()].map((p) => p.id);
  return Math.max(0, ...ids) + 1;
}

export function getPackageItemEditData(
  userTypeId: PackageTypeId,
  itemId: number,
  lang: string,
): PackageItemEditData | null {
  if (!getPackageTypeConfig(userTypeId)) return null;
  const item = findPackageItem(itemId);
  if (!item) return null;
  return {
    userTypeId,
    lang,
    item: structuredClone(item),
  };
}

export function savePackageItemEditData(editData: PackageItemEditData): void {
  const catalog = editData.item.catalog ?? 'packages';
  const current = catalogList(catalog);
  const packages = current.some((pkg) => pkg.id === editData.item.id)
    ? current.map((pkg) => (pkg.id === editData.item.id ? { ...editData.item, catalog } : pkg))
    : [...current, { ...editData.item, catalog }];
  setCatalogList(catalog, packages);
}

export function updatePackageTiersForUserType(
  itemId: number,
  userTypeId: PackageTypeId,
  tiers: Record<string, boolean>,
): void {
  const item = findPackageItem(itemId);
  if (!item) return;
  const catalog = item.catalog ?? 'packages';
  setCatalogList(
    catalog,
    catalogList(catalog).map((pkg) =>
      pkg.id === itemId
        ? { ...pkg, tiersByUserType: { ...pkg.tiersByUserType, [userTypeId]: tiers } }
        : pkg,
    ),
  );
}

export function addPackageItem(options: {
  catalog?: PackageCatalog;
  section?: PackageSection;
  kind?: PackageKind;
}): PackageItem {
  const catalog = options.catalog ?? 'packages';
  const section = options.section ?? 'management';
  const kind = options.kind ?? 'package';
  const packages = catalogList(catalog);
  const inSection = packages.filter((p) => p.section === section);
  const item: PackageItem = {
    id: nextPackageId(),
    sortOrder: inSection.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1,
    ...blankItemFields(),
    catalog,
    section,
    kind,
    titlesByLang: emptyLangMap(kind === 'separator' ? 'Separator' : 'New package'),
    descriptionsByLang: emptyLangMap(''),
    htmlByLang: emptyLangMap(''),
    pictures: ['', '', ''],
    published: kind === 'separator',
    tiersByUserType: emptyTiersByUserType(),
    icon: kind === 'separator' ? '•' : '',
    titleColor: '#111111',
    backgroundColor: kind === 'separator' ? '#d9edf7' : '#e8e8e8',
  };
  setCatalogList(catalog, [...packages, item]);
  return item;
}

export function addGlobalPackageItem(): PackageItem {
  return addPackageItem({ catalog: 'packages', section: 'management', kind: 'package' });
}

export function removePackageItem(itemId: number): void {
  const item = findPackageItem(itemId);
  if (!item) return;
  const catalog = item.catalog ?? 'packages';
  setCatalogList(
    catalog,
    catalogList(catalog).filter((p) => p.id !== itemId),
  );
}

export function removeGlobalPackageItem(itemId: number): void {
  removePackageItem(itemId);
}

export function reorderPackagesInSection(
  catalog: PackageCatalog,
  section: PackageSection,
  orderedIds: number[],
): void {
  const all = catalogList(catalog);
  const byId = new Map(all.filter((p) => p.section === section).map((p) => [p.id, p]));
  const reordered = orderedIds
    .map((id, index) => {
      const pkg = byId.get(id);
      return pkg ? { ...pkg, sortOrder: index + 1 } : null;
    })
    .filter((p): p is PackageItem => p !== null);
  const rest = all.filter((p) => p.section !== section);
  setCatalogList(catalog, [...rest, ...reordered]);
}

export function reorderGlobalPackages(orderedIds: number[]): void {
  const byId = new Map(getGlobalPackages().map((p) => [p.id, p]));
  const packages = orderedIds
    .map((id, index) => {
      const pkg = byId.get(id);
      return pkg ? { ...pkg, sortOrder: index + 1 } : null;
    })
    .filter((p): p is PackageItem => p !== null);
  saveGlobalPackages(packages);
}

export function copyPackageSectionToAthleteAccounts(section: PackageSection): void {
  const source = getGlobalPackages().filter((pkg) => pkg.section === section);
  const kept = getAthleteAccountPackages().filter((pkg) => pkg.section !== section);
  let nextId = nextPackageId();
  const copies = source.map((pkg) => {
    const copy: PackageItem = {
      ...structuredClone(pkg),
      id: nextId,
      catalog: 'athlete_accounts',
    };
    nextId += 1;
    return copy;
  });
  saveAthleteAccountPackages([...kept, ...copies]);
}

export const MOVESBOOK_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
