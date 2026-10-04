'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CalendarDays, CreditCard, Mail, User, X } from 'lucide-react';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import { COUNTRIES_WITH_CODES } from '@/lib/news/countries';
import AdminPcuDatePicker, {
  ddMmYyyyToIso,
  formatPcuIsoDate,
  isoToDdMmYyyy,
  parseIsoDate,
  toIsoDate,
} from '@/components/admin/AdminPcuDatePicker';
import NewsCategoriesMultiSelect from '@/components/admin/NewsCategoriesMultiSelect';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import {
  createNewsCategoriesState,
  createVipCountriesState,
  PCU_AGENT_OPTIONS,
  PCU_OPERATOR_OPTIONS,
} from '@/lib/admin/pcuAdminSettingsOptions';
import {
  mergeNewsCategories,
  mergeRecordFlags,
  mergeVipCountriesAllowed,
  type PcuSettings,
} from '@/lib/admin/userPcuSettings';
import { normalizePcuAlertDateToInput } from '@/lib/admin/userPcuAlertMsg';
import {
  flushSharedLangEditors,
  useLangHtmlEditor,
} from '@/lib/admin/pcuLangHtmlEditor.client';
import {
  applyExpirationFunctionsSlice,
  buildExpirationFunctionsSlice,
  DEFAULT_BUYED_ACCOUNTS_MATRIX,
  DEFAULT_FREE_ACCOUNTS_MATRIX,
  emptyHtmlByLang,
  LANG_KEYS,
  mergeBuyedAccountsMatrix,
  mergeFreeAccountsMatrix,
  mergeHtmlByLang,
  mergeHtmlByLangKeys,
  type PcuLangKey,
  type BuyedAccountsVersionMatrix,
  type ExpirationEndUserMode,
  type ExpirationFeatureMode,
  type FreeAccountsVersionMatrix,
  type NewMembersExpiryMode,
  type NewVersionAssignMode,
  type PcuFunctionsSettings,
  type VersionColumn3,
  type VersionColumn4,
} from '@/lib/admin/userPcuFunctionsSettings';
import {
  applyProcedureRowOnToggle,
  buildProcedureSavePayload,
  mergeProcedureRowsByTab,
  parseProcedureFromSaved,
  type ProcedureRow,
  type ProcedureRowsByTab,
  type ProcedureTabId,
} from '@/lib/admin/userPcuProcedureDefaults';
import {
  resolveRegisteredUserActionSegment,
  type PcuPanelPayload,
} from '@/lib/admin/userPcuPanel';
import { buildPcuHistoryUserUrl } from '@/lib/admin/pcuHistoryUserUrl';
import type { PcuAccessSettings } from '@/lib/admin/userPcuAccessSettings';
import { resolveProfileAccessDates, hasPendingMembershipRenewal } from '@/lib/admin/profileAccessDates';
import NotYetActivePeriodEditControl, {
  subscriptionPeriodDateClassName,
} from '@/components/admin/NotYetActivePeriodEditControl';
import ProfileReferencesReadOnly from '@/components/admin/ProfileReferencesReadOnly';
import {
  normalizeFavouritePriority,
  type FavouritePriority,
  type ProfilePanelSettings,
} from '@/lib/admin/userProfilePanelSettings';
const CKEditorComponent = dynamic(() => import('@/components/news/CKEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[200px] border border-gray-300 rounded bg-gray-50 animate-pulse" aria-hidden />
  ),
});

const BASE_TABS = [
  { id: 'purchases', label: 'IPurchases' },
  { id: 'profile', label: 'Profile' },
  { id: 'admin', label: "Admin's settings" },
  { id: 'functions', label: 'Functions' },
  { id: 'alert', label: 'Alert msg' },
] as const;

const CLUB_EXTRA_TABS = [
  { id: 'idcards', label: 'ID Cards' },
  { id: 'cards', label: 'Cards Status' },
  { id: 'devices', label: 'Devices' },
  { id: 'posts', label: 'Delete posts' },
] as const;

type TopTabId = string;

const isDataUrl = (src?: string | null) =>
  typeof src === 'string' && src.startsWith('data:image/');

function flagEmojiFromCode(code: string): string {
  const cc = (code || '').trim().toUpperCase();
  if (cc.length !== 2) return '';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(A + cc.charCodeAt(0) - base, A + cc.charCodeAt(1) - base);
}

function countryCodeFromName(name: string): string {
  if (!name.trim()) return '';
  return COUNTRIES_WITH_CODES.find((c) => c.name === name.trim())?.id ?? '';
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const FILTER_VERSION_OPTIONS = [
  'All',
  'Trial Base',
  'Trial for club members',
  'User- base version',
  'User- premium',
  'User- professional',
  "Coach Base PFU pay for users",
  "Coach Base don't pay for users",
  'Coach Premium PFU',
  'Coach Premium',
  'Coach Professional PFU',
  'Coach Professional',
  'Team Base PFU pay for users',
  "Team Base don't pay for user",
  'Team Premium PFU',
  'Team Premium',
  'Team Professional PFU',
  'Team Professional',
  'Group Standard Version',
  'Club Base',
  'Club Premium',
  'Club Professional',
  'Club Trial',
] as const;

type OrderingOption = 'ordering' | 'by version' | 'by date start subscription' | 'by date end subscription';

type SubscriptionRow = {
  id: string;
  dateStart: string;
  dateEnd: string | null;
  version: string;
  username: string;
  companyName: string;
  e: string;
  status: string;
};

function normalizeIsoDate(value: string | null | undefined): string {
  const raw = value?.trim() || '';
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return ddMmYyyyToIso(raw) || raw;
}

function pcuSettingsEndpoint(userId: string, entityId?: string | null): string {
  const base = `/api/admin/registered-users/${encodeURIComponent(userId)}/pcu-settings`;
  const id = entityId?.trim();
  if (!id) return base;
  return `${base}?${new URLSearchParams({ entityId: id }).toString()}`;
}

function withPcuEntityScope(
  payload: Record<string, unknown>,
  entityId?: string | null,
): Record<string, unknown> {
  const id = entityId?.trim();
  if (!id) return payload;
  return { ...payload, entityId: id, clubId: id };
}

function resolvePcuAccessDates(
  user: PcuPanelPayload,
  subscriptionRows: SubscriptionRow[],
  initialPcuAccess?: PcuAccessSettings,
): { accessStart: string; accessEnd: string } {
  const resolved = resolveProfileAccessDates(subscriptionRows, initialPcuAccess, {
    start: user.startDateIso,
    end: user.endDateIso,
  });
  return {
    accessStart: normalizeIsoDate(resolved.accessStart),
    accessEnd: normalizeIsoDate(resolved.accessEnd),
  };
}

/** Extended expiration = actual subscription end + N days (-1 = no auto date). */
function computeExtendedExpirationIso(actualIso: string, daysStr: string): string {
  const actual = actualIso.trim();
  const daysRaw = daysStr.trim();
  if (!actual || actual.startsWith('0000') || !daysRaw || daysRaw === '-1') return '';
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days < 0) return '';
  const base = parseIsoDate(actual);
  if (!base) return '';
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
}

type UserPcuControlPanelProps = {
  user: PcuPanelPayload;
  backHref: string;
  subscriptionRows?: SubscriptionRow[];
  profilePanel?: ProfilePanelSettings;
  initialPcuAccess?: PcuAccessSettings;
  /** Tab shown first (history user page uses subscription / iPurchases). */
  defaultActiveTab?: TopTabId;
  /** Profile tab: Admin Profile vs club/team/group/coach profile (from URL). */
  defaultProfileSubTab?: 'admin' | 'entity';
  /** Segment for admin actions API (falls back to user.segment). */
  actionSegment?: string;
  /** Saved admin tab settings loaded from the server. */
  initialPcuSettings?: PcuSettings | null;
  /** Link back to read-only PCU overview (user search eye icon). */
  overviewHref?: string;
  /** Reload profile/subscription rows after access dates change. */
  onAccessDatesSaved?: () => void | Promise<void>;
};

function SubscriptionFilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-between">
      <span className="font-medium text-gray-900 shrink-0">{label}</span>
      {children}
    </div>
  );
}

