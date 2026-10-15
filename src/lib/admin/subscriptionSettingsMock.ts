import type {
  SubscriptionEditData,
  SubscriptionEditSettings,
  SubscriptionListRow,
  SubscriptionMembershipSetting,
  SubscriptionUserType,
} from '@/types/adminSubscriptionSettings';
import {
  getDefaultManageableUsersForUserType,
  hasCreatableCompaniesSetting,
} from '@/lib/admin/subscriptionEditSettingsLayout';
import { hasRichTextContent } from '@/utils/richTextTranslation';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';

export const SUBSCRIPTION_LANGUAGES = [
  { code: 'en', label: 'En' },
  { code: 'fr', label: 'Fr' },
  { code: 'de', label: 'De' },
  { code: 'it', label: 'It' },
  { code: 'es', label: 'Es' },
  { code: 'por', label: 'Por' },
  { code: 'rus', label: 'Rus' },
  { code: 'ind', label: 'Ind' },
  { code: 'indo', label: 'Indo' },
  { code: 'jap', label: 'Jap' },
  { code: 'chin', label: 'Chin' },
  { code: 'arab', label: 'Arab' },
] as const;

const DEFAULT_TIERS = { trial: true, base: true, premium: true, pro: true };

function notify(...channels: SubscriptionListRow['notifyChannels'][number][]): SubscriptionListRow['notifyChannels'] {
  return channels;
}

type SubscriptionListRowSeed = Omit<
  SubscriptionListRow,
  'creatableCompanies' | 'usersFirstSubscription' | 'usersRenewal'
>;

function completeListRow(row: SubscriptionListRowSeed): SubscriptionListRow {
  return {
    ...row,
    ...getDefaultManageableUsersForUserType(row.userType),
  };
}

