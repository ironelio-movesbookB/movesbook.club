'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Search, ArrowDownAZ, Clock, Plus, Pencil, Eye, EyeOff, Link, User, Settings, Trash2, X, Tag, ThumbsUp, Share2, List, Music2, Disc3, Heart, Globe, Megaphone, type LucideIcon } from 'lucide-react';
import type { OGPData } from './OGPForm';
import type { NewsTopic } from './NewsTopicBar';
import { ALL_TOPICS, ALL_USER_SECTORS, ALL_SUPER_ADMIN, NEWS_TOPIC_KEYS, NEWS_TOPICS } from './NewsTopicBar';
import { ALL_LANGUAGES } from '@/constants/language.constants';
import {
  ALL_MUSICAL_GENRES,
} from '@/constants/musicGenres.constants';
import NewsSettingModal, { type OgpVisibilitySettings, defaultSettings } from './NewsSettingModal';
import OgpShareModal from './OgpShareModal';
import CreateOgpNewsGroupModal from './CreateOgpNewsGroupModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOgpGroupShareUrl } from '@/lib/ogpGroupShareUrl';
import OgpRichDescription, {
  ogpDescriptionPlainText,
} from '@/components/shared/OgpRichDescription';
import { ShareInMyClubsButtonIfClub } from '@/components/club/ShareInMyClubsButton';
import ClubGlobalNewsToggleButton from '@/components/club/ClubGlobalNewsToggleButton';
import RichTextEditor from '@/components/settings/RichTextEditor';
import FeaturedNewsCard from './FeaturedNewsCard';
import NewsHeadlinesPanel from './NewsHeadlinesPanel';
import NewsHeadlinesExpandedView from './NewsHeadlinesExpandedView';
import OgpArticleActionBar from './OgpArticleActionBar';
import OgpSponsoredCard from './OgpSponsoredCard';
import OgpSponsorsSettingsModal from './OgpSponsorsSettingsModal';
import {
  OGP_CARDS_PER_ROW,
  isSponsorDisplayActive,
  maxSponsorCols,
  paginateWithSponsors,
  type OgpSponsorSettings,
  type OgpSponsorSourceArticle,
  type SponsoredPageCell,
} from '@/lib/news/ogpSponsors';
import { TOP_STORIES_COUNT } from '@/lib/news/headlines';

type MusicLibraryNavKey = 'recent' | 'playlist' | 'songs' | 'albums' | 'favourites';

/** Mutually exclusive poster filter (radio). `'none'` = no poster filter. */
type PostedByFilter = 'none' | 'movesbook' | 'myCountry' | 'me' | 'clubGlobalNews';

const MUSIC_LIBRARY_NAV: { key: MusicLibraryNavKey; label: string; icon: LucideIcon }[] = [
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'playlist', label: 'Playlist', icon: List },
  { key: 'songs', label: 'Songs', icon: Music2 },
  { key: 'albums', label: 'Albums', icon: Disc3 },
  { key: 'favourites', label: 'Favourites', icon: Heart },
];

export type ArticlePasted = OGPData & {
  customDescription?: string;
  id: string;
  userId?: string;
  /** Username of the creator (for inline "by <username>" display on cards). */
  creatorUsername?: string | null;
  /** Creator's country from users_new.country (for "Show posted by my country" filter). */
  creatorCountry?: string | null;
  savedAt?: string;
  topic?: NewsTopic;
  languageCode?: string | null;
  /** Set when soft-deleted by creator; admin/super_admin see these. */
  deletedAt?: string;
  deletedByUserId?: string;
  deletedByName?: string;
  /** Visibility settings for News Setting modal (creator / admin / super admin only). */
  visibility?: OgpVisibilitySettings;
  /** When true, article was created by the current super admin (enables Pencil/settings as creator). */
  createdByCurrentUser?: boolean;
  /** When true, article was posted by a Super Admin account (used for filtering; action icon is always trash). */
  createdBySuperAdmin?: boolean;
  /** Musical genre (Music OGP only). */
  genre?: string | null;
  /** Artist name entered in Add Music (Music OGP only). */
  artist?: string | null;
  /** Song / Album / Playlist selected in Add Music (Music OGP only). */
  registrationType?: string | null;
  /** True when the creator saved this entry with "Put in my favourites" checked. */
  isFavourite?: boolean;
  /** When true, this card represents an OGP News group (preview = first member). */
  isOgpGroup?: boolean;
  /** Super admin: included in the Global News merged feed. */
  inGlobalNews?: boolean;
  /** Super admin: promoted to the featured News Card (hero). */
  isFeatured?: boolean;
  /** Super admin: show in featured News Card when isFeatured (default true). */
  displayInEvidence?: boolean;
  /** Times this OGP News was opened (News Headlines / Top Stories ranking). */
  viewCount?: number;
  /** Club admin: promoted into this club's Club Global News feed. */
  inClubGlobalNews?: boolean;
  /** Club OGP News audience mode from club_shared_ogp_articles.audienceMode. */
  clubAudienceMode?: OgpVisibilitySettings['clubAudienceMode'];
  /** Club admin: club ids this OGP article has been shared to. */
  sharedClubIds?: string[];
  /** Club id this feed row was shared into (Club OGP / Global / other club). */
  sharedClubId?: string | null;
  /** Username (or name) of the club this OGP was shared into. */
  sharedClubUsername?: string | null;
  /** True when this row comes from another club (not the club being viewed). */
  isFromOtherClub?: boolean;
  groupName?: string;
  memberCount?: number;
  memberIds?: string[];
  /** Display name of the user who created the group (e.g. "roberto zang"). */
  creatorName?: string | null;
};

/** API/list shape for a saved OGP News group. */
export type OgpNewsGroupCard = {
  id: string;
  name: string;
  topic: string;
  savedAt: string;
  memberCount: number;
  memberIds: string[];
  userId?: string;
  creatorUsername?: string | null;
  /** Full display name of the group creator. */
  creatorName?: string | null;
  creatorCountry?: string | null;
  createdByCurrentUser?: boolean;
  title?: string | null;
  image?: string | null;
  /** Custom group cover when set; otherwise `image` falls back to 1st member. */
  coverImage?: string | null;
  description?: string | null;
  url: string;
  siteName?: string | null;
  type?: string | null;
  customDescription?: string | null;
  deletedAt?: string | null;
  visibility?: OgpVisibilitySettings;
  /** Club OGP News audience mode. */
  clubAudienceMode?: OgpVisibilitySettings['clubAudienceMode'];
  /** Club admin: club ids this group has been shared to. */
  sharedClubIds?: string[];
  /** Club admin: promoted into this club's Club Global News feed. */
  inClubGlobalNews?: boolean;
  sharedClubId?: string | null;
  sharedClubUsername?: string | null;
  isFromOtherClub?: boolean;
  previewTopic?: string;
  previewCreatorUsername?: string | null;
};

export type ArticleTyped = {
  id: string;
  description: string;
  artist?: string | null;
  title?: string | null;
  registrationType?: string | null;
  isFavourite?: boolean;
};

const FALLBACK_NEWS_TOPICS_LIST = [
  'News',
  'Sport',
  'Events',
  'Nutrition',
  'Training',
  'Medicine',
  'Equipments',
  'Lounge music',
] as const;

/** Stable empty defaults — inline `= []` in props recreates a new array every render and can loop effects. */
const EMPTY_TOPICS: string[] = [];
const EMPTY_TOPIC_NAMES: string[] = [];
const EMPTY_GROUPS: OgpNewsGroupCard[] = [];

function hasAnyVisibilitySettings(a: ArticlePasted): boolean {
  const v = a.visibility;
  if (!v) return false;
  const hasSelections =
    (v.userTypes?.length ?? 0) > 0 ||
    (v.countries?.length ?? 0) > 0 ||
    (v.languages?.length ?? 0) > 0 ||
    (v.sports?.length ?? 0) > 0;
  const hasDuration = v.expiresAt != null && String(v.expiresAt).trim() !== '';
  return hasSelections || hasDuration;
}