export default function UserPcuControlPanel({
  user,
  backHref,
  subscriptionRows = [],
  profilePanel,
  initialPcuAccess,
  defaultActiveTab = 'profile',
  defaultProfileSubTab = 'admin',
  actionSegment,
  initialPcuSettings = null,
  overviewHref,
  onAccessDatesSaved,
}: UserPcuControlPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const segmentForActions = resolveRegisteredUserActionSegment(actionSegment, user.segment);
  const pcuEntityId = user.entityId;
  const loadedPcuSettingsRef = useRef<PcuSettings | null>(null);
  const reloadPcuFromServerRef = useRef<(pcu: PcuSettings | undefined) => void>(() => {});
  const initialPcuHydratedRef = useRef(false);
  const vipBannerBlobRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopTabId>(defaultActiveTab);
  const [profileSubTab, setProfileSubTab] = useState<'admin' | 'entity'>(defaultProfileSubTab);

  useEffect(() => {
    setProfileSubTab(defaultProfileSubTab);
  }, [user.userId, defaultProfileSubTab]);
  const initialAccessDates = resolvePcuAccessDates(user, subscriptionRows, initialPcuAccess);
  const [accessStart, setAccessStart] = useState(() => initialAccessDates.accessStart);
  const [accessEnd, setAccessEnd] = useState(() => initialAccessDates.accessEnd);
  const [suspendAccessControl, setSuspendAccessControl] = useState(
    () => initialPcuAccess?.suspendAccessControl ?? false,
  );
  const [suspend, setSuspend] = useState(() => initialPcuAccess?.suspend ?? false);
  const pcuAccessSnapshotRef = useRef({
    accessStart: initialAccessDates.accessStart,
    accessEnd: initialAccessDates.accessEnd,
    suspendAccessControl: initialPcuAccess?.suspendAccessControl ?? false,
    suspend: initialPcuAccess?.suspend ?? false,
  });
  const [tagUser, setTagUser] = useState(() => Boolean(profilePanel?.tagged));
  const [favouritePriority, setFavouritePriority] = useState<FavouritePriority>(() =>
    normalizeFavouritePriority(profilePanel?.favouritePriority),
  );
  const [profilePanelSaving, setProfilePanelSaving] = useState(false);
  const [pcuAccessSaving, setPcuAccessSaving] = useState(false);
  /** € paid for the window shown in Start/End (statistics Income uses it). */
  const [periodAmountPaid, setPeriodAmountPaid] = useState('');
  const periodAmountSavedRef = useRef('');
  const [profileRowSelected, setProfileRowSelected] = useState<Set<string>>(() => new Set());
  const [actionBusy, setActionBusy] = useState(false);
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgSubject, setMsgSubject] = useState('Message from Movesbook Admin');
  const [msgError, setMsgError] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailError, setMailError] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterVersion, setFilterVersion] = useState<string>('All');
  const [filterSubscription, setFilterSubscription] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('jan');
  const [filterYear, setFilterYear] = useState<string>('2010');
  const [ordering, setOrdering] = useState<OrderingOption>('ordering');
  const [adminTab, setAdminTab] = useState<'operator' | 'blocks' | 'vip'>('operator');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaveError, setAdminSaveError] = useState('');
  const [adminSaveSuccess, setAdminSaveSuccess] = useState('');

  // Admin's settings - UI + editable draft (persisted on Save)
  const [extendEnabled, setExtendEnabled] = useState(true);
  const [extendMonths, setExtendMonths] = useState('12');
  const [asOperator, setAsOperator] = useState(false);
  const [operatorId, setOperatorId] = useState('');
  const [asAgent, setAsAgent] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [enableUserComments, setEnableUserComments] = useState(false);
  const [enableFeedback, setEnableFeedback] = useState(false);
  const [enableBlogs, setEnableBlogs] = useState(false);
  const [blogsDate, setBlogsDate] = useState('');
  const [enableReviews, setEnableReviews] = useState(false);
  const [reviewsDate, setReviewsDate] = useState('');
  const [disableCommentsReviews, setDisableCommentsReviews] = useState(false);
  const [disableCommentsSuggestions, setDisableCommentsSuggestions] = useState(false);
  const [disableCommentsHtmlDocs, setDisableCommentsHtmlDocs] = useState(false);
  const [disableCommentsQueries, setDisableCommentsQueries] = useState(false);
  const [disableCommentsBugs, setDisableCommentsBugs] = useState(false);
  const [disableCommentsBlogs, setDisableCommentsBlogs] = useState(false);
  const [enableSponsors, setEnableSponsors] = useState(false);
  const [sponsorsLastPurchase, setSponsorsLastPurchase] = useState('');
  const [sponsorsExpiration, setSponsorsExpiration] = useState('');
  const [sponsorsCount, setSponsorsCount] = useState('10');
  const [sponsorsCost, setSponsorsCost] = useState('10');
  const [sponsorsPaymentStatus, setSponsorsPaymentStatus] = useState('not ok');

  // Blocks
  const [blockUserEnabled, setBlockUserEnabled] = useState(false);
  const [blockUserAfterDate, setBlockUserAfterDate] = useState('');
  const [blockSocialArea, setBlockSocialArea] = useState(false);
  const [blockTrainingArea, setBlockTrainingArea] = useState(false);
  const [blockManagementArea, setBlockManagementArea] = useState(false);
  const [blockAssignmentsEnabled, setBlockAssignmentsEnabled] = useState(false);
  const [blockAssignmentsAfterDate, setBlockAssignmentsAfterDate] = useState('');

  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertHtmlByLang, setAlertHtmlByLang] = useState<Record<string, string>>(() => emptyHtmlByLang());

  // VIP
  const [vipShowInReferenceList, setVipShowInReferenceList] = useState(false);
  const [vipShowInBanner, setVipShowInBanner] = useState(false);
  const [vipUsernameEnabled, setVipUsernameEnabled] = useState(false);
  const [vipYoutubeEnabled, setVipYoutubeEnabled] = useState(false);
  const [vipUsername, setVipUsername] = useState(() => user.username || '');
  const [vipYoutubeUrl, setVipYoutubeUrl] = useState('');
  const [vipBannerImagePath, setVipBannerImagePath] = useState<string | null>(null);
  const [vipBannerPreviewBlob, setVipBannerPreviewBlob] = useState<string | null>(null);
  const [vipBannerVersion, setVipBannerVersion] = useState(0);
  const [vipBannerUploading, setVipBannerUploading] = useState(false);
  const [vipBannerUploadError, setVipBannerUploadError] = useState('');
  const [vipReferencesHtmlByLang, setVipReferencesHtmlByLang] = useState<Record<string, string>>(() =>
    emptyHtmlByLang(),
  );
  const [vipPriorityLevel, setVipPriorityLevel] = useState('First');
  const [vipFavourite, setVipFavourite] = useState(false);

  // Admin's settings (single user / athlete) - VIP Settings selections
  const [vipEnabled, setVipEnabled] = useState(false);
  const [vipTypes, setVipTypes] = useState<Record<string, boolean>>({
    all: false,
    vipUsers: false,
    vipsOfMySport: false,
    myClubsUsers: false,
    myTeamsUsers: false,
    athletes: false,
    coaches: false,
    teams: false,
    testimonials: false,
    populars: false,
    users: false,
    lastLogged: false,
    ourClubs: false,
  });
  const [vipVisibleToUserTypes, setVipVisibleToUserTypes] = useState<Record<string, boolean>>({
    all: false,
    athlete: false,
    coach: false,
    team: false,
    club: false,
    group: false,
    club_subadmin: false,
    club_operator: false,
  });
  const [vipLanguagesAllowed, setVipLanguagesAllowed] = useState<Record<string, boolean>>({
    all: false,
    English: false,
    French: false,
    Deutsch: false,
    Italiano: false,
    Spanish: false,
    Portuguese: false,
    Russian: false,
    Hindi: false,
    Chinese: false,
    Arabic: false,
  });
  const [vipCountriesAllowed, setVipCountriesAllowed] = useState<Record<string, boolean>>(() =>
    createVipCountriesState(),
  );
  const [newsCategoriesFollowed, setNewsCategoriesFollowed] = useState<Record<string, boolean>>(() =>
    createNewsCategoriesState(),
  );
  const [vipDuration, setVipDuration] = useState(() => isoToDdMmYyyy(new Date().toISOString().slice(0, 10)));
  const [vipAllowVisitorsProfile, setVipAllowVisitorsProfile] = useState(true);
  const [vipAllowVisitorsBiography, setVipAllowVisitorsBiography] = useState(true);
  const [vipAllowVisitorsFriendship, setVipAllowVisitorsFriendship] = useState(true);
  const [vipAllowVisitorsMail, setVipAllowVisitorsMail] = useState(true);

  const [vipBannerImageFileName, setVipBannerImageFileName] = useState('No file chosen');

  const clearVipBannerPreviewBlob = useCallback(() => {
    if (vipBannerBlobRef.current) {
      URL.revokeObjectURL(vipBannerBlobRef.current);
      vipBannerBlobRef.current = null;
    }
    setVipBannerPreviewBlob(null);
  }, []);

  const vipBannerDisplaySrc = useMemo(() => {
    if (vipBannerPreviewBlob) return vipBannerPreviewBlob;
    const resolved = resolvePublicImageUrl(vipBannerImagePath);
    if (!resolved) return null;
    return vipBannerVersion > 0 ? `${resolved}?v=${vipBannerVersion}` : resolved;
  }, [vipBannerPreviewBlob, vipBannerImagePath, vipBannerVersion]);

  useEffect(() => () => clearVipBannerPreviewBlob(), [clearVipBannerPreviewBlob]);

  // Functions tab (club-focused UI)
  const [functionsLang, setFunctionsLang] = useState<PcuLangKey>('en');
  const [functionsSaving, setFunctionsSaving] = useState(false);
  const [functionsSaveError, setFunctionsSaveError] = useState('');
  const [functionsSaveSuccess, setFunctionsSaveSuccess] = useState('');
  const [expirationNotifySaving, setExpirationNotifySaving] = useState(false);
  const [expirationFlowSaving, setExpirationFlowSaving] = useState(false);
  const [expirationMsgSaving, setExpirationMsgSaving] = useState(false);
  const [newMembersSaving, setNewMembersSaving] = useState(false);
  const [newVersionSaving, setNewVersionSaving] = useState(false);

  const [maxMembers, setMaxMembers] = useState('1301');
  const [currentMembers, setCurrentMembers] = useState('5');
  const stillAvailable = useMemo(() => {
    const max = Number(maxMembers);
    const cur = Number(currentMembers);
    if (!Number.isFinite(max) || !Number.isFinite(cur)) return '—';
    return String(Math.max(0, max - cur));
  }, [currentMembers, maxMembers]);

  const [newLicenseRequests, setNewLicenseRequests] = useState('');
  const [authorizationNo, setAuthorizationNo] = useState('');
  const [priceEuro, setPriceEuro] = useState('');
  const [costToPay, setCostToPay] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [maxDevicesCanEnable, setMaxDevicesCanEnable] = useState('');
  const [currentDeviceEnabled, setCurrentDeviceEnabled] = useState('');
  const [requestCodePending, setRequestCodePending] = useState('');
  const [deviceDisable, setDeviceDisable] = useState('');
  const [availableEnquiries, setAvailableEnquiries] = useState('');
  const [subscriptionExpiration, setSubscriptionExpiration] = useState('');
  const [blockCodeGeneration, setBlockCodeGeneration] = useState(false);

  const [postActivationMsgEnabled, setPostActivationMsgEnabled] = useState(true);
  const [postActivationDays, setPostActivationDays] = useState('1-30');
  const [postActivationHtmlByLang, setPostActivationHtmlByLang] = useState<Record<string, string>>(() =>
    emptyHtmlByLang(),
  );

  const [freeAccountsDurationDays, setFreeAccountsDurationDays] = useState('');
  const [freeAccountsMatrix, setFreeAccountsMatrix] = useState<FreeAccountsVersionMatrix>(
    () => ({ ...DEFAULT_FREE_ACCOUNTS_MATRIX }),
  );
  const [buyedAccountsMatrix, setBuyedAccountsMatrix] = useState<BuyedAccountsVersionMatrix>(
    () => ({ ...DEFAULT_BUYED_ACCOUNTS_MATRIX }),
  );
  const [termsCreditCard, setTermsCreditCard] = useState(true);
  const [termsSendMoneyLater, setTermsSendMoneyLater] = useState(true);
  const [termsSendMoneyDays, setTermsSendMoneyDays] = useState('30');

  const [sharingCoaches, setSharingCoaches] = useState(true);
  const [sharingTeams, setSharingTeams] = useState(true);
  const [sharingGroups, setSharingGroups] = useState(true);
  const [sharingOtherClubs, setSharingOtherClubs] = useState(true);

  const [notifyAtExpiration, setNotifyAtExpiration] = useState(false);
  const [notifyBeforeDays, setNotifyBeforeDays] = useState('');
  const [notifyAfterDays, setNotifyAfterDays] = useState('');
  const [notifyEveryDay, setNotifyEveryDay] = useState(false);
  const [notifyByMail, setNotifyByMail] = useState(false);
  const [notifyOnNetworkPage, setNotifyOnNetworkPage] = useState(false);
  const [notifyCellular, setNotifyCellular] = useState(false);
  const [notifyPostFacebook, setNotifyPostFacebook] = useState(false);

  const [stockAccounts, setStockAccounts] = useState('select');
  const [stockVersion, setStockVersion] = useState('select');
  const [stockPrice, setStockPrice] = useState('');
  const [stockPayment, setStockPayment] = useState('select');

  const [procedureTab, setProcedureTab] = useState<ProcedureTabId>('social');
  const [procedureRowsByTab, setProcedureRowsByTab] = useState(() => mergeProcedureRowsByTab());

  const procedureRows = procedureRowsByTab[procedureTab];

  const [expireExtendEnabled, setExpireExtendEnabled] = useState(false);
  const [expireExtendDays, setExpireExtendDays] = useState('');
  const [expireExtendedTo, setExpireExtendedTo] = useState('');
  const [expirationExtendDateError, setExpirationExtendDateError] = useState('');

  const [sharingSharedUsersMode, setSharingSharedUsersMode] = useState<ExpirationFeatureMode | ''>('');
  const [socialItemsMode, setSocialItemsMode] = useState<ExpirationFeatureMode | ''>('');
  const [socialClubPages, setSocialClubPages] = useState(true);
  const [socialMemberPages, setSocialMemberPages] = useState(false);
  const [trainingItemsMode, setTrainingItemsMode] = useState<ExpirationFeatureMode | ''>('');
  const [trainingClubPages, setTrainingClubPages] = useState(true);
  const [trainingMemberPages, setTrainingMemberPages] = useState(false);

  const currentSubscriptionExpirationIso = useMemo(() => {
    const access = accessEnd.trim();
    if (access && !access.startsWith('0000')) return access;
    const lic = subscriptionExpiration.trim();
    if (lic && !lic.startsWith('0000')) return lic;
    const profile = user.endDateIso?.trim() || '';
    if (profile && !profile.startsWith('0000')) return profile;
    return '';
  }, [accessEnd, subscriptionExpiration, user.endDateIso]);

  useEffect(() => {
    const actual = currentSubscriptionExpirationIso;
    if (!actual) return;
    if (subscriptionExpiration !== actual) {
      setSubscriptionExpiration(actual);
    }
  }, [currentSubscriptionExpirationIso, subscriptionExpiration]);

  useEffect(() => {
    if (!expireExtendEnabled) return;
    const extended = computeExtendedExpirationIso(
      currentSubscriptionExpirationIso,
      expireExtendDays,
    );
    if (extended) {
      setExpireExtendedTo(extended);
      setExpirationExtendDateError('');
    }
  }, [currentSubscriptionExpirationIso, expireExtendEnabled, expireExtendDays]);

  const handleExpireExtendedToChange = useCallback(
    (iso: string) => {
      setExpirationExtendDateError('');
      if (!iso.trim()) {
        setExpireExtendedTo('');
        return;
      }
      const actual = parseIsoDate(currentSubscriptionExpirationIso);
      const extended = parseIsoDate(iso);
      if (actual && extended && extended.getTime() <= actual.getTime()) {
        setExpirationExtendDateError('Extended date must be after the actual expiration date.');
        return;
      }
      setExpireExtendedTo(iso);
    },
    [currentSubscriptionExpirationIso],
  );

  const [endUsersInteractiveMode, setEndUsersInteractiveMode] = useState<ExpirationEndUserMode | ''>('');
  const [managementItemsMode, setManagementItemsMode] = useState<ExpirationEndUserMode | ''>('');
  const [insertOptionsManagementMode, setInsertOptionsManagementMode] = useState<ExpirationEndUserMode | ''>('');

  const [expirationMsgHtmlByLang, setExpirationMsgHtmlByLang] = useState(emptyHtmlByLang);

  const functionsPostActivationGetDataRef = useRef<(() => string) | null>(null);
  const functionsExpirationMsgGetDataRef = useRef<(() => string) | null>(null);

  const switchFunctionsLang = useCallback(
    (next: typeof functionsLang) => {
      if (next === functionsLang) return;
      flushSharedLangEditors(functionsLang, [
        {
          getData: functionsPostActivationGetDataRef.current,
          setHtmlByLang: setPostActivationHtmlByLang,
        },
        {
          getData: functionsExpirationMsgGetDataRef.current,
          setHtmlByLang: setExpirationMsgHtmlByLang,
        },
      ]);
      setFunctionsLang(next);
    },
    [functionsLang],
  );

  const [newMembersExpiryMode, setNewMembersExpiryMode] = useState<NewMembersExpiryMode | ''>('');
  const [newMembersAfterDays, setNewMembersAfterDays] = useState('');

  const [newVersionMode, setNewVersionMode] = useState<NewVersionAssignMode | ''>('');

  // ID Cards tab (club-focused UI)
  const [idCardsSaving, setIdCardsSaving] = useState(false);
  const [idCardsSaveError, setIdCardsSaveError] = useState('');
  const [idCardsSaveSuccess, setIdCardsSaveSuccess] = useState('');
  const [idCardsLang, setIdCardsLang] = useState<PcuLangKey>('en');

  const [idCardsCreditCard, setIdCardsCreditCard] = useState(true);
  const [idCardsSendMoneyLaterDays, setIdCardsSendMoneyLaterDays] = useState('60');

  const [idCardsMsgAfterExpeditionEnabled, setIdCardsMsgAfterExpeditionEnabled] = useState(true);
  const [idCardsMsgAfterExpeditionDays, setIdCardsMsgAfterExpeditionDays] = useState('3');
  const [idCardsMsgAfterExpeditionHtmlByLang, setIdCardsMsgAfterExpeditionHtmlByLang] = useState<
    Record<string, string>
  >(() => emptyHtmlByLang());

  const [idCardsThirdPartyEnabled, setIdCardsThirdPartyEnabled] = useState(true);
  const [idCardsThirdPartyHtmlByLang, setIdCardsThirdPartyHtmlByLang] = useState<Record<string, string>>(() =>
    emptyHtmlByLang(),
  );

  const idCardsExpeditionGetDataRef = useRef<(() => string) | null>(null);
  const idCardsThirdPartyGetDataRef = useRef<(() => string) | null>(null);

  const switchIdCardsLang = useCallback(
    (next: typeof idCardsLang) => {
      if (next === idCardsLang) return;
      flushSharedLangEditors(idCardsLang, [
        {
          getData: idCardsExpeditionGetDataRef.current,
          setHtmlByLang: setIdCardsMsgAfterExpeditionHtmlByLang,
        },
        {
          getData: idCardsThirdPartyGetDataRef.current,
          setHtmlByLang: setIdCardsThirdPartyHtmlByLang,
        },
      ]);
      setIdCardsLang(next);
    },
    [idCardsLang],
  );

  const [idCardsEnabledTab, setIdCardsEnabledTab] = useState<'magnetic' | 'rfids' | 'qr' | 'smartcards'>('magnetic');
  const [idCardsFrom, setIdCardsFrom] = useState('');
  const [idCardsTo, setIdCardsTo] = useState('');
  const [idCardsBlockDate, setIdCardsBlockDate] = useState('');
  const [idCardsSendEmail, setIdCardsSendEmail] = useState(false);

  const [idCardsAllowMagnetic, setIdCardsAllowMagnetic] = useState(true);
  const [idCardsAllowRfid, setIdCardsAllowRfid] = useState(false);
  const [idCardsAllowSmartcard, setIdCardsAllowSmartcard] = useState(true);
  const [idCardsAllowQr, setIdCardsAllowQr] = useState(false);

  const [idCardsHistoryQuery, setIdCardsHistoryQuery] = useState('');
  const [idCardsHistoryInvoice, setIdCardsHistoryInvoice] = useState('');
  const [idCardsHistoryPage, setIdCardsHistoryPage] = useState(1);

  // Cards Status tab
  const [cardStatusRows, setCardStatusRows] = useState([
    {
      id: 'total',
      label: 'Total card purchased',
      checked: false,
      global: 933,
      blocked: 4,
      assigned: 130,
      free: 799,
      assPct: 16.27,
      highlightFree: false,
      highlightPct: false,
    },
    {
      id: 'magnetic',
      label: 'Total magnetic cards',
      checked: false,
      global: 530,
      blocked: 4,
      assigned: 119,
      free: 407,
      assPct: 29.24,
      highlightFree: true,
      highlightPct: true,
    },
    {
      id: 'rfid',
      label: 'Total Rfid cards',
      checked: false,
      global: 1,
      blocked: 0,
      assigned: 1,
      free: 0,
      assPct: 0,
      highlightFree: true,
      highlightPct: true,
    },
    {
      id: 'qrcode',
      label: 'QRcode',
      checked: false,
      global: 201,
      blocked: 0,
      assigned: 6,
      free: 195,
      assPct: 3.08,
      highlightFree: true,
      highlightPct: true,
    },
    {
      id: 'smartcards',
      label: 'Total smartcards',
      checked: false,
      global: 201,
      blocked: 0,
      assigned: 4,
      free: 197,
      assPct: 2.03,
      highlightFree: true,
      highlightPct: true,
    },
  ]);

  // Devices tab
  const [devicesTab, setDevicesTab] = useState<'enabled' | 'logins'>('enabled');
  const [devicesSummary, setDevicesSummary] = useState({
    maxEnabled: '25',
    costOverNumber: '1',
    costEuro: '6 € (USD 7.3)',
    currentEnabled: '8',
    disabled: '0',
    pending: '5',
    availableInquiries: '12',
    expirationDate: user.endDateIso || '2026-12-31',
  });
  const [enabledDevices, setEnabledDevices] = useState<
    { id: string; name: string; locationLine: string; expanded?: boolean }[]
  >([
    { id: 'zerosoft_device', name: 'zerosoft_device', locationLine: 'Lapland , Finland - 3 months ago' },
    { id: 'ZST_device', name: 'ZST_device', locationLine: 'Lapland , Finland - 3 months ago' },
    { id: 'VENI', name: 'VENI', locationLine: 'Lapland , Finland - 4 months ago' },
    { id: 'goopit', name: 'goopit', locationLine: 'Lapland , Finland - 4 months ago' },
    { id: 'goopit_org', name: 'goopit_org', locationLine: 'Lapland , Finland - 4 months ago' },
    { id: 'goopit_ams', name: 'goopit_ams', locationLine: 'Lapland , Finland - 4 months ago' },
    { id: 'Ironelio_device', name: 'Ironelio_device', locationLine: 'Lapland , Finland - 4 months ago' },
  ]);
  const [deviceLogFrom, setDeviceLogFrom] = useState('');
  const [deviceLogTo, setDeviceLogTo] = useState('');
  const [deviceLogs, setDeviceLogs] = useState<
    { id: string; username: string; logDate: string; logTime: string; selected?: boolean }[]
  >([
    { id: 'l1', username: 'zerosoft_device', logDate: '2022-03-10', logTime: '10:26 AM' },
    { id: 'l2', username: 'zerosoft_device', logDate: '2022-02-22', logTime: '7:55 AM' },
    { id: 'l3', username: 'zerosoft_device', logDate: '2022-02-22', logTime: '7:04 AM' },
  ]);

  // Delete posts tab
  const [deletePostsQuestion, setDeletePostsQuestion] = useState(true);
  const [deletePostsSuggestion, setDeletePostsSuggestion] = useState(false);
  const [deletePostsProblem, setDeletePostsProblem] = useState(false);
  const [deletePostsFrom, setDeletePostsFrom] = useState('');
  const [deletePostsTo, setDeletePostsTo] = useState('');
  const [deletePostsSaving, setDeletePostsSaving] = useState(false);
  const [deletePostsSaveError, setDeletePostsSaveError] = useState('');
  const [deletePostsSaveSuccess, setDeletePostsSaveSuccess] = useState('');

  const saveDeletePosts = async () => {
    setDeletePostsSaving(true);
    setDeletePostsSaveError('');
    setDeletePostsSaveSuccess('');
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          withPcuEntityScope(
            {
              deletePosts: {
                types: { question: deletePostsQuestion, suggestion: deletePostsSuggestion, problem: deletePostsProblem },
                from: deletePostsFrom,
                to: deletePostsTo,
              },
            },
            pcuEntityId,
          ),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save delete posts');
      setDeletePostsSaveSuccess('Saved');
    } catch (e: unknown) {
      setDeletePostsSaveError(e instanceof Error ? e.message : 'Failed to save delete posts');
    } finally {
      setDeletePostsSaving(false);
      window.setTimeout(() => setDeletePostsSaveSuccess(''), 2500);
    }
  };

  // Alert msg tab
  type AlertMsgLang = 'it' | 'en';
  const [alertMsgLang, setAlertMsgLang] = useState<AlertMsgLang>('en');
  const [alertMsgActivated, setAlertMsgActivated] = useState(false);
  const [alertMsgEnableFrom, setAlertMsgEnableFrom] = useState('');
  const [alertMsgEnableTo, setAlertMsgEnableTo] = useState('');
  const [alertMsgShowLogin, setAlertMsgShowLogin] = useState(true);
  const [alertMsgShowLogout, setAlertMsgShowLogout] = useState(true);
  const [alertMsgHtmlByLang, setAlertMsgHtmlByLang] = useState<Record<AlertMsgLang, string>>({
    en: '',
    it: '',
  });
  const alertMsgEditor = useLangHtmlEditor(alertMsgLang, setAlertMsgLang, alertMsgHtmlByLang, setAlertMsgHtmlByLang);
  const [alertMsgSaving, setAlertMsgSaving] = useState(false);
  const [alertMsgSaveError, setAlertMsgSaveError] = useState('');
  const [alertMsgSaveSuccess, setAlertMsgSaveSuccess] = useState('');

  const saveAlertMsg = async () => {
    setAlertMsgSaving(true);
    setAlertMsgSaveError('');
    setAlertMsgSaveSuccess('');
    try {
      const htmlByLang = alertMsgEditor.getHtmlByLangForSave();
      setAlertMsgHtmlByLang(htmlByLang as Record<AlertMsgLang, string>);

      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const enableFrom = normalizePcuAlertDateToInput(alertMsgEnableFrom);
      const enableTo = normalizePcuAlertDateToInput(alertMsgEnableTo);
      setAlertMsgEnableFrom(enableFrom);
      setAlertMsgEnableTo(enableTo);

      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          withPcuEntityScope(
            {
              alertMsg: {
                activated: alertMsgActivated,
                enableFrom,
                enableTo,
                showAt: { login: alertMsgShowLogin, logout: alertMsgShowLogout },
                htmlByLang,
              },
            },
            pcuEntityId,
          ),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save alert message');
      reloadPcuFromServerRef.current(data.pcuSettings as PcuSettings | undefined);
      setAlertMsgSaveSuccess('Saved');
    } catch (e: unknown) {
      setAlertMsgSaveError(e instanceof Error ? e.message : 'Failed to save alert message');
    } finally {
      setAlertMsgSaving(false);
      window.setTimeout(() => setAlertMsgSaveSuccess(''), 2500);
    }
  };

  const saveIdCardsSettings = async () => {
    setIdCardsSaving(true);
    setIdCardsSaveError('');
    setIdCardsSaveSuccess('');
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          withPcuEntityScope(
            {
              idCards: {
                terms: { creditCard: idCardsCreditCard, sendMoneyLaterDays: idCardsSendMoneyLaterDays },
                messages: {
                  afterExpeditionNotPaid: {
                    enabled: idCardsMsgAfterExpeditionEnabled,
                    days: idCardsMsgAfterExpeditionDays,
                    htmlByLang: idCardsMsgAfterExpeditionHtmlByLang,
                  },
                  thirdPartyPricelist: {
                    enabled: idCardsThirdPartyEnabled,
                    htmlByLang: idCardsThirdPartyHtmlByLang,
                  },
                },
                cardsEnabled: {
                  tab: idCardsEnabledTab,
                  from: idCardsFrom,
                  to: idCardsTo,
                  blockDate: idCardsBlockDate,
                  sendEmail: idCardsSendEmail,
                  allow: {
                    magnetic: idCardsAllowMagnetic,
                    rfid: idCardsAllowRfid,
                    smartcard: idCardsAllowSmartcard,
                    qr: idCardsAllowQr,
                  },
                },
                history: { query: idCardsHistoryQuery, invoice: idCardsHistoryInvoice, page: idCardsHistoryPage },
              },
            },
            pcuEntityId,
          ),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save ID cards');
      reloadPcuFromServerRef.current(data.pcuSettings as PcuSettings | undefined);
      setIdCardsSaveSuccess('Saved');
    } catch (e: unknown) {
      setIdCardsSaveError(e instanceof Error ? e.message : 'Failed to save ID cards');
    } finally {
      setIdCardsSaving(false);
      window.setTimeout(() => setIdCardsSaveSuccess(''), 2500);
    }
  };

  const buildFunctionsSettingsPayload = useCallback(
    (): PcuFunctionsSettings => ({
      members: { maxMembers, currentMembers },
      licenses: {
        newLicenseRequests,
        authorizationNo,
        priceEuro,
        costToPay,
        amountPaid,
        maxDevicesCanEnable,
        currentDeviceEnabled,
        requestCodePending,
        deviceDisable,
        availableEnquiries,
        subscriptionExpiration,
        blockCodeGeneration,
      },
      messageAfterActivation: {
        enabled: postActivationMsgEnabled,
        daysRange: postActivationDays,
        htmlByLang: postActivationHtmlByLang,
      },
      freeAccounts: {
        durationDays: freeAccountsDurationDays,
        versionMatrix: freeAccountsMatrix,
      },
      terms: {
        creditCard: termsCreditCard,
        sendMoneyLater: termsSendMoneyLater,
        sendMoneyLaterDays: termsSendMoneyDays,
      },
      sharing: {
        coaches: sharingCoaches,
        teams: sharingTeams,
        groups: sharingGroups,
        otherClubs: sharingOtherClubs,
      },
      ...buildExpirationFunctionsSlice({
        notifyAtExpiration,
        notifyBeforeDays,
        notifyAfterDays,
        notifyEveryDay,
        notifyByMail,
        notifyOnNetworkPage,
        notifyCellular,
        notifyPostFacebook,
        expireExtendEnabled,
        expireExtendDays,
        expireActual: currentSubscriptionExpirationIso,
        expireExtendedTo,
        sharingSharedUsersMode,
        socialItemsMode,
        socialClubPages,
        socialMemberPages,
        trainingItemsMode,
        trainingClubPages,
        trainingMemberPages,
        endUsersInteractiveMode,
        managementItemsMode,
        insertOptionsManagementMode,
        expirationMsgHtmlByLang,
        newMembersExpiryMode,
        newMembersAfterDays,
        newVersionMode,
      }),
      stock: { accounts: stockAccounts, version: stockVersion, price: stockPrice, payment: stockPayment },
      buyedAccountsMatrix,
      procedure: buildProcedureSavePayload(procedureRowsByTab, procedureTab),
    }),
    [
      maxMembers,
      currentMembers,
      newLicenseRequests,
      authorizationNo,
      priceEuro,
      costToPay,
      amountPaid,
      maxDevicesCanEnable,
      currentDeviceEnabled,
      requestCodePending,
      deviceDisable,
      availableEnquiries,
      subscriptionExpiration,
      blockCodeGeneration,
      postActivationMsgEnabled,
      postActivationDays,
      postActivationHtmlByLang,
      freeAccountsDurationDays,
      freeAccountsMatrix,
      termsCreditCard,
      termsSendMoneyLater,
      termsSendMoneyDays,
      sharingCoaches,
      sharingTeams,
      sharingGroups,
      sharingOtherClubs,
      notifyAtExpiration,
      notifyBeforeDays,
      notifyAfterDays,
      notifyEveryDay,
      notifyByMail,
      notifyOnNetworkPage,
      notifyCellular,
      notifyPostFacebook,
      stockAccounts,
      stockVersion,
      stockPrice,
      stockPayment,
      buyedAccountsMatrix,
      procedureTab,
      procedureRowsByTab,
      expireExtendEnabled,
      expireExtendDays,
      currentSubscriptionExpirationIso,
      expireExtendedTo,
      sharingSharedUsersMode,
      socialItemsMode,
      socialClubPages,
      socialMemberPages,
      trainingItemsMode,
      trainingClubPages,
      trainingMemberPages,
      endUsersInteractiveMode,
      managementItemsMode,
      insertOptionsManagementMode,
      expirationMsgHtmlByLang,
      newMembersExpiryMode,
      newMembersAfterDays,
      newVersionMode,
    ],
  );

  const applyFunctionsSettingsToForm = useCallback((fn: PcuFunctionsSettings) => {
    if (fn.members) {
      if (fn.members.maxMembers != null) setMaxMembers(String(fn.members.maxMembers));
      if (fn.members.currentMembers != null) setCurrentMembers(String(fn.members.currentMembers));
    }
    if (fn.licenses) {
      const lic = fn.licenses;
      if (lic.newLicenseRequests != null) setNewLicenseRequests(String(lic.newLicenseRequests));
      if (lic.authorizationNo != null) setAuthorizationNo(String(lic.authorizationNo));
      if (lic.priceEuro != null) setPriceEuro(String(lic.priceEuro));
      if (lic.costToPay != null) setCostToPay(String(lic.costToPay));
      if (lic.amountPaid != null) setAmountPaid(String(lic.amountPaid));
      if (lic.maxDevicesCanEnable != null) setMaxDevicesCanEnable(String(lic.maxDevicesCanEnable));
      if (lic.currentDeviceEnabled != null) setCurrentDeviceEnabled(String(lic.currentDeviceEnabled));
      if (lic.requestCodePending != null) setRequestCodePending(String(lic.requestCodePending));
      if (lic.deviceDisable != null) setDeviceDisable(String(lic.deviceDisable));
      if (lic.availableEnquiries != null) setAvailableEnquiries(String(lic.availableEnquiries));
      if (lic.subscriptionExpiration != null) setSubscriptionExpiration(String(lic.subscriptionExpiration));
      if (lic.blockCodeGeneration != null) setBlockCodeGeneration(Boolean(lic.blockCodeGeneration));
    }
    if (fn.messageAfterActivation) {
      setPostActivationMsgEnabled(Boolean(fn.messageAfterActivation.enabled));
      if (fn.messageAfterActivation.daysRange != null) {
        setPostActivationDays(String(fn.messageAfterActivation.daysRange));
      }
      if (fn.messageAfterActivation.htmlByLang) {
        setPostActivationHtmlByLang(mergeHtmlByLang(fn.messageAfterActivation.htmlByLang));
      }
    }
    if (fn.freeAccounts) {
      if (fn.freeAccounts.versionMatrix) {
        const matrix = mergeFreeAccountsMatrix(fn.freeAccounts.versionMatrix);
        setFreeAccountsMatrix(matrix);
        const trialDays = matrix.daysDuration.trial?.trim();
        if (trialDays) {
          setFreeAccountsDurationDays(trialDays);
        } else if (
          fn.freeAccounts.durationDays != null &&
          String(fn.freeAccounts.durationDays).trim() !== ''
        ) {
          setFreeAccountsDurationDays(String(fn.freeAccounts.durationDays));
        }
      } else if (
        fn.freeAccounts.durationDays != null &&
        String(fn.freeAccounts.durationDays).trim() !== ''
      ) {
        setFreeAccountsDurationDays(String(fn.freeAccounts.durationDays));
      }
    }
    if (fn.buyedAccountsMatrix) {
      setBuyedAccountsMatrix(mergeBuyedAccountsMatrix(fn.buyedAccountsMatrix));
    }
    if (fn.terms) {
      setTermsCreditCard(Boolean(fn.terms.creditCard));
      setTermsSendMoneyLater(Boolean(fn.terms.sendMoneyLater));
      if (fn.terms.sendMoneyLaterDays != null) setTermsSendMoneyDays(String(fn.terms.sendMoneyLaterDays));
    }
    if (fn.sharing) {
      setSharingCoaches(Boolean(fn.sharing.coaches));
      setSharingTeams(Boolean(fn.sharing.teams));
      setSharingGroups(Boolean(fn.sharing.groups));
      setSharingOtherClubs(Boolean(fn.sharing.otherClubs));
    }
    applyExpirationFunctionsSlice(fn, {
      setNotifyAtExpiration,
      setNotifyBeforeDays,
      setNotifyAfterDays,
      setNotifyEveryDay,
      setNotifyByMail,
      setNotifyOnNetworkPage,
      setNotifyCellular,
      setNotifyPostFacebook,
      setExpireExtendEnabled,
      setExpireExtendDays,
      setExpireExtendedTo,
      setSharingSharedUsersMode,
      setSocialItemsMode,
      setSocialClubPages,
      setSocialMemberPages,
      setTrainingItemsMode,
      setTrainingClubPages,
      setTrainingMemberPages,
      setEndUsersInteractiveMode,
      setManagementItemsMode,
      setInsertOptionsManagementMode,
      setExpirationMsgHtmlByLang,
      setNewMembersExpiryMode,
      setNewMembersAfterDays,
      setNewVersionMode,
    });
    if (fn.stock) {
      if (fn.stock.accounts != null) setStockAccounts(String(fn.stock.accounts));
      if (fn.stock.version != null) setStockVersion(String(fn.stock.version));
      if (fn.stock.price != null) setStockPrice(String(fn.stock.price));
      if (fn.stock.payment != null) setStockPayment(String(fn.stock.payment));
    }
    if (fn.procedure) {
      const parsed = parseProcedureFromSaved(fn.procedure);
      setProcedureTab(parsed.tab);
      setProcedureRowsByTab(parsed.rowsByTab);
    }
  }, []);

  const saveFunctionsSettings = async () => {
    setFunctionsSaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    try {
      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          withPcuEntityScope({ functions: buildFunctionsSettingsPayload() }, pcuEntityId),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save functions');
      reloadPcuFromServerRef.current(data.pcuSettings as PcuSettings | undefined);
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save functions');
    } finally {
      setFunctionsSaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  };

  const buildExpirationSlice = useCallback(
    () =>
      buildExpirationFunctionsSlice({
        notifyAtExpiration,
        notifyBeforeDays,
        notifyAfterDays,
        notifyEveryDay,
        notifyByMail,
        notifyOnNetworkPage,
        notifyCellular,
        notifyPostFacebook,
        expireExtendEnabled,
        expireExtendDays,
        expireActual: currentSubscriptionExpirationIso,
        expireExtendedTo,
        sharingSharedUsersMode,
        socialItemsMode,
        socialClubPages,
        socialMemberPages,
        trainingItemsMode,
        trainingClubPages,
        trainingMemberPages,
        endUsersInteractiveMode,
        managementItemsMode,
        insertOptionsManagementMode,
        expirationMsgHtmlByLang,
        newMembersExpiryMode,
        newMembersAfterDays,
        newVersionMode,
      }),
    [
      notifyAtExpiration,
      notifyBeforeDays,
      notifyAfterDays,
      notifyEveryDay,
      notifyByMail,
      notifyOnNetworkPage,
      notifyCellular,
      notifyPostFacebook,
      expireExtendEnabled,
      expireExtendDays,
      currentSubscriptionExpirationIso,
      expireExtendedTo,
      sharingSharedUsersMode,
      socialItemsMode,
      socialClubPages,
      socialMemberPages,
      trainingItemsMode,
      trainingClubPages,
      trainingMemberPages,
      endUsersInteractiveMode,
      managementItemsMode,
      insertOptionsManagementMode,
      expirationMsgHtmlByLang,
      newMembersExpiryMode,
      newMembersAfterDays,
      newVersionMode,
    ],
  );

  const persistFunctionsPatch = useCallback(
    async (functionsPatch: Partial<PcuFunctionsSettings>) => {
      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          withPcuEntityScope({ functions: functionsPatch }, pcuEntityId),
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save section');
      const pcu = data.pcuSettings as PcuSettings | undefined;
      if (pcu) reloadPcuFromServerRef.current(pcu);
      return pcu;
    },
    [user.userId, pcuEntityId],
  );

  const saveExpirationNotifySection = useCallback(async () => {
    setExpirationNotifySaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    try {
      await persistFunctionsPatch({
        expirationNotify: buildExpirationSlice().expirationNotify,
      });
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save section');
    } finally {
      setExpirationNotifySaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  }, [persistFunctionsPatch, buildExpirationSlice]);

  const saveExpirationFlowSection = useCallback(async () => {
    setExpirationFlowSaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    setExpirationExtendDateError('');
    try {
      if (expireExtendEnabled && expireExtendedTo.trim()) {
        const actual = parseIsoDate(currentSubscriptionExpirationIso);
        const extended = parseIsoDate(expireExtendedTo);
        if (!actual || !extended || extended.getTime() <= actual.getTime()) {
          setExpirationExtendDateError('Extended date must be after the actual expiration date.');
          throw new Error('Extended date must be after the actual expiration date.');
        }
      }
      const slice = buildExpirationSlice();
      await persistFunctionsPatch({
        expirationFlow: slice.expirationFlow!,
      });
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save section');
    } finally {
      setExpirationFlowSaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  }, [
    persistFunctionsPatch,
    buildExpirationSlice,
    expireExtendEnabled,
    expireExtendedTo,
    currentSubscriptionExpirationIso,
  ]);

  const saveExpirationMessageSection = useCallback(async () => {
    setExpirationMsgSaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    try {
      const slice = buildExpirationSlice();
      await persistFunctionsPatch({
        expirationFlow: { messageHtmlByLang: slice.expirationFlow!.messageHtmlByLang },
      });
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save section');
    } finally {
      setExpirationMsgSaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  }, [persistFunctionsPatch, buildExpirationSlice]);

  const saveNewMembersSection = useCallback(async () => {
    setNewMembersSaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    try {
      await persistFunctionsPatch({
        newMembers: buildExpirationSlice().newMembers,
      });
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save section');
    } finally {
      setNewMembersSaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  }, [persistFunctionsPatch, buildExpirationSlice]);

  const saveNewVersionSection = useCallback(async () => {
    setNewVersionSaving(true);
    setFunctionsSaveError('');
    setFunctionsSaveSuccess('');
    try {
      await persistFunctionsPatch({
        newVersion: buildExpirationSlice().newVersion,
      });
      setFunctionsSaveSuccess('Saved');
    } catch (e: unknown) {
      setFunctionsSaveError(e instanceof Error ? e.message : 'Failed to save section');
    } finally {
      setNewVersionSaving(false);
      window.setTimeout(() => setFunctionsSaveSuccess(''), 2500);
    }
  }, [persistFunctionsPatch, buildExpirationSlice]);

  const persistProcedureSettings = useCallback(
    async (nextByTab: ProcedureRowsByTab, tab: ProcedureTabId) => {
      const token = getAdminBearerToken();
      if (!token) return;
      try {
        const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(
            withPcuEntityScope(
              {
                functions: {
                  procedure: buildProcedureSavePayload(nextByTab, tab),
                },
              },
              pcuEntityId,
            ),
          ),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (data.pcuSettings) {
          loadedPcuSettingsRef.current = data.pcuSettings as PcuSettings;
        }
      } catch {
        /* optional auto-save; use Save for explicit confirmation */
      }
    },
    [user.userId, pcuEntityId],
  );

  const updateProcedureRows = useCallback(
    (updater: ProcedureRow[] | ((prev: ProcedureRow[]) => ProcedureRow[])) => {
      setProcedureRowsByTab((prev) => {
        const current = prev[procedureTab];
        const nextRows = typeof updater === 'function' ? updater(current) : updater;
        const nextByTab = { ...prev, [procedureTab]: nextRows };
        void persistProcedureSettings(nextByTab, procedureTab);
        return nextByTab;
      });
    },
    [procedureTab, persistProcedureSettings],
  );

  const topTabs = useMemo(() => {
    // Requirements:
    // - single user/athlete: IPurchases, Profile, Admin's settings, Functions, Alert msg
    // - club: IPurchases, Profile, Admin's settings, Functions, ID Cards, Cards Status, Devices, Delete posts, Alert msg
    if (user.segment === 'clubs') {
      return [...BASE_TABS.slice(0, 4), ...CLUB_EXTRA_TABS, BASE_TABS[4]];
    }
    return BASE_TABS;
  }, [user.segment]);

  useEffect(() => {
    if (!topTabs.some((t) => t.id === activeTab)) {
      setActiveTab(defaultActiveTab);
    }
  }, [activeTab, topTabs, defaultActiveTab]);

  const countryCode = countryCodeFromName(user.country);
  const isSingleUserProfile = user.segment === 'single-user';
  const ownedEntities = user.ownedEntities ?? [];
  const selectedEntityId = user.entityId;

  const navigateProfileView = useCallback(
    (view: 'admin' | { entityId: string }) => {
      const href = buildPcuHistoryUserUrl(user.userId, {
        scope: searchParams?.get('scope'),
        segment: segmentForActions || user.segment,
        q: searchParams?.get('q'),
        tab: 'profile',
        profileSubTab: view === 'admin' ? 'admin' : 'entity',
        clubId: view === 'admin' ? null : view.entityId,
      });
      router.push(href);
    },
    [router, searchParams, segmentForActions, user.segment, user.userId],
  );
  const profileAvatarRaw =
    !isSingleUserProfile && profileSubTab === 'entity'
      ? user.entityImageUrl
      : user.imageUrl;
  const profileAvatarSrc = resolvePublicImageUrl(profileAvatarRaw) ?? profileAvatarRaw;
  const profileAvatarCaption =
    !isSingleUserProfile && profileSubTab === 'entity' && user.entityProfile
      ? user.entityProfile.officialName || user.entityProfile.username || user.username
      : user.username;
  /** Club owner accounts share the athlete-style Admin's settings panel (operator, publishing, VIP, etc.). */
  const showAthleteStyleAdminSettings =
    user.segment === 'single-user' || user.segment === 'clubs';

  useEffect(() => {
    setAdminSaveError('');
    setAdminSaveSuccess('');
  }, [user.userId, user.referencesHtml, user.referencesLevel, user.entityProfile]);

  const applyPcuSettingsToForm = useCallback((pcu: PcuSettings | null) => {
    if (!pcu) return;
    loadedPcuSettingsRef.current = pcu;

    if (pcu.extend) {
      setExtendEnabled(Boolean(pcu.extend.enabled));
      if (pcu.extend.months != null) setExtendMonths(String(pcu.extend.months));
    }
    if (pcu.assignment) {
      setAsOperator(Boolean(pcu.assignment.asOperator));
      setOperatorId(String(pcu.assignment.operatorId ?? ''));
      setAsAgent(Boolean(pcu.assignment.asAgent));
      setAgentId(String(pcu.assignment.agentId ?? ''));
    }
    if (pcu.publishing) {
      const pub = pcu.publishing;
      setEnableUserComments(Boolean(pub.enableUserComments));
      setEnableFeedback(Boolean(pub.enableFeedback));
      setEnableBlogs(Boolean(pub.enableBlogs));
      setBlogsDate(pub.blogsDate ?? '');
      setEnableReviews(Boolean(pub.enableReviews));
      setReviewsDate(pub.reviewsDate ?? '');
      if (pub.disableComments) {
        setDisableCommentsReviews(Boolean(pub.disableComments.reviews));
        setDisableCommentsSuggestions(Boolean(pub.disableComments.suggestions));
        setDisableCommentsHtmlDocs(Boolean(pub.disableComments.htmlDocsNews));
        setDisableCommentsQueries(Boolean(pub.disableComments.queries));
        setDisableCommentsBugs(Boolean(pub.disableComments.bugs));
        setDisableCommentsBlogs(Boolean(pub.disableComments.blogs));
      }
      if (pub.newsCategories) {
        setNewsCategoriesFollowed(mergeNewsCategories(pub.newsCategories));
      }
    }
    if (pcu.sponsors) {
      setEnableSponsors(Boolean(pcu.sponsors.enableSponsors));
      setSponsorsLastPurchase(pcu.sponsors.lastPurchase ?? '');
      setSponsorsExpiration(pcu.sponsors.expirationDate ?? '');
      setSponsorsCount(pcu.sponsors.numberEnabled ?? '10');
      setSponsorsCost(pcu.sponsors.costLastPurchase ?? '10');
      setSponsorsPaymentStatus(pcu.sponsors.paymentStatus ?? 'not ok');
    }
    if (pcu.blocks) {
      setBlockUserEnabled(Boolean(pcu.blocks.blockUserEnabled));
      setBlockUserAfterDate(pcu.blocks.blockUserAfterDate ?? '');
      if (pcu.blocks.blockAreas) {
        setBlockSocialArea(Boolean(pcu.blocks.blockAreas.social));
        setBlockTrainingArea(Boolean(pcu.blocks.blockAreas.training));
        setBlockManagementArea(Boolean(pcu.blocks.blockAreas.management));
      }
      setBlockAssignmentsEnabled(Boolean(pcu.blocks.blockAssignmentsEnabled));
      setBlockAssignmentsAfterDate(pcu.blocks.blockAssignmentsAfterDate ?? '');
    }
    if (pcu.alert) {
      setAlertEnabled(Boolean(pcu.alert.enabled));
      if (pcu.alert.htmlByLang) {
        setAlertHtmlByLang(mergeHtmlByLang(pcu.alert.htmlByLang));
      }
    }
    if (pcu.alertMsg) {
      const am = pcu.alertMsg;
      if (am.activated != null) setAlertMsgActivated(Boolean(am.activated));
      setAlertMsgEnableFrom(normalizePcuAlertDateToInput(am.enableFrom));
      setAlertMsgEnableTo(normalizePcuAlertDateToInput(am.enableTo));
      if (am.showAt) {
        if (am.showAt.login != null) setAlertMsgShowLogin(Boolean(am.showAt.login));
        if (am.showAt.logout != null) setAlertMsgShowLogout(Boolean(am.showAt.logout));
      }
      if (am.htmlByLang) {
        setAlertMsgHtmlByLang((prev) =>
          mergeHtmlByLangKeys(['en', 'it'] as const, { ...prev, ...am.htmlByLang }),
        );
      }
    }
    if (pcu.idCards) {
      const ic = pcu.idCards;
      if (ic.terms) {
        if (ic.terms.creditCard != null) setIdCardsCreditCard(Boolean(ic.terms.creditCard));
        if (ic.terms.sendMoneyLaterDays != null) {
          setIdCardsSendMoneyLaterDays(String(ic.terms.sendMoneyLaterDays));
        }
      }
      const msgs = ic.messages;
      if (msgs?.afterExpeditionNotPaid) {
        const m = msgs.afterExpeditionNotPaid;
        if (m.enabled != null) setIdCardsMsgAfterExpeditionEnabled(Boolean(m.enabled));
        if (m.days != null) setIdCardsMsgAfterExpeditionDays(String(m.days));
        if (m.htmlByLang) setIdCardsMsgAfterExpeditionHtmlByLang(mergeHtmlByLang(m.htmlByLang));
      }
      if (msgs?.thirdPartyPricelist) {
        const m = msgs.thirdPartyPricelist;
        if (m.enabled != null) setIdCardsThirdPartyEnabled(Boolean(m.enabled));
        if (m.htmlByLang) setIdCardsThirdPartyHtmlByLang(mergeHtmlByLang(m.htmlByLang));
      }
    }
    if (pcu.vip) {
      const vip = pcu.vip;
      clearVipBannerPreviewBlob();
      setVipShowInReferenceList(Boolean(vip.showInReferenceList));
      setVipShowInBanner(Boolean(vip.showInBanner));
      setVipUsernameEnabled(
        vip.usernameEnabled != null ? Boolean(vip.usernameEnabled) : Boolean(vip.username),
      );
      setVipYoutubeEnabled(
        vip.youtubeEnabled != null ? Boolean(vip.youtubeEnabled) : Boolean(vip.youtubeUrl),
      );
      setVipUsername(vip.username ?? user.username ?? '');
      setVipYoutubeUrl(vip.youtubeUrl ?? '');
      const bannerPath = vip.bannerImage?.trim() || null;
      setVipBannerImagePath(bannerPath);
      setVipBannerVersion(bannerPath ? Date.now() : 0);
      setVipBannerImageFileName(
        bannerPath ? bannerPath.split('/').pop() || 'No file chosen' : 'No file chosen',
      );
      setVipBannerUploadError('');
      if (vip.referencesHtmlByLang) {
        setVipReferencesHtmlByLang(mergeHtmlByLang(vip.referencesHtmlByLang));
      }
      if (vip.priorityLevel) setVipPriorityLevel(vip.priorityLevel);
      setVipFavourite(Boolean(vip.favourite));
      setVipEnabled(Boolean(vip.enabled));
      if (vip.types) setVipTypes((prev) => mergeRecordFlags(prev, vip.types));
      if (vip.visibleToUserTypes) {
        setVipVisibleToUserTypes((prev) => mergeRecordFlags(prev, vip.visibleToUserTypes));
      }
      if (vip.languagesAllowed) {
        setVipLanguagesAllowed((prev) => mergeRecordFlags(prev, vip.languagesAllowed));
      }
      if (vip.countriesAllowed) {
        setVipCountriesAllowed(mergeVipCountriesAllowed(vip.countriesAllowed));
      }
      if (vip.duration) setVipDuration(vip.duration);
      if (vip.allowVisitors) {
        setVipAllowVisitorsProfile(vip.allowVisitors.profile ?? true);
        setVipAllowVisitorsBiography(vip.allowVisitors.biography ?? true);
        setVipAllowVisitorsFriendship(vip.allowVisitors.friendship ?? true);
        setVipAllowVisitorsMail(vip.allowVisitors.mail ?? true);
      }
    }
    if (pcu.functions) {
      applyFunctionsSettingsToForm(pcu.functions);
    }
  }, [user.username, applyFunctionsSettingsToForm, clearVipBannerPreviewBlob]);

  const reloadPcuFromServer = useCallback((pcu: PcuSettings | undefined) => {
    if (!pcu) return;
    loadedPcuSettingsRef.current = pcu;
    applyPcuSettingsToForm(pcu);
  }, [applyPcuSettingsToForm]);

  useEffect(() => {
    reloadPcuFromServerRef.current = reloadPcuFromServer;
  }, [reloadPcuFromServer]);

  useEffect(() => {
    initialPcuHydratedRef.current = false;
    clearVipBannerPreviewBlob();
  }, [user.userId, pcuEntityId, clearVipBannerPreviewBlob]);

  useEffect(() => {
    if (!initialPcuSettings || initialPcuHydratedRef.current) return;
    initialPcuHydratedRef.current = true;
    applyPcuSettingsToForm(initialPcuSettings);
  }, [initialPcuSettings, applyPcuSettingsToForm]);

  const buildAdminSettingsPayload = useCallback(
    (): PcuSettings => ({
      extend: { enabled: extendEnabled, months: extendMonths },
      assignment: { asOperator, operatorId, asAgent, agentId },
      publishing: {
        enableUserComments,
        enableFeedback,
        enableBlogs,
        blogsDate,
        enableReviews,
        reviewsDate,
        disableComments: {
          reviews: disableCommentsReviews,
          suggestions: disableCommentsSuggestions,
          htmlDocsNews: disableCommentsHtmlDocs,
          queries: disableCommentsQueries,
          bugs: disableCommentsBugs,
          blogs: disableCommentsBlogs,
        },
        newsCategories: newsCategoriesFollowed,
      },
      sponsors: {
        enableSponsors,
        lastPurchase: sponsorsLastPurchase,
        expirationDate: sponsorsExpiration,
        numberEnabled: sponsorsCount,
        costLastPurchase: sponsorsCost,
        paymentStatus: sponsorsPaymentStatus,
      },
      blocks: {
        blockUserEnabled,
        blockUserAfterDate,
        blockAreas: { social: blockSocialArea, training: blockTrainingArea, management: blockManagementArea },
        blockAssignmentsEnabled,
        blockAssignmentsAfterDate,
      },
      alert: { enabled: alertEnabled, htmlByLang: alertHtmlByLang },
      vip: {
        showInReferenceList: vipShowInReferenceList,
        showInBanner: vipShowInBanner,
        usernameEnabled: vipUsernameEnabled,
        youtubeEnabled: vipYoutubeEnabled,
        bannerImage: vipBannerImagePath,
        username: vipUsername,
        youtubeUrl: vipYoutubeUrl,
        referencesHtmlByLang: vipReferencesHtmlByLang,
        priorityLevel: vipPriorityLevel,
        favourite: vipFavourite,
        enabled: vipEnabled,
        types: vipTypes,
        visibleToUserTypes: vipVisibleToUserTypes,
        languagesAllowed: vipLanguagesAllowed,
        countriesAllowed: vipCountriesAllowed,
        duration: vipDuration,
        allowVisitors: {
          profile: vipAllowVisitorsProfile,
          biography: vipAllowVisitorsBiography,
          friendship: vipAllowVisitorsFriendship,
          mail: vipAllowVisitorsMail,
        },
      },
    }),
    [
      extendEnabled,
      extendMonths,
      asOperator,
      operatorId,
      asAgent,
      agentId,
      enableUserComments,
      enableFeedback,
      enableBlogs,
      blogsDate,
      enableReviews,
      reviewsDate,
      disableCommentsReviews,
      disableCommentsSuggestions,
      disableCommentsHtmlDocs,
      disableCommentsQueries,
      disableCommentsBugs,
      disableCommentsBlogs,
      newsCategoriesFollowed,
      enableSponsors,
      sponsorsLastPurchase,
      sponsorsExpiration,
      sponsorsCount,
      sponsorsCost,
      sponsorsPaymentStatus,
      blockUserEnabled,
      blockUserAfterDate,
      blockSocialArea,
      blockTrainingArea,
      blockManagementArea,
      blockAssignmentsEnabled,
      blockAssignmentsAfterDate,
      alertEnabled,
      alertHtmlByLang,
      vipShowInReferenceList,
      vipShowInBanner,
      vipUsernameEnabled,
      vipYoutubeEnabled,
      vipBannerImagePath,
      vipUsername,
      vipYoutubeUrl,
      vipReferencesHtmlByLang,
      vipPriorityLevel,
      vipFavourite,
      vipEnabled,
      vipTypes,
      vipVisibleToUserTypes,
      vipLanguagesAllowed,
      vipCountriesAllowed,
      vipDuration,
      vipAllowVisitorsProfile,
      vipAllowVisitorsBiography,
      vipAllowVisitorsFriendship,
      vipAllowVisitorsMail,
    ],
  );

  const resetAdminSettingsForm = useCallback(() => {
    applyPcuSettingsToForm(loadedPcuSettingsRef.current);
    setAdminSaveError('');
    setAdminSaveSuccess('');
  }, [applyPcuSettingsToForm]);

  const persistVipBannerImage = useCallback(
    async (bannerImage: string | null) => {
      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(withPcuEntityScope({ vip: { bannerImage } }, pcuEntityId)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save banner');
      if (data.pcuSettings) {
        loadedPcuSettingsRef.current = data.pcuSettings as PcuSettings;
      }
    },
    [user.userId, pcuEntityId],
  );

  const handleVipBannerFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVipBannerUploadError('');
    setVipBannerUploading(true);
    setVipBannerImageFileName(file.name);

    clearVipBannerPreviewBlob();
    const localPreview = URL.createObjectURL(file);
    vipBannerBlobRef.current = localPreview;
    setVipBannerPreviewBlob(localPreview);

    try {
      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');

      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(
        `/api/admin/registered-users/${encodeURIComponent(user.userId)}/vip-banner-upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData },
      );
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) throw new Error(uploadData?.error || 'Failed to upload banner');

      const path = typeof uploadData.path === 'string' ? uploadData.path : '';
      if (!path) throw new Error('Upload did not return a file path');

      clearVipBannerPreviewBlob();
      setVipBannerImagePath(path);
      setVipBannerVersion(Date.now());
      await persistVipBannerImage(path);
      if (loadedPcuSettingsRef.current?.vip) {
        loadedPcuSettingsRef.current = {
          ...loadedPcuSettingsRef.current,
          vip: { ...loadedPcuSettingsRef.current.vip, bannerImage: path },
        };
      }
    } catch (err: unknown) {
      clearVipBannerPreviewBlob();
      setVipBannerUploadError(err instanceof Error ? err.message : 'Failed to upload banner');
      setVipBannerImageFileName(
        vipBannerImagePath ? vipBannerImagePath.split('/').pop() || 'No file chosen' : 'No file chosen',
      );
    } finally {
      setVipBannerUploading(false);
      e.target.value = '';
    }
  };

  const handleVipBannerDelete = async () => {
    setVipBannerUploadError('');
    setVipBannerUploading(true);
    try {
      clearVipBannerPreviewBlob();
      setVipBannerImagePath(null);
      setVipBannerVersion(0);
      setVipBannerImageFileName('No file chosen');
      await persistVipBannerImage(null);
    } catch (err: unknown) {
      setVipBannerUploadError(err instanceof Error ? err.message : 'Failed to delete banner');
    } finally {
      setVipBannerUploading(false);
    }
  };

  const saveAdminSettings = async () => {
    setAdminSaving(true);
    setAdminSaveError('');
    setAdminSaveSuccess('');
    try {
      const token = getAdminBearerToken();
      if (!token) throw new Error('Admin session not found. Please log in as admin.');
      const res = await fetch(pcuSettingsEndpoint(user.userId, pcuEntityId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(withPcuEntityScope(buildAdminSettingsPayload(), pcuEntityId)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save settings');
      if (data.pcuSettings) {
        loadedPcuSettingsRef.current = data.pcuSettings as PcuSettings;
        applyPcuSettingsToForm(data.pcuSettings as PcuSettings);
      }
      setAdminSaveSuccess('Settings saved successfully.');
    } catch (e: unknown) {
      setAdminSaveError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setAdminSaving(false);
      window.setTimeout(() => setAdminSaveSuccess(''), 3000);
    }
  };

  const filteredRows = useMemo(() => {
    const parseIso = (s?: string | null) => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const monthIndex = (() => {
      const m = (filterMonth || '').toLowerCase().slice(0, 3);
      const idx = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m);
      return idx >= 0 ? idx : null;
    })();
    const yearNum = Number(filterYear);
    const dateFloor =
      monthIndex != null && Number.isFinite(yearNum) ? new Date(yearNum, monthIndex, 1) : null;

    let rows = [...subscriptionRows];
    if (filterVersion && filterVersion !== 'All') {
      rows = rows.filter((r) => (r.version || '').toLowerCase().includes(filterVersion.toLowerCase()));
    }
    if (filterSubscription && filterSubscription !== 'All') {
      rows = rows.filter((r) => (r.version || '').toLowerCase().includes(filterSubscription.toLowerCase()));
    }
    if (dateFloor) {
      rows = rows.filter((r) => {
        const ds = parseIso(r.dateStart);
        return ds ? ds >= dateFloor : true;
      });
    }

    if (ordering === 'by version') {
      rows.sort((a, b) => (a.version || '').localeCompare(b.version || ''));
    } else if (ordering === 'by date start subscription') {
      rows.sort((a, b) => {
        const da = parseIso(a.dateStart)?.getTime() ?? 0;
        const db = parseIso(b.dateStart)?.getTime() ?? 0;
        return da - db;
      });
    } else if (ordering === 'by date end subscription') {
      rows.sort((a, b) => {
        const da = parseIso(a.dateEnd)?.getTime() ?? 0;
        const db = parseIso(b.dateEnd)?.getTime() ?? 0;
        return da - db;
      });
    }
    return rows;
  }, [filterMonth, filterSubscription, filterVersion, filterYear, ordering, subscriptionRows]);

  const historicalSubtitle = useMemo(() => {
    switch (user.segment) {
      case 'teams':
        return "Historical Team's subscriptions to the Network";
      case 'groups':
        return "Historical Group's subscriptions to the Network";
      case 'clubs':
        return "Historical Club's subscriptions to the Network";
      case 'coaches':
        return "Historical Coach's subscriptions to the Network";
      default:
        return "Historical User's subscriptions to the Network";
    }
  }, [user.segment]);

  const alreadyRenewed = useMemo(
    () => hasPendingMembershipRenewal(subscriptionRows),
    [subscriptionRows],
  );

  useEffect(() => {
    if (profilePanel) {
      setTagUser(Boolean(profilePanel.tagged));
      setFavouritePriority(normalizeFavouritePriority(profilePanel.favouritePriority));
    }
  }, [profilePanel]);

  useEffect(() => {
    const { accessStart: start, accessEnd: end } = resolvePcuAccessDates(
      user,
      subscriptionRows,
      initialPcuAccess,
    );
    setAccessStart(start);
    setAccessEnd(end);
    if (initialPcuAccess) {
      setSuspendAccessControl(initialPcuAccess.suspendAccessControl);
      setSuspend(initialPcuAccess.suspend);
    }
    pcuAccessSnapshotRef.current = {
      accessStart: start,
      accessEnd: end,
      suspendAccessControl: initialPcuAccess?.suspendAccessControl ?? false,
      suspend: initialPcuAccess?.suspend ?? false,
    };
  }, [initialPcuAccess, user, subscriptionRows]);

  useEffect(() => {
    pcuAccessSnapshotRef.current = {
      accessStart,
      accessEnd,
      suspendAccessControl,
      suspend,
    };
  }, [accessStart, accessEnd, suspendAccessControl, suspend]);

  const isFavourite = favouritePriority !== 'not_selected';

  const saveProfilePanelSettings = useCallback(
    async (patch: { tagged?: boolean; favouritePriority?: FavouritePriority }) => {
      const prevTagged = tagUser;
      const prevPriority = favouritePriority;
      if (patch.tagged !== undefined) setTagUser(patch.tagged);
      if (patch.favouritePriority !== undefined) {
        setFavouritePriority(normalizeFavouritePriority(patch.favouritePriority));
      }

      const token = getAdminBearerToken();
      if (!token) {
        if (patch.tagged !== undefined) setTagUser(prevTagged);
        if (patch.favouritePriority !== undefined) setFavouritePriority(prevPriority);
        window.alert('Admin session not found. Please log in again.');
        return;
      }

      setProfilePanelSaving(true);
      try {
        const res = await fetch(
          `/api/admin/registered-users/${encodeURIComponent(user.userId)}/profile-panel`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(patch),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to save profile settings');
        if (data.profilePanel) {
          setTagUser(Boolean(data.profilePanel.tagged));
          setFavouritePriority(normalizeFavouritePriority(data.profilePanel.favouritePriority));
        }
      } catch (e: unknown) {
        setTagUser(prevTagged);
        setFavouritePriority(prevPriority);
        window.alert(e instanceof Error ? e.message : 'Failed to save profile settings');
      } finally {
        setProfilePanelSaving(false);
      }
    },
    [user.userId, tagUser, favouritePriority],
  );

  useEffect(() => {
    const token = getAdminBearerToken();
    if (!token || !accessStart) return;
    let cancelled = false;
    const qs = new URLSearchParams({ dateStart: accessStart, dateEnd: accessEnd });
    if (user.entityId) qs.set('entityId', user.entityId);
    if (user.entityKind) qs.set('entityKind', user.entityKind);
    void fetch(
      `/api/admin/registered-users/${encodeURIComponent(user.userId)}/pcu-access?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const value = String(data.amountPaid ?? '');
        periodAmountSavedRef.current = value;
        setPeriodAmountPaid(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.userId, user.entityId, user.entityKind, accessStart, accessEnd]);

  const savePcuAccessSettings = useCallback(
    async (patch: Partial<PcuAccessSettings> & { amountPaid?: string }) => {
      const prev = { ...pcuAccessSnapshotRef.current };
      const prevAmount = periodAmountSavedRef.current;
      const merged = {
        accessStartIso: patch.accessStartIso ?? prev.accessStart,
        accessEndIso: patch.accessEndIso ?? prev.accessEnd,
        suspendAccessControl: patch.suspendAccessControl ?? prev.suspendAccessControl,
        suspend: patch.suspend ?? prev.suspend,
      };

      if (
        merged.accessStartIso.trim() &&
        merged.accessEndIso.trim() &&
        merged.accessEndIso < merged.accessStartIso
      ) {
        window.alert('End date cannot be earlier than start date.');
        return;
      }

      setAccessStart(merged.accessStartIso);
      setAccessEnd(merged.accessEndIso);
      setSuspendAccessControl(merged.suspendAccessControl);
      setSuspend(merged.suspend);
      pcuAccessSnapshotRef.current = {
        accessStart: merged.accessStartIso,
        accessEnd: merged.accessEndIso,
        suspendAccessControl: merged.suspendAccessControl,
        suspend: merged.suspend,
      };

      const token = getAdminBearerToken();
      if (!token) {
        setAccessStart(prev.accessStart);
        setAccessEnd(prev.accessEnd);
        setSuspendAccessControl(prev.suspendAccessControl);
        setSuspend(prev.suspend);
        pcuAccessSnapshotRef.current = prev;
        window.alert('Admin session not found. Please log in again.');
        return;
      }

      setPcuAccessSaving(true);
      try {
        const res = await fetch(
          `/api/admin/registered-users/${encodeURIComponent(user.userId)}/pcu-access`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...merged,
              ...(patch.amountPaid !== undefined ? { amountPaid: patch.amountPaid } : {}),
              clubId: user.entityId ?? undefined,
              entityId: user.entityId ?? undefined,
              entityKind: user.entityKind ?? undefined,
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to save access settings');
        if (typeof data.amountPaid === 'string') {
          periodAmountSavedRef.current = data.amountPaid;
          setPeriodAmountPaid(data.amountPaid);
        }
        if (data.pcuAccess) {
          const { accessStart: start, accessEnd: end } = resolvePcuAccessDates(
            user,
            subscriptionRows,
            data.pcuAccess as PcuAccessSettings,
          );
          setAccessStart(start);
          setAccessEnd(end);
          setSuspendAccessControl(Boolean(data.pcuAccess.suspendAccessControl));
          setSuspend(Boolean(data.pcuAccess.suspend));
          pcuAccessSnapshotRef.current = {
            accessStart: start,
            accessEnd: end,
            suspendAccessControl: Boolean(data.pcuAccess.suspendAccessControl),
            suspend: Boolean(data.pcuAccess.suspend),
          };
        }
        if (onAccessDatesSaved && ('accessStartIso' in patch || 'accessEndIso' in patch)) {
          await onAccessDatesSaved();
        }
      } catch (e: unknown) {
        setAccessStart(prev.accessStart);
        setAccessEnd(prev.accessEnd);
        setSuspendAccessControl(prev.suspendAccessControl);
        setSuspend(prev.suspend);
        pcuAccessSnapshotRef.current = prev;
        setPeriodAmountPaid(prevAmount);
        window.alert(e instanceof Error ? e.message : 'Failed to save access settings');
      } finally {
        setPcuAccessSaving(false);
      }
    },
    [user, subscriptionRows, onAccessDatesSaved],
  );

  const resolveActionUserIds = useCallback((): string[] => {
    if (profileRowSelected.size > 0) {
      const ids = new Set<string>();
      profileRowSelected.forEach((rowId) => {
        ids.add(rowId.startsWith('account-') ? rowId.slice('account-'.length) : user.userId);
      });
      return Array.from(ids);
    }
    return [user.userId];
  }, [profileRowSelected, user.userId]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSendMail = useCallback(() => {
    setMailError('');
    setMailTo(user.email?.trim() || '');
    setMailSubject('');
    setMailBody('');
    setMailModalOpen(true);
  }, [user.email]);

  const handleMailSubmit = useCallback(async () => {
    const to = mailTo.trim();
    if (!to) {
      setMailError('Please enter an email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setMailError('Please enter a valid email address.');
      return;
    }
    const message = mailBody.trim();
    if (!message) {
      setMailError('Please enter a message.');
      return;
    }
    const token = getAdminBearerToken();
    if (!token) {
      setMailError('Admin session not found. Please log in again.');
      return;
    }
    setMailSending(true);
    setMailError('');
    try {
      const res = await fetch('/api/admin/registered-users/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segment: segmentForActions,
          userIds: resolveActionUserIds(),
          message,
          subject: mailSubject.trim() || 'Message from Movesbook Admin',
          toEmail: to,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send mail');

      const failed = Array.isArray(data.failed) ? data.failed : [];
      if (failed.length > 0) {
        const first = failed[0] as { error?: string };
        throw new Error(first?.error || 'Failed to send mail.');
      }

      setMailModalOpen(false);
      window.alert(`Mail sent successfully to ${to}.`);
    } catch (e: unknown) {
      setMailError(e instanceof Error ? e.message : 'Failed to send mail');
    } finally {
      setMailSending(false);
    }
  }, [
    mailTo,
    mailBody,
    mailSubject,
    segmentForActions,
    resolveActionUserIds,
  ]);

  const openSendMsgModal = useCallback(() => {
    setMsgError('');
    setMsgDraft('');
    setMsgSubject('Message from Movesbook Admin');
    setMsgModalOpen(true);
  }, []);

  const handleSendMsgSubmit = useCallback(async () => {
    const message = msgDraft.trim();
    if (!message) {
      setMsgError('Please enter a message.');
      return;
    }
    const token = getAdminBearerToken();
    if (!token) {
      setMsgError('Admin session not found. Please log in again.');
      return;
    }
    setMsgSending(true);
    setMsgError('');
    try {
      const res = await fetch('/api/admin/registered-users/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segment: segmentForActions,
          userIds: resolveActionUserIds(),
          message,
          subject: msgSubject.trim() || 'Message from Movesbook Admin',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send message');
      window.alert(`Message sent to ${data.sent ?? 0} user(s).`);
      setMsgModalOpen(false);
    } catch (e: unknown) {
      setMsgError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setMsgSending(false);
    }
  }, [msgDraft, msgSubject, resolveActionUserIds, segmentForActions]);

  const handleDeleteAccount = useCallback(async () => {
    const label = user.fullname || user.username;
    const ok = window.confirm(
      `Delete account for ${label}?\n\nThis permanently removes the user from Movesbook. This cannot be undone.`,
    );
    if (!ok) return;

    const token = getAdminBearerToken();
    if (!token) {
      window.alert('Admin session not found. Please log in again.');
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch('/api/admin/registered-users/actions', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segment: segmentForActions,
          userIds: resolveActionUserIds(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete account');
      const deleted = typeof data.deleted === 'number' ? data.deleted : 0;
      window.alert(`Deleted ${deleted} user account(s).`);
      router.push(backHref);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete account');
    } finally {
      setActionBusy(false);
    }
  }, [backHref, resolveActionUserIds, router, segmentForActions, user.fullname, user.username]);

  const handleAdminSettings = () => {
    // PCU Admin's settings is handled in-panel; keep routing for future deep-links if needed.
  };

  return (
    <div className="print-area w-full min-w-0 max-w-5xl mx-auto">
      <div className="bg-gray-200 border border-gray-300 rounded shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-300">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" className="p-1.5 rounded hover:bg-gray-300 shrink-0" title="Menu">
              <span className="block w-5 h-0.5 bg-gray-700 mb-1" />
              <span className="block w-5 h-0.5 bg-gray-700 mb-1" />
              <span className="block w-5 h-0.5 bg-gray-700" />
            </button>
            <div className="text-sm font-semibold text-red-700 whitespace-nowrap">
              Panel control about the User
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-red-700 hover:underline whitespace-nowrap"
              onClick={() => router.push('/admin/all')}
            >
              Back to the List
            </button>
          </div>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2 shrink-0">
            {overviewHref ? (
              <button
                type="button"
                className="text-xs text-teal-800 hover:underline px-1"
                onClick={() => router.push(overviewHref)}
              >
                Overview
              </button>
            ) : null}
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-300"
              title="Close"
              onClick={() => router.push(backHref)}
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-4 py-3">
          <div className="w-16 h-16 bg-white border border-gray-400 flex items-center justify-center overflow-hidden shrink-0">
            {user.imageUrl ? (
              isDataUrl(user.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <Image
                  src={user.imageUrl}
                  alt={user.username}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              )
            ) : (
              <User className="w-7 h-7 text-gray-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div>
                  <strong>Name :</strong> {user.fullname || '—'}
                </div>
                <div>
                  <strong>Age :</strong> {user.ageDisplay}
                </div>
                <div>
                  <strong>Type of User :</strong> {user.typeOfUser}
                </div>
                <div>
                  <strong>Sport :</strong> {user.sport || '—'}
                </div>
                <div>
                  <strong>State :</strong> {user.state || '—'}
                </div>
                <div>
                  <strong>Locality :</strong> {user.locality || user.cityClubTeam || '—'}
                </div>
                <div>
                  <strong>Country :</strong> {user.country || '—'}
                  {countryCode ? ` (${countryCode})` : ''}
                  {countryCode ? ` ${flagEmojiFromCode(countryCode)}` : ''}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              <button
                type="button"
                onClick={handleSendMail}
                className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
              >
                <Mail className="inline w-4 h-4 mr-2" />
                Send mail
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span>Start</span>
                <AdminPcuDatePicker
                  value={accessStart}
                  disabled={pcuAccessSaving}
                  onChange={(iso) => void savePcuAccessSettings({ accessStartIso: iso })}
                  className="w-32"
                />
                <CalendarDays className="w-5 h-5 text-gray-600" />
                <CreditCard className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>End</span>
                <AdminPcuDatePicker
                  value={accessEnd}
                  minDateIso={accessStart || undefined}
                  disabled={pcuAccessSaving}
                  onChange={(iso) => void savePcuAccessSettings({ accessEndIso: iso })}
                  className="w-32 text-red-600"
                />
                <CalendarDays className="w-5 h-5 text-gray-600" />
                {alreadyRenewed ? (
                  <span className="text-green-600 font-semibold">(already renewed)</span>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>Amount paid (€)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={periodAmountPaid}
                  disabled={pcuAccessSaving || !accessStart}
                  placeholder="0.00"
                  title="Money received for this Start–End period (used by Statistics → Income)"
                  onChange={(e) => setPeriodAmountPaid(e.target.value)}
                  onBlur={() => {
                    if (periodAmountPaid.trim() === periodAmountSavedRef.current.trim()) return;
                    void savePcuAccessSettings({ amountPaid: periodAmountPaid.trim() });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                />
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={suspendAccessControl}
                  disabled={pcuAccessSaving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSuspendAccessControl(next);
                    void savePcuAccessSettings({ suspendAccessControl: next });
                  }}
                  className="w-4 h-4 rounded border-gray-400"
                />
                <span className="text-red-600">Suspend access control</span>
              </label>
              <button type="button" className="px-4 py-2 bg-gray-700 text-white text-sm rounded">
                Exhaustion status
              </button>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={suspend}
                  disabled={pcuAccessSaving}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSuspend(next);
                    void savePcuAccessSettings({ suspend: next });
                  }}
                  className="w-4 h-4 rounded border-gray-400"
                />
                <span className="text-red-600">Suspend</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-0 border border-gray-300 border-t-0 bg-gray-300 mt-0">
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'admin') handleAdminSettings();
              if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                params.set('tab', tab.id);
                router.replace(`${window.location.pathname}?${params.toString()}`, {
                  scroll: false,
                });
              }
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-medium border-r border-gray-400 last:border-r-0 ${
              activeTab === tab.id
                ? 'bg-black text-white'
                : 'bg-gray-400 text-gray-900 hover:bg-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-300 border-t-0 shadow-sm">
        <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-800">
          {activeTab === 'profile'
            ? `Details of ${user.username}`
            : topTabs.find((t) => t.id === activeTab)?.label}
        </div>

        {activeTab === 'profile' ? (
          <div className="p-0">
            <div className="px-4 py-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="px-3 py-1.5 bg-black text-white text-sm rounded"
              >
                BACK
              </button>
            </div>

            <div className="px-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigateProfileView('admin')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t ${
                    profileSubTab === 'admin' ? 'bg-black text-white' : 'bg-gray-400 text-gray-900'
                  }`}
                >
                  {isSingleUserProfile ? 'User Profile' : 'Admin Profile'}
                </button>
                {isSingleUserProfile
                  ? null
                  : ownedEntities.map((entity) => {
                      const isActive =
                        profileSubTab === 'entity' && selectedEntityId === entity.id;
                      return (
                        <button
                          key={entity.id}
                          type="button"
                          onClick={() => navigateProfileView({ entityId: entity.id })}
                          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t ${
                            isActive ? 'bg-black text-white' : 'bg-gray-400 text-gray-900'
                          }`}
                          title={entity.tabLabel}
                        >
                          <span
                            className={`inline-block h-3 w-3 shrink-0 rounded-full ${
                              isActive ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            aria-hidden
                          />
                          <span>{entity.tabLabel}</span>
                        </button>
                      );
                    })}
              </div>
              <div className="border-b border-gray-300" />
            </div>

            <div className="px-4 py-4">
              <div className="bg-purple-700 text-white px-4 py-2 font-semibold flex items-center justify-between">
                <span>Members Profile</span>
                <span className="text-xs text-yellow-200">(only view)</span>
              </div>

              <div className="border border-gray-300 bg-white p-4">
                <p className="text-center text-red-600 text-sm font-semibold mb-3">* required fields</p>

                <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 bg-gray-200 border border-gray-300 overflow-hidden flex items-center justify-center">
                      {profileAvatarSrc ? (
                        isDataUrl(profileAvatarSrc) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profileAvatarSrc} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Image
                            src={profileAvatarSrc}
                            alt=""
                            width={96}
                            height={96}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        )
                      ) : (
                        <User className="w-10 h-10 text-gray-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 text-center">{profileAvatarCaption}</div>
                  </div>

                  <div className="space-y-2">
                      {isSingleUserProfile ? (
                        <>
                          <ProfileField label="Username*" value={user.username} />
                          <ProfileField label="Name" value={user.firstName} />
                          <ProfileField label="Surname" value={user.surname} />
                          <ProfileField label="Email*" value={user.email} />
                          <ProfileField label="Password*" value="••••••••" muted />
                          <ProfileField label="Repeat*" value="••••••••" muted />
                          <SelectField label="Country" value={user.adminCountry || ''} options={ALL_COUNTRIES} />
                          <ProfileField label="Geographical" value={user.geographical || ''} mono />
                          <SplitField
                            label="City"
                            leftValue={user.adminCity || user.city}
                            rightLabel="Zip Code"
                            rightValue={user.adminZipCode}
                          />
                          <SplitField
                            label="Phone/cell"
                            leftValue={user.adminPhoneCell}
                            rightLabel=""
                            rightValue={user.adminPhoneCell2}
                          />
                          <ProfileField label="Gender*" value={user.gender || ''} />
                          <BirthdayField day={user.birthDay} month={user.birthMonth} year={user.birthYear} />
                          <ProfileField label="User Type*" value={user.typeOfUser} />
                          <ProfileField label="Occupation" value="" />
                          <ProfileField label="Skills" value="" />
                          <SplitField label="Employer" leftValue="" rightLabel="Heart zone" rightValue="" />
                          <SelectField label="Time zone" value="" options={['Europe/Rome']} />
                          <SelectField label="Unit of Measure" value="Metric" options={['Metric']} />
                          <ProfileField label="First day of the week" value="" />
                          <SelectField label="Language*" value="English" options={['English', 'French', 'Italian']} />
                          <ProfileField label="Theme" value="" />
                          <SelectField label="Privacy" value="Only Friend" options={['Only Friend', 'Public', 'Private']} />
                          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                            <label className="text-sm text-gray-700">
                              Receive follow up notifications and mails
                            </label>
                            <input type="checkbox" disabled className="w-4 h-4" />
                          </div>
                          <div className="mt-6">
                            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                              References
                            </div>
                            <ProfileReferencesReadOnly
                              referencesHtml={user.referencesHtml}
                              referencesLevel={user.referencesLevel}
                              emptyMessage="No admin references have been added yet."
                            />
                          </div>
                        </>
                      ) : profileSubTab === 'admin' ? (
                        <>
                          <ProfileField label="Username*" value={user.username} />
                          <ProfileField label="Name" value={user.firstName} />
                          <ProfileField label="Surname" value={user.surname} />
                          <ProfileField label="Email*" value={user.email} />
                          <ProfileField label="Password*" value="••••••••" muted />
                          <ProfileField label="Repeat*" value="••••••••" muted />
                          <SelectField label="Country" value={user.adminCountry || ''} options={ALL_COUNTRIES} />
                          <SplitField
                            label="City"
                            leftValue={user.adminCity || user.city}
                            rightLabel="Zip Code"
                            rightValue={user.adminZipCode}
                          />
                          <SplitField
                            label="Phone/cell"
                            leftValue={user.adminPhoneCell}
                            rightLabel=""
                            rightValue={user.adminPhoneCell2}
                          />
                          <ProfileField label="Gender*" value={user.gender || ''} />
                          <BirthdayField day={user.birthDay} month={user.birthMonth} year={user.birthYear} />
                          <ProfileField label="User Type*" value={user.typeOfUser} />
                          <ProfileField label="Occupation" value="" />
                          <div className="mt-6">
                            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                              References
                            </div>
                            <ProfileReferencesReadOnly
                              referencesHtml={user.referencesHtml}
                              referencesLevel={user.referencesLevel}
                              emptyMessage="No admin references have been added yet."
                            />
                          </div>
                        </>
                      ) : profileSubTab === 'entity' && user.entityProfile ? (
                        <>
                          <ProfileField label="Username*" value={user.entityProfile.username} />
                          <ProfileField label="Official name" value={user.entityProfile.officialName} />
                          <ProfileField label="Email*" value={user.entityProfile.email} />
                          <ProfileField label="Password*" value="••••••••" muted />
                          <ProfileField label="Repeat*" value="••••••••" muted />
                          <SelectField
                            label="Country"
                            value={user.entityProfile.country}
                            options={ALL_COUNTRIES}
                          />
                          <SplitField
                            label="City / Location"
                            leftValue={user.entityProfile.location}
                            rightLabel="Zip Code"
                            rightValue={user.entityProfile.zipCode}
                          />
                          <ProfileField
                            label="Geographical"
                            value={user.entityProfile.geo}
                            mono
                          />
                          <ProfileField label="Phone/cell" value={user.entityProfile.phone} />
                          <ProfileField label="Telegram" value={user.entityProfile.telegram} />

                          <div className="mt-6">
                            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                              {user.segment === 'clubs'
                                ? 'References of the club'
                                : `References of the ${user.roleTitle.toLowerCase()}`}
                            </div>
                            <ProfileReferencesReadOnly
                              referencesHtml={user.entityProfile.referencesHtml}
                              referencesLevel={user.entityProfile.referencesLevel}
                              emptyMessage={
                                user.segment === 'clubs'
                                  ? 'No club references have been added yet.'
                                  : `No ${user.roleTitle.toLowerCase()} references have been added yet.`
                              }
                            />
                          </div>
                        </>
                      ) : profileSubTab === 'entity' ? (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                          <p className="text-sm font-semibold text-gray-800">
                            Select a {user.roleTitle.toLowerCase()} tab above to view its profile.
                          </p>
                          {ownedEntities.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-600">
                              This admin has no registered {user.roleTitle.toLowerCase()} profiles yet.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <ProfileField label="Username*" value={user.username} />
                          <ProfileField label="Name" value={user.firstName} />
                          <ProfileField label="Surname" value={user.surname} />
                          <ProfileField label="Email*" value={user.email} />
                          <ProfileField label="Password*" value="••••••••" muted />
                          <ProfileField label="Repeat*" value="••••••••" muted />
                          <SelectField label="Country" value={user.country || ''} options={ALL_COUNTRIES} />
                          <SplitField
                            label="City"
                            leftValue={user.city || user.locality}
                            rightLabel="Zip Code"
                            rightValue={user.zipCode}
                          />
                          <ProfileField label="Phone/cell" value={user.phoneCell} />

                          <div className="mt-6">
                            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                              References
                            </div>
                            <ProfileReferencesReadOnly
                              referencesHtml={user.referencesHtml}
                              referencesLevel={user.referencesLevel}
                              emptyMessage="No references have been added yet."
                            />
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'purchases' ? (
          <div className="p-0">
            <div className="px-4 py-3">
              <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                Details of subscription - {user.roleTitle}
              </div>

              <div className="border border-gray-300 border-t-0 bg-white">
                <div className="bg-purple-700 text-white px-4 py-2 font-semibold">{historicalSubtitle}</div>

                <div className="bg-sky-100 px-4 py-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1">
                    <div>
                      <strong>Full Name:</strong> {user.fullname || '—'}
                    </div>
                    <div className="flex items-center gap-2">
                      <strong>Country:</strong> {user.country || '—'}
                      {countryCode ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-lg leading-none">{flagEmojiFromCode(countryCode)}</span>
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <strong>Username:</strong> {user.username || '—'}
                    </div>
                    <div>
                      <strong>Location:</strong> {user.locality || user.cityClubTeam || '—'}
                    </div>
                    <div>
                      <strong>Official {user.roleTitle}name:</strong>{' '}
                      <span className="text-base font-bold text-red-600">
                        {user.entityName || '—'}
                      </span>
                    </div>
                    <div>
                      <strong>Sport</strong> {user.sport || '—'}
                    </div>
                  </div>
                </div>

                <div className="bg-sky-200 px-4 py-2 text-sm flex flex-wrap items-center gap-6">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tagUser}
                      disabled={profilePanelSaving}
                      onChange={(e) => void saveProfilePanelSettings({ tagged: e.target.checked })}
                      className="w-4 h-4 disabled:opacity-60"
                    />
                    <span>Tag the user</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isFavourite}
                      disabled={profilePanelSaving}
                      onChange={(e) =>
                        void saveProfilePanelSettings({
                          favouritePriority: e.target.checked
                            ? favouritePriority === 'not_selected'
                              ? 'medium'
                              : favouritePriority
                            : 'not_selected',
                        })
                      }
                      className="w-4 h-4 disabled:opacity-60"
                    />
                    <span>Put as favourite</span>
                  </label>
                  <div className="inline-flex items-center gap-2">
                    <span>Priority</span>
                    <select
                      value={favouritePriority}
                      disabled={profilePanelSaving}
                      onChange={(e) =>
                        void saveProfilePanelSettings({
                          favouritePriority: normalizeFavouritePriority(e.target.value),
                        })
                      }
                      className="px-2 py-1 border border-gray-400 bg-white text-sm disabled:opacity-60"
                    >
                      <option value="not_selected">Not selected</option>
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                    </select>
                  </div>
                </div>

                <div className="px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2 border-t border-gray-300">
                  <div className="flex flex-wrap items-center gap-2 relative">
                    <button
                      type="button"
                      onClick={() => setFilterOpen((v) => !v)}
                      className="px-3 py-1 border border-gray-400 bg-gray-700 text-white text-sm rounded inline-flex items-center gap-2"
                    >
                      Filter
                      <span className="inline-block border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
                    </button>

                    {filterOpen ? (
                      <div className="absolute z-20 left-0 top-full mt-1 w-[min(100vw-2rem,380px)] border border-black bg-[#fff8dc] shadow-lg">
                        <div className="p-4 space-y-3 text-sm">
                          <SubscriptionFilterRow label="Version">
                            <select
                              value={filterVersion}
                              onChange={(e) => setFilterVersion(e.target.value)}
                              className="w-full max-w-[220px] border border-gray-500 bg-white px-2 py-1.5 text-sm ml-auto"
                            >
                              {FILTER_VERSION_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </SubscriptionFilterRow>

                          <SubscriptionFilterRow label="Subscription">
                            <select
                              value={filterSubscription}
                              onChange={(e) => setFilterSubscription(e.target.value)}
                              className="w-full max-w-[220px] border border-gray-500 bg-white px-2 py-1.5 text-sm ml-auto"
                            >
                              {FILTER_VERSION_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </SubscriptionFilterRow>

                          <SubscriptionFilterRow label="Datarange">
                            <div className="flex gap-2 w-full max-w-[220px] ml-auto">
                              <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="flex-1 min-w-0 border border-gray-500 bg-white px-2 py-1.5 text-sm"
                              >
                                {['select', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map(
                                  (m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ),
                                )}
                              </select>
                              <input
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="w-20 shrink-0 border border-gray-500 bg-white px-2 py-1.5 text-sm text-center"
                              />
                            </div>
                          </SubscriptionFilterRow>
                        </div>
                        <div className="flex justify-center gap-4 border-t border-gray-400 bg-[#f5ebc8] py-3">
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="px-8 py-1.5 bg-[#c4c4c4] border border-gray-600 text-sm font-semibold text-gray-900 hover:bg-[#b8b8b8]"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="px-8 py-1.5 bg-[#c4c4c4] border border-gray-600 text-sm font-semibold text-gray-900 hover:bg-[#b8b8b8]"
                          >
                            Exit
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <select
                      value={ordering}
                      onChange={(e) => setOrdering(e.target.value as OrderingOption)}
                      className="px-2 py-1 border border-gray-400 bg-white text-sm"
                    >
                      <option value="ordering">ordering</option>
                      <option value="by version">by version</option>
                      <option value="by date start subscription">by date start subscription</option>
                      <option value="by date end subscription">by date end subscription</option>
                    </select>
                    <button
                      type="button"
                      className="px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded"
                    >
                      Proceed
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-blue-800">
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={actionBusy}
                      className="underline cursor-pointer hover:text-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={openSendMsgModal}
                      disabled={actionBusy}
                      className="underline cursor-pointer hover:text-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Msg
                    </button>
                    <button
                      type="button"
                      onClick={handleSendMail}
                      disabled={actionBusy}
                      className="underline cursor-pointer hover:text-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send mail
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      disabled={actionBusy}
                      className="underline cursor-pointer text-red-700 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete account
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="px-2 py-2 text-left w-8">
                            <input
                              type="checkbox"
                              checked={
                                filteredRows.length > 0 &&
                                filteredRows.every((r) => profileRowSelected.has(r.id))
                              }
                              onChange={() => {
                                if (
                                  filteredRows.length > 0 &&
                                  filteredRows.every((r) => profileRowSelected.has(r.id))
                                ) {
                                  setProfileRowSelected(new Set());
                                } else {
                                  setProfileRowSelected(new Set(filteredRows.map((r) => r.id)));
                                }
                              }}
                              className="w-4 h-4"
                            />
                          </th>
                          <th className="px-2 py-2 text-left">Full Name</th>
                          <th className="px-2 py-2 text-left">User Name</th>
                          <th className="px-2 py-2 text-left">Type</th>
                          <th className="px-2 py-2 text-left">Version</th>
                          <th className="px-2 py-2 text-left">Date Start</th>
                          <th className="px-2 py-2 text-left">Date End</th>
                          <th className="px-2 py-2 text-left">Logs</th>
                          <th className="px-2 py-2 text-left">E</th>
                          <th className="px-2 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length > 0 ? (
                          filteredRows.map((r) => (
                            <tr key={r.id} className="odd:bg-white even:bg-gray-50 border-b border-gray-200">
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  checked={profileRowSelected.has(r.id)}
                                  onChange={() => {
                                    const next = new Set(profileRowSelected);
                                    if (next.has(r.id)) next.delete(r.id);
                                    else next.add(r.id);
                                    setProfileRowSelected(next);
                                  }}
                                  className="w-4 h-4"
                                />
                              </td>
                              <td className="px-2 py-2">{user.fullname || '—'}</td>
                              <td className="px-2 py-2">{r.username || user.username}</td>
                              <td className="px-2 py-2">{user.roleTitle}</td>
                              <td className="px-2 py-2">{r.version}</td>
                              <td className={`px-2 py-2 whitespace-nowrap ${subscriptionPeriodDateClassName(r.status)}`}>
                                {formatPcuIsoDate(r.dateStart)}
                              </td>
                              <td className={`px-2 py-2 whitespace-nowrap ${subscriptionPeriodDateClassName(r.status)}`}>
                                {formatPcuIsoDate(r.dateEnd) || '—'}
                              </td>
                              <td className="px-2 py-2">{String(user.logs ?? 0)}</td>
                              <td className="px-2 py-2">{r.e}</td>
                              <td className="px-2 py-2">
                                <NotYetActivePeriodEditControl
                                  userId={user.userId}
                                  entityId={user.entityId}
                                  entityKind={user.entityKind}
                                  row={r}
                                  onSaved={onAccessDatesSaved}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-2 py-6 text-center text-gray-500" colSpan={10}>
                              No purchases found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'admin' ? (
          <div className="p-0">
            <div className="px-4 py-3">
              <div className="border border-gray-300 bg-white">
                <div className="bg-[#c7c2e9] border-b border-gray-300 px-4 py-2 font-semibold text-sm flex items-center justify-between">
                  <span>Operator Settings</span>
                  <span className="text-xs text-red-700">(only s-admin and co-admins can use this function)</span>
                </div>

                <div className="px-4 py-3">
                  <div className="flex gap-4 items-start">
                    <div className="w-16 h-16 bg-white border border-gray-400 flex items-center justify-center overflow-hidden shrink-0">
                      {user.imageUrl ? (
                        isDataUrl(user.imageUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.imageUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <Image
                            src={user.imageUrl}
                            alt={user.username}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        )
                      ) : (
                        <User className="w-7 h-7 text-gray-500" />
                      )}
                    </div>

                    <div className="text-sm">
                      <div className="font-semibold">{user.fullname}</div>
                      <div>{user.country || '—'}</div>
                      <button
                        type="button"
                        onClick={handleSendMail}
                        className="mt-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded"
                      >
                        Send mail
                      </button>
                    </div>
                  </div>
                </div>

                {showAthleteStyleAdminSettings ? (
                  <>
                    <div className="bg-slate-700 text-yellow-300 font-semibold px-4 py-2">Other settings</div>
                    <div className="px-4 py-3 text-xs text-gray-700 text-center">
                      S-admin, co-admins and operators can modify these settings regards the current user:
                    </div>

                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-[56px_1fr] gap-4 items-start">
                        <div className="pt-2">
                          <div className="w-14 h-14 bg-gray-100 border border-gray-200" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-gray-200 p-4">
                            <div className="font-semibold text-sm mb-2">
                              Put this user as customer of this operator
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={asOperator}
                                  onChange={(e) => setAsOperator(e.target.checked)}
                                />
                                As Operator
                              </label>
                              <select
                                value={operatorId}
                                onChange={(e) => setOperatorId(e.target.value)}
                                className="px-2 py-1 border border-gray-300 bg-white flex-1"
                              >
                                {PCU_OPERATOR_OPTIONS.map((o) => (
                                  <option key={o.value || 'default'} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <button type="button" className="w-9 h-9 border border-gray-300 bg-gray-50">
                                👥
                              </button>
                            </div>
                          </div>

                          <div className="border border-gray-200 p-4">
                            <div className="font-semibold text-sm mb-2">
                              Put this user as customer of this agent/sub-agent
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={asAgent}
                                  onChange={(e) => setAsAgent(e.target.checked)}
                                />
                                As Agent
                              </label>
                              <select
                                value={agentId}
                                onChange={(e) => setAgentId(e.target.value)}
                                className="px-2 py-1 border border-gray-300 bg-white flex-1"
                              >
                                {PCU_AGENT_OPTIONS.map((o) => (
                                  <option key={o.value || 'default'} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <button type="button" className="w-9 h-9 border border-gray-300 bg-gray-50">
                                👥
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-[56px_1fr] gap-3 items-center">
                            <div className="w-14 h-14 bg-gray-100 border border-gray-200" />
                            <div className="border border-gray-200 p-4">
                              <div className="font-semibold text-sm">Enable user to publish feedback</div>
                              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={enableFeedback}
                                  onChange={(e) => setEnableFeedback(e.target.checked)}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-[56px_1fr] gap-3 items-center">
                            <div className="w-14 h-14 bg-gray-100 border border-gray-200" />
                            <div className="border border-gray-200 p-4">
                              <div className="font-semibold text-sm">Enable user to publish blogs</div>
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={enableBlogs}
                                  onChange={(e) => setEnableBlogs(e.target.checked)}
                                />
                                <AdminPcuDatePicker
                                  value={blogsDate}
                                  onChange={setBlogsDate}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-[56px_1fr] gap-3 items-center">
                            <div className="w-14 h-14 bg-gray-100 border border-gray-200" />
                            <div className="border border-gray-200 p-4">
                              <div className="font-semibold text-sm">Enable user to publish reviews</div>
                              <div className="mt-2 flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={enableReviews}
                                  onChange={(e) => setEnableReviews(e.target.checked)}
                                />
                                <AdminPcuDatePicker
                                  value={reviewsDate}
                                  onChange={setReviewsDate}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="border border-gray-200 p-4">
                            <div className="font-semibold text-sm">Disable permission to leave comments</div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsReviews}
                                  onChange={(e) => setDisableCommentsReviews(e.target.checked)}
                                />
                                Reviews
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsSuggestions}
                                  onChange={(e) => setDisableCommentsSuggestions(e.target.checked)}
                                />
                                Suggestions
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsHtmlDocs}
                                  onChange={(e) => setDisableCommentsHtmlDocs(e.target.checked)}
                                />
                                Html docs &amp; News
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsQueries}
                                  onChange={(e) => setDisableCommentsQueries(e.target.checked)}
                                />
                                Queries
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsBugs}
                                  onChange={(e) => setDisableCommentsBugs(e.target.checked)}
                                />
                                Bugs
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={disableCommentsBlogs}
                                  onChange={(e) => setDisableCommentsBlogs(e.target.checked)}
                                />
                                Blogs
                              </label>
                            </div>
                          </div>

                          <div className="border border-gray-200 p-4">
                            <div className="font-semibold text-sm">Categories of News followed by the user</div>
                            <NewsCategoriesMultiSelect
                              selected={newsCategoriesFollowed}
                              onChange={setNewsCategoriesFollowed}
                            />
                          </div>

                          <div className="border border-gray-200 p-4">
                            <div className="font-semibold text-sm mb-2">Enable Sponsors</div>
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={enableSponsors}
                                onChange={(e) => setEnableSponsors(e.target.checked)}
                              />
                              Enable Sponsors
                            </label>
                            <div className="mt-2 space-y-2 text-sm">
                              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                                <span>Date last purchase</span>
                                <input
                                  value={sponsorsLastPurchase}
                                  onChange={(e) => setSponsorsLastPurchase(e.target.value)}
                                  className="px-2 py-1 border border-gray-300"
                                  placeholder="0000-00-00"
                                />
                              </div>
                              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                                <span>Expiration Date</span>
                                <input
                                  value={sponsorsExpiration}
                                  onChange={(e) => setSponsorsExpiration(e.target.value)}
                                  className="px-2 py-1 border border-gray-300"
                                  placeholder="0000-00-00"
                                />
                              </div>
                              <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                                <span>Number of Sponsors Enabled</span>
                                <input
                                  value={sponsorsCount}
                                  onChange={(e) => setSponsorsCount(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 w-20"
                                />
                              </div>
                              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                                <span>Cost last purchase</span>
                                <input
                                  value={sponsorsCost}
                                  onChange={(e) => setSponsorsCost(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 w-20"
                                />
                              </div>
                              <div className="grid grid-cols-[160px_1fr] gap-2 items-center">
                                <span>Status of payments not ok</span>
                                <button type="button" className="px-3 py-1 bg-black text-white rounded w-fit">
                                  Payment
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-[56px_1fr] gap-3 items-center">
                            <div className="w-14 h-14 bg-gray-100 border border-gray-200" />
                            <div className="border border-gray-200 p-4">
                              <div className="font-semibold text-sm">Enable user to add comments</div>
                              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={enableUserComments}
                                  onChange={(e) => setEnableUserComments(e.target.checked)}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <AdminSettingsSaveBar
                        saving={adminSaving}
                        error={adminSaveError}
                        success={adminSaveSuccess}
                        onSave={() => void saveAdminSettings()}
                        onCancel={resetAdminSettingsForm}
                      />

                      <div className="mt-6 border border-gray-300">
                        <div className="bg-[#eeeaf8] px-4 py-2 font-semibold text-sm flex items-center justify-center gap-3">
                          <span className="w-8 h-8 inline-flex items-center justify-center bg-white border border-gray-300 rounded">🚫</span>
                          <span>Manage the blocks</span>
                        </div>
                        <div className="bg-yellow-100 px-4 py-3 text-sm flex items-center gap-4">
                          <ToggleNY value={blockUserEnabled} onChange={setBlockUserEnabled} />
                          <div className="font-semibold">Block this user</div>
                          <div className="text-xs">After this date</div>
                          <AdminPcuDatePicker
                            value={blockUserAfterDate}
                            onChange={setBlockUserAfterDate}
                          />
                        </div>
                      </div>

                      <div className="mt-6 border border-gray-300">
                        <div className="bg-slate-700 text-yellow-300 font-semibold px-4 py-2">VIP Settings</div>
                        <div className="p-4 bg-white">
                          <div className="flex items-center gap-4 text-sm mb-4">
                            <ToggleNY value={vipEnabled} onChange={setVipEnabled} />
                            <div className="font-semibold">VIP Settings</div>
                          </div>

                          <div className="text-sm text-center text-gray-600 mb-2">-put the user in this sections of the VIP banner</div>
                          <div className="flex justify-center mb-6">
                            <div className="border border-gray-300 p-4 w-full max-w-sm text-sm">
                              {[
                                ['all', 'select all vip type'],
                                ['vipUsers', 'VIP users'],
                                ['vipsOfMySport', "VIP's of My sport"],
                                ['myClubsUsers', 'My Clubs users'],
                                ['myTeamsUsers', 'My Teams users'],
                                ['athletes', 'Athletes'],
                                ['coaches', 'Coaches'],
                                ['teams', 'Teams'],
                                ['testimonials', 'Testimonials'],
                                ['populars', 'Populars'],
                                ['users', 'Users'],
                                ['lastLogged', 'Last logged'],
                                ['ourClubs', 'Our Clubs'],
                              ].map(([k, label]) => (
                                <label key={k} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!vipTypes[k]}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setVipTypes((p) => {
                                        if (k === 'all') {
                                          const next: Record<string, boolean> = { ...p, all: checked };
                                          for (const key of Object.keys(p)) {
                                            if (key !== 'all') next[key] = checked;
                                          }
                                          return next;
                                        }
                                        return { ...p, [k]: checked, all: false };
                                      });
                                    }}
                                  />
                                  <span className={k === 'all' ? 'font-semibold' : ''}>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 items-start">
                            <div className="text-sm text-gray-700 pt-2">-Who can see him?</div>
                            <div className="border border-gray-300 p-4 w-full max-w-sm text-sm">
                              <div className="mb-2 text-center text-gray-700">Type of user</div>
                              {[
                                ['all', 'select all user type'],
                                ['athlete', 'Athlete'],
                                ['coach', 'Coach'],
                                ['team', 'Team'],
                                ['club', 'Club'],
                                ['group', 'Group'],
                                ['club_subadmin', 'Club_subadmin'],
                                ['club_operator', 'Club_operator'],
                              ].map(([k, label]) => (
                                <label key={k} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!vipVisibleToUserTypes[k]}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setVipVisibleToUserTypes((p) => {
                                        if (k === 'all') {
                                          const next: Record<string, boolean> = { ...p, all: checked };
                                          for (const key of Object.keys(p)) {
                                            if (key !== 'all') next[key] = checked;
                                          }
                                          return next;
                                        }
                                        return { ...p, [k]: checked, all: false };
                                      });
                                    }}
                                  />
                                  <span className={k === 'all' ? 'font-semibold' : ''}>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 items-start mt-6">
                            <div className="text-sm text-gray-700 pt-2">Language</div>
                            <div className="border border-gray-300 p-4 w-full max-w-sm text-sm">
                              {Object.keys(vipLanguagesAllowed).map((k) => (
                                <label key={k} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!vipLanguagesAllowed[k]}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setVipLanguagesAllowed((p) => {
                                        if (k === 'all') {
                                          const next: Record<string, boolean> = { ...p, all: checked };
                                          for (const key of Object.keys(p)) {
                                            if (key !== 'all') next[key] = checked;
                                          }
                                          return next;
                                        }
                                        return { ...p, [k]: checked, all: false };
                                      });
                                    }}
                                  />
                                  <span className={k === 'all' ? 'font-semibold' : ''}>
                                    {k === 'all' ? 'select all languages' : k}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 items-start mt-6">
                            <div className="text-sm text-gray-700 pt-2">Countries</div>
                            <div className="border border-gray-300 p-4 w-full max-w-sm text-sm max-h-64 overflow-auto">
                              <label className="flex items-center gap-2 mb-1 sticky top-0 bg-white py-1 border-b border-gray-200">
                                <input
                                  type="checkbox"
                                  checked={!!vipCountriesAllowed.all}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setVipCountriesAllowed((p) => {
                                      const next: Record<string, boolean> = { ...p, all: checked };
                                      for (const c of ALL_COUNTRIES) {
                                        next[c] = checked;
                                      }
                                      return next;
                                    });
                                  }}
                                />
                                <span className="font-semibold">select all countries</span>
                              </label>
                              {ALL_COUNTRIES.map((country) => (
                                <label key={country} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!vipCountriesAllowed[country]}
                                    onChange={(e) =>
                                      setVipCountriesAllowed((p) => ({
                                        ...p,
                                        [country]: e.target.checked,
                                        all: false,
                                      }))
                                    }
                                  />
                                  <span>{country}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 items-center mt-4">
                            <div className="text-sm text-gray-700">Duration</div>
                            <AdminPcuDatePicker
                              value={ddMmYyyyToIso(vipDuration)}
                              onChange={(iso) => setVipDuration(isoToDdMmYyyy(iso))}
                            />
                          </div>

                          <div className="text-center text-sm mt-6">
                            What data of the VIP the user can see?
                            <div className="text-xs text-red-700">(only s-admin and co-admins can use this function)</div>
                          </div>

                          <div className="mt-4 space-y-3 text-sm max-w-xl mx-auto">
                            <div className="flex items-center gap-4">
                              <ToggleNY value={vipAllowVisitorsProfile} onChange={setVipAllowVisitorsProfile} />
                              <span>Allow to my visitors to accede to my profile</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <ToggleNY value={vipAllowVisitorsBiography} onChange={setVipAllowVisitorsBiography} />
                              <span>Allow to my visitors to open my biography</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <ToggleNY value={vipAllowVisitorsFriendship} onChange={setVipAllowVisitorsFriendship} />
                              <span>Allow to my visitors to the friendship</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <ToggleNY value={vipAllowVisitorsMail} onChange={setVipAllowVisitorsMail} />
                              <span>Allow to my visitors to mail me</span>
                            </div>
                          </div>

                          <div className="mt-8 border border-gray-300">
                            <div className="bg-slate-600 text-white px-3 py-2 font-semibold text-sm">
                              Banner and header for the reference list of user
                            </div>
                            <div className="p-3 text-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={vipShowInReferenceList}
                                    onChange={(e) => setVipShowInReferenceList(e.target.checked)}
                                  />
                                  Enable to display in the reference list of users
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={vipShowInBanner}
                                    onChange={(e) => setVipShowInBanner(e.target.checked)}
                                  />
                                  Enable to display in the banner at main page
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={vipUsernameEnabled}
                                    onChange={(e) => setVipUsernameEnabled(e.target.checked)}
                                  />
                                  <input
                                    value={vipUsername}
                                    onChange={(e) => setVipUsername(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={vipYoutubeEnabled}
                                    onChange={(e) => setVipYoutubeEnabled(e.target.checked)}
                                  />
                                  <input
                                    value={vipYoutubeUrl}
                                    onChange={(e) => setVipYoutubeUrl(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 flex-1"
                                    placeholder="YouTube URL"
                                  />
                                </div>
                              </div>

                              <div className="mt-3 bg-gray-100 border border-gray-200 h-44 flex items-center justify-center overflow-hidden relative">
                                {vipBannerDisplaySrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={vipBannerDisplaySrc}
                                    src={vipBannerDisplaySrc}
                                    alt="VIP reference banner"
                                    className="w-full h-full object-contain"
                                    onError={() =>
                                      setVipBannerUploadError(
                                        'Banner preview could not load. Save again or re-upload the image.',
                                      )
                                    }
                                  />
                                ) : (
                                  <span className="text-4xl font-semibold text-gray-400 text-center leading-tight">
                                    NO<br />
                                    IMAGE
                                    <br />
                                    AVAILABLE
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <label
                                  className={`px-3 py-1.5 bg-gray-100 border border-gray-300 ${vipBannerUploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
                                >
                                  {vipBannerUploading ? 'Uploading…' : 'Choose File'}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    className="hidden"
                                    disabled={vipBannerUploading}
                                    onChange={(e) => void handleVipBannerFileChange(e)}
                                  />
                                </label>
                                <span className="text-xs text-gray-600">{vipBannerImageFileName}</span>
                                <button
                                  type="button"
                                  disabled={vipBannerUploading || !vipBannerImagePath}
                                  onClick={() => void handleVipBannerDelete()}
                                  className="px-4 py-1.5 bg-gray-200 border border-gray-400 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                              {vipBannerUploadError ? (
                                <p className="mt-2 text-xs text-red-700">{vipBannerUploadError}</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-6">
                            <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                              References of the admin
                            </div>
                            <ProfileReferencesReadOnly
                              referencesHtml={user.referencesHtml}
                              referencesLevel={user.referencesLevel}
                              emptyMessage="No admin references have been added yet."
                            />
                          </div>

                          {user.entityProfile ? (
                            <div className="mt-6">
                              <div className="bg-[#efe7b3] border border-[#c9bd7a] px-4 py-2 text-sm font-semibold">
                                {user.segment === 'clubs'
                                  ? 'References of the club'
                                  : `References of the ${user.roleTitle.toLowerCase()}`}
                              </div>
                              <ProfileReferencesReadOnly
                                referencesHtml={user.entityProfile.referencesHtml}
                                referencesLevel={user.entityProfile.referencesLevel}
                                emptyMessage={
                                  user.segment === 'clubs'
                                    ? 'No club references have been added yet.'
                                    : `No ${user.roleTitle.toLowerCase()} references have been added yet.`
                                }
                              />
                            </div>
                          ) : null}

                          <div className="mt-6 border border-gray-300 p-3 bg-white">
                            <div className="text-sm font-semibold mb-3">VIP list settings</div>
                            <div className="flex flex-wrap items-center gap-6 text-sm">
                              <div className="flex items-center gap-2">
                                <span>Priority Level :</span>
                                <select
                                  value={vipPriorityLevel}
                                  onChange={(e) => setVipPriorityLevel(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 bg-white"
                                >
                                  {['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'].map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={vipFavourite}
                                  onChange={(e) => setVipFavourite(e.target.checked)}
                                />
                                Favourite VIP
                              </label>
                            </div>

                            <AdminSettingsSaveBar
                              saving={adminSaving}
                              error={adminSaveError}
                              success={adminSaveSuccess}
                              onSave={() => void saveAdminSettings()}
                              onCancel={resetAdminSettingsForm}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-4 pb-4 text-sm text-gray-600">
                    Admin settings for this account type are not available in this view yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'functions' ? (
          <div className="p-0">
            <div className="px-4 py-3">
              <div className="border border-gray-300 bg-white">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-gray-100 border-b border-gray-300 text-sm">
                  <div className="text-xs">Maximum number of Members</div>
                  <input
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                    className="px-2 py-1 border border-gray-300 w-20 text-center text-red-700 font-semibold"
                  />
                  <div className="text-xs">Current Members</div>
                  <input
                    value={currentMembers}
                    onChange={(e) => setCurrentMembers(e.target.value)}
                    className="px-2 py-1 border border-gray-300 w-16 text-center text-red-700 font-semibold"
                  />
                  <div className="text-xs">Still Available</div>
                  <div className="px-2 py-1 bg-green-500 text-white font-semibold rounded w-16 text-center">
                    {stillAvailable}
                  </div>
                  <button
                    type="button"
                    onClick={saveFunctionsSettings}
                    disabled={functionsSaving}
                    className="ml-auto px-4 py-1.5 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                  >
                    {functionsSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>

                <div className="bg-slate-700 text-white font-semibold px-4 py-2 text-sm">
                  Permission for management section
                </div>

                <div className="px-4 py-3">
                  <div className="text-sm font-semibold mb-2">New requests of licenses:</div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
                    <div className="space-y-2 text-sm">
                      <LabeledInput label="New requests of licenses:" value={newLicenseRequests} onChange={setNewLicenseRequests} />
                      <LabeledInput label="To pay over the authorisation no:" value={authorizationNo} onChange={setAuthorizationNo} />
                      <LabeledInput label="Price in euro :" value={priceEuro} onChange={setPriceEuro} />
                      <LabeledInput label="Cost to pay:" value={costToPay} onChange={setCostToPay} />
                      <div className="grid grid-cols-[260px_1fr_60px] items-center gap-2">
                        <label className="text-sm">Amount paid:</label>
                        <input
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-28"
                        />
                        <button type="button" className="px-3 py-1 bg-black text-white rounded">
                          Pay
                        </button>
                      </div>
                      <div className="grid grid-cols-[260px_1fr_60px] items-center gap-2">
                        <label className="text-sm">Max devices that can enable:</label>
                        <input
                          value={maxDevicesCanEnable}
                          onChange={(e) => setMaxDevicesCanEnable(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-28"
                        />
                        <button type="button" className="px-3 py-1 bg-gray-200 border border-gray-300 rounded">
                          Edit
                        </button>
                      </div>
                      <LabeledInput label="Current device enable:" value={currentDeviceEnabled} onChange={setCurrentDeviceEnabled} />
                      <LabeledInput label="Request of code in pending:" value={requestCodePending} onChange={setRequestCodePending} />
                      <LabeledInput label="Device disable:" value={deviceDisable} onChange={setDeviceDisable} />
                      <LabeledInput label="Avilable enquiries:" value={availableEnquiries} onChange={setAvailableEnquiries} />
                      <div className="grid grid-cols-[260px_1fr] items-center gap-2">
                        <label className="text-sm">
                          Date of expiration of the subscription to Movesbook and related licenses:
                        </label>
                        <AdminPcuDatePicker
                          value={subscriptionExpiration}
                          onChange={setSubscriptionExpiration}
                          className="w-40"
                        />
                      </div>
                      <div className="grid grid-cols-[260px_1fr] items-center gap-2">
                        <label className="text-sm">Block code generation</label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={blockCodeGeneration}
                            onChange={(e) => setBlockCodeGeneration(e.target.checked)}
                          />
                          <span className="text-xs text-gray-600">Enabled</span>
                        </label>
                      </div>
                    </div>

                    <div className="border border-gray-200 p-3 text-sm">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{user.roleTitle}</span>
                        <button type="button" className="px-3 py-1 bg-red-700 text-white rounded">
                          Upgrade Version
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-gray-700">
                        Actual Subscription <span className="text-red-700">{user.version}</span> expiration date{' '}
                        <span className="text-red-700">{user.endSubscription || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-red-900 text-white font-semibold px-4 py-2 text-sm">
                    Message to be displayed after the activation of the accounts but not payed
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={postActivationMsgEnabled}
                          onChange={(e) => setPostActivationMsgEnabled(e.target.checked)}
                        />
                        Enable message
                      </label>
                      <div className="flex items-center gap-2">
                        <span>Days after the assignments of the accounts</span>
                        <select
                          value={postActivationDays}
                          onChange={(e) => setPostActivationDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 bg-white"
                        >
                          {['1-30', '1-90', '1-180'].map((r) => (
                            <option key={r} value={r}>
                              ({r})
                            </option>
                          ))}
                        </select>
                        <span>days</span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-gray-700 mb-1">Edit for each language</div>
                      <div className="flex flex-wrap gap-3 text-sm mb-2">
                        {LANG_KEYS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => switchFunctionsLang(l)}
                            className={`px-2 py-1 border ${
                              functionsLang === l ? 'border-red-600 text-red-700' : 'border-transparent'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <CKEditorComponent
                        instanceId="post-activation-editor"
                        localeKey={functionsLang}
                        registerGetData={(getData) => {
                          functionsPostActivationGetDataRef.current = getData;
                        }}
                        value={postActivationHtmlByLang[functionsLang] || ''}
                        onChange={(html) =>
                          setPostActivationHtmlByLang((prev) => ({ ...prev, [functionsLang]: html }))
                        }
                        minHeightPx={220}
                        placeholder=""
                      />
                      <div className="mt-2">
                        <button type="button" className="px-4 py-1.5 bg-red-600 text-white font-semibold rounded">
                          Update Terms
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-green-700 text-white font-semibold px-4 py-2 text-sm">
                    Free accounts for clubs member for actual version = {user.version}
                  </div>
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="min-w-[640px] text-sm border border-gray-300">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="border border-gray-300 px-2 py-2 text-left w-56"> </th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Trial</th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Base</th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Premium</th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Pro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['athletesLoaded', 'Athletes that can be loaded freely'] as const,
                            ['assigned', 'Free accounts assigned'] as const,
                            ['remaining', 'Remaining free accounts'] as const,
                            ['daysDuration', 'Days duration of the subscription'] as const,
                          ] as const
                        ).map(([rowKey, label]) => (
                          <tr key={rowKey}>
                            <td className="border border-gray-300 px-2 py-2 bg-slate-100 font-semibold">
                              {label}
                            </td>
                            {(['trial', 'base', 'premium', 'pro'] as VersionColumn4[]).map((col) => (
                              <td key={col} className="border border-gray-300 px-2 py-2 text-center">
                                <input
                                  value={freeAccountsMatrix[rowKey][col]}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setFreeAccountsMatrix((prev) => ({
                                      ...prev,
                                      [rowKey]: { ...prev[rowKey], [col]: value },
                                    }));
                                    if (rowKey === 'daysDuration' && col === 'trial') {
                                      setFreeAccountsDurationDays(value);
                                    }
                                  }}
                                  className="px-2 py-1 border border-gray-300 w-16 text-center mx-auto"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-yellow-400 px-4 py-2 font-semibold text-sm">
                    Terms of payment for the stock of Accounts
                  </div>
                  <div className="px-4 py-3 text-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span>Credit card</span>
                        <label className="inline-flex items-center gap-1">
                          <input type="radio" checked={termsCreditCard} onChange={() => setTermsCreditCard(true)} />
                          Y
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input type="radio" checked={!termsCreditCard} onChange={() => setTermsCreditCard(false)} />
                          N
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Send money later and before of</span>
                        <input
                          value={termsSendMoneyDays}
                          onChange={(e) => setTermsSendMoneyDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-16"
                        />
                        <span>days</span>
                        <label className="inline-flex items-center gap-1 ml-2">
                          <input type="checkbox" checked={termsSendMoneyLater} onChange={(e) => setTermsSendMoneyLater(e.target.checked)} />
                          Enable message
                        </label>
                      </div>
                      <button type="button" className="ml-auto px-4 py-1.5 bg-gray-300 border border-gray-400 rounded">
                        Upgrade
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-red-900 text-white font-semibold px-4 py-2 text-sm">
                    Available sharing
                  </div>
                  <div className="px-4 py-3 text-sm space-y-2">
                    <ShareRow label="Coaches" checked={sharingCoaches} onChange={setSharingCoaches} />
                    <ShareRow label="Teams" checked={sharingTeams} onChange={setSharingTeams} />
                    <ShareRow label="Groups" checked={sharingGroups} onChange={setSharingGroups} />
                    <ShareRow label="Other Clubs" checked={sharingOtherClubs} onChange={setSharingOtherClubs} />
                    <div className="mt-3">
                      <button type="button" className="px-6 py-1.5 bg-red-600 text-white font-semibold rounded">
                        Proceed
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-green-700 text-white font-semibold px-4 py-2 text-sm">
                    Accounts buyed for Club&apos;s members and their status. accounts still available
                  </div>
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="min-w-[560px] text-sm border border-gray-300">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="border border-gray-300 px-2 py-2 w-56" />
                          <th className="border border-gray-300 px-2 py-2 text-center">Base</th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Premium</th>
                          <th className="border border-gray-300 px-2 py-2 text-center">Pro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['assigned', 'buyed accounts assigned', 'A'] as const,
                            ['remaining', 'Remaining buyed accounts', 'B'] as const,
                            ['daysDuration', 'Days Duration', 'C'] as const,
                          ] as const
                        ).map(([rowKey, label, tag]) => (
                          <tr key={rowKey}>
                            <td className="border border-gray-300 px-2 py-2 bg-slate-100 font-semibold">
                              {label} <span className="text-xs">{tag}</span>
                            </td>
                            {(['base', 'premium', 'pro'] as VersionColumn3[]).map((col) => (
                              <td key={col} className="border border-gray-300 px-2 py-2 text-center">
                                <input
                                  value={buyedAccountsMatrix[rowKey][col]}
                                  onChange={(e) =>
                                    setBuyedAccountsMatrix((prev) => ({
                                      ...prev,
                                      [rowKey]: { ...prev[rowKey], [col]: e.target.value },
                                    }))
                                  }
                                  className="px-2 py-1 border border-gray-300 w-20 text-center mx-auto"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="mt-3 text-center">
                      <button type="button" className="px-4 py-1.5 bg-gray-700 text-white rounded">
                        Historical account purchased
                      </button>
                    </div>

                    <div className="mt-4 bg-[#efe7b3] border border-[#c9bd7a] px-4 py-3">
                      <div className="font-semibold mb-2">Add a stock of accounts</div>
                      <div className="grid grid-cols-1 md:grid-cols-[160px_160px_120px_160px_1fr] gap-3 items-end">
                        <div>
                          <div className="text-xs mb-1">Accounts</div>
                          <select
                            value={stockAccounts}
                            onChange={(e) => setStockAccounts(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-400 bg-white"
                          >
                            {['select', '1', '10', '100', '1000'].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs mb-1">Version</div>
                          <select
                            value={stockVersion}
                            onChange={(e) => setStockVersion(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-400 bg-white"
                          >
                            {['select', 'Base', 'Premium', 'Pro'].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs mb-1">Price</div>
                          <div className="flex items-center gap-2">
                            <span>€</span>
                            <input
                              value={stockPrice}
                              onChange={(e) => setStockPrice(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-400 bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs mb-1">Payment</div>
                          <select
                            value={stockPayment}
                            onChange={(e) => setStockPayment(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-400 bg-white"
                          >
                            {['select', 'Credit card', 'Bank transfer'].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-end">
                          <button type="button" className="px-8 py-2 bg-gray-800 text-white font-semibold rounded">
                            Proceed
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-gray-300 px-4 py-2 font-semibold text-sm">Actual function and procedure</div>
                  <div className="px-4 py-3">
                    <div className="flex gap-2 mb-2">
                      {(['social', 'training', 'management'] as ProcedureTabId[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setProcedureTab(t)}
                          className={`px-6 py-2 text-sm font-semibold rounded ${
                            procedureTab === t ? 'bg-teal-700 text-white' : 'bg-gray-600 text-white/80'
                          }`}
                        >
                          {t[0].toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="border border-gray-300">
                      {procedureRows.map((r) => (
                        <div key={r.id} className="grid grid-cols-[24px_1fr_120px] items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
                          <span
                            className={`w-3 h-3 rounded-full inline-block ${
                              r.status === 'enabled'
                                ? 'bg-green-500'
                                : r.status === 'disabled'
                                  ? 'bg-red-500'
                                  : r.status === 'optional_on'
                                    ? 'bg-green-500'
                                    : 'bg-purple-500'
                            }`}
                            title={r.status}
                          />
                          <span className="text-sm">{r.label}</span>
                          <div className="flex justify-end gap-3 text-xs">
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                name={`procedure-${procedureTab}-${r.id}`}
                                checked={r.on}
                                onChange={() =>
                                  updateProcedureRows((prev) =>
                                    prev.map((x) =>
                                      x.id === r.id ? applyProcedureRowOnToggle(x, true) : x,
                                    ),
                                  )
                                }
                              />
                              On
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                name={`procedure-${procedureTab}-${r.id}`}
                                checked={!r.on}
                                onChange={() =>
                                  updateProcedureRows((prev) =>
                                    prev.map((x) =>
                                      x.id === r.id ? applyProcedureRowOnToggle(x, false) : x,
                                    ),
                                  )
                                }
                              />
                              Off
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs flex flex-wrap gap-6 items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Features enabled
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Features not enabled
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Optionals not enabled
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Optional enabled
                      </div>
                    </div>
                    <div className="mt-3 flex justify-center">
                      <button type="button" className="px-6 py-2 bg-red-600 text-white font-semibold rounded">
                        Proceed
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-teal-700 text-white font-semibold px-4 py-2 text-sm">Expiration</div>
                  <div className="px-4 py-3 text-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={notifyAtExpiration}
                          onChange={(e) => setNotifyAtExpiration(e.target.checked)}
                        />
                        Notify at expiration
                      </label>
                      <div className="flex items-center gap-2">
                        <span>Alert</span>
                        <input
                          value={notifyBeforeDays}
                          onChange={(e) => setNotifyBeforeDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-12 text-center"
                        />
                        <span>days before and</span>
                        <input
                          value={notifyAfterDays}
                          onChange={(e) => setNotifyAfterDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-12 text-center"
                        />
                        <span>days after the expiration</span>
                        <label className="inline-flex items-center gap-2 ml-2">
                          <input
                            type="checkbox"
                            checked={notifyEveryDay}
                            onChange={(e) => setNotifyEveryDay(e.target.checked)}
                          />
                          Alert every day and not only once
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={notifyByMail} onChange={(e) => setNotifyByMail(e.target.checked)} />
                        Mail
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={notifyOnNetworkPage}
                          onChange={(e) => setNotifyOnNetworkPage(e.target.checked)}
                        />
                        On your network page
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={notifyCellular} onChange={(e) => setNotifyCellular(e.target.checked)} />
                        Cellular
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={notifyPostFacebook} onChange={(e) => setNotifyPostFacebook(e.target.checked)} />
                        Post on Facebook
                      </label>
                      <button
                        type="button"
                        onClick={saveExpirationNotifySection}
                        disabled={expirationNotifySaving}
                        className="ml-auto px-4 py-1.5 bg-gray-300 border border-gray-400 rounded disabled:opacity-50"
                      >
                        {expirationNotifySaving ? 'Saving…' : 'Upgrade'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-[#efe7b3] px-4 py-2 font-semibold text-sm">
                    At the expiring of the subscription of the Club ( not the expiring of the Club&apos;s member )
                  </div>
                  <div className="px-4 py-3 text-sm space-y-3">
                    <div className="font-semibold">
                      What shall happen to the features enabled when the current subscription of the Club expires...?
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={expireExtendEnabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setExpireExtendEnabled(enabled);
                            if (enabled) {
                              const extended = computeExtendedExpirationIso(
                                currentSubscriptionExpirationIso,
                                expireExtendDays,
                              );
                              if (extended) {
                                setExpireExtendedTo(extended);
                                setExpirationExtendDateError('');
                              }
                            }
                          }}
                        />
                        enable the extension of date for
                      </label>
                      <input
                        value={expireExtendDays}
                        onChange={(e) => {
                          const nextDays = e.target.value;
                          setExpireExtendDays(nextDays);
                          if (expireExtendEnabled) {
                            const extended = computeExtendedExpirationIso(
                              currentSubscriptionExpirationIso,
                              nextDays,
                            );
                            if (extended) {
                              setExpireExtendedTo(extended);
                              setExpirationExtendDateError('');
                            }
                          }
                        }}
                        className="px-2 py-1 border border-gray-300 w-16 text-center"
                      />
                      <span>days after the expiration date of the current subscription</span>
                      <span className="ml-auto text-xs bg-gray-200 border border-gray-300 px-2 py-1">-1=Unlimited</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_280px] gap-3 items-end">
                      <div />
                      <div>
                        <div className="text-xs text-gray-600">Actual Expiration</div>
                        <input
                          readOnly
                          value={
                            currentSubscriptionExpirationIso
                              ? isoToDdMmYyyy(currentSubscriptionExpirationIso)
                              : ''
                          }
                          placeholder="—"
                          className="w-full px-3 py-2 border border-gray-300 bg-gray-50 text-center"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Extended to...</div>
                        <AdminPcuDatePicker
                          value={expireExtendedTo}
                          onChange={handleExpireExtendedToChange}
                          disabled={!expireExtendEnabled}
                          minDateIso={currentSubscriptionExpirationIso}
                          className="w-full justify-center [&_input]:w-full [&_input]:text-center [&_input]:bg-red-50 [&_input]:text-red-700"
                        />
                        {expirationExtendDateError ? (
                          <p className="mt-1 text-xs text-red-700">{expirationExtendDateError}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ModeCard
                        title="Sharing with shared users"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'view', label: 'Only view' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={sharingSharedUsersMode}
                        onChange={setSharingSharedUsersMode}
                      />
                      <ModeCard
                        title="Social items of current versions"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'view', label: 'View only' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={socialItemsMode}
                        onChange={setSocialItemsMode}
                        lines={[
                          {
                            checked: socialClubPages,
                            text: "Club's pages",
                            onChange: setSocialClubPages,
                          },
                          {
                            checked: socialMemberPages,
                            text: "Member's pages single user pages",
                            red: true,
                            onChange: setSocialMemberPages,
                          },
                        ]}
                      />
                      <ModeCard
                        title="End users interactive panel"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={endUsersInteractiveMode}
                        onChange={setEndUsersInteractiveMode}
                      />
                      <ModeCard
                        title="Training items of current versions"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'view', label: 'View only' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={trainingItemsMode}
                        onChange={setTrainingItemsMode}
                        lines={[
                          {
                            checked: trainingClubPages,
                            text: "Club's pages",
                            onChange: setTrainingClubPages,
                          },
                          {
                            checked: trainingMemberPages,
                            text: "Member's pages single user pages",
                            red: true,
                            onChange: setTrainingMemberPages,
                          },
                        ]}
                      />
                      <ModeCard
                        title="Management items"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={managementItemsMode}
                        onChange={setManagementItemsMode}
                      />
                      <ModeCard
                        title="Insert options in management area"
                        options={[
                          { id: 'stop', label: 'Stop' },
                          { id: 'extend', label: 'Extend' },
                        ]}
                        value={insertOptionsManagementMode}
                        onChange={setInsertOptionsManagementMode}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={saveExpirationFlowSection}
                        disabled={expirationFlowSaving}
                        className="px-4 py-1.5 bg-gray-300 border border-gray-400 rounded disabled:opacity-50"
                      >
                        {expirationFlowSaving ? 'Saving…' : 'Upgrade'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 px-4 py-3">
                    <CKEditorComponent
                      instanceId="expiration-msg-editor"
                      localeKey={functionsLang}
                      registerGetData={(getData) => {
                        functionsExpirationMsgGetDataRef.current = getData;
                      }}
                      value={expirationMsgHtmlByLang[functionsLang] || ''}
                      onChange={(html) => setExpirationMsgHtmlByLang((prev) => ({ ...prev, [functionsLang]: html }))}
                      minHeightPx={220}
                      placeholder=""
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={saveExpirationMessageSection}
                        disabled={expirationMsgSaving}
                        className="px-6 py-2 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                      >
                        {expirationMsgSaving ? 'Saving…' : 'Upgrade all'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 bg-blue-900 text-white font-semibold px-4 py-2 text-sm">
                    New members with an existing Single User subscription made previously by theirself
                  </div>
                  <div className="px-4 py-3 text-sm">
                    <div className="text-red-700 font-semibold mb-2">Expiration date New date end their subscription</div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newMembersExpiryMode === 'own'}
                          onChange={() => setNewMembersExpiryMode('own')}
                        />
                        Until date end of their own subscription
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newMembersExpiryMode === 'after_end'}
                          onChange={() => setNewMembersExpiryMode('after_end')}
                        />
                        Until
                        <input
                          value={newMembersAfterDays}
                          onChange={(e) => setNewMembersAfterDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-14 text-center"
                        />
                        days after date end of their own subscription
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newMembersExpiryMode === 'after_invite'}
                          onChange={() => setNewMembersExpiryMode('after_invite')}
                        />
                        Until
                        <input
                          value={newMembersAfterDays}
                          onChange={(e) => setNewMembersAfterDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-14 text-center"
                        />
                        days after acceptance of the invite of assignment
                      </label>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={saveNewMembersSection}
                        disabled={newMembersSaving}
                        className="px-5 py-1.5 bg-gray-300 border border-gray-400 rounded disabled:opacity-50"
                      >
                        {newMembersSaving ? 'Saving…' : 'Upgrade'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-300 px-4 py-3 text-sm">
                    <div className="text-red-700 font-semibold mb-2">
                      New version Assign them the functions available for the followed version..
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="radio" checked={newVersionMode === 'same'} onChange={() => setNewVersionMode('same')} />
                        Remain in the same version they have
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newVersionMode === 'trial_to_base'}
                          onChange={() => setNewVersionMode('trial_to_base')}
                        />
                        Trial user goes to base version
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newVersionMode === 'stay_current_subscription'}
                          onChange={() => setNewVersionMode('stay_current_subscription')}
                        />
                        Remain in the same version they have but when they accede to the system from the Clubs pages they
                        are enabled to utilise only the function enabled for the current subscription of the Club
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newVersionMode === 'next_assigned'}
                          onChange={() => setNewVersionMode('next_assigned')}
                        />
                        Will be assigned the next version that they have as current
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={newVersionMode === 'professional'}
                          onChange={() => setNewVersionMode('professional')}
                        />
                        Will be assigned the Professional version
                      </label>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={saveNewVersionSection}
                        disabled={newVersionSaving}
                        className="px-5 py-1.5 bg-gray-300 border border-gray-400 rounded disabled:opacity-50"
                      >
                        {newVersionSaving ? 'Saving…' : 'Upgrade'}
                      </button>
                    </div>
                  </div>
                </div>

                {functionsSaveError ? (
                  <div className="px-4 py-3 text-sm text-red-700">{functionsSaveError}</div>
                ) : null}
                {functionsSaveSuccess ? (
                  <div className="px-4 py-3 text-sm text-green-700">{functionsSaveSuccess}</div>
                ) : null}
                <div className="flex justify-end gap-3 border-t border-gray-300 px-4 py-3 bg-gray-50">
                  <button
                    type="button"
                    onClick={saveFunctionsSettings}
                    disabled={functionsSaving}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                  >
                    {functionsSaving ? 'Saving…' : 'SAVE'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'idcards' ? (
          <div className="p-0">
            <div className="px-4 py-3">
              <div className="border border-gray-300 bg-white">
                <div className="bg-yellow-400 px-4 py-2 font-semibold text-sm">
                  Terms of payment for the stock of identification cards
                </div>
                <div className="px-4 py-3 text-sm flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span>Credit card</span>
                    <label className="inline-flex items-center gap-1">
                      <input type="radio" checked={idCardsCreditCard} onChange={() => setIdCardsCreditCard(true)} />
                      Y
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input type="radio" checked={!idCardsCreditCard} onChange={() => setIdCardsCreditCard(false)} />
                      N
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Send money later and before of</span>
                    <input
                      value={idCardsSendMoneyLaterDays}
                      onChange={(e) => setIdCardsSendMoneyLaterDays(e.target.value)}
                      className="px-2 py-1 border border-gray-300 w-16 text-center"
                    />
                    <span>days</span>
                  </div>
                  <button
                    type="button"
                    onClick={saveIdCardsSettings}
                    disabled={idCardsSaving}
                    className="ml-auto px-4 py-1.5 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                  >
                    {idCardsSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-red-900 text-white font-semibold px-4 py-2 text-sm">
                    Message to be displayed after the expedition but not payed
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={idCardsMsgAfterExpeditionEnabled}
                          onChange={(e) => setIdCardsMsgAfterExpeditionEnabled(e.target.checked)}
                        />
                        Enable message
                      </label>
                      <div className="flex items-center gap-2">
                        <span>Days after the assignments of the ID cards</span>
                        <select
                          value={idCardsMsgAfterExpeditionDays}
                          onChange={(e) => setIdCardsMsgAfterExpeditionDays(e.target.value)}
                          className="px-2 py-1 border border-gray-300 bg-white w-20"
                        >
                          {['1', '3', '7', '14', '30', '60'].map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <span>days</span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-xs text-gray-700 mb-1">Edit for each language</div>
                      <div className="flex flex-wrap gap-3 text-sm mb-2">
                        {LANG_KEYS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => switchIdCardsLang(l)}
                            className={`px-2 py-1 border ${
                              idCardsLang === l ? 'border-red-600 text-red-700' : 'border-transparent'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <CKEditorComponent
                        instanceId="idcards-expedition-editor"
                        localeKey={idCardsLang}
                        registerGetData={(getData) => {
                          idCardsExpeditionGetDataRef.current = getData;
                        }}
                        value={idCardsMsgAfterExpeditionHtmlByLang[idCardsLang] || ''}
                        onChange={(html) =>
                          setIdCardsMsgAfterExpeditionHtmlByLang((prev) => ({ ...prev, [idCardsLang]: html }))
                        }
                        minHeightPx={260}
                        placeholder=""
                      />
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={saveIdCardsSettings}
                          disabled={idCardsSaving}
                          className="px-4 py-1.5 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                        >
                          Update Terms
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-red-900 text-white font-semibold px-4 py-2 text-sm">
                    Message to be displayed upon the third party pricelist
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={idCardsThirdPartyEnabled}
                        onChange={(e) => setIdCardsThirdPartyEnabled(e.target.checked)}
                      />
                      Enable message
                    </label>
                    <div className="text-sm">
                      <div className="text-xs text-gray-700 mb-1">Enter for each language</div>
                      <div className="flex flex-wrap gap-3 text-sm mb-2">
                        {LANG_KEYS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => switchIdCardsLang(l)}
                            className={`px-2 py-1 border ${
                              idCardsLang === l ? 'border-red-600 text-red-700 bg-[#efe7b3]' : 'border-gray-200 bg-[#efe7b3]'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <CKEditorComponent
                        instanceId="idcards-third-party-editor"
                        localeKey={idCardsLang}
                        registerGetData={(getData) => {
                          idCardsThirdPartyGetDataRef.current = getData;
                        }}
                        value={idCardsThirdPartyHtmlByLang[idCardsLang] || ''}
                        onChange={(html) => setIdCardsThirdPartyHtmlByLang((prev) => ({ ...prev, [idCardsLang]: html }))}
                        minHeightPx={220}
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-green-700 text-white font-semibold px-4 py-2 text-sm">Cards enabled</div>
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(
                        [
                          { id: 'magnetic', label: 'Magnetic' },
                          { id: 'rfids', label: 'Rfids' },
                          { id: 'qr', label: 'QR Code' },
                          { id: 'smartcards', label: 'Smartcards' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setIdCardsEnabledTab(t.id)}
                          className={`px-4 py-2 text-sm font-semibold rounded ${
                            idCardsEnabledTab === t.id ? 'bg-black text-white' : 'bg-gray-300 text-gray-900'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-gray-100 border border-gray-300 p-3 flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span>From</span>
                        <input
                          value={idCardsFrom}
                          onChange={(e) => setIdCardsFrom(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-28"
                          placeholder="from"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span>To</span>
                        <input
                          value={idCardsTo}
                          onChange={(e) => setIdCardsTo(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-28"
                          placeholder="to"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={idCardsBlockDate}
                          onChange={(e) => setIdCardsBlockDate(e.target.value)}
                          className="px-2 py-1 border border-gray-300 w-28"
                          placeholder="Block date"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={idCardsSendEmail}
                          onChange={(e) => setIdCardsSendEmail(e.target.checked)}
                        />
                        Send email
                      </label>
                      <button type="button" className="px-4 py-1.5 bg-gray-800 text-white font-semibold rounded">
                        Enable now
                      </button>
                      <button type="button" className="px-4 py-1.5 bg-gray-200 border border-gray-300 rounded">
                        Remove block
                      </button>
                      <button type="button" className="ml-auto px-4 py-1.5 bg-red-600 text-white font-semibold rounded">
                        Disable
                      </button>
                    </div>

                    <div className="mt-3 border border-gray-300 bg-gray-50 p-4 text-sm">
                      <div className="font-semibold mb-3">
                        Enable during the process of subscription only the follow type of cards. Types not selected will not be possible to assign.
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-6">
                        <label className="inline-flex items-center gap-2 font-semibold">
                          <input
                            type="checkbox"
                            checked={idCardsAllowMagnetic}
                            onChange={(e) => setIdCardsAllowMagnetic(e.target.checked)}
                          />
                          Magnetic card
                        </label>
                        <label className="inline-flex items-center gap-2 font-semibold">
                          <input
                            type="checkbox"
                            checked={idCardsAllowRfid}
                            onChange={(e) => setIdCardsAllowRfid(e.target.checked)}
                          />
                          Rfid card
                        </label>
                        <label className="inline-flex items-center gap-2 font-semibold">
                          <input
                            type="checkbox"
                            checked={idCardsAllowSmartcard}
                            onChange={(e) => setIdCardsAllowSmartcard(e.target.checked)}
                          />
                          Smartcard card
                        </label>
                        <label className="inline-flex items-center gap-2 font-semibold">
                          <input
                            type="checkbox"
                            checked={idCardsAllowQr}
                            onChange={(e) => setIdCardsAllowQr(e.target.checked)}
                          />
                          QR code card
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300">
                  <div className="bg-yellow-400 px-4 py-2 font-semibold text-sm">Historical of car purchased</div>
                  <div className="px-4 py-3 border-t border-gray-200 text-sm flex flex-wrap items-center gap-3">
                    <button type="button" className="px-3 py-1.5 bg-gray-700 text-white rounded inline-flex items-center gap-2">
                      Filter
                      <span className="inline-block border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
                    </button>
                    <select className="px-2 py-1 border border-gray-400 bg-white text-sm w-40" defaultValue="Ordering">
                      <option>Ordering</option>
                    </select>
                    <input
                      value={idCardsHistoryQuery}
                      onChange={(e) => setIdCardsHistoryQuery(e.target.value)}
                      className="px-2 py-1 border border-gray-300"
                      placeholder="Fullname, Use"
                    />
                    <input
                      value={idCardsHistoryInvoice}
                      onChange={(e) => setIdCardsHistoryInvoice(e.target.value)}
                      className="px-2 py-1 border border-gray-300"
                      placeholder="Invoice numbe"
                    />
                    <button type="button" className="px-5 py-1.5 bg-red-600 text-white font-semibold rounded">
                      Proceed
                    </button>
                    <button type="button" className="ml-auto hover:underline">
                      Print
                    </button>
                    <button type="button" className="hover:underline">
                      Send Msg
                    </button>
                    <button type="button" onClick={handleSendMail} className="hover:underline">
                      Send mail
                    </button>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="bg-gray-200 px-3 py-2 text-sm flex items-center gap-3">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" disabled />
                        Select all
                      </label>
                    </div>

                    <div className="px-2 py-2 flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        className="px-3 py-1 border border-gray-300 bg-white"
                        onClick={() => setIdCardsHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      {[1, 2, 3, 4, 5].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setIdCardsHistoryPage(p)}
                          className={`px-3 py-1 border border-gray-300 ${idCardsHistoryPage === p ? 'bg-gray-800 text-white' : 'bg-white'}`}
                        >
                          {p}
                        </button>
                      ))}
                      <span className="px-2">…</span>
                      {[13, 14].map((p) => (
                        <button key={p} type="button" onClick={() => setIdCardsHistoryPage(p)} className="px-3 py-1 border border-gray-300 bg-white">
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="px-3 py-1 border border-gray-300 bg-white"
                        onClick={() => setIdCardsHistoryPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>

                    <div className="space-y-4">
                      {[0, 1].map((idx) => (
                        <div key={idx} className="border border-gray-300 bg-white">
                          <div className="grid grid-cols-[32px_72px_1fr] gap-2 p-2 items-start">
                            <div className="pt-2">
                              <input type="checkbox" disabled />
                            </div>
                            <div className="w-16 h-16 bg-white border border-gray-300 overflow-hidden flex items-center justify-center">
                              {user.imageUrl ? (
                                isDataUrl(user.imageUrl) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Image src={user.imageUrl} alt="" width={64} height={64} className="w-full h-full object-cover" />
                                )
                              ) : (
                                <User className="w-7 h-7 text-gray-500" />
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border border-gray-300">
                                <thead>
                                  <tr className="bg-purple-200">
                                    <th className="border border-gray-300 px-2 py-1 text-left">Username</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Country</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Card range from</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Area product</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Date</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Cost</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Rest</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Block</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Type of user</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="border border-gray-300 px-2 py-1">{user.username || '—'}</td>
                                    <td className="border border-gray-300 px-2 py-1">{user.country || '—'}</td>
                                    <td className="border border-gray-300 px-2 py-1" />
                                    <td className="border border-gray-300 px-2 py-1">RFID bracelets</td>
                                    <td className="border border-gray-300 px-2 py-1">2018-10-10</td>
                                    <td className="border border-gray-300 px-2 py-1">3000</td>
                                    <td className="border border-gray-300 px-2 py-1 font-semibold">3000</td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">●</td>
                                    <td className="border border-gray-300 px-2 py-1">{user.roleTitle}</td>
                                  </tr>
                                </tbody>
                              </table>

                              <table className="w-full text-xs border border-gray-300 border-t-0">
                                <thead>
                                  <tr className="bg-purple-200">
                                    <th className="border border-gray-300 px-2 py-1 text-left">Full name</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Locality</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Card range to</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Detail product</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Expires</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">payed</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">pay</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Date Block</th>
                                    <th className="border border-gray-300 px-2 py-1 text-left">Invoice number</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="border border-gray-300 px-2 py-1">{user.fullname || '—'}</td>
                                    <td className="border border-gray-300 px-2 py-1">{user.locality || '—'}</td>
                                    <td className="border border-gray-300 px-2 py-1" />
                                    <td className="border border-gray-300 px-2 py-1">1000 three color</td>
                                    <td className="border border-gray-300 px-2 py-1">-</td>
                                    <td className="border border-gray-300 px-2 py-1">0</td>
                                    <td className="border border-gray-300 px-2 py-1 font-semibold">2018-10-10</td>
                                    <td className="border border-gray-300 px-2 py-1">0000-00-00</td>
                                    <td className="border border-gray-300 px-2 py-1">Card-200388-18</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {idCardsSaveError ? <div className="px-4 py-3 text-sm text-red-700">{idCardsSaveError}</div> : null}
                  {idCardsSaveSuccess ? (
                    <div className="px-4 py-3 text-sm text-green-700">{idCardsSaveSuccess}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'cards' ? (
          <div className="p-0">
            <div className="px-4 py-6">
              <div className="border border-gray-300 bg-white">
                <div className="bg-slate-500 text-white font-semibold px-4 py-2 text-center">
                  Status of the ID devices
                </div>

                <div className="px-4 py-4">
                  <div className="flex justify-end gap-10 text-xs text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-black inline-block" />
                      <span>Blocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                      <span>Assigned</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                      <span>Free</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[680px] w-full text-sm border border-gray-300">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 px-2 py-2 text-left w-72" />
                          <th className="border border-gray-300 px-2 py-2 text-center bg-slate-500 text-white">
                            Global
                          </th>
                          <th className="border border-gray-300 px-2 py-2 text-center bg-slate-500 text-white">
                            Blocked
                          </th>
                          <th className="border border-gray-300 px-2 py-2 text-center bg-slate-500 text-white">
                            Assigned
                          </th>
                          <th className="border border-gray-300 px-2 py-2 text-center bg-slate-500 text-white">
                            Free
                          </th>
                          <th className="border border-gray-300 px-2 py-2 text-center bg-slate-500 text-white">
                            Ass%
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardStatusRows.map((r, idx) => (
                          <tr key={r.id} className={idx === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-2 py-2">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={r.checked}
                                  onChange={(e) =>
                                    setCardStatusRows((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, checked: e.target.checked } : x)),
                                    )
                                  }
                                />
                                <span className={idx === 0 ? 'font-semibold' : ''}>{r.label}</span>
                              </label>
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{r.global}</td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{r.blocked}</td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{r.assigned}</td>
                            <td
                              className={`border border-gray-300 px-2 py-2 text-center font-semibold ${
                                r.highlightFree ? 'bg-yellow-100 text-red-700' : ''
                              }`}
                            >
                              {r.free}
                            </td>
                            <td
                              className={`border border-gray-300 px-2 py-2 text-center font-semibold ${
                                r.highlightPct ? 'bg-sky-100' : ''
                              }`}
                            >
                              {r.assPct}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'devices' ? (
          <div className="p-0">
            <div className="px-4 py-4">
              <div className="border border-gray-300 bg-white">
                <div className="p-4">
                  <div className="bg-[#eeeaf8] border border-gray-300 p-4">
                    <div className="max-w-xl ml-auto text-sm">
                      <div className="grid grid-cols-[1fr_140px] gap-y-2">
                        <div className="text-right pr-4">maximum no of devices that can be enabled</div>
                        <div className="text-left font-semibold">{devicesSummary.maxEnabled}</div>

                        <div className="text-right pr-4">
                          Cost over the number <span className="text-red-700 font-semibold">{devicesSummary.costOverNumber}</span>
                        </div>
                        <div className="text-left font-semibold">{devicesSummary.costEuro}</div>

                        <div className="text-right pr-4">Current devices enabled</div>
                        <div className="text-left font-semibold text-green-700">{devicesSummary.currentEnabled}</div>

                        <div className="text-right pr-4">Devices disable</div>
                        <div className="text-left font-semibold text-green-700">{devicesSummary.disabled}</div>

                        <div className="text-right pr-4">Devices Pending</div>
                        <div className="text-left font-semibold text-green-700">{devicesSummary.pending}</div>

                        <div className="text-right pr-4">Available Inquiries</div>
                        <div className="text-left font-semibold text-green-700">{devicesSummary.availableInquiries}</div>

                        <div className="text-right pr-4 text-red-700">Expiration date</div>
                        <div className="text-left font-semibold">{devicesSummary.expirationDate}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-6">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDevicesTab('enabled')}
                      className={`px-4 py-2 text-sm font-semibold rounded-t ${
                        devicesTab === 'enabled' ? 'bg-black text-white' : 'bg-gray-300 text-gray-900'
                      }`}
                    >
                      Devices enabled to Club&apos;s Management
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevicesTab('logins')}
                      className={`px-4 py-2 text-sm font-semibold rounded-t ${
                        devicesTab === 'logins' ? 'bg-black text-white' : 'bg-gray-300 text-gray-900'
                      }`}
                    >
                      Logins
                    </button>
                  </div>
                  <div className="border border-gray-300 border-t-0">
                    {devicesTab === 'enabled' ? (
                      <div className="p-6">
                        <div className="flex justify-center mb-6">
                          <div className="w-full max-w-2xl h-36 bg-gray-50 border border-gray-200 flex items-center justify-center">
                            <div className="flex items-center gap-10 opacity-80">
                              <div className="text-2xl font-semibold text-gray-400">🪟</div>
                              <div className="text-2xl font-semibold text-gray-400"></div>
                              <div className="text-2xl font-semibold text-gray-400">🤖</div>
                              <div className="text-2xl font-semibold text-blue-600">🔒</div>
                              <div className="text-2xl font-semibold text-gray-400">🖥️</div>
                              <div className="text-2xl font-semibold text-gray-400">💻</div>
                              <div className="text-2xl font-semibold text-gray-400">📱</div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-200">
                          {enabledDevices.map((d) => (
                            <div
                              key={d.id}
                              className="grid grid-cols-[40px_1fr_24px] items-center gap-3 px-4 py-4 border-b border-gray-200"
                            >
                              <div className="w-5 h-5 bg-yellow-400 border border-gray-700 rounded-sm" />
                              <div className="flex items-center justify-between gap-6">
                                <div className="font-semibold text-gray-700">{d.name}</div>
                                <div className="text-sm text-gray-500">{d.locationLine}</div>
                              </div>
                              <button
                                type="button"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() =>
                                  setEnabledDevices((prev) =>
                                    prev.map((x) => (x.id === d.id ? { ...x, expanded: !x.expanded } : x)),
                                  )
                                }
                                aria-label="Toggle"
                              >
                                ▾
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6">
                        <div className="max-w-md mx-auto border border-gray-300 p-4">
                          <div className="text-center font-semibold text-xl mb-2">Filter</div>
                          <div className="text-center text-sm mb-4">
                            club : <span className="text-red-700 font-semibold">{user.username}</span>
                          </div>
                          <div className="grid grid-cols-[90px_1fr] gap-2 text-sm">
                            <div className="self-center">From date</div>
                            <input
                              value={deviceLogFrom}
                              onChange={(e) => setDeviceLogFrom(e.target.value)}
                              className="px-3 py-2 border border-gray-300"
                              placeholder="From"
                            />
                            <div className="self-center">To date</div>
                            <input
                              value={deviceLogTo}
                              onChange={(e) => setDeviceLogTo(e.target.value)}
                              className="px-3 py-2 border border-gray-300"
                              placeholder="To"
                            />
                          </div>
                          <div className="mt-4 flex justify-center gap-3">
                            <button type="button" className="px-6 py-2 bg-gray-700 text-white font-semibold rounded">
                              Apply
                            </button>
                            <button type="button" className="px-6 py-2 bg-gray-700 text-white font-semibold rounded">
                              Refresh
                            </button>
                          </div>
                          <div className="mt-2 flex justify-center">
                            <button type="button" className="px-8 py-2 bg-red-600 text-white font-semibold rounded">
                              Delete selected
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-gray-200">
                          {deviceLogs.map((l) => (
                            <div
                              key={l.id}
                              className="flex flex-wrap items-center gap-6 px-4 py-4 border-b border-gray-200 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={!!l.selected}
                                onChange={(e) =>
                                  setDeviceLogs((prev) =>
                                    prev.map((x) => (x.id === l.id ? { ...x, selected: e.target.checked } : x)),
                                  )
                                }
                              />
                              <div>
                                User Name - <span className="text-red-700">{l.username}</span>
                              </div>
                              <div>
                                Log Date - <span className="text-red-700">{l.logDate}</span>
                              </div>
                              <div className="ml-auto">
                                Log Time - <span className="text-red-700">{l.logTime}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'posts' ? (
          <div className="p-0">
            <div className="px-4 py-8">
              <div className="max-w-2xl mx-auto border border-gray-300 bg-white">
                <div className="bg-red-600 text-white font-semibold px-4 py-3 text-center">Delete these posts.</div>
                <div className="px-6 py-6">
                  <div className="flex justify-center gap-24 mb-6">
                    <label className="flex flex-col items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={deletePostsQuestion}
                        onChange={(e) => setDeletePostsQuestion(e.target.checked)}
                      />
                      <span className="px-8 py-1 border border-gray-300 bg-white">Question</span>
                    </label>
                    <label className="flex flex-col items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={deletePostsSuggestion}
                        onChange={(e) => setDeletePostsSuggestion(e.target.checked)}
                      />
                      <span className="px-8 py-1 border border-gray-300 bg-white">Suggestion</span>
                    </label>
                    <label className="flex flex-col items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={deletePostsProblem}
                        onChange={(e) => setDeletePostsProblem(e.target.checked)}
                      />
                      <span className="px-8 py-1 border border-gray-300 bg-white">Problem</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-center gap-3 text-sm mb-6">
                    <span className="font-semibold">From</span>
                    <div className="flex items-center gap-2">
                      <AdminPcuDatePicker
                        value={deletePostsFrom}
                        onChange={setDeletePostsFrom}
                      />
                    </div>
                    <span className="font-semibold">To</span>
                    <div className="flex items-center gap-2">
                      <AdminPcuDatePicker
                        value={deletePostsTo}
                        onChange={setDeletePostsTo}
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={saveDeletePosts}
                      disabled={deletePostsSaving}
                      className="px-10 py-2 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                    >
                      {deletePostsSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>

                  {deletePostsSaveError ? (
                    <div className="mt-4 text-sm text-center text-red-700">{deletePostsSaveError}</div>
                  ) : null}
                  {deletePostsSaveSuccess ? (
                    <div className="mt-4 text-sm text-center text-green-700">{deletePostsSaveSuccess}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'alert' ? (
          <div className="p-0">
            <div className="px-4 py-6 space-y-6">
              <div className="border border-gray-300 bg-white">
                  <div className="bg-slate-500 text-white font-semibold px-4 py-2 flex items-center justify-between">
                    <span>Alert box to display to the user</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => alertMsgEditor.switchLang('it')}
                        className={`px-3 py-1 border border-white font-semibold ${
                          alertMsgLang === 'it' ? 'bg-white text-slate-700' : 'bg-slate-500 text-white'
                        }`}
                      >
                        IT
                      </button>
                      <button
                        type="button"
                        onClick={() => alertMsgEditor.switchLang('en')}
                        className={`px-3 py-1 border border-white font-semibold ${
                          alertMsgLang === 'en' ? 'bg-white text-slate-700' : 'bg-slate-500 text-white'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={alertMsgActivated}
                          onChange={(e) => setAlertMsgActivated(e.target.checked)}
                        />
                        Activated
                      </label>

                      <div className="flex items-center gap-2">
                        <span>Enable From</span>
                        <AdminPcuDatePicker
                          value={alertMsgEnableFrom}
                          onChange={setAlertMsgEnableFrom}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span>To</span>
                        <AdminPcuDatePicker
                          value={alertMsgEnableTo}
                          onChange={setAlertMsgEnableTo}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold">
                      <div>Show the message at the</div>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={alertMsgShowLogin}
                          onChange={(e) => setAlertMsgShowLogin(e.target.checked)}
                        />
                        Login
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={alertMsgShowLogout}
                          onChange={(e) => setAlertMsgShowLogout(e.target.checked)}
                        />
                        Logout
                      </label>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <CKEditorComponent
                      instanceId="alert-msg-editor"
                      localeKey={alertMsgEditor.localeKey}
                      registerGetData={alertMsgEditor.registerGetData}
                      value={alertMsgEditor.editorValue}
                      onChange={alertMsgEditor.onEditorChange}
                      minHeightPx={280}
                      placeholder=""
                    />
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={saveAlertMsg}
                        disabled={alertMsgSaving}
                        className="px-10 py-2 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
                      >
                        {alertMsgSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    {alertMsgSaveError ? (
                      <div className="mt-4 text-sm text-center text-red-700">{alertMsgSaveError}</div>
                    ) : null}
                    {alertMsgSaveSuccess ? (
                      <div className="mt-4 text-sm text-center text-green-700">{alertMsgSaveSuccess}</div>
                    ) : null}
                  </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500">
            {topTabs.find((t) => t.id === activeTab)?.label} — coming soon
          </div>
        )}
      </div>

      {mailModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setMailModalOpen(false)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Send mail</h2>
            <p className="mb-4 text-sm text-gray-600">
              To: {user.fullname || user.username}
              {!user.email?.trim() ? (
                <span className="block text-xs text-amber-700 mt-1">No email on file — enter an address below.</span>
              ) : (
                <span className="block text-xs text-gray-500 mt-1">
                  Mail is sent from Movesbook using the configured email service.
                </span>
              )}
            </p>
            <label className="mb-2 block text-sm font-medium text-gray-700">Mail address</label>
            <input
              type="email"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              placeholder="user@example.com"
              className="send-message-field mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
              autoComplete="email"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700">Subject (optional)</label>
            <input
              type="text"
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              className="send-message-field mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={mailBody}
              onChange={(e) => setMailBody(e.target.value)}
              rows={4}
              placeholder="Write your message…"
              className="send-message-field mb-3 w-full resize-none rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            {mailError ? <p className="mb-2 text-sm text-red-600">{mailError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMailModalOpen(false)}
                disabled={mailSending}
                className="rounded border border-gray-400 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMailSubmit()}
                disabled={mailSending}
                className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {mailSending ? 'Sending…' : 'Send mail'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {msgModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setMsgModalOpen(false)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Send message</h2>
            <p className="mb-4 text-sm text-gray-600">{user.fullname || user.username}</p>
            <label className="mb-2 block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              className="send-message-field mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={msgDraft}
              onChange={(e) => setMsgDraft(e.target.value)}
              rows={5}
              placeholder="Write your message…"
              className="send-message-field mb-3 w-full resize-none rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            {msgError ? <p className="mb-2 text-sm text-red-600">{msgError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMsgModalOpen(false)}
                className="rounded border border-gray-400 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendMsgSubmit()}
                disabled={msgSending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {msgSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminSettingsSaveBar({
  saving,
  error,
  success,
  onSave,
  onCancel,
}: {
  saving: boolean;
  error: string;
  success: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 border-t border-gray-300 pt-4">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-8 py-2 bg-red-600 text-white font-semibold rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-8 py-2 bg-gray-300 text-gray-900 font-semibold rounded disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error ? <div className="mt-3 text-sm text-center text-red-700">{error}</div> : null}
      {success ? <div className="mt-3 text-sm text-center text-green-700">{success}</div> : null}
    </div>
  );
}

function ProfileField({
  label,
  value,
  muted,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <label className="text-sm text-gray-700 text-left">{label}</label>
      <input
        readOnly
        value={value}
        className={`px-3 py-1.5 border border-gray-300 rounded text-sm w-full ${
          muted ? 'bg-gray-200' : 'bg-gray-50'
        } ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  );
}

function SelectField({ label, value, options }: { label: string; value: string; options: string[] }) {
  const list = options.filter(Boolean);
  const v = value ?? '';
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <label className="text-sm text-gray-700">{label}</label>
      <select disabled value={v} className="px-3 py-1.5 border border-gray-300 rounded bg-gray-100 text-sm">
        <option value={v}>{v || '—'}</option>
        {list.filter((o) => o !== v).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SplitField({
  label,
  leftValue,
  rightLabel,
  rightValue,
}: {
  label: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <label className="text-sm text-gray-700">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <input readOnly value={leftValue} className="px-3 py-1.5 border border-gray-300 rounded bg-gray-50 text-sm" />
        <input
          readOnly
          value={rightValue}
          aria-label={rightLabel || label}
          className="px-3 py-1.5 border border-gray-300 rounded bg-gray-50 text-sm"
        />
      </div>
    </div>
  );
}

function BirthdayField({ day, month, year }: { day: number | null; month: number | null; year: number | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <label className="text-sm text-gray-700">Birthday</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={day ?? ''}
          className="px-2 py-1.5 border border-gray-300 rounded bg-gray-50 text-sm w-14"
        />
        <select
          disabled
          value={month ?? ''}
          className="px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-sm flex-1"
        >
          {month ? <option value={month}>{MONTHS[month - 1]}</option> : <option value="">—</option>}
        </select>
        <input
          readOnly
          value={year ?? ''}
          className="px-2 py-1.5 border border-gray-300 rounded bg-gray-50 text-sm w-20"
        />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="grid grid-cols-[260px_1fr] items-center gap-2">
      <label className="text-sm">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 border border-gray-300 w-28"
      />
    </div>
  );
}

function ShareRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24">{label}</div>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        Sharing with {label}
      </label>
    </div>
  );
}

function ModeCard<T extends string>({
  title,
  options,
  value,
  onChange,
  lines,
}: {
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  lines?: { checked: boolean; text: string; red?: boolean; onChange?: (checked: boolean) => void }[];
}) {
  return (
    <div className="bg-gray-100 border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-gray-700 whitespace-nowrap">
          {options.map((o) => (
            <label key={o.id} className="inline-flex items-center gap-1 ml-2">
              <input type="radio" checked={value === o.id} onChange={() => onChange(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      {lines?.length ? (
        <div className="mt-2 space-y-1 text-sm">
          {lines.map((l, idx) => (
            <label key={idx} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={l.checked}
                disabled={!l.onChange}
                onChange={(e) => l.onChange?.(e.target.checked)}
              />
              <span className={l.red ? 'text-red-700' : ''}>{l.text}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToggleNY({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex items-center gap-2 border border-gray-400 rounded-full px-3 py-1 bg-white">
      <label className="inline-flex items-center gap-1 text-xs">
        <input type="radio" checked={!value} onChange={() => onChange(false)} />
        N
      </label>
      <label className="inline-flex items-center gap-1 text-xs">
        <input type="radio" checked={value} onChange={() => onChange(true)} />
        Y
      </label>
    </div>
  );
}