const RAW_SUBSCRIPTION_LIST_ROWS: SubscriptionListRowSeed[] = [
  // Athlete
  { id: 1, listOrder: 1, code: 'U00', name: 'Trial Base', userType: 'athlete', days1: 361, days2: 10, price1: 101, price2: 10, credit1: 10, credit2: 20, credit3: 10, credit4: 10, inviteAthletes: -1, inviteTeams: -1, inviteGroups: -1, inviteClubs: -1, notifyChannels: notify('mail', 'network', 'cellular', 'facebook'), isDefault: true },
  { id: 2, listOrder: 2, code: 'U01', name: 'Trial for club members', userType: 'athlete', days1: 365, days2: 10, price1: 10, price2: 10, credit1: 10, credit2: 20, credit3: 10, credit4: 10, inviteAthletes: -1, inviteTeams: -1, inviteGroups: -1, inviteClubs: -1, notifyChannels: notify('mail', 'network', 'cellular', 'facebook') },
  { id: 3, listOrder: 3, code: 'U02', name: 'User- base version', userType: 'athlete', days1: 180, days2: 30, price1: 10, price2: 10, credit1: 10, credit2: 10, credit3: 10, credit4: 10, inviteAthletes: 1, inviteTeams: 1, inviteGroups: 1, inviteClubs: 1, notifyChannels: notify('mail', 'network') },
  { id: 4, listOrder: 4, code: 'U03', name: 'User- premium', userType: 'athlete', days1: 123, days2: 30, price1: 123, price2: 20, credit1: 20, credit2: 20, credit3: 20, credit4: 20, inviteAthletes: 5, inviteTeams: 3, inviteGroups: 2, inviteClubs: 1, notifyChannels: notify('mail', 'network', 'cellular') },
  { id: 5, listOrder: 5, code: 'U04', name: 'User- professional', userType: 'athlete', days1: 300, days2: 30, price1: 60, price2: 50, credit1: 30, credit2: 30, credit3: 30, credit4: 30, inviteAthletes: 10, inviteTeams: 5, inviteGroups: 5, inviteClubs: 3, notifyChannels: notify('mail', 'network', 'cellular', 'facebook') },
  // Coach
  { id: 6, listOrder: 6, code: 'C01', name: 'Coach Base PFU pay for users', userType: 'coach', days1: 365, days2: 30, price1: 50, price2: 20, credit1: 10, credit2: 10, credit3: 10, credit4: 10, inviteAthletes: 5, inviteTeams: 1, inviteGroups: 1, inviteClubs: 1, notifyChannels: notify('mail', 'network', 'cellular', 'facebook'), isDefault: true },
  { id: 7, listOrder: 7, code: 'C02', name: "Coach Base don't pay for users", userType: 'coach', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 15, credit2: 15, credit3: 15, credit4: 15, inviteAthletes: 10, inviteTeams: 3, inviteGroups: 2, inviteClubs: 2, notifyChannels: notify('mail', 'network') },
  { id: 8, listOrder: 8, code: 'C03', name: 'Coach Premium PFU', userType: 'coach', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 20, credit2: 20, credit3: 20, credit4: 20, inviteAthletes: 20, inviteTeams: 5, inviteGroups: 5, inviteClubs: 3, notifyChannels: notify('mail', 'network', 'cellular') },
  { id: 9, listOrder: 9, code: 'C04', name: 'Coach Premium', userType: 'coach', days1: 365, days2: 30, price1: 29, price2: 29, credit1: 5, credit2: 5, credit3: 5, credit4: 5, inviteAthletes: 2, inviteTeams: 1, inviteGroups: 1, inviteClubs: 1, notifyChannels: notify('mail', 'network') },
  { id: 19, listOrder: 10, code: 'C05', name: 'Coach Professional PFU', userType: 'coach', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 20, credit2: 20, credit3: 20, credit4: 20, inviteAthletes: 20, inviteTeams: 5, inviteGroups: 5, inviteClubs: 3, notifyChannels: notify('mail', 'network', 'cellular') },
  // Team
  { id: 10, listOrder: 11, code: 'T01', name: 'Team Base PFU pay for users', userType: 'team', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 10, credit2: 10, credit3: 10, credit4: 10, inviteAthletes: 10, inviteTeams: 1, inviteGroups: 1, inviteClubs: 1, notifyChannels: notify('mail', 'network', 'cellular', 'facebook'), isDefault: true },
  { id: 11, listOrder: 12, code: 'T02', name: "Team Base don't pay for user", userType: 'team', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 15, credit2: 15, credit3: 15, credit4: 15, inviteAthletes: 20, inviteTeams: 2, inviteGroups: 2, inviteClubs: 2, notifyChannels: notify('mail', 'network') },
  { id: 12, listOrder: 13, code: 'T03', name: 'Team Premium PFU', userType: 'team', days1: 365, days2: 30, price1: 1.99, price2: 1.99, credit1: 24, credit2: 24, credit3: 24, credit4: 24, inviteAthletes: 50, inviteTeams: 5, inviteGroups: 5, inviteClubs: 3, notifyChannels: notify('mail', 'network', 'cellular') },
  { id: 22, listOrder: 14, code: 'T04', name: 'Team Premium', userType: 'team', days1: 365, days2: 30, price1: 1.88, price2: 1.88, credit1: 15, credit2: 15, credit3: 15, credit4: 15, inviteAthletes: 20, inviteTeams: 2, inviteGroups: 2, inviteClubs: 2, notifyChannels: notify('mail', 'network') },
  { id: 23, listOrder: 15, code: 'T05', name: 'Team Professional PFU', userType: 'team', days1: 0, days2: 0, price1: 0, price2: 0, credit1: 24, credit2: 24, credit3: 24, credit4: 24, inviteAthletes: 50, inviteTeams: 5, inviteGroups: 5, inviteClubs: 3, notifyChannels: notify('mail', 'network', 'cellular') },
  // Group
  { id: 13, listOrder: 20, code: 'G01', name: 'Group Standard Version', userType: 'group', days1: 365, days2: 30, price1: 30, price2: 15, credit1: 10, credit2: 10, credit3: 10, credit4: 10, inviteAthletes: 10, inviteTeams: 1, inviteGroups: 1, inviteClubs: 1, notifyChannels: notify('mail', 'network') },
  { id: 14, listOrder: 21, code: 'G02', name: 'Group Premium', userType: 'group', days1: 365, days2: 30, price1: 60, price2: 30, credit1: 15, credit2: 15, credit3: 15, credit4: 15, inviteAthletes: 20, inviteTeams: 2, inviteGroups: 2, inviteClubs: 2, notifyChannels: notify('mail', 'network', 'cellular') },
  // Club
  { id: 15, listOrder: 16, code: 'Club Base', name: 'Club Base', userType: 'club', days1: 90, days2: 30, price1: 0, price2: 0, credit1: 20, credit2: 20, credit3: 20, credit4: 20, inviteAthletes: 13, inviteTeams: 1, inviteGroups: 10, inviteClubs: 1, notifyChannels: notify('mail', 'network'), isDefault: true },
  { id: 16, listOrder: 17, code: 'C02', name: 'Club Premium', userType: 'club', days1: 181, days2: 30, price1: 11, price2: 11, credit1: 30, credit2: 30, credit3: 30, credit4: 30, inviteAthletes: 13, inviteTeams: 1, inviteGroups: 10, inviteClubs: 1, notifyChannels: notify('mail', 'network', 'facebook') },
  { id: 17, listOrder: 18, code: 'Club Pro', name: 'Club Professional', userType: 'club', days1: 90, days2: 30, price1: 30, price2: 30, credit1: 40, credit2: 40, credit3: 40, credit4: 40, inviteAthletes: 13, inviteTeams: 1, inviteGroups: 10, inviteClubs: 1, notifyChannels: notify('mail', 'network', 'cellular', 'facebook') },
  { id: 18, listOrder: 19, code: 'C04', name: 'Club Trial', userType: 'club', days1: 30, days2: 10, price1: 0, price2: 0, credit1: 10, credit2: 10, credit3: 10, credit4: 10, inviteAthletes: 13, inviteTeams: 1, inviteGroups: 10, inviteClubs: 1, notifyChannels: notify('mail', 'network'), isTemplate: true },
];