function getExpiresAtMs(a: ArticlePasted): number | null {
  const exp = a.visibility?.expiresAt;
  if (exp == null || String(exp).trim() === '') return null;
  try {
    const t = new Date(exp).getTime();
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

/** No Duration (= null/empty) means unlimited — not expired. */
function isNotExpired(a: ArticlePasted): boolean {
  const expMs = getExpiresAtMs(a);
  if (expMs == null) return true;
  return expMs >= Date.now();
}

function hasExpirationDateSet(a: ArticlePasted): boolean {
  return getExpiresAtMs(a) != null;
}

/** True only when an expiration date is set and that date is in the past. */
function isPastExpired(a: ArticlePasted): boolean {
  return hasExpirationDateSet(a) && !isNotExpired(a);
}

/** Active for normal viewers: has News Settings, not deleted, and not past expiry (unlimited OK). */
function isActiveForNormalUser(a: ArticlePasted): boolean {
  return isNotExpired(a) && !a.deletedAt && hasAnyVisibilitySettings(a);
}

function groupToFeedItem(g: OgpNewsGroupCard): ArticlePasted {
  return {
    id: g.id,
    isOgpGroup: true,
    groupName: g.name,
    memberCount: g.memberCount,
    memberIds: g.memberIds,
    userId: g.userId,
    creatorUsername: g.creatorUsername ?? null,
    creatorName: g.creatorName ?? g.creatorUsername ?? null,
    creatorCountry: g.creatorCountry ?? null,
    createdByCurrentUser: g.createdByCurrentUser === true,
    title: g.title ?? g.name,
    image: g.image ?? null,
    description: g.description ?? null,
    url: g.url || '#',
    siteName: g.siteName ?? null,
    type: g.type ?? null,
    customDescription: g.customDescription ?? undefined,
    topic: g.topic,
    savedAt: g.savedAt,
    deletedAt: g.deletedAt ?? undefined,
    visibility: g.visibility,
    clubAudienceMode: g.clubAudienceMode ?? null,
    sharedClubIds: g.sharedClubIds,
    inClubGlobalNews: g.inClubGlobalNews === true,
    sharedClubId: g.sharedClubId ?? null,
    sharedClubUsername: g.sharedClubUsername ?? null,
    isFromOtherClub: g.isFromOtherClub === true,
  };
}

/** Number of OGP cards per row (each row = 6 OGPs). */
const OGPS_PER_ROW = OGP_CARDS_PER_ROW;
/** Dropdown options: number of rows to display per page. Items per page = rows × OGPS_PER_ROW. */
const ROWS_PER_PAGE_OPTIONS = [3, 5, 10, 15, 20];
const MAX_PAGE_BUTTONS = 9;

export type SortOrder = 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc';

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

/** Share/copy URL: group → public Movesbook group page; single → external OGP URL. */
function getArticleShareUrl(a: ArticlePasted, kind: 'news' | 'music' = 'news'): string {
  if (a.isOgpGroup) return getOgpGroupShareUrl(a.id, undefined, kind);
  return a.url || '';
}

/** Wraps case-insensitive matches of `query` in `text` with <mark>. */
function highlightText(text: string, query: string): React.ReactNode {
  if (!text) return '';
  if (!query || !query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

interface NewsArticlesListProps {
  pasted: ArticlePasted[];
  typed?: ArticleTyped[];
  activeTopic: NewsTopic | null;
  onRemovePasted?: (id: string) => void;
  onRemoveTyped?: (id: string) => void;
  /** When true, current user is admin or super admin (can delete any OGP). Creator can always delete their own. */
  canDeleteOgp?: boolean;
  /** Current user id – used to allow creator to delete their own OGP. */
  currentUserId?: string | null;
  /** Current user's country (users_new.country) – used by "Show posted by my country". */
  currentUserCountry?: string | null;
  /** Called when the "+" button is clicked to show the OGP input form. Rendered below pagination when provided. */
  onAddClick?: () => void;
  /** When true, the "+" button is disabled (e.g. when "All" is selected) */
  addButtonDisabled?: boolean;
  /** Called when saving visibility settings from the gear modal (creator / admin / super admin only). */
  onUpdatePastedSettings?: (id: string, settings: OgpVisibilitySettings) => void | Promise<void>;
  /** Topic names for the change-topic modal (Events, Nutrition, Sport, etc.). */
  topics?: string[];
  /** Called when creator changes an OGP's topic and/or description (Pencil button). */
  onUpdatePastedTopic?: (id: string, topic: string, customDescription?: string) => void | Promise<void>;
  /** Music: pencil opens Add Music for full edit instead of Change topic. */
  onEditPasted?: (article: ArticlePasted) => void;
  /** When true, use adminToken for API calls (e.g. creator fetch) so super admin can use User button. */
  adminContext?: boolean;
  /** When true (super admin), show all OGPs for the selected topic including expired, no News Setting, and deleted. */
  isSuperAdmin?: boolean;
  /** When activeTopic is ALL_USER_SECTORS, filter to articles whose topic is in this list (super admin). */
  topicNamesCreatedByNormalUsers?: string[];
  /** Super admin: user-inserted topics with creator username (shown next to topic title in headers). */
  userInsertedTopics?: { name: string; creatorUsername: string | null }[];
  /** When set (e.g. super admin), overrides the "All" topic display name (e.g. "All defaults") */
  allTopicLabel?: string;
  /** Super admin: clicking the pink creator username in the topic heading opens “see as user” mode. */
  onSuperAdminViewAsUser?: (username: string) => void;
  /** When true, topic heading omits “( username )” (e.g. “see as user” mode already shows name in page title). */
  hideCreatorUsernameInHeading?: boolean;
  /** When true, OGP card actions (edit, share, link, …) and the add (+) button are disabled. */
  superAdminReadOnlyOgpActions?: boolean;
  /** When set, checkbox reads “Show only posted by {name}” instead of “posted by me”. */
  showOnlyMyOgNewsLabelUsername?: string | null;
  /** When true, `pasted` is already limited to what a viewer may see (e.g. super admin view-as-user API); do not apply extra client visibility filtering. */
  viewerScopedOgpList?: boolean;
  /** API prefix for OGP endpoints. Defaults to `/api/news`; Music section uses `/api/music`. */
  apiBase?: string;
  /** Music: genres available for the active topic (excluding "All"). */
  musicalGenresForFilter?: string[];
  /** Music: selected musical genre; null/undefined means "All". */
  activeMusicalGenre?: string | null;
  /** Music: called when the musical genre dropdown changes. Pass null for "All". */
  onMusicalGenreSelect?: (genre: string | null) => void;
  /** Saved OGP News/Music groups. */
  ogpNewsGroups?: OgpNewsGroupCard[];
  /** Persist a new/merged OGP News/Music group. */
  onSaveOgpNewsGroup?: (payload: {
    name: string;
    topic: string;
    articleIds: string[];
    confirmExisting?: boolean;
    coverImage?: string | null;
  }) => Promise<{ merged: boolean; group: OgpNewsGroupCard }>;
  /** Create a new topic from the create-group modal. */
  onCreateTopic?: (name: string) => void | Promise<void>;
  /** Delete an OGP News group. */
  onRemoveOgpNewsGroup?: (id: string) => void | Promise<void>;
  /** Update group topic and/or description (pencil). */
  onUpdateOgpNewsGroup?: (
    id: string,
    topic: string,
    customDescription?: string
  ) => void | Promise<void>;
  /** Update group visibility settings (gear). */
  onUpdateOgpNewsGroupSettings?: (id: string, settings: OgpVisibilitySettings) => void | Promise<void>;
  /** Super admin: show "Share in Global News" on OGP News cards (news section only). */
  showGlobalNewsButton?: boolean;
  /** Super admin: toggle Global News flag for an OGP article. */
  onToggleGlobalNews?: (id: string, inGlobalNews: boolean) => void | Promise<void>;
  /** Super admin: show featured News Card controls on OGP News cards. */
  showFeaturedControls?: boolean;
  /** Super admin: toggle featured / display-in-evidence flags. */
  onToggleOgpFeatured?: (
    id: string,
    patch: { isFeatured?: boolean; displayInEvidence?: boolean },
  ) => void | Promise<void>;
  /** Club admin: show "Share in Club Global News" globe on OGP cards. */
  showClubGlobalNewsButton?: boolean;
  /** Club id used when toggling Club Global News. */
  clubGlobalNewsClubId?: string | null;
  /** Called after Club Global News toggle succeeds. */
  onToggleClubGlobalNews?: (id: string, inClubGlobalNews: boolean) => void;
  /** Club admin: show "Share in My Clubs" on OGP News cards. */
  showShareInMyClubsButton?: boolean;
  /** Current user type (for club share button). */
  currentUserType?: string | null;
  /** Club admin username for password confirm copy. */
  clubAdminUsername?: string | null;
  /** Called after share/unshare to update local sharedClubIds on an article. */
  onArticleSharedClubIdsChange?: (articleId: string, clubIds: string[]) => void;
  /** Called after Club OGP audience mode is saved. */
  onArticleClubAudienceModeChange?: (
    articleId: string,
    mode: NonNullable<OgpVisibilitySettings['clubAudienceMode']>,
  ) => void;
  /** Club shared OGP News: force single articles only; hide Groups UI. */
  hideOgpGroups?: boolean;
  /** Start with Single News checked so the default feed is singles only. */
  preferSingleNewsDefault?: boolean;
  /** Normal user / club member: checkbox reads "Show deleted by me" (own deleted only). */
  showDeletedByMeLabel?: boolean;
  /**
   * Club OGP News: checkbox to show/hide Club Global News shares and OGPs
   * shared into the admin's other clubs (not the current one).
   */
  enableClubGlobalAndOtherClubsToggle?: boolean;
}

export default function NewsArticlesList({
  pasted,
  activeTopic,
  onRemovePasted,
  canDeleteOgp = false,
  currentUserId = null,
  currentUserCountry = null,
  onAddClick,
  addButtonDisabled = false,
  onUpdatePastedSettings,
  topics: topicsProp = EMPTY_TOPICS,
  onUpdatePastedTopic,
  onEditPasted,
  adminContext = false,
  isSuperAdmin = false,
  topicNamesCreatedByNormalUsers = EMPTY_TOPIC_NAMES,
  userInsertedTopics,
  allTopicLabel,
  onSuperAdminViewAsUser,
  hideCreatorUsernameInHeading = false,
  superAdminReadOnlyOgpActions = false,
  showOnlyMyOgNewsLabelUsername = null,
  viewerScopedOgpList = false,
  apiBase = '/api/news',
  musicalGenresForFilter = EMPTY_TOPIC_NAMES,
  activeMusicalGenre = null,
  onMusicalGenreSelect,
  ogpNewsGroups = EMPTY_GROUPS,
  onSaveOgpNewsGroup,
  onCreateTopic,
  onRemoveOgpNewsGroup,
  onUpdateOgpNewsGroup,
  onUpdateOgpNewsGroupSettings,
  showGlobalNewsButton = false,
  onToggleGlobalNews,
  showFeaturedControls = false,
  onToggleOgpFeatured,
  showClubGlobalNewsButton = false,
  clubGlobalNewsClubId = null,
  onToggleClubGlobalNews,
  showShareInMyClubsButton = false,
  currentUserType = null,
  clubAdminUsername = null,
  onArticleSharedClubIdsChange,
  onArticleClubAudienceModeChange,
  hideOgpGroups = false,
  preferSingleNewsDefault = false,
  showDeletedByMeLabel = false,
  enableClubGlobalAndOtherClubsToggle = false,
}: NewsArticlesListProps) {
  const { t } = useLanguage();
  const isMusic = apiBase === '/api/music';
  const isExercise = apiBase === '/api/exercises';
  const ogpLabel = isMusic ? 'OGP Music' : isExercise ? 'OGP Exercises' : 'OGP News';
  const singleLabel = isMusic ? 'Single Music' : isExercise ? 'Single Exercise' : 'Single News';
  const groupsLabel = isMusic ? 'Music Folders' : isExercise ? 'Groups of Exercises' : 'Groups of News';
  const topicsList = useMemo(
    () => (topicsProp.length > 0 ? topicsProp : [...FALLBACK_NEWS_TOPICS_LIST]),
    [topicsProp]
  );
  const canEditAsCreator = useCallback(
    (a: ArticlePasted) => a.userId === currentUserId || a.createdByCurrentUser === true,
    [currentUserId]
  );

  const translateTopic = useCallback((topic: string) => {
    const key = NEWS_TOPIC_KEYS[topic];
    return key ? t(key) : topic;
  }, [t]);

  const renderActiveTopicHeading = useCallback(
    (variant: 'light' | 'dark') => {
      const topicCls = variant === 'light' ? 'text-blue-700' : 'text-blue-300';
      const userCls = variant === 'light' ? 'text-pink-600' : 'text-pink-300';

      if (activeTopic === ALL_TOPICS) {
        return <span className={topicCls}>{allTopicLabel ?? t('news_all_ogp')}</span>;
      }
      if (activeTopic === ALL_USER_SECTORS) {
        return <span className={topicCls}>All users&apos; topics</span>;
      }
      if (activeTopic === ALL_SUPER_ADMIN) {
        return <span className={topicCls}>All</span>;
      }
      if (!activeTopic) return null;
      const translated = translateTopic(activeTopic);
      const row =
        userInsertedTopics?.find((x) => x.name === activeTopic) ??
        userInsertedTopics?.find(
          (x) => activeTopic != null && x.name.toLowerCase() === activeTopic.toLowerCase()
        );
      let un = row?.creatorUsername ?? null;
      if ((un == null || un === '') && activeTopic != null && topicNamesCreatedByNormalUsers.includes(activeTopic)) {
        const fromArticle = pasted.find((a) => (a.topic ?? 'News') === activeTopic);
        un = fromArticle?.creatorUsername ?? null;
      }
      if (un != null && un !== '' && !hideCreatorUsernameInHeading) {
        return (
          <>
            <span className={topicCls}>{translated}</span>
            {onSuperAdminViewAsUser ? (
              <a
                href="#view-as-user"
                className={`${userCls} underline cursor-pointer hover:opacity-80 mx-0.5 text-xl font-normal inline align-baseline relative z-[60] select-none`}
                title={`View all OGPs visible to ${un}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSuperAdminViewAsUser(un);
                }}
              >
                ( {un} )
              </a>
            ) : (
              <span className={userCls}> ( {un} )</span>
            )}
          </>
        );
      }
      return <span className={topicCls}>{translated}</span>;
    },
    [
      activeTopic,
      allTopicLabel,
      t,
      translateTopic,
      userInsertedTopics,
      topicNamesCreatedByNormalUsers,
      pasted,
      hideCreatorUsernameInHeading,
      onSuperAdminViewAsUser,
    ]
  );

  const sortedTopics = useMemo(() => [...topicsList].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [topicsList]);
  const sortedLanguages = useMemo(() => [...ALL_LANGUAGES].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), []);
  const [search, setSearch] = useState('');
  const [highlightMatches, setHighlightMatches] = useState(false);
  const [postedByFilter, setPostedByFilter] = useState<PostedByFilter>('none');
  const [excludeExpiredAndDeleted, setExcludeExpiredAndDeleted] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [showDeletedTemporarily, setShowDeletedTemporarily] = useState(false);
  const [showClubGlobalAndOtherClubs, setShowClubGlobalAndOtherClubs] = useState(false);
  const [showOnlyLiked, setShowOnlyLiked] = useState(false);
  const [showSingleNews, setShowSingleNews] = useState(
    () => hideOgpGroups || preferSingleNewsDefault,
  );
  const [showGroupsOfNews, setShowGroupsOfNews] = useState(false);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const [selectedForGroupIds, setSelectedForGroupIds] = useState<string[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);
  const [groupNameConflict, setGroupNameConflict] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  /** When set, list shows only OGP News belonging to this group ("GROUP of …" session). */
  const [viewingOgpGroup, setViewingOgpGroup] = useState<OgpNewsGroupCard | null>(null);
  const [musicLibraryNav, setMusicLibraryNav] = useState<MusicLibraryNavKey | null>(null);
  const musicalGenreOptions = useMemo(
    () => [ALL_MUSICAL_GENRES, ...musicalGenresForFilter],
    [musicalGenresForFilter]
  );
  const selectedMusicalGenre = activeMusicalGenre ?? ALL_MUSICAL_GENRES;
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  // Items per page follow the selector (rows × OGPS_PER_ROW).
  // The visual height of the list is still limited to 3 rows using `ogpListMaxHeight`,
  // so when rowsPerPage > 3 the extra rows are reachable via scrolling.
  const itemsPerPage = rowsPerPage * OGPS_PER_ROW;
  const [sortOrder, setSortOrder] = useState<SortOrder>('alpha-asc');
  const [settingsArticleId, setSettingsArticleId] = useState<string | null>(null);
  const [settingsOptions, setSettingsOptions] = useState<{
    userTypes: { value: string; label: string }[];
    countries: string[];
    languages: { value: string; label: string }[];
    sports: { value: string; label: string }[];
  } | null>(null);
  const [creatorModalArticleId, setCreatorModalArticleId] = useState<string | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<{
    name: string | null;
    email: string | null;
    username: string | null;
    gender: string | null;
    country: string | null;
    telegramAccount: string | null;
    image: string | null;
  } | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);
  const [editTopicArticleId, setEditTopicArticleId] = useState<string | null>(null);
  const [editTopicValue, setEditTopicValue] = useState<string>('News');
  const [editTopicDescription, setEditTopicDescription] = useState<string>('');
  const [expandedArticleIds, setExpandedArticleIds] = useState<Set<string>>(new Set());
  const [removeConfirmArticleId, setRemoveConfirmArticleId] = useState<string | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  /** Creator username for the article currently shown in the preview modal ("by <username>"). */
  const [previewCreatorUsername, setPreviewCreatorUsername] = useState<string | null>(null);
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; likedByMe: boolean }>>({});
  const [likeLoadingId, setLikeLoadingId] = useState<string | null>(null);
  const [globalNewsLoadingId, setGlobalNewsLoadingId] = useState<string | null>(null);
  const [featuredLoadingId, setFeaturedLoadingId] = useState<string | null>(null);
  const [showFeaturedInEvidence, setShowFeaturedInEvidence] = useState(true);
  const [showNewsHeadlines, setShowNewsHeadlines] = useState(true);
  const [viewingHeadlines, setViewingHeadlines] = useState(false);
  const [headlinesDisplayPicture, setHeadlinesDisplayPicture] = useState(true);
  const [viewCountOverrides, setViewCountOverrides] = useState<Record<string, number>>({});
  const [shareModalArticle, setShareModalArticle] = useState<ArticlePasted | null>(null);
  const ogpGridRef = useRef<HTMLDivElement>(null);
  const [ogpListMaxHeight, setOgpListMaxHeight] = useState<number | null>(null);
  const [sponsorSettings, setSponsorSettings] = useState<OgpSponsorSettings | null>(null);
  const [showSponsorsModal, setShowSponsorsModal] = useState(false);

  const sponsorOgpArticles = useMemo((): OgpSponsorSourceArticle[] => {
    const seen = new Set<string>();
    const list: OgpSponsorSourceArticle[] = [];
    for (const a of pasted) {
      if (a.isOgpGroup || a.deletedAt || !a.image || seen.has(a.id)) continue;
      seen.add(a.id);
      list.push({
        id: a.id,
        title: a.title || a.url || 'OGP News',
        image: a.image,
        url: a.url || '',
      });
    }
    return list.sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }));
  }, [pasted]);

  const isNewsOgp = apiBase === '/api/news';

  useEffect(() => {
    if (typeof window === 'undefined' || !isNewsOgp) return;
    try {
      const stored = localStorage.getItem('ogpShowFeaturedInEvidence');
      if (stored === 'false') setShowFeaturedInEvidence(false);
      const headlinesStored = localStorage.getItem('ogpShowNewsHeadlines');
      if (headlinesStored === 'false') {
        setShowNewsHeadlines(false);
        setViewingHeadlines(false);
      }
    } catch {
      /* ignore */
    }
  }, [isNewsOgp]);

  useEffect(() => {
    if (!isNewsOgp) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news/ogp-sponsors');
        if (!res.ok) return;
        const data = (await res.json()) as OgpSponsorSettings;
        if (!cancelled && data && Array.isArray(data.sponsors)) {
          setSponsorSettings(data);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNewsOgp]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('ogpHeadlinesDisplayPicture');
      if (stored === 'false') setHeadlinesDisplayPicture(false);
    } catch {
      /* ignore */
    }
  }, []);

  const handleHeadlinesDisplayPictureChange = useCallback((next: boolean) => {
    setHeadlinesDisplayPicture(next);
    try {
      localStorage.setItem('ogpHeadlinesDisplayPicture', next ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, []);

  const handleShowFeaturedInEvidenceChange = useCallback((checked: boolean) => {
    setShowFeaturedInEvidence(checked);
    try {
      localStorage.setItem('ogpShowFeaturedInEvidence', checked ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, []);

  const handleShowNewsHeadlinesChange = useCallback((checked: boolean) => {
    setShowNewsHeadlines(checked);
    if (!checked) setViewingHeadlines(false);
    try {
      localStorage.setItem('ogpShowNewsHeadlines', checked ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleArticleExpanded = useCallback((articleId: string) => {
    setExpandedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (editTopicArticleId != null) {
      const article = pasted.find((a) => a.id === editTopicArticleId);
      const group = ogpNewsGroups.find((g) => g.id === editTopicArticleId);
      if (article) {
        setEditTopicValue(article.topic ?? 'News');
        setEditTopicDescription(article.customDescription ?? '');
      } else if (group) {
        setEditTopicValue(group.topic ?? 'News');
        setEditTopicDescription(group.customDescription ?? '');
      }
    }
  }, [editTopicArticleId, pasted, ogpNewsGroups]);

  useEffect(() => {
    if (copiedArticleId == null) return;
    const t = setTimeout(() => setCopiedArticleId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedArticleId]);

  const fetchCreator = useCallback(async (entityId: string, isGroup: boolean) => {
    setCreatorLoading(true);
    setCreatorError(null);
    setCreatorInfo(null);
    try {
      const token = typeof window !== 'undefined'
        ? (adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token'))
        : null;
      const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const path = isGroup
        ? `${apiBase}/ogp-groups/${entityId}/creator`
        : `${apiBase}/ogp/${entityId}/creator`;
      const res = await fetch(path, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load creator');
      setCreatorInfo({
        name: data.name ?? null,
        email: data.email ?? null,
        username: data.username ?? null,
        gender: data.gender ?? null,
        country: data.country ?? null,
        telegramAccount: data.telegramAccount ?? null,
        image: data.image ?? null,
      });
    } catch (e) {
      setCreatorError(e instanceof Error ? e.message : 'Failed to load creator');
    } finally {
      setCreatorLoading(false);
    }
  }, [adminContext, apiBase]);

  const handleGlobalNewsToggle = useCallback(
    async (articleId: string, currentlyShared: boolean) => {
      if (!onToggleGlobalNews) return;
      setGlobalNewsLoadingId(articleId);
      try {
        await onToggleGlobalNews(articleId, !currentlyShared);
      } finally {
        setGlobalNewsLoadingId(null);
      }
    },
    [onToggleGlobalNews],
  );

  const handleFeaturedToggle = useCallback(
    async (articleId: string, patch: { isFeatured?: boolean; displayInEvidence?: boolean }) => {
      if (!onToggleOgpFeatured) return;
      setFeaturedLoadingId(articleId);
      try {
        await onToggleOgpFeatured(articleId, patch);
      } finally {
        setFeaturedLoadingId(null);
      }
    },
    [onToggleOgpFeatured],
  );

  useEffect(() => {
    if (creatorModalArticleId != null) {
      const isGroup = ogpNewsGroups.some((g) => g.id === creatorModalArticleId);
      fetchCreator(creatorModalArticleId, isGroup);
    }
  }, [creatorModalArticleId, fetchCreator, ogpNewsGroups]);

  // When preview modal opens, fetch creator username for "by <username>" display.
  useEffect(() => {
    if (previewArticleId == null) {
      setPreviewCreatorUsername(null);
      return;
    }
    const isGroup = ogpNewsGroups.some((g) => g.id === previewArticleId);
    const token = typeof window !== 'undefined'
      ? (adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token'))
      : null;
    const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const path = isGroup
      ? `${apiBase}/ogp-groups/${previewArticleId}/creator`
      : `${apiBase}/ogp/${previewArticleId}/creator`;
    fetch(path, { headers })
      .then((res) => {
        if (!res.ok) {
          setPreviewCreatorUsername(null);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.username != null && data.username !== '') {
          setPreviewCreatorUsername(data.username);
        } else {
          setPreviewCreatorUsername(null);
        }
      })
      .catch(() => setPreviewCreatorUsername(null));
  }, [previewArticleId, adminContext, apiBase, ogpNewsGroups]);

  useEffect(() => {
    if (
      settingsArticleId != null &&
      (!settingsOptions || !Array.isArray(settingsOptions.sports))
    ) {
      const empty = { userTypes: [], countries: [], languages: [], sports: [] };
      const token =
        typeof window !== 'undefined'
          ? adminContext
            ? localStorage.getItem('adminToken')
            : localStorage.getItem('token')
          : null;
      const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      fetch('/api/news/ogp-settings-options', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) {
            setSettingsOptions(empty);
            return;
          }
          setSettingsOptions({
            userTypes: data.userTypes ?? [],
            countries: data.countries ?? [],
            languages: data.languages ?? [],
            sports: data.sports ?? [],
          });
        })
        .catch(() => setSettingsOptions(empty));
    }
  }, [settingsArticleId, settingsOptions, adminContext]);

  useEffect(() => {
    setCurrentPage(1);
    setPostedByFilter('none');
    setViewingOgpGroup(null);
  }, [activeTopic, activeMusicalGenre]);

  /** Keep group session in sync when groups are refreshed from the API. */
  useEffect(() => {
    if (!viewingOgpGroup) return;
    const updated = ogpNewsGroups.find((g) => g.id === viewingOgpGroup.id);
    if (updated) setViewingOgpGroup(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the groups list changes
  }, [ogpNewsGroups]);

  const exitOgpGroupView = useCallback(() => {
    setViewingOgpGroup(null);
    setCurrentPage(1);
  }, []);

  const openOgpGroupView = useCallback(
    (groupFeed: ArticlePasted) => {
      if (!groupFeed.isOgpGroup) return;
      const fromApi = ogpNewsGroups.find((g) => g.id === groupFeed.id);
      const group: OgpNewsGroupCard = fromApi ?? {
        id: groupFeed.id,
        name: groupFeed.groupName || groupFeed.title || 'Group',
        topic: groupFeed.topic ?? 'News',
        savedAt: groupFeed.savedAt ?? new Date().toISOString(),
        memberCount: groupFeed.memberCount ?? groupFeed.memberIds?.length ?? 0,
        memberIds: groupFeed.memberIds ?? [],
        userId: groupFeed.userId,
        creatorUsername: groupFeed.creatorUsername,
        creatorName: groupFeed.creatorName,
        creatorCountry: groupFeed.creatorCountry,
        createdByCurrentUser: groupFeed.createdByCurrentUser,
        title: groupFeed.title,
        image: groupFeed.image,
        description: groupFeed.description,
        url: groupFeed.url,
        customDescription: groupFeed.customDescription,
        deletedAt: groupFeed.deletedAt,
        visibility: groupFeed.visibility,
      };
      setViewingOgpGroup(group);
      setIsAddingToGroup(false);
      setViewSelectedOnly(false);
      setSelectedForGroupIds([]);
      setCurrentPage(1);
    },
    [ogpNewsGroups]
  );

  useEffect(() => {
    if (!isAddingToGroup && !viewingOgpGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewingOgpGroup && !showCreateGroupModal) {
        exitOgpGroupView();
        return;
      }
      if (isAddingToGroup && !showCreateGroupModal) {
        setIsAddingToGroup(false);
        setViewSelectedOnly(false);
        setSelectedForGroupIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAddingToGroup, showCreateGroupModal, viewingOgpGroup, exitOgpGroupView]);

  const byTopic = useMemo(() => {
    let base: ArticlePasted[];
    if (activeTopic === ALL_SUPER_ADMIN) {
      // Super admin "All" – show only OGPs created by super admin across all topics.
      base = pasted.filter((a) => a.createdBySuperAdmin);
    } else if (!activeTopic || activeTopic === ALL_TOPICS) {
      base = pasted;
    } else if (activeTopic === ALL_USER_SECTORS && topicNamesCreatedByNormalUsers.length > 0) {
      base = pasted.filter((a) => topicNamesCreatedByNormalUsers.includes(a.topic ?? ''));
    } else {
      base = pasted.filter((a) => (a.topic ?? 'News') === activeTopic);
    }

    const isAllOrDefaultTopic =
      !activeTopic ||
      activeTopic === ALL_TOPICS ||
      (NEWS_TOPICS as readonly string[]).includes(activeTopic);

    if (viewerScopedOgpList) {
      return base;
    }

    // In "All" and 7 default topics:
    // - For the current creator (canEditAsCreator): always show all their own OGPs (including expired / no settings / deleted).
    // - For other users' OGPs: hide those with no News Setting and hide expired ones.
    // - Exception: when isSuperAdmin, show all OGPs (expired, no settings, deleted) for the selected topic.
    if (isAllOrDefaultTopic && !isSuperAdmin) {
      return base.filter((a) => {
        if (canEditAsCreator(a)) return true;
        return hasAnyVisibilitySettings(a) && isNotExpired(a);
      });
    }

    // For other topics (e.g. custom): normal users only see OGPs with settings or their own; admin/creator see all.
    if (!adminContext && !canDeleteOgp) {
      return base.filter((a) => canEditAsCreator(a) || hasAnyVisibilitySettings(a));
    }

    return base;
  }, [
    pasted,
    activeTopic,
    topicNamesCreatedByNormalUsers,
    adminContext,
    canDeleteOgp,
    isSuperAdmin,
    viewerScopedOgpList,
    canEditAsCreator,
  ]);

  /**
   * True when the current UI should allow filtering to "my" OGPs.
   * Previously this was limited to "All" and the default topics; now we allow it
   * for any topic whenever we know the current user id.
   */
  const canFilterByMyOgNews = !!currentUserId;
  const deletedFilterLabel = isSuperAdmin
    ? 'Show deleted'
    : showDeletedByMeLabel
      ? 'Show deleted by me'
      : 'Show also deleted';

  /** Super-admin default: "my country". Viewing a user's topic / view-as-user: "user country". */
  const postedByCountryLabel = useMemo(() => {
    const viewingAsUser = !!showOnlyMyOgNewsLabelUsername?.trim();
    const viewingUserInsertedTopic =
      activeTopic === ALL_USER_SECTORS ||
      (!!activeTopic &&
        (topicNamesCreatedByNormalUsers.includes(activeTopic) ||
          !!userInsertedTopics?.some((t) => t.name === activeTopic)));
    return viewingAsUser || viewingUserInsertedTopic
      ? 'posted by user country'
      : 'posted by my country';
  }, [
    showOnlyMyOgNewsLabelUsername,
    activeTopic,
    topicNamesCreatedByNormalUsers,
    userInsertedTopics,
  ]);

  const filtered = useMemo(() => {
    const applyArticleFilters = (source: ArticlePasted[]) => {
      let list = source;
      // When "Club Global & other clubs" is off, hide other clubs' OGPs only.
      // Do NOT hide this club's own items that were also promoted to Club Global News
      // (inClubGlobalNews) — they must stay in their topic/list position.
      if (
        enableClubGlobalAndOtherClubsToggle &&
        !showClubGlobalAndOtherClubs &&
        postedByFilter !== 'clubGlobalNews'
      ) {
        list = list.filter((a) => a.isFromOtherClub !== true);
      }
      if (postedByFilter === 'me' && canFilterByMyOgNews) {
        list = list.filter(canEditAsCreator);
      } else if (postedByFilter === 'movesbook') {
        list = list.filter((a) => a.createdBySuperAdmin === true);
      } else if (postedByFilter === 'myCountry') {
        const myCountry = (currentUserCountry ?? '').trim().toLowerCase();
        list = list.filter((a) => {
          const creatorCountry = (a.creatorCountry ?? '').trim().toLowerCase();
          return !!myCountry && !!creatorCountry && creatorCountry === myCountry;
        });
      } else if (postedByFilter === 'clubGlobalNews') {
        list = list.filter((a) => a.inClubGlobalNews === true);
      }
      if (isSuperAdmin) {
        if (excludeExpiredAndDeleted) {
          // Hide soft-deleted and past-expiry OGPs (items with no expiry stay visible).
          list = list.filter((a) => !a.deletedAt && isNotExpired(a));
        } else {
          if (showExpired) {
            list = list.filter(isPastExpired);
            if (!showDeletedTemporarily) {
              list = list.filter((a) => !a.deletedAt);
            }
          }
          if (showDeletedTemporarily) {
            list = list.filter((a) => !!a.deletedAt);
          }
        }
      } else {
        list = list.filter((a) => {
          if (canEditAsCreator(a)) {
            if (a.deletedAt) return showDeletedTemporarily;
            // Creator's own OGPs: hide expired unless "Show also expired" is checked.
            if (!showExpired && hasExpirationDateSet(a) && !isNotExpired(a)) {
              return false;
            }
            return true;
          }
          const isActive = isActiveForNormalUser(a);
          const includeExpired = showExpired && isPastExpired(a) && !a.deletedAt;
          const includeDeleted =
            showDeletedTemporarily && !!a.deletedAt && !showDeletedByMeLabel;
          return isActive || includeExpired || includeDeleted;
        });
      }
      if (showOnlyLiked) {
        list = list.filter((a) => (likesMap[a.id]?.count ?? 0) >= 1);
      }
      if (selectedSport) {
        list = list.filter((a) => (a.topic ?? '').toLowerCase() === selectedSport.toLowerCase());
      }
      if (selectedLanguage) {
        list = list.filter((a) => (a.visibility?.languages ?? []).includes(selectedLanguage));
      }
      if (
        isMusic &&
        activeMusicalGenre != null &&
        activeMusicalGenre.trim() !== ''
      ) {
        list = list.filter((a) => (a.genre ?? '').trim() === activeMusicalGenre.trim());
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(
          (a) =>
            (a.title || '').toLowerCase().includes(q) ||
            ogpDescriptionPlainText(null, a.description).toLowerCase().includes(q) ||
            (a.url || '').toLowerCase().includes(q) ||
            ogpDescriptionPlainText(a.customDescription).toLowerCase().includes(q) ||
            (a.groupName || '').toLowerCase().includes(q)
        );
      }
      return list;
    };

    // Music: apply library-nav filters to the article base (registrationType / favourites / recent).
    let articleBase = byTopic;
    if (isMusic) {
      const registrationTypeByNav: Partial<Record<MusicLibraryNavKey, string>> = {
        playlist: 'Playlist',
        songs: 'Song',
        albums: 'Album',
      };
      if (musicLibraryNav === 'favourites') {
        articleBase = byTopic.filter(
          (a) => a.isFavourite === true && canEditAsCreator(a)
        );
      } else if (musicLibraryNav === 'recent') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const cutoff = oneMonthAgo.getTime();
        articleBase = byTopic.filter((a) => {
          if (!a.savedAt) return false;
          const t = new Date(a.savedAt).getTime();
          return !Number.isNaN(t) && t >= cutoff;
        });
      } else if (musicLibraryNav && registrationTypeByNav[musicLibraryNav]) {
        const wanted = registrationTypeByNav[musicLibraryNav];
        articleBase = byTopic.filter((a) => (a.registrationType ?? '').trim() === wanted);
      }
    }

    // Group session: show only OGP items that belong to the selected group.
    if (viewingOgpGroup) {
      const byId = new Map(pasted.filter((a) => !a.isOgpGroup).map((a) => [a.id, a]));
      const members = viewingOgpGroup.memberIds
        .map((id) => byId.get(id))
        .filter((a): a is ArticlePasted => a != null);
      return applyArticleFilters(members);
    }

    // Add-to-group mode: select singles (across topics when View selected is on).
    if (isAddingToGroup) {
      if (viewSelectedOnly) {
        const selectedSet = new Set(selectedForGroupIds);
        const selectedArticles = pasted.filter((a) => !a.isOgpGroup && selectedSet.has(a.id));
        return applyArticleFilters(selectedArticles);
      }
      return applyArticleFilters(byTopic.filter((a) => !a.isOgpGroup));
    }

    // Both off (or both on) → show all; only Single → singles; only Groups → groups.
    // Club shared OGP News: always singles only (never groups).
    const showArticles = hideOgpGroups
      ? true
      : showSingleNews || !showGroupsOfNews;
    const showGroups = hideOgpGroups
      ? false
      : showGroupsOfNews || !showSingleNews;

    let articles: ArticlePasted[] = [];
    if (showArticles) {
      articles = applyArticleFilters(articleBase.filter((a) => !a.isOgpGroup));
    }

    let groups: ArticlePasted[] = [];
    if (showGroups) {
      let groupSource = ogpNewsGroups;
      if (activeTopic === ALL_SUPER_ADMIN) {
        groupSource = [];
      } else if (!activeTopic || activeTopic === ALL_TOPICS) {
        // all topics
      } else if (activeTopic === ALL_USER_SECTORS && topicNamesCreatedByNormalUsers.length > 0) {
        groupSource = groupSource.filter((g) => topicNamesCreatedByNormalUsers.includes(g.topic));
      } else if (activeTopic) {
        groupSource = groupSource.filter((g) => g.topic === activeTopic);
      }
      if (selectedSport) {
        groupSource = groupSource.filter((g) => g.topic.toLowerCase() === selectedSport.toLowerCase());
      }
      groups = groupSource.map(groupToFeedItem);
      if (
        enableClubGlobalAndOtherClubsToggle &&
        !showClubGlobalAndOtherClubs &&
        postedByFilter !== 'clubGlobalNews'
      ) {
        // Same as articles: other-club shares only; keep promoted Club Global items.
        groups = groups.filter((a) => a.isFromOtherClub !== true);
      }
      if (postedByFilter === 'me' && canFilterByMyOgNews) {
        groups = groups.filter(canEditAsCreator);
      } else if (postedByFilter === 'clubGlobalNews') {
        groups = groups.filter((a) => a.inClubGlobalNews === true);
      }
      // Mirror article deleted/expired visibility for groups.
      if (isSuperAdmin) {
        if (excludeExpiredAndDeleted) {
          groups = groups.filter((a) => !a.deletedAt && isNotExpired(a));
        } else {
          if (showExpired) {
            groups = groups.filter(isPastExpired);
            if (!showDeletedTemporarily) {
              groups = groups.filter((a) => !a.deletedAt);
            }
          }
          if (showDeletedTemporarily) {
            groups = groups.filter((a) => !!a.deletedAt);
          } else if (!showExpired) {
            groups = groups.filter((a) => !a.deletedAt);
          }
        }
      } else {
        groups = groups.filter((a) => {
          if (canEditAsCreator(a)) {
            if (a.deletedAt) return showDeletedTemporarily;
            if (!showExpired && hasExpirationDateSet(a) && !isNotExpired(a)) {
              return false;
            }
            return true;
          }
          const isActive = isActiveForNormalUser(a);
          const includeExpired = showExpired && isPastExpired(a) && !a.deletedAt;
          const includeDeleted =
            showDeletedTemporarily && !!a.deletedAt && !showDeletedByMeLabel;
          return isActive || includeExpired || includeDeleted;
        });
      }
      if (showOnlyLiked) {
        groups = groups.filter((a) => (likesMap[a.id]?.count ?? 0) >= 1);
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        groups = groups.filter(
          (a) =>
            (a.groupName || '').toLowerCase().includes(q) ||
            (a.title || '').toLowerCase().includes(q) ||
            ogpDescriptionPlainText(null, a.description).toLowerCase().includes(q) ||
            ogpDescriptionPlainText(a.customDescription).toLowerCase().includes(q)
        );
      }
    }

    return [...groups, ...articles];
  }, [
    byTopic,
    pasted,
    ogpNewsGroups,
    search,
    selectedSport,
    selectedLanguage,
    postedByFilter,
    currentUserCountry,
    excludeExpiredAndDeleted,
    showExpired,
    showDeletedTemporarily,
    canFilterByMyOgNews,
    showDeletedByMeLabel,
    showOnlyLiked,
    likesMap,
    isSuperAdmin,
    canEditAsCreator,
    isMusic,
    activeMusicalGenre,
    musicLibraryNav,
    showSingleNews,
    showGroupsOfNews,
    hideOgpGroups,
    isAddingToGroup,
    viewSelectedOnly,
    selectedForGroupIds,
    enableClubGlobalAndOtherClubsToggle,
    showClubGlobalAndOtherClubs,
    viewingOgpGroup,
    activeTopic,
    topicNamesCreatedByNormalUsers,
  ]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const label = (a: ArticlePasted) =>
      a.isOgpGroup
        ? a.groupName || a.title || a.url || ''
        : a.title || a.url || '';

    list.sort((a, b) => {
      // Groups of News always before single NEWS.
      const aGroup = a.isOgpGroup ? 0 : 1;
      const bGroup = b.isOgpGroup ? 0 : 1;
      if (aGroup !== bGroup) return aGroup - bGroup;

      if (showOnlyLiked) {
        return (likesMap[b.id]?.count ?? 0) - (likesMap[a.id]?.count ?? 0);
      }

      // Expired filter: newest expiration date first (then newest savedAt).
      if (showExpired) {
        const expA = getExpiresAtMs(a);
        const expB = getExpiresAtMs(b);
        if (expA != null && expB != null && expA !== expB) return expB - expA;
        if (expA != null && expB == null) return -1;
        if (expA == null && expB != null) return 1;
        return new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime();
      }

      // Alphabetical within each type (group name / article title).
      const alpha = label(a).localeCompare(label(b), undefined, { sensitivity: 'base' });
      if (sortOrder === 'alpha-desc') return -alpha;
      if (sortOrder === 'date-desc') {
        return new Date(b.savedAt ?? 0).getTime() - new Date(a.savedAt ?? 0).getTime();
      }
      if (sortOrder === 'date-asc') {
        return new Date(a.savedAt ?? 0).getTime() - new Date(b.savedAt ?? 0).getTime();
      }
      // Default and alpha-asc: A–Z
      return alpha;
    });
    return list;
  }, [filtered, sortOrder, showOnlyLiked, likesMap, showExpired]);

  const featuredArticles = useMemo(() => {
    if (!isNewsOgp || viewingOgpGroup || isAddingToGroup) return [];
    return sorted.filter(
      (a) =>
        !a.isOgpGroup &&
        a.isFeatured === true &&
        a.displayInEvidence !== false &&
        !a.deletedAt,
    );
  }, [sorted, isNewsOgp, viewingOgpGroup, isAddingToGroup]);

  const featuredIdSet = useMemo(
    () => new Set(featuredArticles.map((a) => a.id)),
    [featuredArticles],
  );

  const showFeaturedHero =
    isNewsOgp &&
    !viewingOgpGroup &&
    !isAddingToGroup &&
    !viewingHeadlines &&
    featuredArticles.length > 0 &&
    showFeaturedInEvidence;

  const headlinesArticles = useMemo(() => {
    if (!isNewsOgp || viewingOgpGroup || isAddingToGroup) return [];
    return sorted.filter((a) => !a.isOgpGroup && !a.deletedAt);
  }, [sorted, isNewsOgp, viewingOgpGroup, isAddingToGroup]);

  const showHeadlinesPanel =
    isNewsOgp &&
    !viewingOgpGroup &&
    !isAddingToGroup &&
    !viewingHeadlines &&
    showNewsHeadlines &&
    headlinesArticles.length > 0;

  const showSponsors =
    isNewsOgp &&
    !viewingOgpGroup &&
    !isAddingToGroup &&
    !viewingHeadlines &&
    isSponsorDisplayActive(sponsorSettings) &&
    (sponsorSettings?.sponsors.length ?? 0) > 0;

  const getHeadlineViewCount = useCallback(
    (article: ArticlePasted) => viewCountOverrides[article.id] ?? article.viewCount ?? 0,
    [viewCountOverrides],
  );

  const handleRecordOgpView = useCallback(
    async (articleId: string) => {
      const token =
        typeof window !== 'undefined'
          ? adminContext
            ? localStorage.getItem('adminToken')
            : localStorage.getItem('token')
          : null;
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/ogp/${articleId}/view`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && typeof data.viewCount === 'number') {
          setViewCountOverrides((prev) => ({ ...prev, [articleId]: data.viewCount }));
        }
      } catch {
        /* ignore */
      }
    },
    [adminContext, apiBase],
  );

  /** Same as OGP News grid: click title/source opens the preview popup (not the external URL). */
  const handleOpenHeadlineArticle = useCallback(
    (article: ArticlePasted) => {
      if (article.isOgpGroup) {
        openOgpGroupView(article);
        return;
      }
      void handleRecordOgpView(article.id);
      setPreviewArticleId(article.id);
    },
    [handleRecordOgpView, openOgpGroupView],
  );

  const gridSorted = useMemo(() => {
    if (!showFeaturedHero) return sorted;
    return sorted.filter((a) => !featuredIdSet.has(a.id));
  }, [sorted, showFeaturedHero, featuredIdSet]);

  const sponsoredPages = useMemo(() => {
    if (!showSponsors || !sponsorSettings) return null;
    return paginateWithSponsors(
      gridSorted,
      rowsPerPage,
      OGPS_PER_ROW,
      sponsorSettings.startRow,
      sponsorSettings.intervalRows,
      maxSponsorCols(sponsorSettings.sponsors),
    );
  }, [showSponsors, sponsorSettings, gridSorted, rowsPerPage]);

  // Headlines expanded view: Top Stories stay fixed; toolbar paginates the list below.
  const headlinesListCount = Math.max(0, headlinesArticles.length - TOP_STORIES_COUNT);
  const totalPages = Math.max(
    1,
    viewingHeadlines
      ? Math.ceil(headlinesListCount / Math.max(1, rowsPerPage))
      : sponsoredPages
        ? sponsoredPages.length
        : Math.ceil(gridSorted.length / itemsPerPage),
  );
  const start = (currentPage - 1) * itemsPerPage;

  // Clamp current page when total pages shrinks (e.g. after filter or items-per-page change)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginated = useMemo(
    () => gridSorted.slice(start, start + itemsPerPage),
    [gridSorted, start, itemsPerPage]
  );

  const pageCells: SponsoredPageCell<ArticlePasted>[] = useMemo(() => {
    if (sponsoredPages) {
      return sponsoredPages[currentPage - 1] ?? [];
    }
    return paginated.map((item) => ({ kind: 'news' as const, item }));
  }, [sponsoredPages, currentPage, paginated]);

  // OGP list height = row1 + row2 + row3 (measure first element of row 4 relative to grid)
  const updateOgpListMaxHeight = useCallback(() => {
    const grid = ogpGridRef.current;
    if (!grid || typeof document === 'undefined') return;
    const count = grid.children.length;
    if (count === 0) {
      setOgpListMaxHeight(null);
      return;
    }
    const computed = getComputedStyle(grid);
    const colCount = computed.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const firstOfRow4Index = colCount * 3;
    if (count <= firstOfRow4Index) {
      setOgpListMaxHeight(null);
      return;
    }
    const firstOfRow4 = grid.children[firstOfRow4Index];
    if (firstOfRow4 && firstOfRow4 instanceof HTMLElement) {
      // Measure relative to the grid so we get true "height of 3 rows" regardless of offsetParent
      const gridRect = grid.getBoundingClientRect();
      const row4Rect = firstOfRow4.getBoundingClientRect();
      const heightOfThreeRows = row4Rect.top - gridRect.top;
      setOgpListMaxHeight(Math.max(1, heightOfThreeRows));
    }
  }, []);

  useLayoutEffect(() => {
    updateOgpListMaxHeight();
  }, [paginated.length, updateOgpListMaxHeight]);

  useEffect(() => {
    const grid = ogpGridRef.current;
    if (!grid) return;
    const ro = new ResizeObserver(updateOgpListMaxHeight);
    ro.observe(grid);
    // When card content (e.g. images) loads, row heights can change; observe first child to re-measure
    if (grid.firstElementChild) ro.observe(grid.firstElementChild);
    return () => ro.disconnect();
  }, [updateOgpListMaxHeight]);

  const pageNumbers = useMemo(() => {
    let from = Math.max(1, currentPage - Math.floor(MAX_PAGE_BUTTONS / 2));
    let to = Math.min(totalPages, from + MAX_PAGE_BUTTONS - 1);
    if (to - from + 1 < MAX_PAGE_BUTTONS) from = Math.max(1, to - MAX_PAGE_BUTTONS + 1);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [currentPage, totalPages]);

  const allArticleIdsKey = useMemo(() => byTopic.map((a) => a.id).join(','), [byTopic]);
  const allGroupIdsKey = useMemo(
    () => ogpNewsGroups.map((g) => g.id).join(','),
    [ogpNewsGroups]
  );

  useEffect(() => {
    if (!allArticleIdsKey && !allGroupIdsKey) {
      setLikesMap({});
      return;
    }
    const token = typeof window !== 'undefined'
      ? (adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token'))
      : null;
    const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const controller = new AbortController();
    const fetches: Promise<Record<string, { count: number; likedByMe: boolean }>>[] = [];
    if (allArticleIdsKey) {
      fetches.push(
        fetch(`${apiBase}/ogp/likes?ids=${allArticleIdsKey}`, { headers, signal: controller.signal })
          .then((r) => r.json())
          .then((data) => (data && typeof data === 'object' && !data.error ? data : {}))
      );
    }
    if (allGroupIdsKey) {
      fetches.push(
        fetch(`${apiBase}/ogp-groups/likes?ids=${allGroupIdsKey}`, {
          headers,
          signal: controller.signal,
        })
          .then((r) => r.json())
          .then((data) => (data && typeof data === 'object' && !data.error ? data : {}))
      );
    }
    Promise.all(fetches)
      .then((parts) => {
        const merged: Record<string, { count: number; likedByMe: boolean }> = {};
        for (const part of parts) Object.assign(merged, part);
        setLikesMap(merged);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLikesMap({});
      });
    return () => controller.abort();
  }, [allArticleIdsKey, allGroupIdsKey, adminContext, apiBase]);

  const handleLikeClick = useCallback(async (entityId: string, isGroup = false) => {
    const token = typeof window !== 'undefined'
      ? (adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token'))
      : null;
    if (!token) return;
    setLikeLoadingId(entityId);
    try {
      const headers: HeadersInit = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const path = isGroup
        ? `${apiBase}/ogp-groups/${entityId}/like`
        : `${apiBase}/ogp/${entityId}/like`;
      const res = await fetch(path, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update like');
      setLikesMap((prev) => ({
        ...prev,
        [entityId]: { count: data.count ?? 0, likedByMe: data.liked ?? false },
      }));
    } catch {
      // keep previous state on error
    } finally {
      setLikeLoadingId(null);
    }
  }, [adminContext, apiBase]);

  const hasOgpAuthToken =
    typeof window !== 'undefined' &&
    !!(adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token'));

  const renderArticleActions = useCallback(
    (a: ArticlePasted, opts?: { dense?: boolean }) => {
      const canEdit = canEditAsCreator(a);
      const canManage = canDeleteOgp || canEdit;
      return (
        <OgpArticleActionBar
          article={a}
          likes={likesMap[a.id]}
          likeLoading={likeLoadingId === a.id}
          likeDisabled={!hasOgpAuthToken}
          onLike={() => handleLikeClick(a.id, !!a.isOgpGroup)}
          onShare={() => setShareModalArticle(a)}
          viewCount={a.isOgpGroup ? 0 : getHeadlineViewCount(a)}
          showGlobalNewsButton={
            showGlobalNewsButton && !a.isOgpGroup && !isMusic && !isExercise && !!onToggleGlobalNews
          }
          globalNewsLoading={globalNewsLoadingId === a.id}
          onToggleGlobalNews={() => void handleGlobalNewsToggle(a.id, a.inGlobalNews === true)}
          extraSocialButtons={
            <>
              {showShareInMyClubsButton && !isMusic && !isExercise ? (
                <ShareInMyClubsButtonIfClub
                  userType={currentUserType}
                  kind={a.isOgpGroup ? 'ogp-group' : 'ogp'}
                  itemId={a.id}
                  itemTitle={
                    a.isOgpGroup
                      ? (a.groupName ?? a.title ?? null)
                      : (a.title ?? a.customDescription ?? null)
                  }
                  adminUsername={clubAdminUsername ?? undefined}
                  sharedClubIds={a.sharedClubIds}
                  onSharedChange={(clubIds) => onArticleSharedClubIdsChange?.(a.id, clubIds)}
                />
              ) : null}
              {showClubGlobalNewsButton &&
              clubGlobalNewsClubId &&
              !isMusic &&
              !isExercise ? (
                <ClubGlobalNewsToggleButton
                  kind={a.isOgpGroup ? 'ogp-group' : 'ogp'}
                  itemId={a.id}
                  clubId={clubGlobalNewsClubId}
                  inClubGlobalNews={a.inClubGlobalNews === true}
                  onToggled={(next) => onToggleClubGlobalNews?.(a.id, next)}
                />
              ) : null}
            </>
          }
          canEditAsCreator={canEdit}
          canManage={canManage}
          readOnly={superAdminReadOnlyOgpActions}
          isExpanded={expandedArticleIds.has(a.id)}
          onToggleExpand={() => toggleArticleExpanded(a.id)}
          onEdit={() => {
            if (!canEdit) return;
            if (apiBase === '/api/music' && onEditPasted && !a.isOgpGroup) {
              onEditPasted(a);
              return;
            }
            setEditTopicArticleId(a.id);
          }}
          editDisabled={
            !canEdit ||
            (apiBase === '/api/music' && onEditPasted && !a.isOgpGroup
              ? false
              : a.isOgpGroup
                ? !onUpdateOgpNewsGroup
                : !onUpdatePastedTopic)
          }
          editTitle={
            canEdit
              ? apiBase === '/api/music' && onEditPasted && !a.isOgpGroup
                ? 'Edit music (creator only)'
                : a.isOgpGroup
                  ? 'Change group topic (creator only)'
                  : 'Change topic (creator only)'
              : 'Only the creator can change this'
          }
          onCopyLink={() => {
            const shareUrl = getArticleShareUrl(a, isMusic ? 'music' : 'news');
            if (shareUrl) {
              navigator.clipboard?.writeText(shareUrl).then(() => setCopiedArticleId(a.id));
            }
          }}
          linkCopied={copiedArticleId === a.id}
          onViewCreator={() => setCreatorModalArticleId(a.id)}
          showMbOnUserButton={isSuperAdmin && !!a.createdBySuperAdmin}
          onSettings={() => {
            if (canManage) setSettingsArticleId(a.id);
          }}
          settingsDisabled={
            (a.isOgpGroup ? !onUpdateOgpNewsGroupSettings : !onUpdatePastedSettings) || !canManage
          }
          onDelete={() => {
            if (canManage) setRemoveConfirmArticleId(a.id);
          }}
          deleteDisabled={
            (a.isOgpGroup ? !onRemoveOgpNewsGroup : !onRemovePasted) || !canManage
          }
          showMbInsteadOfDelete={!!a.createdBySuperAdmin && !canManage}
          dense={opts?.dense}
        />
      );
    },
    [
      canEditAsCreator,
      canDeleteOgp,
      likesMap,
      likeLoadingId,
      hasOgpAuthToken,
      handleLikeClick,
      getHeadlineViewCount,
      showGlobalNewsButton,
      isMusic,
      isExercise,
      onToggleGlobalNews,
      globalNewsLoadingId,
      handleGlobalNewsToggle,
      showShareInMyClubsButton,
      currentUserType,
      clubAdminUsername,
      onArticleSharedClubIdsChange,
      showClubGlobalNewsButton,
      clubGlobalNewsClubId,
      onToggleClubGlobalNews,
      superAdminReadOnlyOgpActions,
      expandedArticleIds,
      toggleArticleExpanded,
      apiBase,
      onEditPasted,
      onUpdateOgpNewsGroup,
      onUpdatePastedTopic,
      copiedArticleId,
      isSuperAdmin,
      onUpdateOgpNewsGroupSettings,
      onUpdatePastedSettings,
      onRemoveOgpNewsGroup,
      onRemovePasted,
    ],
  );

  return (
    <div className="mt-6 min-w-0 w-full">
      {/* Toolbar - Search, Filter, Pagination (red area from second picture) */}
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-4 min-w-0">
        {/* Row 1: Search, Highlight, next, prev, Select Sport, Language, Show */}
        <div className="bg-red-800 flex flex-wrap items-center gap-2 p-3">
          <div className="flex items-center bg-gray-700 rounded border border-gray-600 flex-1 min-w-[140px] max-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
            <input
              type="text"
              placeholder={t('news_search_placeholder_ogp')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => e.key === 'Enter' && setCurrentPage(1)}
              className="bg-transparent text-white placeholder-gray-400 px-2 py-1.5 text-sm w-full outline-none"
              aria-label="Search OGP articles"
            />
          </div>
          <button
            type="button"
            onClick={() => setHighlightMatches((m) => !m)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              highlightMatches
                ? 'bg-amber-400 text-amber-900 hover:bg-amber-500'
                : 'bg-white text-gray-800 hover:bg-gray-100'
            }`}
            title={highlightMatches ? 'Hide highlights' : 'Highlight search matches in results'}
            aria-pressed={highlightMatches}
          >
            {t('news_highlight')}
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('news_next_ogp')}
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('news_prev')}
          </button>
          <select
            value={selectedSport}
            onChange={(e) => {
              setSelectedSport(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300"
            aria-label={t('news_select')}
          >
            <option value="">{t('news_select')}</option>
            {sortedTopics.map((topic) => (
              <option key={topic} value={topic}>
                {translateTopic(topic)}
              </option>
            ))}
          </select>
          <select
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300"
            aria-label={t('news_language_ogp')}
          >
            <option value="">{t('news_language')}</option>
            {sortedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
            title={t('news_show')}
          >
            {t('news_show')}
          </button>
        </div>
        {/* Row 2: Rows per page dropdown (each row = 6 OGPs), Prev, page numbers, Next */}
        <div className="bg-gray-100 flex flex-wrap items-center gap-2 p-3 border-t border-gray-200">
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300"
            aria-label={t('news_rows')}
          >
            {ROWS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500 hidden sm:inline">{t('news_rows')}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded text-sm font-medium hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('btn_previous')}
          >
            {t('news_prev')}
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCurrentPage(n)}
              className={`min-w-[32px] px-2 py-1.5 rounded text-sm font-medium ${
                currentPage === n
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'
              }`}
              aria-label={currentPage === n ? `Page ${n} (current)` : `Page ${n}`}
              aria-current={currentPage === n ? 'page' : undefined}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded text-sm font-medium hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('btn_next')}
          >
            {t('news_next_ogp')}
          </button>
          {/* Single / Groups — after pagination, before topic title */}
          {!viewingOgpGroup && (
            <div className="flex items-center gap-3 flex-shrink-0 ml-1">
              <label
                className={`flex items-center gap-1.5 select-none ${
                  isAddingToGroup || hideOgpGroups
                    ? 'cursor-not-allowed opacity-80'
                    : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={hideOgpGroups || isAddingToGroup ? true : showSingleNews}
                  disabled={isAddingToGroup || hideOgpGroups}
                  onChange={(e) => {
                    if (isAddingToGroup || hideOgpGroups) return;
                    setShowSingleNews(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-gray-400 accent-green-600 disabled:cursor-not-allowed"
                  aria-label={singleLabel}
                />
                <span className="text-sm text-gray-900 whitespace-nowrap">{singleLabel}</span>
              </label>
              {!isAddingToGroup && !hideOgpGroups && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGroupsOfNews}
                    onChange={(e) => {
                      setShowGroupsOfNews(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded border-gray-400 accent-green-600"
                    aria-label={groupsLabel}
                  />
                  <span className="text-sm text-gray-900 whitespace-nowrap">{groupsLabel}</span>
                </label>
              )}
            </div>
          )}
          {/* OGP topic name - centered; z-index + overflow so the username link stays above siblings and receives clicks */}
          <div className="flex-1 flex justify-center items-center min-w-0 px-2 relative z-[1] overflow-visible">
            <div className="font-normal text-xl text-center inline-flex flex-wrap items-baseline justify-center gap-x-0.5 min-w-0 max-w-full relative overflow-visible">
              {renderActiveTopicHeading('light')}
            </div>
          </div>
          {isMusic && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <label
                htmlFor="musical-genre-select"
                className="text-sm font-medium text-blue-700 whitespace-nowrap"
              >
                Musical genre
              </label>
              <select
                id="musical-genre-select"
                value={selectedMusicalGenre}
                onChange={(e) => {
                  const value = e.target.value;
                  onMusicalGenreSelect?.(value === ALL_MUSICAL_GENRES ? null : value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300 min-w-[7.5rem]"
                aria-label="Musical genre"
              >
                {musicalGenreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Group session: Exit returns to all OGP items. Otherwise Add Single / Add to a group. */}
          {viewingOgpGroup ? (
            <button
              type="button"
              onClick={exitOgpGroupView}
              className="ml-auto flex-shrink-0 px-6 py-2 rounded-md border border-gray-400 bg-gradient-to-b from-gray-100 to-gray-300 text-sm font-semibold text-gray-900 hover:from-gray-200 hover:to-gray-400 shadow-sm"
              title={`Exit group and show all ${ogpLabel}`}
              aria-label="Exit group view"
            >
              Exit
            </button>
          ) : viewingHeadlines ? (
            <button
              type="button"
              onClick={() => setViewingHeadlines(false)}
              className="ml-auto flex-shrink-0 px-6 py-2 rounded-md border border-gray-400 bg-gradient-to-b from-gray-100 to-gray-300 text-sm font-semibold text-gray-900 hover:from-gray-200 hover:to-gray-400 shadow-sm"
              title="Back to OGP News"
              aria-label="Exit news headlines"
            >
              Exit
            </button>
          ) : onAddClick != null && !superAdminReadOnlyOgpActions ? (
              <div className="flex items-end gap-3 flex-shrink-0 ml-auto">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm text-gray-900 leading-tight">Single</span>
                  <button
                    type="button"
                    onClick={onAddClick}
                    disabled={addButtonDisabled}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                      addButtonDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                    title={addButtonDisabled ? 'Select a topic to add an article' : 'Add single article'}
                    aria-label="Add single article"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {!hideOgpGroups && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm text-gray-900 leading-tight whitespace-nowrap">
                    {isAddingToGroup ? 'Add to a group' : 'Add to a group'}
                  </span>
                  {isAddingToGroup ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedForGroupIds.length === 0) {
                            window.alert(`Select at least one ${ogpLabel} to save a group.`);
                            return;
                          }
                          setGroupSaveError(null);
                          setGroupNameConflict(false);
                          setShowCreateGroupModal(true);
                        }}
                        className="flex items-center justify-center min-w-[3.25rem] h-10 px-3 rounded-lg border border-gray-300 bg-white text-red-600 text-sm font-semibold hover:bg-gray-50"
                        title={`Save selected ${ogpLabel} as a group`}
                        aria-label="Save group"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingToGroup(false);
                          setViewSelectedOnly(false);
                          setSelectedForGroupIds([]);
                          setShowCreateGroupModal(false);
                          setGroupSaveError(null);
                          setGroupNameConflict(false);
                          setCurrentPage(1);
                        }}
                        className="flex items-center justify-center min-w-[3.25rem] h-10 px-3 rounded-lg border border-gray-400 bg-gradient-to-b from-gray-100 to-gray-300 text-sm font-semibold text-gray-900 hover:from-gray-200 hover:to-gray-400 shadow-sm"
                        title="Exit and abort group creation"
                        aria-label="Exit group creation"
                      >
                        Exit
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingToGroup(true);
                        setShowSingleNews(true);
                        setShowGroupsOfNews(false);
                        setViewSelectedOnly(false);
                        setSelectedForGroupIds([]);
                        setViewingOgpGroup(null);
                        setCurrentPage(1);
                      }}
                      disabled={superAdminReadOnlyOgpActions}
                      className={`flex items-center justify-center gap-0.5 min-w-[3.25rem] h-10 px-2 rounded-lg border transition-colors ${
                        superAdminReadOnlyOgpActions
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                      }`}
                      title="Add to a group"
                      aria-label="Add to a group"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                )}
              </div>
          ) : null}
        </div>
      </div>

      {/* Pasted - OGP cards in a grid (multiple per row); max 3 rows visible, scroll when more */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0 w-full">
        <div
          className={`bg-gray-800 text-white px-3 sm:px-4 py-2 ${
            apiBase === '/api/music'
              ? 'flex flex-col gap-2'
              : 'flex flex-wrap items-center gap-x-3 gap-y-2'
          }`}
        >
          {isMusic ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-2 min-h-[36px]">
              <div className="justify-self-start font-semibold inline-flex flex-wrap items-baseline gap-x-0.5 min-w-0 truncate">
                {viewingOgpGroup ? (
                  <>
                    <span className="text-white">GROUP of</span>
                    <span className="text-lime-300 uppercase tracking-wide ml-1">
                      {viewingOgpGroup.name}
                    </span>
                  </>
                ) : (
                  renderActiveTopicHeading('dark')
                )}
              </div>
              <nav
                className="flex items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 flex-nowrap"
                aria-label="Music library views"
              >
                {MUSIC_LIBRARY_NAV.map(({ key, label, icon: Icon }) => {
                  const isActive = musicLibraryNav === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMusicLibraryNav((prev) => (prev === key ? null : key));
                        setCurrentPage(1);
                      }}
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                      aria-pressed={isActive}
                      aria-label={label}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="justify-self-end flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSortOrder((s) => (s === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc'))}
                  className={`p-2 rounded-lg transition-colors ${
                    !showOnlyLiked && (sortOrder === 'alpha-asc' || sortOrder === 'alpha-desc')
                      ? 'bg-amber-500 text-amber-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={sortOrder === 'alpha-asc' ? 'Sort A–Z (click for Z–A)' : sortOrder === 'alpha-desc' ? 'Sort Z–A (click for A–Z)' : 'Sort by title'}
                  aria-label="Sort alphabetically"
                >
                  <ArrowDownAZ className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder((s) => (s === 'date-desc' ? 'date-asc' : 'date-desc'))}
                  className={`p-2 rounded-lg transition-colors ${
                    !showOnlyLiked && (sortOrder === 'date-desc' || sortOrder === 'date-asc')
                      ? 'bg-amber-500 text-amber-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={sortOrder === 'date-desc' ? 'Newest first (click for oldest)' : 'Oldest first (click for newest)'}
                  aria-label="Sort by date"
                >
                  <Clock className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnlyLiked((v) => !v);
                    setCurrentPage(1);
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    showOnlyLiked
                      ? 'bg-amber-500 text-amber-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={showOnlyLiked ? 'Show all articles' : 'Show only OGPs with ≥1 like, sorted most liked first'}
                  aria-pressed={showOnlyLiked}
                  aria-label="Show only OGPs with at least one like, sorted by most liked"
                >
                  <ThumbsUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="font-semibold inline-flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 shrink-0">
              {viewingOgpGroup ? (
                <>
                  <span className="text-white">GROUP of</span>
                  <span className="text-lime-300 uppercase tracking-wide">
                    {viewingOgpGroup.name}
                  </span>
                </>
              ) : viewingHeadlines ? (
                <span className="text-white">News Headlines</span>
              ) : (
                renderActiveTopicHeading('dark')
              )}
              {isSuperAdmin && !viewingOgpGroup && (
                <label className="flex items-center gap-2 cursor-pointer select-none font-normal">
                  <input
                    type="radio"
                    name="exclude-expired-deleted"
                    checked={excludeExpiredAndDeleted}
                    onChange={() => {
                      setExcludeExpiredAndDeleted(true);
                      setCurrentPage(1);
                    }}
                    onClick={() => {
                      if (excludeExpiredAndDeleted) {
                        setExcludeExpiredAndDeleted(false);
                        setCurrentPage(1);
                      }
                    }}
                    className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    aria-label="Exclude expired & deleted"
                  />
                  <span className="text-white text-sm whitespace-nowrap">
                    Exclude expired & deleted
                  </span>
                </label>
              )}
            </div>
          )}
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 ${apiBase === '/api/music' ? 'w-full justify-center' : 'ml-auto'}`}>
            {apiBase === '/api/music' && isSuperAdmin && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="exclude-expired-deleted"
                  checked={excludeExpiredAndDeleted}
                  onChange={() => {
                    setExcludeExpiredAndDeleted(true);
                    setCurrentPage(1);
                  }}
                  onClick={() => {
                    if (excludeExpiredAndDeleted) {
                      setExcludeExpiredAndDeleted(false);
                      setCurrentPage(1);
                    }
                  }}
                  className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  aria-label="Exclude expired & deleted"
                />
                <span className="text-white text-sm whitespace-nowrap">
                  Exclude expired & deleted
                </span>
              </label>
            )}
            {isAddingToGroup && !viewingOgpGroup && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={viewSelectedOnly}
                  onChange={(e) => {
                    setViewSelectedOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-gray-300 accent-green-600"
                  aria-label="View selected"
                />
                <span className="text-green-300 text-sm whitespace-nowrap font-medium">
                  View selected
                </span>
              </label>
            )}
            {showClubGlobalNewsButton && clubGlobalNewsClubId ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="posted-by-filter"
                  checked={postedByFilter === 'clubGlobalNews'}
                  onChange={() => {
                    setPostedByFilter('clubGlobalNews');
                    setCurrentPage(1);
                  }}
                  onClick={() => {
                    if (postedByFilter === 'clubGlobalNews') {
                      setPostedByFilter('none');
                      setCurrentPage(1);
                    }
                  }}
                  className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  aria-label="Shared in Global News"
                />
                <span className="text-white text-sm whitespace-nowrap">
                  Shared in Global News
                </span>
              </label>
            ) : null}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="posted-by-filter"
                checked={postedByFilter === 'movesbook'}
                onChange={() => {
                  setPostedByFilter('movesbook');
                  setCurrentPage(1);
                }}
                onClick={() => {
                  // Allow clearing the radio group (back to "show all").
                  if (postedByFilter === 'movesbook') {
                    setPostedByFilter('none');
                    setCurrentPage(1);
                  }
                }}
                className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                aria-label="posted by Movesbook"
              />
              <span className="text-white text-sm whitespace-nowrap">
                posted by Movesbook
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="posted-by-filter"
                checked={postedByFilter === 'myCountry'}
                onChange={() => {
                  setPostedByFilter('myCountry');
                  setCurrentPage(1);
                }}
                onClick={() => {
                  if (postedByFilter === 'myCountry') {
                    setPostedByFilter('none');
                    setCurrentPage(1);
                  }
                }}
                className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                aria-label={postedByCountryLabel}
              />
              <span className="text-white text-sm whitespace-nowrap">
                {postedByCountryLabel}
              </span>
            </label>
            {canFilterByMyOgNews && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="posted-by-filter"
                  checked={postedByFilter === 'me'}
                  onChange={() => {
                    setPostedByFilter('me');
                    setCurrentPage(1);
                  }}
                  onClick={() => {
                    if (postedByFilter === 'me') {
                      setPostedByFilter('none');
                      setCurrentPage(1);
                    }
                  }}
                  className="w-4 h-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  aria-label={
                    showOnlyMyOgNewsLabelUsername
                      ? `only posted by ${showOnlyMyOgNewsLabelUsername}`
                      : t('news_show_only_my_ogp')
                  }
                />
                <span className="text-white text-sm whitespace-nowrap">
                  {showOnlyMyOgNewsLabelUsername
                    ? `only posted by ${showOnlyMyOgNewsLabelUsername}`
                    : t('news_show_only_my_ogp')}
                </span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showExpired}
                onChange={(e) => {
                  setShowExpired(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                aria-label={isSuperAdmin ? 'Show expired' : 'Show also expired'}
              />
              <span className="text-yellow-300 text-sm whitespace-nowrap">
                {isSuperAdmin ? 'Show expired' : 'Show also expired'}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDeletedTemporarily}
                onChange={(e) => {
                  setShowDeletedTemporarily(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                aria-label={deletedFilterLabel}
              />
              <span className="text-yellow-300 text-sm whitespace-nowrap">
                {deletedFilterLabel}
              </span>
            </label>
            {isNewsOgp && (
              <>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showFeaturedInEvidence}
                    onChange={(e) => handleShowFeaturedInEvidenceChange(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-lime-400 focus:ring-lime-500"
                    aria-label="Display news card"
                  />
                  <span className="text-lime-300 text-sm whitespace-nowrap font-medium">
                    Display news card
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNewsHeadlines}
                    onChange={(e) => handleShowNewsHeadlinesChange(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-lime-400 focus:ring-lime-500"
                    aria-label="Display news headlines"
                  />
                  <span className="text-lime-300 text-sm whitespace-nowrap font-medium">
                    Display news headlines
                  </span>
                </label>
              </>
            )}
            {enableClubGlobalAndOtherClubsToggle && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showClubGlobalAndOtherClubs}
                  onChange={(e) => {
                    setShowClubGlobalAndOtherClubs(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  aria-label="Show Club Global News and other clubs"
                  title="Show OGPs shared in Club Global News and in your other clubs"
                />
                <span
                  className="text-cyan-200 text-sm whitespace-nowrap font-medium"
                  title="Show OGPs shared in Club Global News and in your other clubs"
                >
                  Club Global &amp; other clubs
                </span>
              </label>
            )}
            {isSuperAdmin && isNewsOgp && !superAdminReadOnlyOgpActions && (
              <button
                type="button"
                onClick={() => setShowSponsorsModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-amber-950 text-sm font-medium hover:bg-amber-400"
                title="Configure sponsored news"
              >
                <Megaphone className="w-4 h-4" />
                Sponsors
              </button>
            )}
            {apiBase !== '/api/music' && (
            <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc'))}
              className={`p-2 rounded-lg transition-colors ${
                !showOnlyLiked && (sortOrder === 'alpha-asc' || sortOrder === 'alpha-desc')
                  ? 'bg-amber-500 text-amber-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={sortOrder === 'alpha-asc' ? 'Sort A–Z (click for Z–A)' : sortOrder === 'alpha-desc' ? 'Sort Z–A (click for A–Z)' : 'Sort by title'}
              aria-label="Sort alphabetically"
            >
              <ArrowDownAZ className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === 'date-desc' ? 'date-asc' : 'date-desc'))}
              className={`p-2 rounded-lg transition-colors ${
                !showOnlyLiked && (sortOrder === 'date-desc' || sortOrder === 'date-asc')
                  ? 'bg-amber-500 text-amber-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={sortOrder === 'date-desc' ? 'Newest first (click for oldest)' : 'Oldest first (click for newest)'}
              aria-label="Sort by date"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOnlyLiked((v) => !v);
                setCurrentPage(1);
              }}
              className={`p-2 rounded-lg transition-colors ${
                showOnlyLiked
                  ? 'bg-amber-500 text-amber-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={showOnlyLiked ? 'Show all articles' : 'Show only OGPs with ≥1 like, sorted most liked first'}
              aria-pressed={showOnlyLiked}
              aria-label="Show only OGPs with at least one like, sorted by most liked"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
            </div>
            )}
          </div>
        </div>
        <div className="p-4 min-h-0 flex flex-col">
          {filtered.length === 0 && !showFeaturedHero && !showHeadlinesPanel && !viewingHeadlines && !showSponsors ? (
            <p className="text-sm text-gray-500">
              {viewingOgpGroup
                ? `No ${ogpLabel} in group "${viewingOgpGroup.name}".`
                : activeTopic === ALL_TOPICS
                ? t('news_no_articles_all')
                : activeTopic === ALL_USER_SECTORS
                  ? "No articles in users' sectors."
                  : activeTopic === ALL_SUPER_ADMIN
                    ? 'No articles created by super admin.'
                    : activeTopic
                      ? t('news_no_articles_for_topic').replace('{topic}', translateTopic(activeTopic))
                      : t('news_no_articles_default')}
            </p>
          ) : viewingHeadlines ? (
            <div
              className="min-h-0 overflow-y-auto overscroll-contain"
              role="region"
              aria-label="News headlines"
            >
              <NewsHeadlinesExpandedView
                articles={headlinesArticles}
                getViewCount={getHeadlineViewCount}
                onOpenArticle={handleOpenHeadlineArticle}
                displayPicture={headlinesDisplayPicture}
                onDisplayPictureChange={handleHeadlinesDisplayPictureChange}
                renderActions={renderArticleActions}
                isArticleExpanded={(id) => expandedArticleIds.has(id)}
                page={currentPage}
                pageSize={rowsPerPage}
              />
            </div>
          ) : (
            <div
              className="min-h-0 overflow-y-auto overscroll-contain"
              style={ogpListMaxHeight != null ? { height: ogpListMaxHeight, maxHeight: ogpListMaxHeight, minHeight: ogpListMaxHeight } : undefined}
              role="region"
              aria-label="OGP articles list"
            >
              <div
                ref={ogpGridRef}
                className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4 w-full min-w-0 min-h-min"
              >
                {showFeaturedHero && (
                  <FeaturedNewsCard
                    articles={featuredArticles}
                    onPreview={(id) => setPreviewArticleId(id)}
                    onView={(id) => void handleRecordOgpView(id)}
                  />
                )}
                {showHeadlinesPanel && (
                  <NewsHeadlinesPanel
                    articles={headlinesArticles}
                    getViewCount={getHeadlineViewCount}
                    onViewMore={() => {
                      setCurrentPage(1);
                      setViewingHeadlines(true);
                    }}
                    onOpenArticle={handleOpenHeadlineArticle}
                    renderActions={renderArticleActions}
                    isArticleExpanded={(id) => expandedArticleIds.has(id)}
                  />
                )}
                {pageCells.map((cell, cellIndex) =>
                cell.kind === 'sponsor' && sponsorSettings ? (
                  <OgpSponsoredCard
                    key={`sponsor-${currentPage}-${cellIndex}`}
                    sponsors={sponsorSettings.sponsors}
                    delayMs={sponsorSettings.delayMs}
                  />
                ) : cell.kind === 'news' ? ((a: ArticlePasted) => (
                <article
                  key={a.isOgpGroup ? `group-${a.id}` : a.id}
                  className={`border rounded-lg p-3 group flex flex-col min-w-0 relative h-full min-h-0 ${
                    a.isOgpGroup
                      ? 'border-2 border-blue-500 bg-sky-100 hover:bg-sky-100/90'
                      : a.deletedAt
                      ? 'border-amber-400 bg-amber-200 hover:bg-amber-300'
                      : isPastExpired(a)
                        ? 'border-[rgb(255,38,0)] bg-[rgb(255,38,0)]/10 hover:bg-[rgb(255,38,0)]/15'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                    {a.image && (
                      a.isOgpGroup ? (
                        <button
                          type="button"
                          className="block w-full flex-shrink-0 pointer-events-auto rounded mb-2 text-left focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openOgpGroupView(a);
                          }}
                          aria-label={`Open group: ${a.groupName || a.title || 'Group'}`}
                        >
                          <span className={`relative block w-full h-28 rounded overflow-hidden ${a.deletedAt ? 'opacity-75' : ''}`}>
                            <Image
                              src={a.image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                              unoptimized
                            />
                          </span>
                        </button>
                      ) : (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full flex-shrink-0 pointer-events-auto rounded mb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!a.isOgpGroup) void handleRecordOgpView(a.id);
                          }}
                          aria-label={`Open article: ${a.title || a.url}`}
                        >
                          <span className={`relative block w-full h-28 rounded overflow-hidden ${a.deletedAt ? 'opacity-75' : ''}`}>
                            <Image
                              src={a.image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                              unoptimized
                            />
                          </span>
                        </a>
                      )
                    )}
                    {/* OGP topic name + creator; for groups: topic on top, group name below */}
                    <div className="flex items-center gap-1 mb-1.5 flex-shrink-0">
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 max-w-[70%] min-w-0"
                        title="Topic"
                      >
                        <Tag className="w-3 h-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {translateTopic(a.topic ?? 'News')}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-1.5 min-w-0 max-w-[55%] justify-end">
                        {(a.inClubGlobalNews === true || a.isFromOtherClub === true) &&
                          a.sharedClubUsername && (
                            <span
                              className="text-[11px] text-teal-700 font-medium whitespace-nowrap truncate"
                              title={
                                a.isFromOtherClub
                                  ? `Shared in club ${a.sharedClubUsername}`
                                  : `Shared in Club Global News · ${a.sharedClubUsername}`
                              }
                            >
                              {a.sharedClubUsername}
                            </span>
                          )}
                        {(a.isOgpGroup ? a.creatorUsername || a.creatorName : a.creatorUsername) && (
                          <span
                            className="text-[11px] text-blue-600 whitespace-nowrap truncate"
                            title={
                              a.isOgpGroup
                                ? (a.creatorUsername || a.creatorName || undefined)
                                : (a.creatorUsername || undefined)
                            }
                          >
                            by {a.isOgpGroup ? a.creatorUsername || a.creatorName : a.creatorUsername}
                          </span>
                        )}
                      </span>
                    </div>
                    {a.isOgpGroup && (
                      <button
                        type="button"
                        className="block w-full text-left text-xs font-semibold text-sky-800 truncate mb-1 flex-shrink-0 hover:underline cursor-pointer"
                        title={`Open ${ogpLabel} group. Here you can see all the most recent articles related to '${a.groupName || a.title || 'Group'}'`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openOgpGroupView(a);
                        }}
                      >
                        {a.groupName || a.title || 'Group'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="relative z-10 text-left pointer-events-auto flex-1 min-h-0 flex flex-col group/text"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (a.isOgpGroup) {
                          openOgpGroupView(a);
                        } else {
                          void handleRecordOgpView(a.id);
                          setPreviewArticleId(a.id);
                        }
                      }}
                    >
                      <h4 className={`font-medium text-sm line-clamp-2 ${a.deletedAt ? 'text-gray-600' : 'text-gray-900'} group-hover/text:underline`}>
                        {highlightMatches && search.trim()
                          ? highlightText(a.title || a.url, search)
                          : a.title || a.url}
                      </h4>
                      {a.artist ? (
                        <p className="text-xs text-gray-500 mt-0.5 truncate" title={a.artist}>
                          {a.artist}
                        </p>
                      ) : null}
                      <div
                        className={`text-xs text-gray-600 mt-1 flex-1 min-h-0 ${
                          expandedArticleIds.has(a.id)
                            ? 'max-h-28 overflow-y-auto overflow-x-hidden pointer-events-auto'
                            : 'line-clamp-2'
                        }`}
                        onClick={(e) => {
                          if (expandedArticleIds.has(a.id)) {
                            e.stopPropagation();
                          } else {
                            e.preventDefault();
                            e.stopPropagation();
                            if (a.isOgpGroup) {
                              openOgpGroupView(a);
                            } else {
                              void handleRecordOgpView(a.id);
                              setPreviewArticleId(a.id);
                            }
                          }
                        }}
                        onMouseDown={(e) => expandedArticleIds.has(a.id) && e.stopPropagation()}
                      >
                        {highlightMatches && search.trim()
                          ? highlightText(
                              ogpDescriptionPlainText(
                                a.customDescription,
                                a.description,
                                a.url
                              ),
                              search
                            )
                          : expandedArticleIds.has(a.id)
                            ? (
                              <OgpRichDescription
                                html={
                                  a.customDescription || a.description || a.url || ''
                                }
                                className="text-xs text-gray-600"
                              />
                              )
                            : ogpDescriptionPlainText(
                                a.customDescription,
                                a.description,
                                a.url
                              )}
                      </div>
                    </button>
                    <div className="relative z-10 text-sm text-gray-600 mt-2 flex items-center gap-2 flex-shrink-0">
                      <span className="flex-1 min-w-0">
                        {formatDate(a.savedAt ?? new Date().toISOString())}
                      </span>
                      {isAddingToGroup && !a.isOgpGroup && (
                        <input
                          type="checkbox"
                          checked={selectedForGroupIds.includes(a.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedForGroupIds((prev) =>
                              checked
                                ? prev.includes(a.id)
                                  ? prev
                                  : [...prev, a.id]
                                : prev.filter((id) => id !== a.id)
                            );
                          }}
                          className="w-4 h-4 rounded border-gray-400 accent-green-600 flex-shrink-0"
                          aria-label={`Select ${a.title || ogpLabel} for group`}
                        />
                      )}
                    </div>
                    {/* I likes section: like button, count, share (copy link) - like the red marked area in reference */}
                    <div className="relative z-10 flex items-center gap-2 mt-2 flex-shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLikeClick(a.id, !!a.isOgpGroup);
                        }}
                        disabled={
                          superAdminReadOnlyOgpActions ||
                          !!likeLoadingId ||
                          (typeof window !== 'undefined' && !(adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token')))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                          likesMap[a.id]?.likedByMe
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                        title={likesMap[a.id]?.likedByMe ? 'Unlike' : 'Like'}
                        aria-label={likesMap[a.id]?.likedByMe ? 'Unlike' : 'Like'}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${likesMap[a.id]?.likedByMe ? 'fill-current' : ''}`} />
                        <span className="min-w-[1.5rem] text-right tabular-nums">
                          {likesMap[a.id]?.count ?? 0}
                        </span>
                      </button>
                      {!a.isOgpGroup && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 shrink-0 select-none"
                          title={
                            getHeadlineViewCount(a) === 1
                              ? '1 view'
                              : `${getHeadlineViewCount(a)} views`
                          }
                          aria-label={
                            getHeadlineViewCount(a) === 1
                              ? '1 view'
                              : `${getHeadlineViewCount(a)} views`
                          }
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden />
                          <span className="min-w-[1.5rem] text-right tabular-nums">
                            {getHeadlineViewCount(a)}
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShareModalArticle(a);
                        }}
                        disabled={superAdminReadOnlyOgpActions}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Share"
                        aria-label="Share"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      {showGlobalNewsButton && !a.isOgpGroup && !isMusic && !isExercise && onToggleGlobalNews ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleGlobalNewsToggle(a.id, a.inGlobalNews === true);
                          }}
                          disabled={
                            superAdminReadOnlyOgpActions ||
                            globalNewsLoadingId === a.id
                          }
                          className={`inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                            a.inGlobalNews
                              ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
                              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                          }`}
                          title={
                            a.inGlobalNews
                              ? 'Shared in Global News (click to remove)'
                              : 'Share in Global News'
                          }
                          aria-label={
                            a.inGlobalNews ? 'Remove from Global News' : 'Share in Global News'
                          }
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      {showShareInMyClubsButton && !isMusic && !isExercise ? (
                        <ShareInMyClubsButtonIfClub
                          userType={currentUserType}
                          kind={a.isOgpGroup ? 'ogp-group' : 'ogp'}
                          itemId={a.id}
                          itemTitle={
                            a.isOgpGroup
                              ? (a.groupName ?? a.title ?? null)
                              : (a.title ?? a.customDescription ?? null)
                          }
                          adminUsername={clubAdminUsername ?? undefined}
                          sharedClubIds={a.sharedClubIds}
                          onSharedChange={(clubIds) =>
                            onArticleSharedClubIdsChange?.(a.id, clubIds)
                          }
                        />
                      ) : null}
                      {showClubGlobalNewsButton &&
                      clubGlobalNewsClubId &&
                      !isMusic &&
                      !isExercise ? (
                        <ClubGlobalNewsToggleButton
                          kind={a.isOgpGroup ? 'ogp-group' : 'ogp'}
                          itemId={a.id}
                          clubId={clubGlobalNewsClubId}
                          inClubGlobalNews={a.inClubGlobalNews === true}
                          onToggled={(next) => onToggleClubGlobalNews?.(a.id, next)}
                        />
                      ) : null}
                      {a.isOgpGroup && (
                        <span
                          className="inline-flex items-center justify-center min-w-[1.5rem] h-7 px-1.5 rounded border border-gray-300 bg-white text-gray-800 text-sm font-semibold tabular-nums"
                          title={`${a.memberCount ?? 0} ${ogpLabel} in this group`}
                          aria-label={`${a.memberCount ?? 0} ${ogpLabel} in this group`}
                        >
                          {a.memberCount ?? 0}
                        </span>
                      )}
                    </div>
                    {a.deletedAt && (
                      <p className="relative z-10 pointer-events-none text-xs text-amber-800 mt-1 font-medium">
                        Deleted on {formatDate(a.deletedAt)}
                        {a.deletedByName ? ` by ${a.deletedByName}` : ' by creator'}
                      </p>
                    )}
                    {!a.deletedAt && isPastExpired(a) && (
                      <p className="relative z-10 pointer-events-none text-xs text-amber-800 mt-1 font-medium">
                        Expired on {formatDate(a.visibility?.expiresAt ?? undefined)}
                      </p>
                    )}
                    {showFeaturedControls && isNewsOgp && !a.isOgpGroup && onToggleOgpFeatured && (
                      <div className="relative z-10 mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1.5 flex-shrink-0">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={a.isFeatured === true}
                            disabled={superAdminReadOnlyOgpActions || featuredLoadingId === a.id}
                            onChange={(e) => {
                              void handleFeaturedToggle(a.id, { isFeatured: e.target.checked });
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            aria-label="Featured News Card"
                          />
                          <span>Featured News Card</span>
                        </label>
                      </div>
                    )}
                  </div>
                  {/* Action icons row below each OGP - compact so 6 fit within narrow cards */}
                  <div className="relative z-20 pointer-events-auto mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-0.5 min-w-0 flex-shrink-0">
                    <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!canEditAsCreator(a)) return;
                          if (apiBase === '/api/music' && onEditPasted && !a.isOgpGroup) {
                            onEditPasted(a);
                            return;
                          }
                          setEditTopicArticleId(a.id);
                        }}
                        disabled={
                          superAdminReadOnlyOgpActions ||
                          !canEditAsCreator(a) ||
                          (apiBase === '/api/music' && onEditPasted && !a.isOgpGroup
                            ? false
                            : a.isOgpGroup
                              ? !onUpdateOgpNewsGroup
                              : !onUpdatePastedTopic)
                        }
                        className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
                        title={
                          canEditAsCreator(a)
                            ? apiBase === '/api/music' && onEditPasted && !a.isOgpGroup
                              ? 'Edit music (creator only)'
                              : a.isOgpGroup
                                ? 'Change group topic (creator only)'
                                : 'Change topic (creator only)'
                            : "Only the creator can change this"
                        }
                        aria-label={
                          apiBase === '/api/music' && onEditPasted && !a.isOgpGroup
                            ? 'Edit music'
                            : 'Change topic'
                        }
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleArticleExpanded(a.id);
                        }}
                        disabled={superAdminReadOnlyOgpActions}
                        className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={expandedArticleIds.has(a.id) ? 'Show less (2 rows)' : 'Show full text'}
                        aria-label={expandedArticleIds.has(a.id) ? 'Collapse text' : 'Expand to full text'}
                      >
                        {expandedArticleIds.has(a.id) ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const shareUrl = getArticleShareUrl(a, isMusic ? 'music' : 'news');
                          if (shareUrl) {
                            navigator.clipboard?.writeText(shareUrl).then(() => setCopiedArticleId(a.id));
                          }
                        }}
                        disabled={superAdminReadOnlyOgpActions}
                        className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          copiedArticleId === a.id
                            ? 'Copied!'
                            : a.isOgpGroup
                              ? 'Copy group link to clipboard'
                              : 'Copy OGP URL to clipboard'
                        }
                        aria-label={copiedArticleId === a.id ? 'Copied!' : 'Copy link'}
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCreatorModalArticleId(a.id);
                        }}
                        disabled={superAdminReadOnlyOgpActions}
                        className={`flex items-center justify-center w-6 h-6 min-w-[24px] rounded border transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentUserId != null && !canEditAsCreator(a)
                            ? 'border-amber-200 bg-amber-200 text-gray-600 hover:bg-amber-400 hover:border-amber-300'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                        title={a.isOgpGroup ? 'View creator of this group' : 'View creator of this article'}
                        aria-label="View creator"
                      >
                        {isSuperAdmin && a.createdBySuperAdmin ? (
                          <span
                            className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded bg-red-600 text-white border border-yellow-300 shrink-0 select-none"
                            style={{
                              fontFamily: "'Comic Sans MS', 'Comic Sans', cursive",
                              fontSize: 11,
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                            title="Posted by Movesbook (Super Admin)"
                          >
                            MB
                          </span>
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (canDeleteOgp || canEditAsCreator(a)) setSettingsArticleId(a.id);
                        }}
                        disabled={
                          superAdminReadOnlyOgpActions ||
                          (a.isOgpGroup ? !onUpdateOgpNewsGroupSettings : !onUpdatePastedSettings) ||
                          (!canDeleteOgp && !canEditAsCreator(a))
                        }
                        className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
                        title={
                          canDeleteOgp || canEditAsCreator(a)
                            ? a.isOgpGroup
                              ? 'Group settings (visibility)'
                              : 'News settings (visibility)'
                            : 'Only creator, admin, or super admin can edit settings'
                        }
                        aria-label="News settings"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      {a.createdBySuperAdmin && !canDeleteOgp && !canEditAsCreator(a) ? (
                        <span
                          className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded bg-red-600 text-white border border-yellow-300 shrink-0 select-none"
                          style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', cursive", fontSize: 11, fontWeight: 700, lineHeight: 1 }}
                          title="Posted by Movesbook (Super Admin)"
                          aria-label="Posted by Movesbook (Super Admin)"
                        >
                          MB
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canDeleteOgp || canEditAsCreator(a)) setRemoveConfirmArticleId(a.id);
                          }}
                          disabled={
                            superAdminReadOnlyOgpActions ||
                            (a.isOgpGroup ? !onRemoveOgpNewsGroup : !onRemovePasted) ||
                            (!canDeleteOgp && !canEditAsCreator(a))
                          }
                          className="flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            canDeleteOgp || canEditAsCreator(a)
                              ? a.isOgpGroup
                                ? 'Delete group'
                                : 'Delete'
                              : 'Only super admin, admin, or creator can delete'
                          }
                          aria-label={a.isOgpGroup ? 'Delete group' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                </article>
                ))(cell.item) : null)}
              </div>
            </div>
          )}
        </div>
      </div>

      <OgpSponsorsSettingsModal
        isOpen={showSponsorsModal}
        onClose={() => setShowSponsorsModal(false)}
        initial={sponsorSettings}
        ogpArticles={sponsorOgpArticles}
        onSaved={(next) => {
          setSponsorSettings(next);
          setCurrentPage(1);
        }}
      />

      {settingsArticleId != null && (
        <NewsSettingModal
          isOpen={true}
          onClose={() => setSettingsArticleId(null)}
          initialSettings={(() => {
            const fromPasted = pasted.find((a) => a.id === settingsArticleId);
            const fromGroup = ogpNewsGroups.find((g) => g.id === settingsArticleId);
            const visibility =
              fromPasted?.visibility ?? fromGroup?.visibility ?? defaultSettings;
            const clubAudienceMode =
              fromPasted?.clubAudienceMode ?? fromGroup?.clubAudienceMode ?? null;
            return {
              ...visibility,
              ...(clubGlobalNewsClubId ? { clubAudienceMode } : {}),
            };
          })()}
          onSave={async (settings) => {
            const isGroup = ogpNewsGroups.some((g) => g.id === settingsArticleId);
            if (isGroup) {
              await onUpdateOgpNewsGroupSettings?.(settingsArticleId, settings);
              if (settings.clubAudienceMode) {
                onArticleClubAudienceModeChange?.(
                  settingsArticleId,
                  settings.clubAudienceMode,
                );
              }
            } else {
              onUpdatePastedSettings?.(settingsArticleId, settings);
              if (clubGlobalNewsClubId && settings.clubAudienceMode) {
                try {
                  const token = localStorage.getItem('token');
                  await fetch(
                    `/api/clubs/shared-news/ogp/${encodeURIComponent(settingsArticleId)}`,
                    {
                      method: 'PATCH',
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        clubId: clubGlobalNewsClubId,
                        audienceMode: settings.clubAudienceMode,
                      }),
                    },
                  );
                  onArticleClubAudienceModeChange?.(
                    settingsArticleId,
                    settings.clubAudienceMode,
                  );
                } catch (e) {
                  console.error('Failed to save club audience mode', e);
                }
              }
            }
            setSettingsArticleId(null);
          }}
          onDeleteSettings={() => {
            const isGroup = ogpNewsGroups.some((g) => g.id === settingsArticleId);
            const cleared = {
              ...defaultSettings,
              ...(clubGlobalNewsClubId
                ? { clubAudienceMode: 'me-and-club-members' as const }
                : {}),
            };
            if (isGroup) onUpdateOgpNewsGroupSettings?.(settingsArticleId, cleared);
            else onUpdatePastedSettings?.(settingsArticleId, cleared);
          }}
          options={settingsOptions}
          title={
            ogpNewsGroups.some((g) => g.id === settingsArticleId)
              ? 'Group Setting'
              : apiBase === '/api/music'
                ? 'Music Setting'
                : 'News Setting'
          }
          showClubAudienceRadios={Boolean(clubGlobalNewsClubId)}
        />
      )}

      <OgpShareModal
        isOpen={shareModalArticle != null}
        onClose={() => setShareModalArticle(null)}
        article={
          shareModalArticle
            ? {
                url: getArticleShareUrl(shareModalArticle, isMusic ? 'music' : 'news'),
                title: shareModalArticle.isOgpGroup
                  ? shareModalArticle.groupName || shareModalArticle.title
                  : shareModalArticle.title,
              }
            : null
        }
        onCopyLink={() => shareModalArticle && setCopiedArticleId(shareModalArticle.id)}
      />

      {creatorModalArticleId != null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setCreatorModalArticleId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="creator-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 id="creator-modal-title" className="text-lg font-semibold text-gray-900">
                {apiBase === '/api/music' ? 'Music creator' : apiBase === '/api/exercises' ? 'Exercise creator' : 'OGP creator'}
              </h2>
              <button
                type="button"
                onClick={() => setCreatorModalArticleId(null)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {creatorLoading && (
                <p className="text-sm text-gray-500">Loading creator info…</p>
              )}
              {creatorError && (
                <p className="text-sm text-red-600">{creatorError}</p>
              )}
              {!creatorLoading && !creatorError && creatorInfo && (
                <div className="flex gap-4 items-start">
                  <dl className="space-y-3 text-sm flex-1 min-w-0">
                    {creatorInfo.name != null && creatorInfo.name !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Name</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.name}</dd>
                      </div>
                    )}
                    {creatorInfo.username != null && creatorInfo.username !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Username</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.username}</dd>
                      </div>
                    )}
                    {creatorInfo.email != null && creatorInfo.email !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Email</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.email}</dd>
                      </div>
                    )}
                    {creatorInfo.gender != null && creatorInfo.gender !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Gender</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.gender}</dd>
                      </div>
                    )}
                    {creatorInfo.country != null && creatorInfo.country !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Country</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.country}</dd>
                      </div>
                    )}
                    {creatorInfo.telegramAccount != null && creatorInfo.telegramAccount !== '' && (
                      <div>
                        <dt className="text-gray-500 font-medium">Telegram</dt>
                        <dd className="text-gray-900 mt-0.5">{creatorInfo.telegramAccount}</dd>
                      </div>
                    )}
                    {[
                      creatorInfo.name,
                      creatorInfo.username,
                      creatorInfo.email,
                      creatorInfo.gender,
                      creatorInfo.country,
                      creatorInfo.telegramAccount,
                    ].every((v) => v == null || v === '') && (
                      <p className="text-gray-500">No creator details available.</p>
                    )}
                  </dl>
                  <div className="flex-shrink-0 relative w-24 h-24 bg-gray-200 border border-gray-300 overflow-hidden">
                    <Image
                      src={
                        creatorInfo.image && creatorInfo.image.trim() !== ''
                          ? creatorInfo.image
                          : creatorInfo.gender?.toLowerCase() === 'female'
                            ? '/female_default.jpg'
                            : '/male_default.jpg'
                      }
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewArticleId != null && (() => {
        const article =
          pasted.find((x) => x.id === previewArticleId) ??
          (() => {
            const g = ogpNewsGroups.find((x) => x.id === previewArticleId);
            return g ? groupToFeedItem(g) : null;
          })();
        if (!article) return null;
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setPreviewArticleId(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ogp-preview-modal-title"
          >
            <div
              className="bg-white rounded-xl shadow-xl border border-gray-300 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                <span className="font-semibold" id="ogp-preview-modal-title">
                  {article.isOgpGroup
                    ? article.groupName || 'Group'
                    : translateTopic(article.topic ?? 'News')}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewArticleId(null)}
                  className="p-1 rounded text-gray-300 hover:text-white hover:bg-gray-700"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {article.image && (
                  article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset cursor-pointer"
                      aria-label={`Open article: ${article.title || article.url}`}
                      onClick={() => {
                        if (!article.isOgpGroup) void handleRecordOgpView(article.id);
                      }}
                    >
                      <span className="relative block w-full h-64 max-h-64">
                        <Image
                          src={article.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 512px) 100vw, 512px"
                          unoptimized
                        />
                      </span>
                    </a>
                  ) : (
                    <span className="relative block w-full h-64 max-h-64">
                      <Image
                        src={article.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 512px) 100vw, 512px"
                        unoptimized
                      />
                    </span>
                  )
                )}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    {article.title || article.url}
                  </h3>
                  <div className="text-sm text-gray-500 mt-1 w-full flex items-center justify-between gap-2 flex-nowrap">
                    <span className="flex-shrink-0">{formatDate(article.savedAt ?? new Date().toISOString())}</span>
                    {previewCreatorUsername && (
                      <span className="text-blue-600 flex-shrink-0 ml-auto">by {previewCreatorUsername}</span>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-gray-700 max-h-60 overflow-y-auto overflow-x-hidden pr-2 border border-gray-200 rounded-lg p-3">
                    <OgpRichDescription
                      html={
                        article.customDescription || article.description || article.url || ''
                      }
                      className="text-sm text-gray-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {removeConfirmArticleId != null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setRemoveConfirmArticleId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-confirm-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-confirm-modal-title" className="text-lg font-semibold text-gray-900 mb-3">
              {ogpNewsGroups.some((g) => g.id === removeConfirmArticleId)
                ? `Remove ${ogpLabel} group`
                : 'Remove OGP'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {ogpNewsGroups.some((g) => g.id === removeConfirmArticleId)
                ? `Are you sure you want to remove this group? The individual ${ogpLabel} items will not be deleted.`
                : 'Are you sure you want to remove this article? This action cannot be undone.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRemoveConfirmArticleId(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (ogpNewsGroups.some((g) => g.id === removeConfirmArticleId)) {
                    void onRemoveOgpNewsGroup?.(removeConfirmArticleId);
                  } else {
                    onRemovePasted?.(removeConfirmArticleId);
                  }
                  setRemoveConfirmArticleId(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {editTopicArticleId != null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setEditTopicArticleId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-topic-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-topic-modal-title" className="text-lg font-semibold text-gray-900 mb-3">
              {ogpNewsGroups.some((g) => g.id === editTopicArticleId)
                ? 'Change group topic'
                : apiBase === '/api/music'
                  ? 'Change Music topic'
                  : 'Change OGP topic'}
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              {ogpNewsGroups.some((g) => g.id === editTopicArticleId)
                ? 'Move this group to another topic (e.g. Events, Nutrition, Sport).'
                : 'Move this article to another topic (e.g. Events, Nutrition, Sport).'}
            </p>
            <label htmlFor="edit-topic-select" className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <select
              id="edit-topic-select"
              value={editTopicValue}
              onChange={(e) => setEditTopicValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 mb-4"
            >
              {topicsList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label htmlFor="edit-topic-description" className="block text-sm font-medium text-gray-700 mb-1">
              Type here a brief description...
            </label>
            <div className="mb-4">
              <RichTextEditor
                value={editTopicDescription}
                onChange={setEditTopicDescription}
                placeholder="Brief description..."
                minHeight="80px"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditTopicArticleId(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const isGroup = ogpNewsGroups.some((g) => g.id === editTopicArticleId);
                  if (isGroup) {
                    void onUpdateOgpNewsGroup?.(editTopicArticleId, editTopicValue, editTopicDescription);
                  } else {
                    onUpdatePastedTopic?.(editTopicArticleId, editTopicValue, editTopicDescription);
                  }
                  setEditTopicArticleId(null);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <CreateOgpNewsGroupModal
          variant={isMusic ? 'music' : 'news'}
          topics={topicsList.filter(
            (t) => t !== ALL_TOPICS && t !== ALL_USER_SECTORS && t !== ALL_SUPER_ADMIN
          )}
          defaultTopic={
            activeTopic &&
            activeTopic !== ALL_TOPICS &&
            activeTopic !== ALL_USER_SECTORS &&
            activeTopic !== ALL_SUPER_ADMIN
              ? activeTopic
              : topicsList[0] ?? (isMusic ? 'Music' : isExercise ? 'Exercise' : 'News')
          }
          selectedCount={selectedForGroupIds.length}
          saving={groupSaving}
          error={groupSaveError}
          existingNameConflict={groupNameConflict}
          onCreateTopic={onCreateTopic}
          onCancel={() => {
            setShowCreateGroupModal(false);
            setGroupSaveError(null);
            setGroupNameConflict(false);
          }}
          onSave={async ({ name, topic, confirmExisting, coverImage }) => {
            if (!onSaveOgpNewsGroup) {
              setGroupSaveError('Saving groups is not available');
              return;
            }
            setGroupSaving(true);
            setGroupSaveError(null);
            try {
              await onSaveOgpNewsGroup({
                name,
                topic,
                articleIds: selectedForGroupIds,
                confirmExisting,
                coverImage: coverImage ?? null,
              });
              setShowCreateGroupModal(false);
              setGroupNameConflict(false);
              setIsAddingToGroup(false);
              setViewSelectedOnly(false);
              setSelectedForGroupIds([]);
              setShowGroupsOfNews(true);
              setShowSingleNews(true);
              setCurrentPage(1);
            } catch (e) {
              const err = e as Error & { exists?: boolean };
              if (err.exists) {
                setGroupNameConflict(true);
                setGroupSaveError(
                  err.message ||
                    'A group with this name already exists. Change the name or confirm to add to it.'
                );
              } else {
                setGroupSaveError(err.message || 'Failed to save group');
              }
            } finally {
              setGroupSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
