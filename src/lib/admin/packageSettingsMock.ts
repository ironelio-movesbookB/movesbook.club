import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import type {
  PackageItem,
  PackageItemEditData,
  PackageSettingsView,
  PackageTypeConfig,
  PackageTypeId,
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
      { key: 'basic_pfu', label: 'Basic PFU' },
      { key: 'basic', label: 'Basic' },
      { key: 'prem_pfu', label: 'Prem PFU' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro_pfu', label: 'Pro PFU' },
      { key: 'pro', label: 'Pro' },
    ],
  },
  {
    id: 7,
    label: 'Team',
    tiers: [
      { key: 'basic_pfu', label: 'Basic PFU' },
      { key: 'basic', label: 'Basic' },
      { key: 'prem_pfu', label: 'Prem PFU' },
      { key: 'prem', label: 'Prem' },
      { key: 'pro_pfu', label: 'Pro PFU' },
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
  const keys = ['basic_pfu', 'basic', 'prem_pfu', 'prem', 'pro_pfu', 'pro'];
  if (name === 'View totals') return tierFlags(keys, keys);
  if (name === 'E-newsletter') return tierFlags(keys, ['basic']);
  if (name === 'Online training diary' || name === 'Social Networking') return tierFlags(keys, []);
  if (index % 4 === 0) return tierFlags(keys, ['prem', 'pro', 'pro_pfu']);
  if (index % 4 === 1) return tierFlags(keys, ['basic', 'basic_pfu', 'prem']);
  if (index % 4 === 2) return tierFlags(keys, ['prem_pfu', 'prem', 'pro']);
  return tierFlags(keys, ['pro', 'pro_pfu']);
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

function buildGlobalPackages(): PackageItem[] {
  return GLOBAL_PACKAGE_NAMES.map((name, index) => {
    const titles = emptyLangMap(name);
    titles.en = name;
    const tiersByUserType = emptyTiersByUserType();
    tiersByUserType[5] = athleteTiers(index, name);
    tiersByUserType[6] = coachTeamTiers(index, name);
    tiersByUserType[7] = coachTeamTiers(index, name);
    tiersByUserType[8] = clubTiers(index, name);
    tiersByUserType[9] = groupTiers(index, name);

    return {
      id: index + 1,
      sortOrder: index + 1,
      titlesByLang: titles,
      descriptionsByLang: emptyLangMap(''),
      htmlByLang: emptyLangMap(''),
      pictures: ['', '', ''],
      published: true,
      tiersByUserType,
    };
  });
}

let globalPackages: PackageItem[] = buildGlobalPackages();

export function getGlobalPackages(): PackageItem[] {
  return globalPackages;
}

export function saveGlobalPackages(packages: PackageItem[]): void {
  globalPackages = [...packages]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pkg, index) => ({ ...pkg, sortOrder: index + 1 }));
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

export function getPackageItemEditData(
  userTypeId: PackageTypeId,
  itemId: number,
  lang: string,
): PackageItemEditData | null {
  if (!getPackageTypeConfig(userTypeId)) return null;
  const item = getGlobalPackages().find((p) => p.id === itemId);
  if (!item) return null;
  return {
    userTypeId,
    lang,
    item: structuredClone(item),
  };
}

export function savePackageItemEditData(editData: PackageItemEditData): void {
  const packages = getGlobalPackages().map((pkg) =>
    pkg.id === editData.item.id ? editData.item : pkg,
  );
  saveGlobalPackages(packages);
}

export function updatePackageTiersForUserType(
  itemId: number,
  userTypeId: PackageTypeId,
  tiers: Record<string, boolean>,
): void {
  const packages = getGlobalPackages().map((pkg) =>
    pkg.id === itemId
      ? { ...pkg, tiersByUserType: { ...pkg.tiersByUserType, [userTypeId]: tiers } }
      : pkg,
  );
  saveGlobalPackages(packages);
}

export function addGlobalPackageItem(): PackageItem {
  const packages = getGlobalPackages();
  const nextId = Math.max(0, ...packages.map((p) => p.id)) + 1;
  const item: PackageItem = {
    id: nextId,
    sortOrder: packages.length + 1,
    titlesByLang: emptyLangMap('New package'),
    descriptionsByLang: emptyLangMap(''),
    htmlByLang: emptyLangMap(''),
    pictures: ['', '', ''],
    published: false,
    tiersByUserType: emptyTiersByUserType(),
  };
  saveGlobalPackages([...packages, item]);
  return item;
}

export function removeGlobalPackageItem(itemId: number): void {
  saveGlobalPackages(getGlobalPackages().filter((p) => p.id !== itemId));
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

export const MOVESBOOK_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