const INITIAL_SUBSCRIPTION_LIST_ROWS: SubscriptionListRow[] =
  RAW_SUBSCRIPTION_LIST_ROWS.map(completeListRow);

/** Mutable list rows — updated when version settings are saved. */
let subscriptionListRows: SubscriptionListRow[] = INITIAL_SUBSCRIPTION_LIST_ROWS.map((row) => ({
  ...row,
}));

/** @deprecated Prefer getSubscriptionListRows() for current data. */
export const SUBSCRIPTION_LIST_ROWS: SubscriptionListRow[] = subscriptionListRows;

const SUBSCRIPTION_EDIT_STORAGE_KEY = 'movesbook:subscription-edit-data:v1';

export function getSubscriptionListRows(): SubscriptionListRow[] {
  return subscriptionListRows.map(getEffectiveListRow);
}

export const CLUB_TEMPLATE_ROWS: SubscriptionListRow[] = Array.from({ length: 12 }, (_, i) =>
  completeListRow({
    id: 100 + i,
    listOrder: 19 + i,
    code: '',
    name: '',
    userType: 'club',
    days1: 0,
    days2: 0,
    price1: 0,
    price2: 0,
    credit1: 0,
    credit2: 0,
    credit3: 0,
    credit4: 0,
    inviteAthletes: 13,
    inviteTeams: 1,
    inviteGroups: 10,
    inviteClubs: 1,
    notifyChannels: notify('mail', 'network'),
    isTemplate: true,
  }),
);

const USER_TYPE_LABELS: Record<SubscriptionUserType, string> = {
  athlete: 'Athlete',
  coach: 'Coach',
  team: 'Team',
  group: 'Group',
  club: 'Club',
};

export function getUserTypeLabel(type: SubscriptionUserType): string {
  return USER_TYPE_LABELS[type];
}

export function formatNotifyChannels(channels: SubscriptionListRow['notifyChannels']): string {
  const labels: Record<string, string> = {
    mail: 'Mail',
    network: 'Network',
    cellular: 'Cellular',
    facebook: 'Facebook',
  };
  return channels.map((c) => labels[c]).join('-');
}

export function getSubscriptionRowsByUserType(userType?: SubscriptionUserType | null): SubscriptionListRow[] {
  const rows = userType
    ? subscriptionListRows.filter((r) => r.userType === userType)
    : subscriptionListRows;
  return rows.map(getEffectiveListRow);
}

export function getSubscriptionByListOrder(listOrder: number): SubscriptionListRow | undefined {
  const row = subscriptionListRows.find((r) => r.listOrder === listOrder);
  return row ? getEffectiveListRow(row) : undefined;
}

export function getSubscriptionById(id: number): SubscriptionListRow | undefined {
  const row = subscriptionListRows.find((r) => r.id === id);
  return row ? getEffectiveListRow(row) : undefined;
}

/** Resolve /subscriptions/edit_subscription/[param]/… — accepts subscription id or listOrder. */
export function resolveSubscriptionFromEditRouteParam(
  param: number,
): SubscriptionListRow | undefined {
  if (!Number.isFinite(param)) return undefined;

  const byListOrder = getSubscriptionByListOrder(param);
  const byId = getSubscriptionById(param);

  // e.g. /edit_subscription/15/en → id 15 Club Base, not listOrder 15 Team Pro
  if (byId?.userType === 'club' && byListOrder?.userType !== 'club') {
    return byId;
  }

  return byListOrder ?? byId;
}

export function getClubEditHref(row: SubscriptionListRow): string {
  return `/subscriptions/club_edit_subscription/${row.id}/club`;
}

export function getEditHref(row: SubscriptionListRow): string {
  if (row.userType === 'club') {
    return getClubEditHref(row);
  }
  return `/subscriptions/edit_subscription/${row.id}/en`;
}

function buildDefaultEditData(row: SubscriptionListRow): SubscriptionEditData {
  return {
    id: row.id,
    listOrder: row.listOrder,
    userType: row.userType,
    general: {
      code: row.code,
      name: row.name,
      senderRegisterCredit1: row.credit1,
      senderRegisterCredit2: row.credit2,
      receiverRegisterCredit1: row.credit3,
      receiverRegisterCredit2: row.credit4,
      maxDiscount: 10,
      promocodeDurationDays: 10,
      promocodeAssign: false,
      firstSubscriptionDays: row.days1,
      firstSubscriptionPrice: row.price1,
      firstSubscriptionPromoDiscount: 10,
      renewalDays: row.days2,
      renewalPrice: row.price2,
      renewalPromoDiscount: 10,
      tripleDurationDiscount: row.userType === 'coach' ? 40 : 60,
      tripleDurationPrice: row.userType === 'coach' ? 30 : 150,
      sloganByLang: {
        en:
          row.userType === 'athlete'
            ? '<p><em>This is a Test of Insertions of a Trial Base News.</em></p>'
            : row.userType === 'coach'
              ? '<p>Great offer for a 3 years renewal !!</p>'
              : row.userType === 'club'
                ? '<p><strong>Club version</strong> — training management, member sharing, and team tools for your organization.</p>'
                : '',
      },
    },
    settings: {
      coachesLimit: row.userType === 'athlete' ? 2 : 0,
      coachTiers: { ...DEFAULT_TIERS },
      athletesLimit:
        row.userType === 'coach' ||
        row.userType === 'team' ||
        row.userType === 'group' ||
        row.userType === 'club'
          ? row.inviteAthletes
          : 0,
      athleteTiers: { trial: true, base: false, premium: false, pro: false },
      coachSharing: { limit: 1, sharingEnabled: true },
      creatableCompanies: row.creatableCompanies,
      usersAvailableFirstSubscription: row.usersFirstSubscription,
      usersAvailableRenewal: row.usersRenewal,
      teams: { limit: row.inviteTeams, sharingEnabled: true },
      groups: { limit: row.inviteGroups, sharingEnabled: true },
      clubs: { limit: row.inviteClubs, sharingEnabled: true },
      alertDaysBefore: 0,
      alertDaysAfter: 0,
      alertEveryDay: false,
      notifyMail: row.notifyChannels.includes('mail'),
      notifyNetwork: row.notifyChannels.includes('network'),
      notifyCellular: row.notifyChannels.includes('cellular'),
      notifyFacebook: row.notifyChannels.includes('facebook'),
      inviteEndMode: row.userType === 'coach' ? 'days_after_accept' : 'own_subscription',
      inviteEndDays: 2,
      invitedUserVersion: 'same',
      expirationMessageEnabled: row.userType === 'coach',
      expirationDaysAfter: 30,
      expirationDaysBefore: 30,
      expirationMessageByLang: {
        en:
          row.userType === 'coach'
            ? '<p>Details of subscription C01 - Coach Base PFU pay for users en</p>'
            : '',
      },
      lastNewsByLang: {
        en:
          row.userType === 'athlete'
            ? '<p><em>This is a Test of Insertions of a Trial Base News.</em></p>'
            : row.userType === 'club' && row.code === 'Club Base'
              ? '<p style="text-align:center"><strong style="color:#8b0000;font-size:1.25rem">NEW FEATURES OF <em>CLUB version BASE</em></strong></p><p style="background:#e0e0e0;padding:8px"><strong style="color:#8b0000;font-style:italic">11 Nov 2021</strong></p><p style="color:#888;font-style:italic;font-size:0.875rem">Elio</p>'
              : row.userType === 'coach'
                ? '<p>Great offer for a 3 years renewal !!</p>'
                : '',
      },
    },
  };
}

const editDataCache = new Map<number, SubscriptionEditData>();

function buildNotifyChannelsFromSettings(
  settings: SubscriptionEditData['settings'],
): SubscriptionListRow['notifyChannels'] {
  const channels: SubscriptionListRow['notifyChannels'] = [];
  if (settings.notifyMail) channels.push('mail');
  if (settings.notifyNetwork) channels.push('network');
  if (settings.notifyCellular) channels.push('cellular');
  if (settings.notifyFacebook) channels.push('facebook');
  return channels;
}

function usesAthletesInviteLimit(userType: SubscriptionUserType): boolean {
  return userType === 'coach' || userType === 'team' || userType === 'group' || userType === 'club';
}

function applyEditDataToListRow(
  row: SubscriptionListRow,
  data: SubscriptionEditData,
): SubscriptionListRow {
  const { general, settings } = data;

  return {
    ...row,
    code: general.code,
    name: general.name,
    days1: general.firstSubscriptionDays,
    days2: general.renewalDays,
    price1: general.firstSubscriptionPrice,
    price2: general.renewalPrice,
    credit1: general.senderRegisterCredit1,
    credit2: general.senderRegisterCredit2,
    credit3: general.receiverRegisterCredit1,
    credit4: general.receiverRegisterCredit2,
    inviteAthletes: usesAthletesInviteLimit(row.userType)
      ? settings.athletesLimit
      : row.inviteAthletes,
    inviteTeams: settings.teams.limit,
    inviteGroups: settings.groups.limit,
    inviteClubs: settings.clubs.limit,
    notifyChannels: buildNotifyChannelsFromSettings(settings),
    ...(hasCreatableCompaniesSetting(row.userType)
      ? {
          creatableCompanies: settings.creatableCompanies,
          usersFirstSubscription: settings.usersAvailableFirstSubscription,
          usersRenewal: settings.usersAvailableRenewal,
        }
      : {}),
  };
}

function getEffectiveListRow(row: SubscriptionListRow): SubscriptionListRow {
  const cached = editDataCache.get(row.id);
  return cached ? applyEditDataToListRow(row, cached) : row;
}

function syncListRowFromEditData(data: SubscriptionEditData): void {
  const index = subscriptionListRows.findIndex((row) => row.id === data.id);
  if (index < 0) return;
  subscriptionListRows[index] = applyEditDataToListRow(subscriptionListRows[index], data);
}

function persistEditDataCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: Record<string, SubscriptionEditData> = {};
    editDataCache.forEach((data, id) => {
      payload[String(id)] = data;
    });
    window.localStorage.setItem(SUBSCRIPTION_EDIT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode errors in mock storage.
  }
}

function mergeRichTextByLang(
  cached: Record<string, string> | undefined,
  defaults: Record<string, string>,
): Record<string, string> {
  const merged = { ...defaults };
  if (!cached) return merged;

  for (const [key, value] of Object.entries(cached)) {
    if (hasRichTextContent(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

function mergeMembershipSetting(
  cached: SubscriptionMembershipSetting | undefined,
  defaults: SubscriptionMembershipSetting,
): SubscriptionMembershipSetting {
  return {
    limit: cached?.limit ?? defaults.limit,
    sharingEnabled: cached?.sharingEnabled ?? defaults.sharingEnabled,
  };
}

function mergeEditDataWithDefaults(
  cached: SubscriptionEditData,
  row: SubscriptionListRow,
): SubscriptionEditData {
  const defaults = buildDefaultEditData(row);

  return {
    ...cached,
    general: {
      ...cached.general,
      sloganByLang: mergeRichTextByLang(cached.general?.sloganByLang, defaults.general.sloganByLang),
    },
    settings: {
      ...defaults.settings,
      ...cached.settings,
      athletesLimit: cached.settings?.athletesLimit ?? defaults.settings.athletesLimit,
      coachSharing: mergeMembershipSetting(
        cached.settings?.coachSharing,
        defaults.settings.coachSharing,
      ),
      teams: mergeMembershipSetting(cached.settings?.teams, defaults.settings.teams),
      groups: mergeMembershipSetting(cached.settings?.groups, defaults.settings.groups),
      clubs: mergeMembershipSetting(cached.settings?.clubs, defaults.settings.clubs),
      lastNewsByLang: mergeRichTextByLang(
        cached.settings?.lastNewsByLang,
        defaults.settings.lastNewsByLang,
      ),
    },
  };
}

function loadEditDataCacheFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTION_EDIT_STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw) as Record<string, SubscriptionEditData>;
    for (const data of Object.values(payload)) {
      if (!data?.id) continue;
      editDataCache.set(data.id, data);
      syncListRowFromEditData(data);
    }
  } catch {
    // Ignore corrupt storage payloads.
  }
}

/** Reload subscription edit data from localStorage (e.g. after admin save in another tab). */
export function syncSubscriptionEditDataFromStorage(): void {
  loadEditDataCacheFromStorage();
}

function hydrateEditDataCacheFromStorage(): void {
  loadEditDataCacheFromStorage();
}

export const SUBSCRIPTION_SETTINGS_UPDATED_EVENT = 'subscription-settings-updated';

function notifySubscriptionSettingsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SUBSCRIPTION_SETTINGS_UPDATED_EVENT));
}

function normalizeSubscriptionEditSettings(
  settings: SubscriptionEditSettings,
  userType?: SubscriptionUserType,
): SubscriptionEditSettings {
  const manageableDefaults = userType
    ? getDefaultManageableUsersForUserType(userType)
    : { creatableCompanies: 0, usersFirstSubscription: 0, usersRenewal: 0 };

  return {
    ...settings,
    coachSharing: settings.coachSharing ?? { limit: 1, sharingEnabled: true },
    teams: settings.teams ?? { limit: 0, sharingEnabled: true },
    groups: settings.groups ?? { limit: 0, sharingEnabled: true },
    clubs: settings.clubs ?? { limit: 0, sharingEnabled: true },
    creatableCompanies: settings.creatableCompanies ?? manageableDefaults.creatableCompanies,
    usersAvailableFirstSubscription:
      settings.usersAvailableFirstSubscription ?? manageableDefaults.usersFirstSubscription,
    usersAvailableRenewal:
      settings.usersAvailableRenewal ?? manageableDefaults.usersRenewal,
  };
}

export function getSubscriptionEditData(idOrListOrder: number, byListOrder = false): SubscriptionEditData | null {
  const row = byListOrder
    ? subscriptionListRows.find((entry) => entry.listOrder === idOrListOrder)
    : subscriptionListRows.find((entry) => entry.id === idOrListOrder);
  if (!row) return null;

  const effectiveRow = getEffectiveListRow(row);
  const cached = editDataCache.get(row.id);
  if (cached) {
    const merged = mergeEditDataWithDefaults(cached, effectiveRow);
    return {
      ...merged,
      settings: normalizeSubscriptionEditSettings(merged.settings, merged.userType),
    };
  }

  const built = buildDefaultEditData(effectiveRow);
  return {
    ...built,
    settings: normalizeSubscriptionEditSettings(built.settings, built.userType),
  };
}

/** Apply version settings loaded from the database (server store or public API). */
export function applySubscriptionEditDataSnapshot(
  payload: Record<string, SubscriptionEditData>,
): void {
  for (const data of Object.values(payload)) {
    if (!data?.id) continue;
    editDataCache.set(data.id, data);
    syncListRowFromEditData(data);
  }
  persistEditDataCache();
}

const VERSION_SETTINGS_PUBLIC_URL = '/api/subscriptions/version-settings';

function adminVersionSettingsUrl(id: number): string {
  return `/api/admin/subscriptions/version-settings/${id}`;
}

async function putVersionSettingsToServer(data: SubscriptionEditData, token: string): Promise<boolean> {
  try {
    const res = await fetch(adminVersionSettingsUrl(data.id), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let serverLoad: Promise<void> | null = null;

/** Browser: load the admin-saved version settings from the database once per page. */
export function loadSubscriptionEditDataFromServer(force = false): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (serverLoad && !force) return serverLoad;
  serverLoad = (async () => {
    try {
      const res = await fetch(VERSION_SETTINGS_PUBLIC_URL, { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { versions?: Record<string, SubscriptionEditData> };
      const versions = body.versions ?? {};

      // One-time migration: versions edited before database storage exist only in the admin's browser.
      const token = getAdminBearerToken();
      if (token) {
        for (const [id, data] of editDataCache.entries()) {
          if (!versions[String(id)]) void putVersionSettingsToServer(data, token);
        }
      }

      applySubscriptionEditDataSnapshot(versions);
      notifySubscriptionSettingsUpdated();
    } catch {
      // Keep defaults / local cache when offline.
    }
  })();
  return serverLoad;
}

/** Save locally and in the database. Resolves false when the database save failed. */
export async function saveSubscriptionEditData(data: SubscriptionEditData): Promise<boolean> {
  editDataCache.set(data.id, data);
  syncListRowFromEditData(data);
  persistEditDataCache();
  notifySubscriptionSettingsUpdated();
  const token = getAdminBearerToken();
  if (!token) return false;
  return putVersionSettingsToServer(data, token);
}

/** Apply version settings loaded from the database (server cache or browser hydration). */
export function applySubscriptionEditDataList(list: SubscriptionEditData[]): void {
  for (const data of list) {
    if (!data?.id) continue;
    editDataCache.set(data.id, data);
    syncListRowFromEditData(data);
  }
  if (typeof window !== 'undefined') {
    persistEditDataCache();
    notifySubscriptionSettingsUpdated();
  }
}

export const SUBSCRIPTION_VERSIONS_API = '/api/subscription-versions';

/** Save version settings to the database, then update the local cache. */
export async function saveSubscriptionEditDataToServer(data: SubscriptionEditData): Promise<void> {
  const { getAdminBearerToken } = await import('@/lib/admin/clientAdminAuth');
  const token = getAdminBearerToken();
  const res = await fetch(`${SUBSCRIPTION_VERSIONS_API}/${data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Could not save the version settings');
  }
  saveSubscriptionEditData(data);
}

type SavedVersionsResponse = { versions?: SubscriptionEditData[]; seededIds?: number[] };

async function fetchSavedVersions(): Promise<SavedVersionsResponse | null> {
  const res = await fetch(SUBSCRIPTION_VERSIONS_API, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as SavedVersionsResponse) : null;
}

async function hydrateEditDataFromServer(): Promise<void> {
  try {
    let body = await fetchSavedVersions();
    if (!body) return;
    const saved = Array.isArray(body.versions) ? body.versions : [];
    const savedIds = new Set(saved.map((v) => v.id));
    const seededIds = new Set(Array.isArray(body.seededIds) ? body.seededIds : []);

    // One-time migration of values an admin saved in this browser before the DB storage existed.
    const localOnly: SubscriptionEditData[] = [];
    editDataCache.forEach((data, id) => {
      if (!savedIds.has(id) || seededIds.has(id)) localOnly.push(data);
    });
    if (localOnly.length > 0) {
      const { getAdminBearerToken } = await import('@/lib/admin/clientAdminAuth');
      const token = getAdminBearerToken();
      if (token) {
        const migrated = await fetch(`${SUBSCRIPTION_VERSIONS_API}/migrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ versions: localOnly }),
        }).catch(() => null);
        if (migrated?.ok) body = (await fetchSavedVersions()) ?? body;
      }
    }

    const latest = Array.isArray(body.versions) ? body.versions : [];
    if (latest.length > 0) applySubscriptionEditDataList(latest);
  } catch {
    // Offline or API unavailable: keep defaults / local cache.
  }
}

hydrateEditDataCacheFromStorage();
void loadSubscriptionEditDataFromServer();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SUBSCRIPTION_EDIT_STORAGE_KEY || event.key === null) {
      loadEditDataCacheFromStorage();
    }
  });
  void hydrateEditDataFromServer();
}
