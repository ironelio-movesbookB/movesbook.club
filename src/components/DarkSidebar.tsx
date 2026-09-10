'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { REGISTRATION_ONLY_ID_CARDS_TOOLTIP } from '@/lib/registration/clubIdentificationCardsRegistration';
import type { LucideIcon } from 'lucide-react';
import { 
  Home,
  Globe,
  Users,
  Building2,
  Trophy,
  Settings,
  Bell,
  Mail,
  Clock,
  Music,
  CalendarDays,
  LayoutDashboard,
  ChevronDown,
  Plus,
  UserCircle,
  Eye,
  EyeOff,
  Twitter,
  Facebook,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  Newspaper,
  Link as LinkIcon,
  BookOpen,
  SlidersHorizontal,
  PenSquare,
  List,
  Search,
  X,
  Coins,
  Heart,
  Monitor,
  PlusCircle,
  FolderOpen,
  ShoppingCart,
  ScanLine,
  Lock,
  ClipboardList,
  BarChart3,
  Printer,
  ArrowUpSquare,
  Link2,
  Briefcase,
  CreditCard,
  Shield,
  Stamp,
  Move,
  ChevronRight,
  Pencil,
  Users2,
  Router,
  Contact2,
  ShipWheel,
  QrCode,
  RadioTower,
  Wallet,
  Bookmark,
  CheckSquare,
  RectangleHorizontal,
  Star,
  Camera,
  MousePointerClick,
  Calendar,
  CalendarRange,
  UserCircle2,
  Fingerprint,
  Settings2,
  LayoutGrid,
  Volume2,
  Mic,
  Import,
  Check,
  RefreshCw,
  FileText,
  Timer,
  Hourglass,
  Award,
  ArrowUpRight,
  ArrowLeftRight,
  Paperclip,
  Phone,
  Presentation,
  Megaphone,
  ShoppingBasket,
  User,
  Radio,
  CircleSlash,
  CheckCircle,
  Server,
  UserCog,
  ClipboardCheck,
  FileWarning,
  HelpCircle,
  CornerDownLeft,
  CornerDownRight,
  Repeat2,
  FileStack,
  Receipt,
  Info,
  MessagesSquare,
  Youtube
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import MyPageTopicsEntryRow from '@/components/club/MyPageTopicsEntryRow';
import SelectClubForTopicsModal from '@/components/club/SelectClubForTopicsModal';
import { useRouter } from 'next/navigation';
import {
  isClubAccountUserType,
  isGroupAccountUserType,
  isManagedEntityAdminUserType,
  isTeamAccountUserType,
  showSuggestMovesbookForTab,
  userOwnsMovesbookWebsite,
} from '@/utils/dashboardRouting';
import {
  formatMyClubsSidebarLabel,
  getFormCreatedClubsSortedByCreatedAt,
  isClubCreatedFromForm,
  userHasClubProfile,
} from '@/lib/club/clubSidebarLabel';
import { formatCreatableCompaniesSidebarLabel } from '@/lib/club/creatableCompaniesQuota.shared';
import { canManageClubWebsite } from '@/lib/club/clubWebsitePermissions';
import {
  formatEntitySidebarLabel,
  getFormCreatedEntitiesSortedByCreatedAt,
} from '@/lib/entity/entityForm';
import {
  normalizeYoutubeUrlForOpen,
  YOUTUBE_CHANNEL_URL_KEY
} from '@/utils/youtubeChannelUrl';
import SidebarClubMyEntityTop from '@/components/SidebarClubMyEntityTop';
import ClubMyClubInfoSubmenu from '@/components/club/ClubMyClubInfoSubmenu';
import ClubSocialSubmenu from '@/components/club/ClubSocialSubmenu';
import ClubMembersDashboardSection from '@/components/club/ClubMembersDashboardSection';
import PersonalMyTopicsSidebarBlock from '@/components/club/PersonalMyTopicsSidebarBlock';
import ChangeProfilePhotoModal from '@/components/athlete/ChangeProfilePhotoModal';
import MubSidebarBar from '@/components/mub/MubSidebarBar';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { CLUB_WEBSITE_SETTINGS_INDEX_PATH, clubWebsiteDisplayUrl } from '@/lib/clubWebsiteSettingsPaths';
import { PERSONAL_WEBSITE_TOPICS_PATH } from '@/lib/personalWebsiteSettingsPaths';
import {
  readSelectedClubHint,
  writeClubWorkspaceTab,
} from '@/lib/club/clubWorkspaceTab';
import {
  requestOpenClubTopicsSection,
  requestOpenPersonalTopicsSection,
} from '@/lib/club/clubTopicsNavigation';
import { legacyUserBugProblemUrl } from '@/lib/messages/feedbackRoutes';
import { getAuthToken } from '@/utils/auth.utils';
import { withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import {
  CLUB_STAFF_CHANGED_EVENT,
  type ClubStaffListItem,
} from '@/lib/club/clubStaff.constants';

function SidebarStackedGlobeIcon({ badge }: { badge: 'M' | 'F' | 'star' }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-end justify-center" aria-hidden>
      <Globe className="h-3.5 w-3.5 opacity-95" />
      {badge === 'star' ? (
        <Star className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 fill-white text-white" strokeWidth={2} />
      ) : (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </span>
  );
}

type ClubAdminInsertItem =
  | { kind: 'icon'; Icon: LucideIcon; label: string; path?: string }
  | { kind: 'affiliate'; label: string; path?: string }
  | { kind: 'assignAlert'; label: string; path?: string }
  | { kind: 'recordAlert'; label: string; path?: string };

const CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS: ClubAdminInsertItem[][] = [
  [
    { kind: 'icon', Icon: FileText, label: 'New user' },
    { kind: 'affiliate', label: 'New affiliate to the club', path: '/clubMembers/memberList' },
  ],
  [
    { kind: 'icon', Icon: Contact2, label: 'New subscription to the Club' },
    { kind: 'icon', Icon: Timer, label: 'Quick renew subscription' },
    { kind: 'icon', Icon: CheckCircle, label: 'Payment of deadlines', path: '/clubs/archive_deadlines' },
  ],
  [
    { kind: 'icon', Icon: ShoppingCart, label: 'Sell products', path: '/ArchiveSeles/product_sale_list' },
    // PHP: clubs/new_moment_cash — sell a service / cash movement
    {
      kind: 'icon',
      Icon: ShoppingBasket,
      label: 'Insert a movement of selling service',
      path: '/clubs/new_moment_cash',
    },
    { kind: 'icon', Icon: Hourglass, label: 'Payment other deadlines', path: '/clubs/archive_service_list' },
  ],
  [
    { kind: 'icon', Icon: Hourglass, label: 'Add a new credit', path: '/clubMembers/pay_member_employee' },
    // PHP: clubMembers/debt_member — create a member debt (Member debts typology)
    { kind: 'icon', Icon: Hourglass, label: 'Insert a new debit', path: '/clubMembers/debt_member' },
  ],
  [
    { kind: 'icon', Icon: ArrowUpRight, label: 'Payment expenses', path: '/clubs/new_expense' },
    { kind: 'icon', Icon: ArrowUpRight, label: 'Pay a member or an employee', path: '/clubMembers/pay_member_employee' },
  ],
  [
    { kind: 'icon', Icon: CreditCard, label: 'Card to a member' },
    { kind: 'icon', Icon: Contact2, label: 'Card for operator' },
    { kind: 'icon', Icon: ArrowLeftRight, label: 'Card replacement' },
  ],
  [
    { kind: 'icon', Icon: Paperclip, label: 'Insert a Reservation' },
    { kind: 'icon', Icon: Phone, label: 'Marketing contact' },
    { kind: 'icon', Icon: Calendar, label: 'Insert event in Agenda' },
  ],
  [
    { kind: 'assignAlert', label: 'Assign alert to an user' },
    { kind: 'icon', Icon: Clock, label: 'Track an access manually' },
    { kind: 'recordAlert', label: 'Record an alert to an user' },
    { kind: 'icon', Icon: CircleSlash, label: 'Quick door block' },
  ],
  [
    { kind: 'icon', Icon: Users, label: 'New Employee/Operator' },
    { kind: 'icon', Icon: Presentation, label: 'New Poll' },
    { kind: 'icon', Icon: Megaphone, label: 'New Advertising campaign' },
  ],
];

function renderClubAdminInsertItemLeading(item: ClubAdminInsertItem): ReactNode {
  if (item.kind === 'affiliate') {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white">
        <Shield className="h-4 w-4 opacity-95" strokeWidth={1.5} />
        <Star className="pointer-events-none absolute h-2 w-2 fill-white text-white" strokeWidth={0} />
      </span>
    );
  }
  if (item.kind === 'assignAlert') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <User className="h-3 w-3" strokeWidth={2} />
        <Radio className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  if (item.kind === 'recordAlert') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <User className="h-3 w-3" strokeWidth={2} />
        <Bell className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  const Icon = item.Icon;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />;
}

type ClubAdminArchiveItem =
  | { kind: 'icon'; Icon: LucideIcon; label: string; path: string }
  | { kind: 'affiliate'; label: string; path: string }
  | { kind: 'overview'; label: string };

const CLUB_ADMIN_ARCHIVE_GROUPS: ClubAdminArchiveItem[][] = [
  [{ kind: 'icon', Icon: Server, label: '» Overview', path: '/clubs/archive_overview' }],
  [
    { kind: 'icon', Icon: Users, label: 'Archive of Members', path: '/clubMembers/memberList'},
    { kind: 'icon', Icon: UserCog, label: 'Operators', path: '/clubs/club_operatorlist' },
    { kind: 'icon', Icon: User, label: 'Employees', path: '/clubs/archive_employees' },
  ],
  [
    { kind: 'affiliate', label: 'Affiliations', path: '/clubMembers/membership' },
    { kind: 'icon', Icon: Contact2, label: 'Subscriptions to the club', path: '/clubs/subscription' },
    { kind: 'icon', Icon: CreditCard, label: 'Accesses', path: '/clubs/access_list' },
  ],
  [
    { kind: 'icon', Icon: Hourglass, label: 'Archive of Deadlines', path: '/clubs/archive_deadlines' },
    { kind: 'icon', Icon: Award, label: 'Credit voucher', path: '/clubSettings/creditCustomer' },
    { kind: 'icon', Icon: Hourglass, label: 'Other debts', path: '/clubs/other_debts' },
    { kind: 'icon', Icon: Hourglass, label: 'Planned expenses', path: '/clubs/arc_expenses' },
  ],
  [
    { kind: 'icon', Icon: ShoppingCart, label: 'Shop/Selling of products', path: '/ArchiveSeles/product_sale_list' },
    { kind: 'icon', Icon: Users2, label: 'Archive of Memberships', path: '/clubs/memberships/archive' },
    { kind: 'icon', Icon: BookOpen, label: 'Archive of Course Subs', path: '/clubs/courses/archive' },
    { kind: 'icon', Icon: FileText, label: 'Archive of Services', path: '/clubs/archive_service_list' },
    { kind: 'icon', Icon: Receipt, label: 'Member expenses', path: '/clubs/new_expense' },
    { kind: 'icon', Icon: FileStack, label: 'Archive of Expenses', path: '/clubs/archive_expense_list' },
  ],
  [
    { kind: 'icon', Icon: CornerDownLeft, label: 'Cash In', path: '/clubs/movement_cash_details/IN' },
    { kind: 'icon', Icon: CornerDownRight, label: 'Cash Out', path: '/clubs/movement_cash_details/OUT' },
    { kind: 'icon', Icon: Repeat2, label: 'Cash (all movements)', path: '/clubs/movement_cash_details' },
  ],
  [
    { kind: 'icon', Icon: ClipboardCheck, label: 'Archive of Receipts', path: '/clubs/archive_receipts' },
  ],
  [
    { kind: 'icon', Icon: FileStack, label: 'Cards assignments', path: '/clubs/cards_assignments' },
    { kind: 'icon', Icon: FileWarning, label: 'Alert assigned', path: '/clubs/alerts_assigned' },
  ],
  [
    { kind: 'icon', Icon: Paperclip, label: 'Reservations', path: '/clubs/archive_reservations' },
    { kind: 'icon', Icon: Phone, label: 'Contacts of marketing', path: '/clubs/marketing_contacts' },
    { kind: 'icon', Icon: Calendar, label: 'Events', path: '/clubs/archive_events' },
  ],
  [
    { kind: 'icon', Icon: Presentation, label: 'Polls', path: '/clubs/archive_polls' },
    { kind: 'icon', Icon: Megaphone, label: 'Advertising campaigns', path: '/clubs/advertising_campaigns' },
    {
      kind: 'icon',
      Icon: HelpCircle,
      label: 'Queries to the staff ...',
      path: '/clubs/staff_queries'
    },
  ],
];

function renderClubAdminArchiveLeading(item: ClubAdminArchiveItem): ReactNode {
  if (item.kind === 'affiliate') {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white">
        <Shield className="h-4 w-4 opacity-95" strokeWidth={1.5} />
        <Star className="pointer-events-none absolute h-2 w-2 fill-white text-white" strokeWidth={0} />
      </span>
    );
  }
  if (item.kind === 'overview') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <Server className="h-3.5 w-3.5" strokeWidth={2} />
        <ChevronRight className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  const Icon = item.Icon;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />;
}

interface DarkSidebarProps {
  userType: string;
  entities?: any[];
  selectedEntityId?: string | null;
  onEntitySelect?: (id: string) => void;
  onMyPageClick?: () => void;
  onMyClubClick?: () => void;
  onMyTeamClick?: () => void;
  onMyGroupClick?: () => void;
  onMyCoachingGroupClick?: () => void;
  onPostsClick?: () => void;
  /** Member info → Registration info (purchased version details in dashboard). */
  onRegistrationInfoClick?: () => void;
  /** Messages → My feedbacks for Staff — swap center section (keep left/right sidebars) */
  onMyFeedbacksStaffClick?: () => void;
  /** My Club → Music for the club → Add songs & playlists (same as navbar "Add Songs") */
  onClubAddSongsPlaylistsClick?: () => void;
  /** My Club → Music for the club → Music Panel (same as navbar "Music Panel") */
  onClubMusicPanelClick?: () => void;
  /** General settings → Identification devices (card readers list in dashboard) */
  onIdentificationDevicesClick?: () => void;
  /** General settings → Access of outcome settings (dashboard panel) */
  onAccessOutcomeSettingsClick?: () => void;
  /** Communities → Suggest Movesbook (promocode invite dashboard) */
  onSuggestMovesbookClick?: () => void;
  /** My Club → SOCIAL → Chat (club broadcast channel) */
  onClubChatClick?: () => void;
  /** My Club → Club News → News (shared editorial news) */
  onClubNewsSectionClick?: () => void;
  /** My Club → Club News → Movesbook News (superadmin Global News, read-only) */
  onClubMovesbookNewsSectionClick?: () => void;
  /** My Club → Club News → OGP News (shared OGP news) */
  onClubOgpNewsSectionClick?: () => void;
  /** My Club → Club News → Club Global News (all shared) */
  onClubGlobalNewsSectionClick?: () => void;
  /** My Page → News → Movesbook News (superadmin Global News, read-only) */
  onMyPageMovesbookNewsClick?: () => void;
  /** My Page → News → News (same as top-nav MB News / news-by-movesbook) */
  onMyPageNewsClick?: () => void;
  /** My Page → News → OGP News (same as top-nav News / ?open=news) */
  onMyPageOgpNewsClick?: () => void;
  activeTab?: 'my-page' | 'my-entity';
  onTabChange?: (tab: 'my-page' | 'my-entity') => void;
  /** Fresh `users_new.image` from API (e.g. GET /api/user/profile); overrides stale localStorage. */
  profileImageFromDb?: string | null;
  /** Called after a successful profile photo upload so parents can sync banner/other UI (passes saved path — avoid immediate refetch-only sync). */
  onProfileImageSaved?: (patch: { image?: string }) => void;
  /** My clubs → Create a club (club dashboard). */
  onCreateClubClick?: () => void;
  /** Athlete My clubs → Become member (assignment flow TBD). */
  onBecomeMemberClick?: () => void;
  /** Coach My Groups trained → Create a trained group. */
  onCreateGroupTrainedClick?: () => void;
  /** Team dashboard → Create a team. */
  onCreateTeamClick?: () => void;
  /** Group dashboard → Create a group. */
  onCreateGroupClick?: () => void;
  /**
   * Club / team / group / coach dashboards: show the entity tab (My Club, My Team, …)
   * only while that workspace is open from the sidebar — hidden on My Page.
   */
  clubMyClubTabVisible?: boolean;
  /** Direct Access login: hide My Page tab; user stays on My Club only. */
  hideMyPageTab?: boolean;
  /** Club workspace: clubs list has finished loading from the API. */
  clubProfileLoaded?: boolean;
  /** Club admin — companies creatable vs already created (from subscription version). */
  creatableCompaniesQuota?: import('@/lib/club/creatableCompaniesQuota.shared').CreatableCompaniesQuota | null;
}

export default function DarkSidebar({
  userType,
  entities = [],
  selectedEntityId,
  onEntitySelect,
  onMyPageClick,
  onMyClubClick,
  onMyTeamClick,
  onMyGroupClick,
  onMyCoachingGroupClick,
  onPostsClick,
  onRegistrationInfoClick,
  onMyFeedbacksStaffClick,
  onClubAddSongsPlaylistsClick,
  onClubMusicPanelClick,
  onIdentificationDevicesClick,
  onAccessOutcomeSettingsClick,
  onSuggestMovesbookClick,
  onClubChatClick,
  onClubNewsSectionClick,
  onClubMovesbookNewsSectionClick,
  onClubOgpNewsSectionClick,
  onClubGlobalNewsSectionClick,
  onMyPageMovesbookNewsClick,
  onMyPageNewsClick,
  onMyPageOgpNewsClick,
  activeTab = 'my-page',
  onTabChange,
  profileImageFromDb,
  onProfileImageSaved,
  onCreateClubClick,
  onBecomeMemberClick,
  onCreateGroupTrainedClick,
  onCreateTeamClick,
  onCreateGroupClick,
  clubMyClubTabVisible = false,
  hideMyPageTab = false,
  clubProfileLoaded = true,
  creatableCompaniesQuota = null,
}: DarkSidebarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [allowVisiting, setAllowVisiting] = useState(true);
  const [showChangeProfilePhotoModal, setShowChangeProfilePhotoModal] = useState(false);
  const [userImageOverride, setUserImageOverride] = useState<string | null | undefined>(undefined);
  const [internalActiveTab, setInternalActiveTab] = useState<'my-page' | 'my-entity'>(activeTab);

  useEffect(() => {
    setInternalActiveTab(activeTab);
  }, [activeTab]);

  const currentTab = onTabChange ? activeTab : internalActiveTab;
  const setCurrentTab = onTabChange ? onTabChange : setInternalActiveTab;
  const showSuggestMovesbook = showSuggestMovesbookForTab(userType, currentTab);

  const [communitiesOpen, setCommunitiesOpen] = useState(false);
  const [currentClubMembersOpen, setCurrentClubMembersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [myDashboardOpen, setMyDashboardOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState({ movesbook: 0, clubs: 0, total: 0 });
  const [myFeedbackCount, setMyFeedbackCount] = useState(0);
  const [myClubsOpen, setMyClubsOpen] = useState(false);
  const [clubAdminInfoOpen, setClubAdminInfoOpen] = useState(false);
  const [memberInfoOpen, setMemberInfoOpen] = useState(false);
  const [myPageForVisitorsOpen, setMyPageForVisitorsOpen] = useState(false);
  const [bannerMenuItems, setBannerMenuItems] = useState<Array<{name: string, icon: string}>>([]);
  const [bannerCheckedItems, setBannerCheckedItems] = useState<boolean[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const token = getAuthToken();
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch('/api/messages/support?countOnly=1&mine=1', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.count === 'number') setMyFeedbackCount(data.count);
      } catch {
        /* optional */
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const token = getAuthToken();
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch('/api/notifications?countsOnly=1', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        setNotificationCounts({
          movesbook: Number(data.movesbook) || 0,
          clubs: Number(data.clubs) || 0,
          total: Number(data.total) || 0,
        });
      } catch {
        /* optional */
      }
    })();
  }, [user?.id]);

  // Load banner menu items from localStorage (saved from TopBar.tsx)
  const loadBannerItems = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedBannerItems = localStorage.getItem('topbar_banner_menu');
      const savedCheckedBanner = localStorage.getItem('topbar_checked_banner');
      
      if (savedBannerItems) {
        const items = JSON.parse(savedBannerItems);
        setBannerMenuItems(items);
      }
      
      if (savedCheckedBanner) {
        const checked = JSON.parse(savedCheckedBanner);
        setBannerCheckedItems(checked);
      }
    } catch (error) {
      console.error('Error loading banner menu items:', error);
    }
  }, []);

  // Load banner items on mount
  useEffect(() => {
    loadBannerItems();
  }, [loadBannerItems]);

  // Listen for localStorage changes and custom events to update banner items in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      // Check if the changed key is banner menu related
      if (event.key === 'topbar_banner_menu' || event.key === 'topbar_checked_banner') {
        loadBannerItems();
      }
    };

    const handleBannerMenuUpdated = (event: Event) => {
      // Update banner items immediately when custom event is received
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.items && customEvent.detail.checked) {
        // Ensure arrays have same length before updating
        if (customEvent.detail.items.length === customEvent.detail.checked.length) {
          console.log('DarkSidebar received banner update:', {
            itemCount: customEvent.detail.items.length,
            checkedCount: customEvent.detail.checked.filter(Boolean).length
          });
          setBannerMenuItems(customEvent.detail.items);
          setBannerCheckedItems(customEvent.detail.checked);
        } else {
          console.error('Banner menu update received with mismatched array lengths:', {
            itemsLength: customEvent.detail.items.length,
            checkedLength: customEvent.detail.checked.length,
            items: customEvent.detail.items.map((i: any) => i.name),
            checked: customEvent.detail.checked
          });
          // Fallback to loading from localStorage
          loadBannerItems();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bannerMenuUpdated', handleBannerMenuUpdated as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannerMenuUpdated', handleBannerMenuUpdated as EventListener);
    };
  }, [loadBannerItems]);

  const formCreatedClubs = useMemo(
    () => getFormCreatedClubsSortedByCreatedAt(entities),
    [entities]
  );
  const formCreatedEntities = useMemo(
    () => getFormCreatedEntitiesSortedByCreatedAt(entities),
    [entities]
  );
  /** Clubs this user administers (any role) — used so coach/team/group can open club website display. */
  const [administeredClubs, setAdministeredClubs] = useState<
    { id: string; name: string; description?: string | null }[]
  >([]);
  const administeredClubIds = useMemo(
    () => new Set(administeredClubs.map((c) => c.id)),
    [administeredClubs],
  );

  useEffect(() => {
    if (
      isClubAccountUserType(userType) ||
      userType === 'ATHLETE' ||
      !(
        isTeamAccountUserType(userType) ||
        isGroupAccountUserType(userType) ||
        userType === 'COACH'
      )
    ) {
      setAdministeredClubs([]);
      return;
    }
    let cancelled = false;
    const token = getAuthToken();
    if (!token) return;
    fetch('/api/clubs/my-clubs', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          clubs?: { id: string; name: string; description?: string | null }[];
        };
        if (!cancelled && Array.isArray(data.clubs)) {
          setAdministeredClubs(
            data.clubs.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description ?? null,
            })),
          );
        }
      })
      .catch(() => {
        /* picker can still use trained team/group entities */
      });
    return () => {
      cancelled = true;
    };
  }, [userType]);

  const clubsForTopicsPicker = useMemo(() => {
    if (isClubAccountUserType(userType)) {
      return formCreatedClubs as { id: string; name: string; description?: string | null }[];
    }
    if (userType === 'ATHLETE') {
      return entities as { id: string; name: string; description?: string | null }[];
    }
    if (
      isTeamAccountUserType(userType) ||
      isGroupAccountUserType(userType) ||
      userType === 'COACH'
    ) {
      const byId = new Map<string, { id: string; name: string; description?: string | null }>();
      for (const club of administeredClubs) byId.set(club.id, club);
      for (const entity of formCreatedEntities as {
        id: string;
        name: string;
        description?: string | null;
      }[]) {
        if (!byId.has(entity.id)) byId.set(entity.id, entity);
      }
      return Array.from(byId.values());
    }
    return [];
  }, [userType, formCreatedClubs, formCreatedEntities, entities, administeredClubs]);
  const clubUserHasProfile =
    !isClubAccountUserType(userType) || userHasClubProfile(entities);
  const isAthleteUser = userType === 'ATHLETE';
  const isCoachUser = userType === 'COACH';
  const isTeamManagerUser = isTeamAccountUserType(userType);
  const isGroupAdminUser = isGroupAccountUserType(userType);
  const athleteHasClubMembership = entities.length > 0;
  const isManagedEntityWorkspaceUser =
    isClubAccountUserType(userType) ||
    isTeamManagerUser ||
    isGroupAdminUser ||
    isCoachUser;
  const clubHasSelectedEntity =
    Boolean(selectedEntityId) || readSelectedClubHint();
  const showMyClubTab = isManagedEntityWorkspaceUser
    ? isClubAccountUserType(userType)
      ? clubHasSelectedEntity && currentTab === 'my-entity'
      : clubMyClubTabVisible === true
    : isAthleteUser
      ? athleteHasClubMembership
      : clubUserHasProfile;

  useEffect(() => {
    if (
      (isClubAccountUserType(userType) ||
        isAthleteUser ||
        isCoachUser ||
        isTeamManagerUser ||
        isGroupAdminUser) &&
      entities.length > 0
    ) {
      setMyClubsOpen(true);
    }
  }, [entities.length, userType, isAthleteUser, isCoachUser, isTeamManagerUser, isGroupAdminUser]);

  const [socialSettings, setSocialSettings] = useState<Record<string, unknown>>({});
  /** Personal "My channel on YouTube" — persisted on `User.youtubeChannelUrl` (API merges legacy social JSON). */
  const [userYoutubeChannelUrl, setUserYoutubeChannelUrl] = useState('');
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [clubTopicsPickerOpen, setClubTopicsPickerOpen] = useState(false);
  const [youtubeUrlDraft, setYoutubeUrlDraft] = useState('');
  const [youtubeSaveLoading, setYoutubeSaveLoading] = useState(false);
  const [clubYoutubeOverride, setClubYoutubeOverride] = useState<
    Record<string, string | null | undefined>
  >({});
  /** When `clubs_new` was empty, child can create/fetch a club and pass it here so the header has an `id`. */
  const [clubBootstrap, setClubBootstrap] = useState<{
    id: string;
    name?: string;
    description?: string | null;
    location?: string | null;
    youtubeChannelUrl?: string | null;
  } | null>(null);
  const [friendsGroupsOpen, setFriendsGroupsOpen] = useState(false);
  const [friendsOnlineOpen, setFriendsOnlineOpen] = useState(true);
  const [friendsFindOpen, setFriendsFindOpen] = useState(true);
  const [clubManagementOpen, setClubManagementOpen] = useState(false);
  const [clubCurrentOperatorsOpen, setClubCurrentOperatorsOpen] = useState(false);
  /** Live club-admin profile for Current Operators → Administrator (from /api/user/profile). */
  const [clubAdminOperatorProfile, setClubAdminOperatorProfile] = useState<{
    name: string;
    country: string | null;
    image: string | null;
  } | null>(null);
  const [clubStaffItems, setClubStaffItems] = useState<ClubStaffListItem[]>([]);
  const [accountsAndDeviceOpen, setAccountsAndDeviceOpen] = useState(false);
  const [clubAccountsSectionOpen, setClubAccountsSectionOpen] = useState(false);
  const [clubIdDevicesSectionOpen, setClubIdDevicesSectionOpen] = useState(false);
  const [clubHardwaresSectionOpen, setClubHardwaresSectionOpen] = useState(false);
  const [clubManageAccountsOpen, setClubManageAccountsOpen] = useState(false);
  const [clubAccountsYellowOpen, setClubAccountsYellowOpen] = useState(false);
  const [clubQrCodesOpen, setClubQrCodesOpen] = useState(false);
  const [clubRfidBadgesOpen, setClubRfidBadgesOpen] = useState(false);
  const [clubMagneticOpen, setClubMagneticOpen] = useState(false);
  const [clubSmartcardsOpen, setClubSmartcardsOpen] = useState(false);
  const [clubMonitoringsOpen, setClubMonitoringsOpen] = useState(false);
  const [clubAdminSubscriptionsOpen, setClubAdminSubscriptionsOpen] = useState(false);
  const [clubGeneralSettingsOpen, setClubGeneralSettingsOpen] = useState(false);
  const [clubSecurityOpen, setClubSecurityOpen] = useState(false);
  const [clubAdminInsertNewItemOpen, setClubAdminInsertNewItemOpen] = useState(false);
  const [clubArchivesOpen, setClubArchivesOpen] = useState(false);
  const [clubUserGuidesOpen, setClubUserGuidesOpen] = useState(false);
  const [clubPostsOpen, setClubPostsOpen] = useState(false);
  const [clubNewsOpen, setClubNewsOpen] = useState(false);
  const [myPageNewsOpen, setMyPageNewsOpen] = useState(false);
  const [musicForClubOpen, setMusicForClubOpen] = useState(false);
  const [clubInternetLinksOpen, setClubInternetLinksOpen] = useState(false);
  const [clubInternetMyClubsOpen, setClubInternetMyClubsOpen] = useState(true);
  const [clubInternetSocialSitesOpen, setClubInternetSocialSitesOpen] = useState(false);
  const [clubInternetFavouriteLinksOpen, setClubInternetFavouriteLinksOpen] = useState(false);
  const [movesbookLinkCopied, setMovesbookLinkCopied] = useState(false);
  const [clubMarketingOpen, setClubMarketingOpen] = useState(false);
  const [clubMarketingClubStaffOpen, setClubMarketingClubStaffOpen] = useState(false);
  const [clubMarketingCoursesOpen, setClubMarketingCoursesOpen] = useState(false);

  const sidebarProfileImageSrc = resolvePublicImageUrl(
    userImageOverride ?? profileImageFromDb ?? user?.image
  );
  const clubAdminOperatorDisplayName =
    clubAdminOperatorProfile?.name || user?.name || 'Admin';
  const clubAdminOperatorCountry =
    clubAdminOperatorProfile?.country || user?.country?.trim() || null;
  const clubAdminOperatorImageSrc = resolvePublicImageUrl(
    clubAdminOperatorProfile?.image ??
      userImageOverride ??
      profileImageFromDb ??
      user?.image,
  );
  /** When parent sends a new `users_new.image`, drop local override before paint so banner + sidebar stay in sync. */
  useLayoutEffect(() => {
    setUserImageOverride(undefined);
  }, [profileImageFromDb]);

  useEffect(() => {
    if (!clubCurrentOperatorsOpen || !user?.id) return;
    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          name?: string | null;
          firstName?: string | null;
          surname?: string | null;
          country?: string | null;
          image?: string | null;
        };
        const displayName =
          [data.firstName, data.surname].filter(Boolean).join(' ').trim() ||
          data.name?.trim() ||
          user.name ||
          'Admin';
        if (cancelled) return;
        setClubAdminOperatorProfile({
          name: displayName,
          country: data.country?.trim() || null,
          image: data.image ?? null,
        });
      } catch {
        /* optional — fall back to auth user */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clubCurrentOperatorsOpen, user?.id, user?.name]);

  useEffect(() => {
    if (!clubCurrentOperatorsOpen) return;
    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;
    const loadStaff = async () => {
      try {
        const res = await fetch(withSelectedClubId('/api/club/staff'), {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: ClubStaffListItem[] };
        if (cancelled) return;
        setClubStaffItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setClubStaffItems([]);
      }
    };
    void loadStaff();
    window.addEventListener(CLUB_STAFF_CHANGED_EVENT, loadStaff);
    return () => {
      cancelled = true;
      window.removeEventListener(CLUB_STAFF_CHANGED_EVENT, loadStaff);
    };
  }, [clubCurrentOperatorsOpen, selectedEntityId]);

  const goToClubStaffList = (preset?: 'coadmin' | 'operator' | 'collaborator') => {
    writeClubWorkspaceTab('my-entity');
    const qs = preset ? `?preset=${preset}` : '';
    router.push(`/club/staff${qs}`);
  };

  const removeClubStaff = async (staffId: string) => {
    const token = getAuthToken();
    if (!token) return;
    if (!window.confirm('Remove this club staff member?')) return;
    try {
      const res = await fetch(withSelectedClubId(`/api/club/staff/${staffId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setClubStaffItems((prev) => prev.filter((item) => item.id !== staffId));
      window.dispatchEvent(new Event(CLUB_STAFF_CHANGED_EVENT));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!clubManagementOpen) {
      setClubCurrentOperatorsOpen(false);
      setAccountsAndDeviceOpen(false);
      setClubAccountsSectionOpen(false);
      setClubIdDevicesSectionOpen(false);
      setClubHardwaresSectionOpen(false);
      setClubManageAccountsOpen(false);
      setClubAccountsYellowOpen(false);
      setClubQrCodesOpen(false);
      setClubRfidBadgesOpen(false);
      setClubMagneticOpen(false);
      setClubSmartcardsOpen(false);
      setClubMonitoringsOpen(false);
      setClubAdminSubscriptionsOpen(false);
      setClubGeneralSettingsOpen(false);
      setClubSecurityOpen(false);
      setClubAdminInsertNewItemOpen(false);
      setClubArchivesOpen(false);
      setClubUserGuidesOpen(false);
      setClubMarketingOpen(false);
      setClubMarketingClubStaffOpen(false);
      setClubMarketingCoursesOpen(false);
    }
  }, [clubManagementOpen]);

  useEffect(() => {
    if (!clubMarketingOpen) {
      setClubMarketingClubStaffOpen(false);
      setClubMarketingCoursesOpen(false);
    }
  }, [clubMarketingOpen]);

  useEffect(() => {
    if (userType !== 'CLUB') {
      setClubPostsOpen(false);
    }
  }, [userType]);

  useEffect(() => {
    if (!clubMonitoringsOpen) {
      setClubAdminSubscriptionsOpen(false);
    }
  }, [clubMonitoringsOpen]);

  useEffect(() => {
    if (!accountsAndDeviceOpen) {
      setClubAccountsSectionOpen(false);
      setClubIdDevicesSectionOpen(false);
      setClubHardwaresSectionOpen(false);
      setClubManageAccountsOpen(false);
      setClubAccountsYellowOpen(false);
      setClubQrCodesOpen(false);
      setClubRfidBadgesOpen(false);
      setClubMagneticOpen(false);
      setClubSmartcardsOpen(false);
    }
  }, [accountsAndDeviceOpen]);

  useEffect(() => {
    if (!clubIdDevicesSectionOpen) {
      setClubQrCodesOpen(false);
      setClubRfidBadgesOpen(false);
      setClubMagneticOpen(false);
      setClubSmartcardsOpen(false);
    }
  }, [clubIdDevicesSectionOpen]);

  useEffect(() => {
    if (!clubAccountsSectionOpen) {
      setClubManageAccountsOpen(false);
      setClubAccountsYellowOpen(false);
    }
  }, [clubAccountsSectionOpen]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/user/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          socialSettings?: unknown;
          youtubeChannelUrl?: string | null;
        };
        let legacyYt = '';
        const social = data.socialSettings;
        if (
          !cancelled &&
          social &&
          typeof social === 'object' &&
          !Array.isArray(social)
        ) {
          const o = social as Record<string, unknown>;
          setSocialSettings(o);
          const raw = o[YOUTUBE_CHANNEL_URL_KEY];
          if (typeof raw === 'string') legacyYt = raw.trim();
        }
        const fromUser =
          data.youtubeChannelUrl != null && String(data.youtubeChannelUrl).trim() !== ''
            ? String(data.youtubeChannelUrl).trim()
            : '';
        if (!cancelled) {
          setUserYoutubeChannelUrl(fromUser || legacyYt);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    setClubYoutubeOverride({});
  }, [selectedEntityId]);

  const friendCount = 234;
  const lastPostsCount = 11;
  const messagesCount = 0;
  const onlineCount = 0;

  useEffect(() => {
    if (clubProfileLoaded && !clubHasSelectedEntity && currentTab === 'my-entity') {
      writeClubWorkspaceTab('my-page');
      setCurrentTab('my-page');
    }
  }, [clubProfileLoaded, clubHasSelectedEntity, currentTab, setCurrentTab]);

  const savedYoutubeUrl = userYoutubeChannelUrl;

  const myPageYoutubeOpenHref = normalizeYoutubeUrlForOpen(savedYoutubeUrl);

  const openYoutubeModal = () => {
    setYoutubeUrlDraft(savedYoutubeUrl);
    setYoutubeModalOpen(true);
  };

  const openYoutubeDraftInNewTab = () => {
    const href = normalizeYoutubeUrlForOpen(youtubeUrlDraft);
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveYoutubeUrl = async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const trimmed = youtubeUrlDraft.trim();
    if (trimmed && !normalizeYoutubeUrlForOpen(trimmed)) return;
    setYoutubeSaveLoading(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ youtubeChannelUrl: trimmed || null })
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        socialSettings?: Record<string, unknown>;
        youtubeChannelUrl?: string | null;
      };
      if (data.socialSettings && typeof data.socialSettings === 'object') {
        setSocialSettings(data.socialSettings);
      }
      setUserYoutubeChannelUrl(
        data.youtubeChannelUrl != null && String(data.youtubeChannelUrl).trim() !== ''
          ? String(data.youtubeChannelUrl).trim()
          : ''
      );
      setYoutubeModalOpen(false);
    } finally {
      setYoutubeSaveLoading(false);
    }
  };

  const selectedEntity =
    entities.find((e: { id?: string }) => e.id === selectedEntityId) ?? entities[0];

  const selectedOrBootstrap =
    selectedEntity &&
    typeof selectedEntity === 'object' &&
    (selectedEntity as { id?: string }).id != null
      ? selectedEntity
      : clubBootstrap;

  const displaySelectedClub =
    selectedOrBootstrap &&
    typeof selectedOrBootstrap === 'object' &&
    (selectedOrBootstrap as { id?: string }).id != null
      ? {
          ...selectedOrBootstrap,
          youtubeChannelUrl: Object.prototype.hasOwnProperty.call(
            clubYoutubeOverride,
            (selectedOrBootstrap as { id: string }).id
          )
            ? (clubYoutubeOverride[(selectedOrBootstrap as { id: string }).id] ?? null)
            : ((selectedOrBootstrap as { youtubeChannelUrl?: string | null }).youtubeChannelUrl ??
                null)
        }
      : null;

  const clubWebsiteManage = canManageClubWebsite(
    user?.id,
    userType,
    displaySelectedClub as { id?: string; adminId?: string; admin?: { id?: string } } | null,
  );
  const movesbookWebsiteHref = clubWebsiteDisplayUrl(
    displaySelectedClub ? (displaySelectedClub as { id: string }).id : null
  );

  const openMovesbookWebsite = () => {
    window.open(movesbookWebsiteHref, '_blank', 'noopener,noreferrer');
  };

  const copyMovesbookWebsiteLink = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${movesbookWebsiteHref}`
        : movesbookWebsiteHref;
    try {
      await navigator.clipboard.writeText(url);
      setMovesbookLinkCopied(true);
      window.setTimeout(() => setMovesbookLinkCopied(false), 2000);
    } catch {
      window.prompt(t('sidebar_club_get_link'), url);
    }
  };

  useEffect(() => {
    if (
      selectedEntity &&
      typeof selectedEntity === 'object' &&
      (selectedEntity as { id?: string }).id != null &&
      clubBootstrap?.id === (selectedEntity as { id: string }).id
    ) {
      setClubBootstrap(null);
    }
  }, [selectedEntity, clubBootstrap?.id]);

  const handleClubYoutubeSaved = (clubId: string, url: string | null) => {
    setClubYoutubeOverride((prev) => ({ ...prev, [clubId]: url }));
  };

  const handleClubBootstrapped = useCallback((club: {
    id: string;
    name?: string;
    youtubeChannelUrl?: string | null;
  }) => {
    setClubBootstrap({
      id: club.id,
      name: club.name ?? 'Club',
      description: null,
      location: null,
      youtubeChannelUrl: club.youtubeChannelUrl ?? null
    });
  }, []);

  /** Club dashboard + athlete dashboard: "My Club" tab replaces legacy profile strip with club header + primary menus. */
  const showClubMyEntityTop =
    currentTab === 'my-entity' &&
    (userType === 'ATHLETE' ||
      (isClubAccountUserType(userType) &&
        formCreatedClubs.length > 0 &&
        clubHasSelectedEntity));

  const handleMyPage = () => {
    router.push('/privacy');
  };

  const handleMyClub = () => {
    router.push('/privacy');
  };

  const handleMyTeam = () => {
    if (onMyTeamClick) {
      onMyTeamClick();
    } else if (selectedEntityId) {
      router.push(`/my-team?teamId=${selectedEntityId}`);
    } else if (entities.length > 0) {
      router.push(`/my-team?teamId=${entities[0].id}`);
    } else {
      router.push('/my-page');
    }
  };

  const handleMyGroup = () => {
    if (onMyGroupClick) {
      onMyGroupClick();
    } else if (selectedEntityId) {
      router.push(`/my-group?groupId=${selectedEntityId}`);
    } else if (entities.length > 0) {
      router.push(`/my-group?groupId=${entities[0].id}`);
    } else {
      router.push('/my-page');
    }
  };

  const handleMyCoachingGroup = () => {
    if (onMyCoachingGroupClick) {
      onMyCoachingGroupClick();
    } else if (selectedEntityId) {
      router.push(`/my-coaching-group?groupId=${selectedEntityId}`);
    } else if (entities.length > 0) {
      router.push(`/my-coaching-group?groupId=${entities[0].id}`);
    } else {
      router.push('/my-page');
    }
  };

  const handleMyPageTab = () => {
    if (hideMyPageTab) return;
    writeClubWorkspaceTab('my-page');
    setCurrentTab('my-page');
    if (onMyPageClick) {
      onMyPageClick();
    } else {
      router.push('/my-page');
    }
  };

  const handleSuggestMovesbookClick = () => {
    if (onSuggestMovesbookClick) {
      onSuggestMovesbookClick();
      return;
    }
    router.push('/users/notification_by_promocode');
  };

  const handleMyEntityTab = () => {
    if (
      (isClubAccountUserType(userType) ||
        isCoachUser ||
        isAthleteUser ||
        isTeamManagerUser ||
        isGroupAdminUser) &&
      !showMyClubTab
    ) {
      return;
    }

    writeClubWorkspaceTab('my-entity');
    setCurrentTab('my-entity');

    if (isClubAccountUserType(userType)) {
      onMyClubClick?.();
      return;
    }

    if (isTeamManagerUser && onMyTeamClick) {
      onMyTeamClick();
    } else if (isGroupAdminUser && onMyGroupClick) {
      onMyGroupClick();
    } else if (userType === 'COACH' && onMyCoachingGroupClick) {
      onMyCoachingGroupClick();
    } else if (userType === 'ATHLETE' && onMyClubClick) {
      onMyClubClick();
    } else {
      // Default behavior - just change tab without navigation
      // The tab change is already handled by setCurrentTab above
    }
  };

  const handleMyPageClubSelect = useCallback(
    (clubId: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedClub', clubId);
        writeClubWorkspaceTab('my-entity');
      }
      onEntitySelect?.(clubId);
      setCurrentTab('my-entity');
      if (isClubAccountUserType(userType) || isAthleteUser) {
        onMyClubClick?.();
      }
    },
    [onEntitySelect, setCurrentTab, userType, isAthleteUser, onMyClubClick]
  );

  /**
   * "My Topics" picker — after picking an entity, open topics DISPLAY
   * (never the settings editor). Real clubs → club website display;
   * team/group/trained entities → personal My Topics display.
   */
  const handleClubSelectedForTopics = useCallback(
    (entityId: string) => {
      setClubTopicsPickerOpen(false);

      const isClubOrAthlete =
        isClubAccountUserType(userType) || userType === 'ATHLETE';
      const isAdministeredClub = administeredClubIds.has(entityId);

      if (isClubOrAthlete || isAdministeredClub) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedClub', entityId);
        }
        writeClubWorkspaceTab('my-entity');
        onEntitySelect?.(entityId);
        setCurrentTab('my-entity');
        requestOpenClubTopicsSection();
        router.push(clubWebsiteDisplayUrl(entityId));
        return;
      }

      // Team / group / coach trained entity — personal topics display (not settings).
      // Never store a non-club id in selectedClub (avoids wrong page after switch).
      writeClubWorkspaceTab('my-page');
      onEntitySelect?.(entityId);
      setCurrentTab('my-page');
      requestOpenPersonalTopicsSection();
      router.push(`${PERSONAL_WEBSITE_TOPICS_PATH}/display`);
    },
    [onEntitySelect, setCurrentTab, router, userType, administeredClubIds]
  );

  const openMyTopicsClubPicker = useCallback(() => {
    if (clubsForTopicsPicker.length === 1) {
      handleClubSelectedForTopics(clubsForTopicsPicker[0]!.id);
      return;
    }
    setClubTopicsPickerOpen(true);
  }, [clubsForTopicsPicker, handleClubSelectedForTopics]);

  const getEntityLabel = () => {
    if (isClubAccountUserType(userType)) return t('sidebar_my_club');
    if (isTeamManagerUser) return t('sidebar_my_team');
    if (isGroupAdminUser) return t('sidebar_my_group');
    if (userType === 'COACH') return t('sidebar_trained_group');
    // For athletes and other users, show "My Club" as default
    return t('sidebar_my_club');
  };

  const renderFriendsAndCommunitiesMenus = ({ showEvents = false }: { showEvents?: boolean } = {}) => (
    <>
      <div className="border-b border-teal-700">
        <div className="flex w-full items-stretch bg-teal-800 text-white">
          <button
            type="button"
            onClick={() => setFriendsOpen((v) => !v)}
            aria-expanded={friendsOpen}
            className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
          >
            <Users className="w-5 h-5 shrink-0" />
            <span className="font-semibold tracking-wide truncate">{t('sidebar_friends_title')}</span>
          </button>
          {friendsOpen && (
            <button
              type="button"
              className="shrink-0 self-stretch px-2 text-xs font-normal text-white/95 hover:bg-teal-700 hover:underline flex items-center"
            >
              {t('sidebar_friends_view_all')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFriendsOpen((v) => !v)}
            aria-label={friendsOpen ? t('collapse') : t('expand')}
            className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
          >
            <ChevronDown
              className={`w-4 h-4 opacity-80 transition-transform duration-200 ${friendsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {friendsOpen && (
          <div className="bg-[#e5e7eb] text-gray-800 max-h-[min(70vh,520px)] overflow-y-auto border-t border-teal-900/40">
            <div className="px-3 pt-3 pb-2 text-xs text-gray-700">
              {t('sidebar_friends_has_friends')
                .replace('{name}', user?.name || 'User')
                .replace('{count}', String(friendCount))}
            </div>

            <div className="px-3 pb-3">
              <div className="relative flex items-center bg-white rounded border border-gray-300 shadow-sm">
                <input
                  type="search"
                  placeholder={t('sidebar_friends_search_placeholder')}
                  className="w-full pl-2 pr-9 py-2 text-xs text-gray-800 placeholder:text-gray-400 rounded border-0 bg-transparent focus:ring-0 focus:outline-none"
                  aria-label={t('sidebar_friends_search_placeholder')}
                />
                <Search className="absolute right-2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="px-3 space-y-0 border-t border-gray-300/80">
              <div className="flex items-center justify-between py-2.5 border-b border-gray-300/90 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Newspaper className="w-4 h-4 text-gray-600 shrink-0" />
                  <span className="truncate">{t('sidebar_friends_last_posts')}</span>
                </div>
                <span className="shrink-0 ml-2 min-w-[1.5rem] h-5 flex items-center justify-center rounded-sm bg-sky-300 text-white text-[11px] font-semibold px-1">
                  {lastPostsCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-gray-600 shrink-0" />
                  <span className="truncate">{t('sidebar_friends_messages_from')}</span>
                </div>
                <span className="shrink-0 ml-2 min-w-[1.5rem] h-5 flex items-center justify-center rounded-sm bg-sky-300 text-white text-[11px] font-semibold px-1">
                  {messagesCount}
                </span>
              </div>
            </div>

            <div className="mt-1 border-t border-gray-400/50">
              <button
                type="button"
                onClick={() => setFriendsGroupsOpen((v) => !v)}
                className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2"
              >
                <span>{t('sidebar_friends_groups_of_friends')}</span>
                <span className="text-[10px] font-normal">{t('sidebar_friends_view_all')}</span>
              </button>
              {friendsGroupsOpen && (
                <div className="bg-[#e5e7eb] px-3 py-3 text-xs text-gray-600 border-b border-gray-400/40">
                  {t('sidebar_friends_groups_empty')}
                </div>
              )}

              <button
                type="button"
                onClick={() => setFriendsOnlineOpen((v) => !v)}
                className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2 border-t border-gray-500/30"
              >
                <span className="flex items-center gap-2">
                  {t('sidebar_friends_online_friends')}
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-emerald-500 text-[10px] font-bold px-1">
                    {onlineCount}
                  </span>
                </span>
                <span className="text-[10px] font-normal">{t('sidebar_friends_view_all_caps')}</span>
              </button>
              {friendsOnlineOpen && (
                <div className="bg-[#e5e7eb] px-3 py-6 text-center text-xs text-gray-600 border-b border-gray-400/40">
                  {t('sidebar_friends_no_users_online')}
                </div>
              )}

              <div className="border-t border-gray-500/30">
                <button
                  type="button"
                  onClick={() => setFriendsFindOpen((v) => !v)}
                  className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2"
                >
                  <span>{t('sidebar_friends_find_new')}</span>
                  <X className="w-4 h-4 text-white/90" />
                </button>
                {friendsFindOpen && (
                  <div className="bg-[#e5e7eb] px-3 pb-10 pt-2 text-xs relative border-b border-gray-400/40">
                    <p className="text-gray-700 mb-2 text-center">
                      {t('sidebar_friends_find_greeting').replace(
                        '{name}',
                        (user?.name || 'User').split(/\\s+/)[0] || 'User'
                      )}
                    </p>
                    <p className="text-red-600 font-medium leading-snug mb-3 text-center">
                      {t('sidebar_friends_find_line1')}
                      <br />
                      {t('sidebar_friends_find_line2')}
                    </p>
                    <input
                      type="text"
                      className="w-full mb-2 px-2 py-2 text-xs border border-gray-300 rounded bg-white text-gray-800 shadow-sm"
                      aria-label={t('sidebar_filter_option')}
                    />
                    <button
                      type="button"
                      className="w-full py-2.5 rounded text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 transition-colors"
                    >
                      {t('sidebar_filter_option')}
                    </button>
                    <button type="button" className="mt-2 w-full text-center text-red-600 hover:underline text-[11px]">
                      {t('sidebar_friends_see_invites_credits')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-teal-700">
        <button
          type="button"
          onClick={() => setCommunitiesOpen((v) => !v)}
          aria-expanded={communitiesOpen}
          className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5" />
            <span>Communities</span>
          </div>
          <ChevronDown className={`w-4 h-4 opacity-80 transition-transform ${communitiesOpen ? 'rotate-180' : ''}`} />
        </button>

        {communitiesOpen && (
          <div className="bg-gray-800 text-white">
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-300" />
                <span className="text-sm">Sharing friends</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
            </button>

            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-300" />
                <span className="text-sm">My Coaches</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
            </button>

            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-300" />
                <span className="text-sm">My teams</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
            </button>

            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-300" />
                <span className="text-sm">My Groups</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
            </button>

            <div className="border-t border-gray-700">
              <button
                type="button"
                onClick={() => setCurrentClubMembersOpen((v) => !v)}
                aria-expanded={currentClubMembersOpen}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm text-gray-200">Current Club&apos;s member list</span>
                <ChevronDown
                  className={`w-4 h-4 opacity-70 transition-transform ${currentClubMembersOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {currentClubMembersOpen && (
                <div className="bg-[#e5e7eb] px-3 py-6 text-center text-xs text-gray-600 border-t border-gray-400/40">
                  Member list UI
                </div>
              )}
            </div>

            <div className="py-3 bg-gray-850 border-t border-gray-700">
              {showSuggestMovesbook ? (
                <button
                  type="button"
                  onClick={handleSuggestMovesbookClick}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded text-sm font-medium transition-colors"
                >
                  Suggest Movesbook to your friends
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {showEvents && (
        <div className="border-b border-teal-700">
          <div className="bg-[#374151] text-white px-3 py-2 text-xs font-bold tracking-wide flex items-center gap-2 border-t border-black/20">
            <CalendarDays className="w-4 h-4" />
            <span>EVENTS</span>
          </div>
          <div className="bg-[#2f3640] border-t border-black/20 px-3 py-3">
            <div className="w-full bg-teal-600 text-white text-xs font-bold py-1.5 px-2 flex items-center justify-between">
              <span className="opacity-90">◀</span>
              <span>August 2014</span>
              <span className="opacity-90">▶</span>
            </div>
            <div className="bg-white text-gray-700 text-[10px]">
              <div className="grid grid-cols-7 border-b border-gray-300">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => (
                  <div key={d} className="py-1 text-center border-r border-gray-200 last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {[
                  '', '', '', '', '1', '2', '3',
                  '4', '5', '6', '7', '8', '9', '10',
                  '11', '12', '13', '14', '15', '16', '17',
                  '18', '19', '20', '21', '22', '23', '24',
                  '25', '26', '27', '28', '29', '30', '31',
                ].map((v, idx) => (
                  <div
                    key={idx}
                    className={`h-7 flex items-center justify-center border-r border-b border-gray-200 last:border-r-0 ${
                      v === '20' ? 'bg-teal-600 text-white font-semibold' : ''
                    }`}
                  >
                    {v}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const youtubeDraftValid =
    !youtubeUrlDraft.trim() || !!normalizeYoutubeUrlForOpen(youtubeUrlDraft);

  return (
    <>
    <div className="w-full h-full bg-gray-900 text-white flex flex-col overflow-hidden" style={{ width: '320px' }}>
      {/* Tab Navigation — club accounts: My Club tab only while a sidebar club workspace is open */}
      <div className="flex flex-shrink-0 border-b border-gray-700 bg-gray-900">
        {!hideMyPageTab && (
          <button
            onClick={handleMyPageTab}
            className={`${showMyClubTab ? 'flex-1' : 'w-full'} py-3 px-4 text-center font-medium transition-colors ${
              currentTab === 'my-page'
                ? 'bg-gray-700 text-white border-b-2 border-yellow-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-750 hover:text-white'
            }`}
          >
            {t('sidebar_my_page')}
          </button>
        )}
        {(showMyClubTab || hideMyPageTab) && (
          <button
            onClick={handleMyEntityTab}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              currentTab === 'my-entity'
                ? 'bg-gray-700 text-white border-b-2 border-yellow-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-750 hover:text-white'
            }`}
          >
            {getEntityLabel()}
          </button>
        )}
      </div>

      {/* Top: club accounts on "My Club" = club header + logo/details + primary menus; else legacy profile strip */}
      {showClubMyEntityTop ? (
        <SidebarClubMyEntityTop
          personName={user?.name || 'User'}
          club={displaySelectedClub ?? null}
          userCountry={user?.country}
          userImageUrl={userImageOverride ?? user?.image}
          userType={userType}
          onClubYoutubeSaved={handleClubYoutubeSaved}
          onClubBootstrapped={handleClubBootstrapped}
          onChangeLogo={() => setShowChangeProfilePhotoModal(true)}
          onChatClick={onClubChatClick}
        />
      ) : (
        <div className="bg-gray-800 p-3 flex-shrink-0">
          {/* Header Bar - Compact */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
            <button className="text-white hover:text-yellow-400 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{t('sidebar_status')}</span>
              <span className="text-xs text-green-400">{t('sidebar_online')}</span>
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            </div>
            <button className="text-gray-400 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Identity - Compact */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-white text-sm font-medium truncate">{user?.name || 'User'}</span>
          </div>

          {/* Profile Picture — `users_new.image` via API + local override after upload */}
          <div className="mb-2">
            <div className="w-20 h-20 bg-gray-700 rounded-lg mb-1 overflow-hidden flex items-center justify-center relative border border-gray-600/60">
              {sidebarProfileImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={sidebarProfileImageSrc}
                  src={sidebarProfileImageSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <UserCircle className="w-12 h-12 text-gray-500" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowChangeProfilePhotoModal(true)}
              className="text-white text-xs hover:text-yellow-400 transition-colors"
            >
              {t('sidebar_change_photo')}
            </button>
          </div>

          {/* User Details - Compact Single Line */}
          <div className="space-y-1 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-300">{t('sidebar_username')}:</span>
              <span className="text-yellow-400">{user?.username || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-300">{t('sidebar_age')}:</span>
              <span className="text-yellow-400">32</span>
              <span className="text-gray-300 ml-1">•</span>
              <span className="text-gray-300">American football</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-300">{t('sidebar_city')}:</span>
              <span className="text-yellow-400">Turku</span>
              <span className="text-gray-300 ml-1">•</span>
              <span className="text-gray-300">Finland</span>
            </div>
          </div>

          {/* Privacy Setting - Compact */}
          <div className="flex items-center gap-1.5 mb-2">
            <input
              type="checkbox"
              checked={allowVisiting}
              onChange={(e) => setAllowVisiting(e.target.checked)}
              className="w-3 h-3 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-white text-xs">{t('sidebar_allow_visiting')}</span>
          </div>

          <MubSidebarBar variant="compact" />

          {/* Visitor Tracking - Compact */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-1.5 text-white text-xs">
              <UserCircle className="w-3 h-3 text-gray-400" />
              <ArrowLeft className="w-3 h-3 text-gray-400" />
              <span className="truncate">{t('sidebar_users_visited_my_pages')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white text-xs">
              <span>{t('sidebar_users_visited')}</span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <UserCircle className="w-3 h-3 text-gray-400" />
            </div>
          </div>

          {/* Social Network Integration - Compact */}
          <div className="mb-2">
            <span className="text-white text-xs block mb-1">{t('sidebar_social_networks')}</span>
            <div className="flex items-center gap-2">
              <button className="text-blue-400 hover:text-blue-300 transition-colors">
                <Twitter className="w-4 h-4" />
              </button>
              <button className="text-blue-500 hover:text-blue-400 transition-colors">
                <Facebook className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Comments Section - Compact */}
          <div className="text-gray-500 text-xs">{t('sidebar_comments')}</div>
        </div>
      )}

      <ChangeProfilePhotoModal
        isOpen={showChangeProfilePhotoModal}
        onClose={() => setShowChangeProfilePhotoModal(false)}
        onSaved={(patch) => {
          if (patch.image !== undefined) {
            setUserImageOverride(patch.image);
            try {
              if (typeof window !== 'undefined') {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const parsed = JSON.parse(raw) as Record<string, unknown>;
                  parsed.image = patch.image;
                  localStorage.setItem('user', JSON.stringify(parsed));
                }
              }
            } catch {
              // ignore localStorage issues
            }
            onProfileImageSaved?.({ image: patch.image });
          }
        }}
        currentImagePath={userImageOverride ?? profileImageFromDb ?? user?.image}
        t={t}
      />

      {/* Bottom Section - Navigation Menu */}
      <div className="bg-teal-900 flex-1 min-h-0" style={{ overflowY: 'visible', maxHeight: 'none' }}>
        {/* Conditional Menu Based on Active Tab */}
        {currentTab === 'my-page' ? (
          <>
            {/* My Page menu (legacy-style) */}
            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setMyClubsOpen((v) => !v)}
                  aria-expanded={myClubsOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition-colors hover:bg-teal-700"
                >
                  <Mail className="h-5 w-5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                      {isCoachUser
                        ? t('sidebar_my_groups_trained')
                        : isTeamManagerUser
                          ? t('sidebar_my_teams')
                          : isGroupAdminUser
                            ? t('sidebar_my_group')
                            : t('sidebar_my_clubs')}
                    </span>
                    {isClubAccountUserType(userType) && creatableCompaniesQuota ? (
                      <span className="text-[11px] font-semibold normal-case text-yellow-300">
                        {formatCreatableCompaniesSidebarLabel(creatableCompaniesQuota)}
                      </span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMyClubsOpen((v) => !v)}
                  aria-label={myClubsOpen ? t('collapse') : t('expand')}
                  className="flex shrink-0 items-center border-l border-teal-700/40 px-4 transition-colors hover:bg-teal-700"
                >
                  <ChevronDown
                    className={`h-4 w-4 opacity-80 transition-transform duration-200 ${myClubsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {myClubsOpen && isClubAccountUserType(userType) && (
                <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onCreateClubClick?.()}
                    disabled={creatableCompaniesQuota ? !creatableCompaniesQuota.canCreate : false}
                    className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-red-500 disabled:hover:to-red-700"
                  >
                    Create a club
                  </button>
                  {formCreatedClubs.length > 0 && (
                    <>
                      <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                      <ul className="mt-3 space-y-1">
                        {formCreatedClubs.map((club: { id: string; name: string; description?: string | null }) => {
                          const label = formatMyClubsSidebarLabel(club);
                          const isSelected = selectedEntityId === club.id;
                          return (
                            <li key={club.id}>
                              <button
                                type="button"
                                onClick={() => handleMyPageClubSelect(club.id)}
                                className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
                                  isSelected ? 'bg-zinc-700/60' : ''
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
                    <MyPageTopicsEntryRow onOpenClubPicker={openMyTopicsClubPicker} />
                  </div>
                </div>
              )}
              {myClubsOpen && isAthleteUser && (
                <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onBecomeMemberClick?.()}
                    className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
                  >
                    {t('my_clubs_become_member')}
                  </button>
                  {entities.length > 0 && (
                    <>
                      <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                      <ul className="mt-3 space-y-1">
                        {entities.map((club: { id: string; name: string }) => {
                          const isSelected = selectedEntityId === club.id;
                          return (
                            <li key={club.id}>
                              <button
                                type="button"
                                onClick={() => handleMyPageClubSelect(club.id)}
                                className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
                                  isSelected ? 'bg-zinc-700/60' : ''
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate leading-snug">
                                  {club.name?.trim() || 'Club'}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
                    <MyPageTopicsEntryRow onOpenClubPicker={openMyTopicsClubPicker} />
                  </div>
                </div>
              )}
              {myClubsOpen && isCoachUser && (
                <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onCreateGroupTrainedClick?.()}
                    className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
                  >
                    {t('create_group_trained')}
                  </button>
                  {formCreatedEntities.length > 0 && (
                    <>
                      <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                      <ul className="mt-3 space-y-1">
                        {formCreatedEntities.map(
                          (group: { id: string; name: string; description?: string | null }) => {
                          const isSelected = selectedEntityId === group.id;
                          const label = formatEntitySidebarLabel(group);
                          return (
                            <li key={group.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  onEntitySelect?.(group.id);
                                  setCurrentTab('my-entity');
                                }}
                                className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
                                  isSelected ? 'bg-zinc-700/60' : ''
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                              </button>
                            </li>
                          );
                        },
                        )}
                      </ul>
                    </>
                  )}
                  <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
                    <MyPageTopicsEntryRow onOpenClubPicker={openMyTopicsClubPicker} />
                  </div>
                </div>
              )}
              {myClubsOpen && isTeamManagerUser && (
                <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onCreateTeamClick?.()}
                    className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
                  >
                    Create a team
                  </button>
                  {formCreatedEntities.length > 0 ? (
                    <>
                      <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                      <ul className="mt-3 space-y-1">
                        {formCreatedEntities.map(
                          (team: { id: string; name: string; description?: string | null }) => {
                          const isSelected = selectedEntityId === team.id;
                          const label = formatEntitySidebarLabel(team);
                          return (
                            <li key={team.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  onEntitySelect?.(team.id);
                                  setCurrentTab('my-entity');
                                }}
                                className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
                                  isSelected ? 'bg-zinc-700/60' : ''
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                              </button>
                            </li>
                          );
                        },
                        )}
                      </ul>
                    </>
                  ) : null}
                  <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
                    <MyPageTopicsEntryRow onOpenClubPicker={openMyTopicsClubPicker} />
                  </div>
                </div>
              )}
              {myClubsOpen && isGroupAdminUser && (
                <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onCreateGroupClick?.()}
                    className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
                  >
                    Create a group
                  </button>
                  {formCreatedEntities.length > 0 && (
                    <>
                      <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                      <ul className="mt-3 space-y-1">
                        {formCreatedEntities.map(
                          (group: { id: string; name: string; description?: string | null }) => {
                          const isSelected = selectedEntityId === group.id;
                          const label = formatEntitySidebarLabel(group);
                          return (
                            <li key={group.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  onEntitySelect?.(group.id);
                                  setCurrentTab('my-entity');
                                }}
                                className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
                                  isSelected ? 'bg-zinc-700/60' : ''
                                }`}
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                              </button>
                            </li>
                          );
                        },
                        )}
                      </ul>
                    </>
                  )}
                  <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
                    <MyPageTopicsEntryRow onOpenClubPicker={openMyTopicsClubPicker} />
                  </div>
                </div>
              )}
            </div>

            <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-5 h-5" />
                <span>Main Toolbar</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            {isClubAccountUserType(userType) ? (
              <div className="border-b border-teal-700">
                <div className="flex w-full items-stretch bg-teal-800 text-white">
                  <button
                    type="button"
                    onClick={() => setClubAdminInfoOpen((v) => !v)}
                    aria-expanded={clubAdminInfoOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition-colors hover:bg-teal-700"
                  >
                    <UserCircle className="h-5 w-5 shrink-0" />
                    <span>Club admin info</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClubAdminInfoOpen((v) => !v)}
                    aria-label={clubAdminInfoOpen ? t('collapse') : t('expand')}
                    className="flex shrink-0 items-center border-l border-teal-700/40 px-4 transition-colors hover:bg-teal-700"
                  >
                    <ChevronDown
                      className={`h-4 w-4 opacity-80 transition-transform duration-200 ${clubAdminInfoOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
                {clubAdminInfoOpen && (
                  <div className="border-t border-teal-900/40 bg-[#2d2d2d] text-sm text-white">
                    <button
                      type="button"
                      onClick={() => router.push('/profile#admin-info')}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90"
                    >
                      <UserCircle className="h-4 w-4 shrink-0 opacity-90" />
                      <span>Club Admin profile</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-b border-teal-700">
                <div className="flex w-full items-stretch bg-teal-800 text-white">
                  <button
                    type="button"
                    onClick={() => setMemberInfoOpen((v) => !v)}
                    aria-expanded={memberInfoOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition-colors hover:bg-teal-700"
                  >
                    <UserCircle className="h-5 w-5 shrink-0" />
                    <span>Member info</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberInfoOpen((v) => !v)}
                    aria-label={memberInfoOpen ? t('collapse') : t('expand')}
                    className="flex shrink-0 items-center border-l border-teal-700/40 px-4 transition-colors hover:bg-teal-700"
                  >
                    <ChevronDown
                      className={`h-4 w-4 opacity-80 transition-transform duration-200 ${memberInfoOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
                {memberInfoOpen && (
                  <div className="border-t border-teal-900/40 bg-[#2d2d2d] text-sm text-white">
                    <button
                      type="button"
                      onClick={() => {
                        if (onRegistrationInfoClick) {
                          onRegistrationInfoClick();
                        } else {
                          router.push('/profile#member-registration-info');
                        }
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90"
                    >
                      <ClipboardList className="h-4 w-4 shrink-0 opacity-90" />
                      <span>Registration info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/profile#member-info')}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90 border-t border-black/25"
                    >
                      <UserCircle className="h-4 w-4 shrink-0 opacity-90" />
                      <span>Member info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/profile#member-profile')}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90 border-t border-black/25"
                    >
                      <UserCircle className="h-4 w-4 shrink-0 opacity-90" />
                      <span>User Profile</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setMyPageForVisitorsOpen((v) => !v)}
                  aria-expanded={myPageForVisitorsOpen}
                  className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
                >
                  <Eye className="w-5 h-5 shrink-0" />
                  <span className="truncate">My page for visitors</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMyPageForVisitorsOpen((v) => !v)}
                  aria-label={myPageForVisitorsOpen ? 'Collapse' : 'Expand'}
                  className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                >
                  <ChevronDown
                    className={`w-4 h-4 opacity-80 transition-transform duration-200 ${myPageForVisitorsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {myPageForVisitorsOpen && bannerMenuItems.length > 0 && (
                <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40">
                  {/* Banner menu items selected in TopBar */}
                  {bannerMenuItems.map((item, index) => {
                    // Safety check: ensure checked items array has this index
                    const isChecked = index < bannerCheckedItems.length ? bannerCheckedItems[index] : false;
                    
                    // Only show checked/selected items
                    if (isChecked) {
                      return (
                        <div 
                          key={index}
                          className="flex items-center gap-3 px-4 py-2.5 border-t border-black/25 hover:bg-zinc-700/90 transition-colors"
                        >
                          <span className="text-sm">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                      );
                    }
                    return null;
                  }).filter(Boolean)}
                  
                  {/* Show message if no items are selected */}
                  {bannerMenuItems.filter((_, index) => 
                    index < bannerCheckedItems.length ? bannerCheckedItems[index] : false
                  ).length === 0 && (
                    <div className="px-4 py-3 text-gray-400 text-sm italic">
                      No items selected in Banner menu
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setMyDashboardOpen((v) => !v)}
                  aria-expanded={myDashboardOpen}
                  className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
                >
                  <Mail className="w-5 h-5 shrink-0" />
                  <span className="truncate">{t('sidebar_my_dashboard_menu')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMyDashboardOpen((v) => !v)}
                  aria-label={myDashboardOpen ? t('collapse') : t('expand')}
                  className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                >
                  <ChevronDown
                    className={`w-4 h-4 opacity-80 transition-transform duration-200 ${myDashboardOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {myDashboardOpen && (
                <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40">
                  <div className="flex w-full items-stretch border-b border-black/25 min-h-[44px]">
                    <button
                      type="button"
                      onClick={() => router.push('/users/my_desk_list')}
                      className="flex flex-1 items-center gap-2 min-w-0 px-4 py-2.5 text-left hover:bg-zinc-700/90 transition-colors"
                    >
                      <ClipboardList className="w-4 h-4 shrink-0 opacity-90" />
                      <span className="truncate">{t('dashboard_my_desk')}</span>
                    </button>
                    <button
                      type="button"
                      title={t('sidebar_my_desk_settings_aria')}
                      aria-label={t('sidebar_my_desk_settings_aria')}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/users/my_desk');
                      }}
                      className="shrink-0 px-3 flex items-center hover:bg-zinc-700/90 border-l border-black/25 text-gray-300"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  {userOwnsMovesbookWebsite(userType) ? (
                    <PersonalMyTopicsSidebarBlock userId={user?.id} canManage />
                  ) : null}
                  <div className="flex w-full items-stretch min-h-[44px]">
                    {myPageYoutubeOpenHref ? (
                      <a
                        href={myPageYoutubeOpenHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left text-white no-underline transition-colors hover:bg-zinc-700/90"
                      >
                        <Youtube className="w-4 h-4 shrink-0 opacity-90" />
                        <span className="truncate">{t('sidebar_my_youtube_channel')}</span>
                      </a>
                    ) : (
                      <span
                        className="flex min-w-0 flex-1 cursor-default items-center gap-2 px-4 py-2.5 text-left text-white/50"
                        title={t('sidebar_youtube_row_empty_hint')}
                        role="note"
                      >
                        <Youtube className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate">{t('sidebar_my_youtube_channel')}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      title={t('sidebar_youtube_channel_settings_aria')}
                      aria-label={t('sidebar_youtube_channel_settings_aria')}
                      onClick={(e) => {
                        e.stopPropagation();
                        openYoutubeModal();
                      }}
                      className="shrink-0 px-3 flex items-center hover:bg-zinc-700/90 border-l border-black/25 text-gray-300"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
              <div className="flex items-center gap-3">
                <List className="w-5 h-5" />
                <span>My Lists</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5" />
                <span>My Music</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  aria-expanded={notificationsOpen}
                  className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
                >
                  <Mail className="w-5 h-5 shrink-0" />
                  <span className="truncate">Notifications({notificationCounts.total})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  aria-label={notificationsOpen ? t('collapse') : t('expand')}
                  className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                >
                  <ChevronDown
                    className={`w-4 h-4 opacity-80 transition-transform duration-200 ${notificationsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {notificationsOpen && (
                <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40 px-3 py-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => router.push('/users/notification/all/all/movesbook')}
                    className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                  >
                    <Bell className="h-4 w-4 shrink-0 opacity-95" />
                    <span className="leading-snug">
                      Notifications from movesbook staff ({notificationCounts.movesbook})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isClubAccountUserType(userType)) {
                        const qs = selectedEntityId
                          ? `?clubId=${encodeURIComponent(selectedEntityId)}`
                          : '';
                        router.push(`/users/clubnotification${qs}`);
                        return;
                      }
                      if (userType === 'COACH') {
                        const qs = selectedEntityId
                          ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                          : '';
                        router.push(`/users/coachnotification${qs}`);
                        return;
                      }
                      if (isTeamAccountUserType(userType)) {
                        const qs = selectedEntityId
                          ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                          : '';
                        router.push(`/users/teamnotification${qs}`);
                        return;
                      }
                      if (isGroupAccountUserType(userType)) {
                        const qs = selectedEntityId
                          ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                          : '';
                        router.push(`/users/groupnotification${qs}`);
                        return;
                      }
                      router.push('/users/notification/all/all/clubs');
                    }}
                    className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 opacity-95" />
                    <span className="leading-snug">
                      {isClubAccountUserType(userType)
                        ? 'Notifications from club staff'
                        : userType === 'COACH'
                          ? 'Send / Coach notifies'
                          : isTeamAccountUserType(userType)
                            ? 'Send / Team notifies'
                            : isGroupAccountUserType(userType)
                              ? 'Send / Group notifies'
                              : `Notifications from club staff (${notificationCounts.clubs})`}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setMessagesOpen((v) => !v)}
                  aria-expanded={messagesOpen}
                  className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 shrink-0" />
                  <span className="truncate">Messages</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessagesOpen((v) => !v)}
                  aria-label={messagesOpen ? t('collapse') : t('expand')}
                  className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                >
                  <ChevronDown
                    className={`w-4 h-4 opacity-80 transition-transform duration-200 ${messagesOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {messagesOpen && (
                <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onMyFeedbacksStaffClick) {
                        onMyFeedbacksStaffClick();
                        return;
                      }
                      if (user?.id) {
                        router.push(legacyUserBugProblemUrl(String(user.id)));
                      }
                    }}
                    className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                  >
                    <Users2 className="h-4 w-4 shrink-0 opacity-95" />
                    <span className="leading-snug">
                      {t('sidebar_my_feedbacks_staff')} ({myFeedbackCount})
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" />
                <span>{t('sidebar_my_bookings')}</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            <button
              className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700"
            >
              <div className="flex items-center gap-3">
                <PenSquare className="w-5 h-5" />
                <span>Posts</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            <div className="w-full border-b border-teal-700">
              <button
                type="button"
                onClick={() => setMyPageNewsOpen((v) => !v)}
                aria-expanded={myPageNewsOpen}
                className="flex w-full items-center justify-between bg-teal-800 py-3 px-4 text-white transition-colors hover:bg-teal-700"
              >
                <div className="flex items-center gap-3">
                  <Newspaper className="h-5 w-5 shrink-0" />
                  <span>{t('sidebar_my_news')}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 opacity-80 transition-transform duration-200 ${
                    myPageNewsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {myPageNewsOpen && (
                <div className="bg-[#4a4a4a] text-white">
                  <button
                    type="button"
                    onClick={() => onMyPageMovesbookNewsClick?.()}
                    className="mb-1.5 flex w-full items-center gap-2.5 border-b-2 border-gray-400/70 px-4 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 leading-snug">Movesbook News</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMyPageNewsClick?.()}
                    className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-4 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                  >
                    <Newspaper className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 leading-snug">News</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMyPageOgpNewsClick?.()}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                  >
                    <Link2 className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 leading-snug">OGP News</span>
                  </button>
                </div>
              )}
            </div>

            <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5" />
                <span>Other Item</span>
              </div>
              <ChevronDown className="w-4 h-4 opacity-80" />
            </button>

            <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5" />
                <span>{t('sidebar_internet_links')}</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4 opacity-80" />
                <Settings className="w-4 h-4 text-gray-300" />
              </div>
            </button>

            <div className="border-b border-teal-700">
              <div className="flex w-full items-stretch bg-teal-800 text-white">
                <button
                  type="button"
                  onClick={() => setFriendsOpen((v) => !v)}
                  aria-expanded={friendsOpen}
                  className="flex flex-1 items-center gap-3 min-w-0 py-3 pl-4 pr-2 text-left hover:bg-teal-700 transition-colors"
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <span className="font-semibold tracking-wide truncate">{t('sidebar_friends_title')}</span>
                </button>
                {friendsOpen && (
                  <button
                    type="button"
                    className="shrink-0 self-stretch px-2 text-xs font-normal text-white/95 hover:bg-teal-700 hover:underline flex items-center"
                  >
                    {t('sidebar_friends_view_all')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFriendsOpen((v) => !v)}
                  aria-label={friendsOpen ? t('collapse') : t('expand')}
                  className="shrink-0 px-4 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                >
                  <ChevronDown
                    className={`w-4 h-4 opacity-80 transition-transform duration-200 ${friendsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {friendsOpen && (
                <div className="bg-[#e5e7eb] text-gray-800 max-h-[min(70vh,520px)] overflow-y-auto border-t border-teal-900/40">
                  <div className="px-3 pt-3 pb-2 text-xs text-gray-700">
                    {t('sidebar_friends_has_friends')
                      .replace('{name}', user?.name || 'User')
                      .replace('{count}', String(friendCount))}
                  </div>

                  <div className="px-3 pb-3">
                    <div className="relative flex items-center bg-white rounded border border-gray-300 shadow-sm">
                      <input
                        type="search"
                        placeholder={t('sidebar_friends_search_placeholder')}
                        className="w-full pl-2 pr-9 py-2 text-xs text-gray-800 placeholder:text-gray-400 rounded border-0 bg-transparent focus:ring-0 focus:outline-none"
                        aria-label={t('sidebar_friends_search_placeholder')}
                      />
                      <Search className="absolute right-2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="px-3 space-y-0 border-t border-gray-300/80">
                    <div className="flex items-center justify-between py-2.5 border-b border-gray-300/90 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Newspaper className="w-4 h-4 text-gray-600 shrink-0" />
                        <span className="truncate">{t('sidebar_friends_last_posts')}</span>
                      </div>
                      <span className="shrink-0 ml-2 min-w-[1.5rem] h-5 flex items-center justify-center rounded-sm bg-sky-300 text-white text-[11px] font-semibold px-1">
                        {lastPostsCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-4 h-4 text-gray-600 shrink-0" />
                        <span className="truncate">{t('sidebar_friends_messages_from')}</span>
                      </div>
                      <span className="shrink-0 ml-2 min-w-[1.5rem] h-5 flex items-center justify-center rounded-sm bg-sky-300 text-white text-[11px] font-semibold px-1">
                        {messagesCount}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 border-t border-gray-400/50">
                    <button
                      type="button"
                      onClick={() => setFriendsGroupsOpen((v) => !v)}
                      className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2"
                    >
                      <span>{t('sidebar_friends_groups_of_friends')}</span>
                      <span className="text-[10px] font-normal">{t('sidebar_friends_view_all')}</span>
                    </button>
                    {friendsGroupsOpen && (
                      <div className="bg-[#e5e7eb] px-3 py-3 text-xs text-gray-600 border-b border-gray-400/40">
                        {t('sidebar_friends_groups_empty')}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setFriendsOnlineOpen((v) => !v)}
                      className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2 border-t border-gray-500/30"
                    >
                      <span className="flex items-center gap-2">
                        {t('sidebar_friends_online_friends')}
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-emerald-500 text-[10px] font-bold px-1">
                          {onlineCount}
                        </span>
                      </span>
                      <span className="text-[10px] font-normal">{t('sidebar_friends_view_all_caps')}</span>
                    </button>
                    {friendsOnlineOpen && (
                      <div className="bg-[#e5e7eb] px-3 py-6 text-center text-xs text-gray-600 border-b border-gray-400/40">
                        {t('sidebar_friends_no_users_online')}
                      </div>
                    )}

                    <div className="border-t border-gray-500/30">
                      <button
                        type="button"
                        onClick={() => setFriendsFindOpen((v) => !v)}
                        className="w-full flex items-center justify-between bg-[#4b5563] hover:bg-[#3f4654] text-white text-[11px] font-semibold tracking-wide px-3 py-2"
                      >
                        <span>{t('sidebar_friends_find_new')}</span>
                        <X className="w-4 h-4 text-white/90" />
                      </button>
                      {friendsFindOpen && (
                        <div className="bg-[#e5e7eb] px-3 pb-10 pt-2 text-xs relative border-b border-gray-400/40">
                          <p className="text-gray-700 mb-2 text-center">
                            {t('sidebar_friends_find_greeting').replace(
                              '{name}',
                              (user?.name || 'User').split(/\s+/)[0] || 'User'
                            )}
                          </p>
                          <p className="text-red-600 font-medium leading-snug mb-3 text-center">
                            {t('sidebar_friends_find_line1')}
                            <br />
                            {t('sidebar_friends_find_line2')}
                          </p>
                          <input
                            type="text"
                            className="w-full mb-2 px-2 py-2 text-xs border border-gray-300 rounded bg-white text-gray-800 shadow-sm"
                            aria-label={t('sidebar_filter_option')}
                          />
                          <button
                            type="button"
                            className="w-full py-2.5 rounded text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 transition-colors"
                          >
                            {t('sidebar_filter_option')}
                          </button>
                          <button
                            type="button"
                            className="mt-2 w-full text-center text-red-600 hover:underline text-[11px]"
                          >
                            {t('sidebar_friends_see_invites_credits')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-teal-700">
              <button
                type="button"
                onClick={() => setCommunitiesOpen((v) => !v)}
                aria-expanded={communitiesOpen}
                className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5" />
                  <span>Communities</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 opacity-80 transition-transform ${communitiesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {communitiesOpen && (
                <div className="bg-gray-800 text-white">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-gray-300" />
                      <span className="text-sm">Sharing friends</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
                  </button>

                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-gray-300" />
                      <span className="text-sm">My Coaches</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
                  </button>

                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-gray-300" />
                      <span className="text-sm">My teams</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
                  </button>

                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors border-t border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-gray-300" />
                      <span className="text-sm">My Groups</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-60 rotate-[-90deg]" />
                  </button>

                  <div className="border-t border-gray-700">
                    <button
                      type="button"
                      onClick={() => setCurrentClubMembersOpen((v) => !v)}
                      aria-expanded={currentClubMembersOpen}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
                    >
                      <span className="text-sm text-gray-200">Current Club&apos;s member list</span>
                      <ChevronDown
                        className={`w-4 h-4 opacity-70 transition-transform ${currentClubMembersOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {currentClubMembersOpen && (
                      <div className="bg-[#e5e7eb] px-3 py-6 text-center text-xs text-gray-600 border-t border-gray-400/40">
                        Member list UI
                      </div>
                    )}
                  </div>

                  <div className="py-3 bg-gray-850 border-t border-gray-700">
                    {showSuggestMovesbook ? (
                      <button
                        type="button"
                        onClick={handleSuggestMovesbookClick}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded text-sm font-medium transition-colors"
                      >
                        Suggest Movesbook to your friends
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Entity tab menu (UI only). When "My Club" is selected, match legacy UI. */}
            {(userType === 'ATHLETE' || isClubAccountUserType(userType)) ? (
              <div className="select-none">
                {!showClubMyEntityTop && (
                  <>
                    {/* User guides (top row) */}
                    <div className="w-full bg-teal-800 text-white border-b border-teal-700">
                      <div className="flex items-center justify-between py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BookOpen className="w-5 h-5 shrink-0" />
                          <span className="font-semibold tracking-wide truncate">{t('sidebar_user_guides')}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ChevronDown className="w-4 h-4 opacity-90" />
                          <Settings className="w-4 h-4 opacity-90" />
                        </div>
                      </div>
                    </div>

                    <ClubSocialSubmenu onChatClick={onClubChatClick} />

                    {isClubAccountUserType(userType) ? (
                      <ClubMyClubInfoSubmenu
                        clubId={displaySelectedClub?.id as string | undefined}
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Building2 className="w-5 h-5 shrink-0" />
                          <span className="font-semibold tracking-wide truncate">Club Info</span>
                        </div>
                        <ChevronDown className="w-4 h-4 opacity-90" />
                      </button>
                    )}

                    <button
                      type="button"
                      className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Eye className="w-5 h-5 shrink-0" />
                        <span className="font-semibold tracking-wide truncate">Club page for visitors</span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-90" />
                    </button>

                    <ClubMembersDashboardSection
                      clubId={displaySelectedClub?.id as string | undefined}
                      youtubeChannelUrl={
                        (displaySelectedClub as { youtubeChannelUrl?: string | null })
                          ?.youtubeChannelUrl ?? null
                      }
                      canManageClub={clubWebsiteManage}
                      onYoutubeChannelUrlSaved={handleClubYoutubeSaved}
                    />
                  </>
                )}

                <button
                  type="button"
                  className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <List className="w-5 h-5 shrink-0" />
                    <span className="font-semibold tracking-wide truncate">Club Lists</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-90" />
                </button>

                {/* Favourite Page */}
                <div className="w-full bg-[#4b4b4b] text-white border-b border-teal-700">
                  <div className="flex items-center justify-between py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Heart className="w-5 h-5 shrink-0 opacity-90" />
                      <span className="font-semibold tracking-wide truncate">Favourite Page</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </div>
                </div>
                <div className="w-full bg-[#4b4b4b] text-white border-b border-teal-700">
                  <div className="flex items-center justify-between py-2.5 px-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Heart className="w-5 h-5 shrink-0 opacity-90" />
                      <span className="font-semibold tracking-wide truncate">My List</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </div>
                </div>

                {/* Music / notifications / messages / bookings */}
                <div className="w-full border-b border-teal-700">
                  <button
                    type="button"
                    onClick={() => setMusicForClubOpen((v) => !v)}
                    aria-expanded={musicForClubOpen}
                    className="flex w-full items-center justify-between bg-teal-800 py-2.5 px-3 text-white transition-colors hover:bg-teal-700"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Music className="h-5 w-5 shrink-0" />
                      <span className="truncate font-semibold tracking-wide">
                        {t('sidebar_music_club')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 opacity-90 transition-transform duration-200 ${
                          musicForClubOpen ? 'rotate-180' : ''
                        }`}
                      />
                      <Settings className="h-4 w-4 opacity-90" aria-hidden />
                    </div>
                  </button>
                  {musicForClubOpen && (
                    <div className="bg-[#4a4a4a] text-white">
                      <button
                        type="button"
                        onClick={() => onClubAddSongsPlaylistsClick?.()}
                        className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                      >
                        <Users className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                        <span className="min-w-0 leading-snug">Add songs & playlists</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onClubMusicPanelClick?.()}
                        className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                      >
                        <Users className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                        <span className="min-w-0 leading-snug">Music Panel</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                      >
                        <Users className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                        <span className="min-w-0 leading-snug">Mood Music</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                      >
                        <Users className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                        <span className="min-w-0 leading-snug">My favoured radios</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-b border-teal-700">
                  <div className="flex w-full items-stretch bg-teal-800 text-white">
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen((v) => !v)}
                      aria-expanded={notificationsOpen}
                      className="flex flex-1 items-center gap-2.5 min-w-0 py-2.5 pl-3 pr-2 text-left hover:bg-teal-700 transition-colors"
                    >
                      <Mail className="w-5 h-5 shrink-0" />
                      <span className="font-semibold tracking-wide truncate">
                        Notifications({notificationCounts.total})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen((v) => !v)}
                      aria-label={notificationsOpen ? t('collapse') : t('expand')}
                      className="shrink-0 px-3 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                    >
                      <ChevronDown
                        className={`w-4 h-4 opacity-90 transition-transform duration-200 ${notificationsOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  {notificationsOpen && (
                    <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40 px-3 py-2 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => router.push('/users/notification/all/all/movesbook')}
                        className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                      >
                        <Bell className="h-4 w-4 shrink-0 opacity-95" />
                        <span className="leading-snug">
                          Notifications from movesbook staff ({notificationCounts.movesbook})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isClubAccountUserType(userType)) {
                            const qs = selectedEntityId
                              ? `?clubId=${encodeURIComponent(selectedEntityId)}`
                              : '';
                            router.push(`/users/clubnotification${qs}`);
                            return;
                          }
                          if (userType === 'COACH') {
                            const qs = selectedEntityId
                              ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                              : '';
                            router.push(`/users/coachnotification${qs}`);
                            return;
                          }
                          if (isTeamAccountUserType(userType)) {
                            const qs = selectedEntityId
                              ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                              : '';
                            router.push(`/users/teamnotification${qs}`);
                            return;
                          }
                          if (isGroupAccountUserType(userType)) {
                            const qs = selectedEntityId
                              ? `?entityId=${encodeURIComponent(selectedEntityId)}`
                              : '';
                            router.push(`/users/groupnotification${qs}`);
                            return;
                          }
                          router.push('/users/notification/all/all/clubs');
                        }}
                        className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 opacity-95" />
                        <span className="leading-snug">
                          {isClubAccountUserType(userType)
                            ? 'Notifications from club staff'
                            : userType === 'COACH'
                              ? 'Send / Coach notifies'
                              : isTeamAccountUserType(userType)
                                ? 'Send / Team notifies'
                                : isGroupAccountUserType(userType)
                                  ? 'Send / Group notifies'
                                  : `Notifications from club staff (${notificationCounts.clubs})`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-b border-teal-700">
                  <div className="flex w-full items-stretch bg-teal-800 text-white">
                    <button
                      type="button"
                      onClick={() => setMessagesOpen((v) => !v)}
                      aria-expanded={messagesOpen}
                      className="flex flex-1 items-center gap-2.5 min-w-0 py-2.5 pl-3 pr-2 text-left hover:bg-teal-700 transition-colors"
                    >
                      <MessageSquare className="w-5 h-5 shrink-0" />
                      <span className="font-semibold tracking-wide truncate">Messages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessagesOpen((v) => !v)}
                      aria-label={messagesOpen ? t('collapse') : t('expand')}
                      className="shrink-0 px-3 flex items-center hover:bg-teal-700 transition-colors border-l border-teal-700/40"
                    >
                      <ChevronDown
                        className={`w-4 h-4 opacity-90 transition-transform duration-200 ${messagesOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  {messagesOpen && (
                    <div className="bg-[#2d2d2d] text-white text-sm border-t border-teal-900/40 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onMyFeedbacksStaffClick) {
                            onMyFeedbacksStaffClick();
                            return;
                          }
                          if (user?.id) {
                            router.push(legacyUserBugProblemUrl(String(user.id)));
                          }
                        }}
                        className="flex w-full items-center gap-3 border border-[#aeaeae] bg-[#4f4f4f] px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#3d3d3d]"
                      >
                        <Users2 className="h-4 w-4 shrink-0 opacity-95" />
                        <span className="leading-snug">
                          {t('sidebar_my_feedbacks_staff')} ({myFeedbackCount})
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-5 h-5 shrink-0" />
                    <span className="font-semibold tracking-wide truncate">Bookings</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-90" />
                </button>

                {/* Posts / news / options / links — expandable submenus only for CLUB account */}
                {userType === 'CLUB' ? (
                  <div className="w-full border-b border-teal-700">
                    <button
                      type="button"
                      onClick={() => setClubPostsOpen((v) => !v)}
                      className="flex w-full items-center justify-between bg-teal-800 py-2.5 px-3 text-white transition-colors hover:bg-teal-700"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <PenSquare className="h-5 w-5 shrink-0" />
                        <span className="truncate font-semibold tracking-wide">Club Posts</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                          clubPostsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {clubPostsOpen && (
                      <div className="space-y-1.5 bg-[#2a2a2a] px-1.5 py-2">
                        <div className="overflow-hidden rounded-sm border border-gray-500/70 bg-[#6b6b6b]">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 border-b border-gray-400/50 px-2.5 py-2 text-left text-[12px] font-bold text-white transition-colors hover:bg-[#757575]"
                          >
                            <FileText className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                            <span className="min-w-0 leading-snug">Post of My Club Page</span>
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 border-b border-gray-400/50 px-2.5 py-2 text-left text-[12px] font-bold text-white transition-colors hover:bg-[#757575]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                              <span className="min-w-0 leading-snug">Post In My Home Page</span>
                            </div>
                            <Settings className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 border-b border-gray-400/50 px-2.5 py-2 text-left text-[12px] font-bold text-white transition-colors hover:bg-[#757575]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                              <span className="min-w-0 leading-snug">Post In My Page For Visitors</span>
                            </div>
                            <Settings className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[12px] font-bold text-white transition-colors hover:bg-[#757575]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                              <span className="min-w-0 leading-snug">Publish A Post</span>
                            </div>
                            <Settings className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          </button>
                        </div>
                        <div className="overflow-hidden rounded-sm border border-gray-600/80 bg-[#454545]">
                          <button
                            type="button"
                            className="w-full border-b border-gray-600/70 px-3 py-2 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#4f4f4f]"
                          >
                            Posts tagged as inappropriate
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#4f4f4f]"
                          >
                            Members with blocked post
                          </button>
                        </div>
                        <div className="overflow-hidden rounded-sm border border-gray-500/70">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 border-b border-sky-300/40 bg-blue-600 px-2.5 py-2 text-left text-[12px] font-bold text-white transition-colors hover:bg-blue-500"
                          >
                            <MessageSquare className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                            <span className="min-w-0 leading-snug">Alerts for the members</span>
                          </button>
                          <button
                            type="button"
                            className="w-full border-b border-gray-600/70 bg-[#525252] px-3 py-2 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#5a5a5a]"
                          >
                            Alerts and notices at the login
                          </button>
                          <button
                            type="button"
                            className="w-full border-b border-gray-600/70 bg-[#525252] px-3 py-2 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#5a5a5a]"
                          >
                            Alerts and notices at the logout
                          </button>
                          <button
                            type="button"
                            className="w-full bg-[#525252] px-3 py-2 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#5a5a5a]"
                          >
                            Intro messages for members
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PenSquare className="w-5 h-5 shrink-0" />
                      <span className="font-semibold tracking-wide truncate">Club Posts</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </button>
                )}

                {/* Club News submenus: club admin, or athlete who is a member of this club */}
                {userType === 'CLUB' || (isAthleteUser && athleteHasClubMembership) ? (
                  <div className="w-full border-b border-teal-700">
                    <button
                      type="button"
                      onClick={() => setClubNewsOpen((v) => !v)}
                      aria-expanded={clubNewsOpen}
                      className="flex w-full items-center justify-between bg-teal-800 py-2.5 px-3 text-white transition-colors hover:bg-teal-700"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Newspaper className="h-5 w-5 shrink-0" />
                        <span className="truncate font-semibold tracking-wide">Club News</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                          clubNewsOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {clubNewsOpen && (
                      <div className="bg-[#4a4a4a] text-white">
                        <button
                          type="button"
                          onClick={() => onClubMovesbookNewsSectionClick?.()}
                          className="mb-1.5 flex w-full items-center gap-2.5 border-b-2 border-gray-400/70 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <BookOpen className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                          <span className="min-w-0 leading-snug">Movesbook News</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onClubNewsSectionClick?.()}
                          className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <Newspaper className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                          <span className="min-w-0 leading-snug">News</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onClubOgpNewsSectionClick?.()}
                          className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <Link2 className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                          <span className="min-w-0 leading-snug">OGP News</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onClubGlobalNewsSectionClick?.()}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <Globe className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                          <span className="min-w-0 leading-snug">Club News &amp; OGP News</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Newspaper className="w-5 h-5 shrink-0" />
                      <span className="font-semibold tracking-wide truncate">Club News</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </button>
                )}

                <button
                  type="button"
                  className="w-full bg-teal-800 hover:bg-teal-700 text-white py-2.5 px-3 flex items-center justify-between transition-colors border-b border-teal-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <SlidersHorizontal className="w-5 h-5 shrink-0" />
                    <span className="font-semibold tracking-wide truncate">Options</span>
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-90" />
                </button>

                <div className="w-full border-b border-teal-700">
                  <div className="flex w-full items-stretch bg-teal-800 text-white">
                    <button
                      type="button"
                      onClick={() => setClubInternetLinksOpen((v) => !v)}
                      aria-expanded={clubInternetLinksOpen}
                      className="flex min-w-0 flex-1 items-center justify-between py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-teal-700"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Globe className="h-5 w-5 shrink-0" />
                        <span className="truncate font-semibold tracking-wide">
                          {t('sidebar_internet_links')}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                          clubInternetLinksOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {clubWebsiteManage ? (
                      <button
                        type="button"
                        onClick={() => {
                          writeClubWorkspaceTab('my-entity');
                          router.push(CLUB_WEBSITE_SETTINGS_INDEX_PATH);
                        }}
                        className="flex shrink-0 items-center border-l border-teal-700/40 px-3 text-gray-300 transition-colors hover:bg-teal-700 hover:text-white"
                        aria-label={t('sidebar_club_website_editor_aria')}
                      >
                        <Settings className="h-4 w-4 opacity-90" />
                      </button>
                    ) : (
                      <span className="flex shrink-0 items-center border-l border-teal-700/40 px-3 text-gray-300">
                        <Settings className="h-4 w-4 opacity-90" aria-hidden />
                      </span>
                    )}
                  </div>
                  {clubInternetLinksOpen && (
                    <div className="bg-[#4a4a4a] text-white">
                      <div className="border-b border-gray-500/60">
                        <button
                          type="button"
                          onClick={() => setClubInternetMyClubsOpen((v) => !v)}
                          aria-expanded={clubInternetMyClubsOpen}
                          className="flex w-full items-center justify-between bg-[#333] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-gray-200 transition-colors hover:bg-[#3a3a3a]"
                        >
                          <span>{t('sidebar_internet_my_clubs_section')}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 opacity-90 transition-transform duration-200 ${
                              clubInternetMyClubsOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {clubInternetMyClubsOpen ? (
                          <div className="border-t border-gray-600/50">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                            >
                              <Globe className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                              <span className="min-w-0 leading-snug">{t('sidebar_club_official_website')}</span>
                            </button>

                            <div className="flex w-full items-center justify-between gap-2 border-b border-gray-500/60 px-3 py-2.5 text-[12px] font-normal text-white transition-colors hover:bg-[#555]">
                              <button
                                type="button"
                                onClick={openMovesbookWebsite}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:text-white/90"
                              >
                                <SidebarStackedGlobeIcon badge="M" />
                                <span className="min-w-0 leading-snug">
                                  {t('sidebar_club_movesbook_club_website')}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={copyMovesbookWebsiteLink}
                                className="shrink-0 border-0 bg-transparent p-0 text-[12px] font-medium text-[#d4a017] hover:underline"
                              >
                                {movesbookLinkCopied
                                  ? t('sidebar_club_link_copied')
                                  : t('sidebar_club_get_link')}
                              </button>
                            </div>

                            {clubWebsiteManage ? (
                              <div className="flex min-h-[44px] w-full items-stretch border-b border-gray-500/60">
                                <button
                                  type="button"
                                  onClick={openMovesbookWebsite}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                                >
                                  <Home className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                                  <span className="min-w-0 truncate leading-snug">
                                    {t('sidebar_club_website_editor')}
                                  </span>
                                </button>
                                <a
                                  href={CLUB_WEBSITE_SETTINGS_INDEX_PATH}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex shrink-0 items-center border-l border-gray-500/60 px-3 text-gray-300 no-underline transition-colors hover:bg-[#555]"
                                  aria-label={t('sidebar_club_website_editor_aria')}
                                >
                                  <Settings className="h-4 w-4" />
                                </a>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 border-b border-gray-500/60 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                      >
                        <SidebarStackedGlobeIcon badge="F" />
                        <span className="min-w-0 leading-snug">{t('sidebar_club_facebook_website')}</span>
                      </button>

                      <div className="border-b border-gray-500/60">
                        <button
                          type="button"
                          onClick={() => setClubInternetSocialSitesOpen((v) => !v)}
                          aria-expanded={clubInternetSocialSitesOpen}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Globe className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                            <span className="min-w-0 leading-snug">{t('sidebar_club_social_sites')}</span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                              clubInternetSocialSitesOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {clubInternetSocialSitesOpen && (
                          <div className="border-t border-gray-600/50 bg-[#3a3a3a]" />
                        )}
                      </div>

                      <div className="flex min-h-[44px] w-full items-stretch">
                        <button
                          type="button"
                          onClick={() => setClubInternetFavouriteLinksOpen((v) => !v)}
                          aria-expanded={clubInternetFavouriteLinksOpen}
                          className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-normal text-white transition-colors hover:bg-[#555]"
                        >
                          <SidebarStackedGlobeIcon badge="star" />
                          <span className="min-w-0 truncate leading-snug">{t('sidebar_club_favourite_links')}</span>
                        </button>
                        <button
                          type="button"
                          className="flex shrink-0 items-center border-l border-gray-500/60 px-3 text-gray-300 transition-colors hover:bg-[#555]"
                          aria-label={t('sidebar_options')}
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setClubInternetFavouriteLinksOpen((v) => !v)}
                          aria-label={clubInternetFavouriteLinksOpen ? t('collapse') : t('expand')}
                          className="flex shrink-0 items-center border-l border-gray-500/60 px-3 transition-colors hover:bg-[#555]"
                        >
                          <ChevronDown
                            className={`h-4 w-4 opacity-90 transition-transform duration-200 ${
                              clubInternetFavouriteLinksOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                      {clubInternetFavouriteLinksOpen && (
                        <div className="border-t border-gray-600/50 bg-[#3a3a3a]" />
                      )}
                    </div>
                  )}
                </div>

                {/* TRAINING section header */}
                <div className="w-full bg-[#7a0d1c] text-white border-b border-teal-700">
                  <div className="flex items-center justify-between py-2 px-3">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5" />
                      <span className="font-bold tracking-wide text-sm">TRAINING</span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-90" />
                  </div>                
                </div>

                {/* CLUB'S MANAGEMENT: CLUB + My Club — collapsed purple strip; expanded = red header + full submenu panel */}
                {userType === 'CLUB' ? (
                  <div className="w-full border-b border-teal-700">
                    {!clubManagementOpen ? (
                      <button
                        type="button"
                        onClick={() => setClubManagementOpen(true)}
                        className="w-full bg-[#92278F] hover:bg-[#7b1f79] text-white border-t border-l border-r border-white/90 border-b border-teal-700 transition-colors select-none"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[13px] font-bold uppercase leading-tight tracking-wide">
                              CLUB&apos;S MANAGEMENT
                            </span>
                            <Settings className="h-5 w-5 shrink-0 text-white opacity-95" aria-hidden />
                          </div>
                          <ChevronDown className="h-4 w-4 text-white opacity-95" strokeWidth={2.5} aria-hidden />
                        </div>
                      </button>
                    ) : (
                      <div className="w-full bg-[#3a3a3a] text-white shadow-inner">
                        <button
                          type="button"
                          onClick={() => setClubManagementOpen(false)}
                          className="w-full bg-[#7a0d1c] hover:bg-[#681018] text-white border-b border-teal-700 transition-colors"
                        >
                          <div className="relative px-3 pt-3 pb-1">
                            <span className="block text-center text-[13px] font-bold uppercase tracking-wide pr-8">
                              CLUB&apos;S MANAGEMENT
                            </span>
                            <Settings className="absolute right-3 top-3 w-5 h-5 text-white opacity-95 pointer-events-none" aria-hidden />
                          </div>
                          <div className="flex justify-center pb-2">
                            <ChevronDown className="w-4 h-4 rotate-180 opacity-95" strokeWidth={2.5} aria-hidden />
                          </div>
                        </button>

                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[#4a4a4a] border-b border-gray-600 text-[11px] text-white">
                          <button type="button" className="hover:underline text-left">
                            Restore list default
                          </button>
                          <button
                            type="button"
                            onClick={() => setClubManagementOpen(false)}
                            className="hover:underline shrink-0"
                          >
                            ✕ Close Section
                          </button>
                        </div>

                        <div className="max-h-[min(70vh,520px)] overflow-y-auto">
                          <div className="border-b border-teal-900/50">
                            <button
                              type="button"
                              onClick={() => setClubUserGuidesOpen((v) => !v)}
                              className="flex w-full items-center justify-between bg-teal-800 py-2 pl-2 pr-2 text-left text-white transition-colors hover:bg-teal-700"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <BookOpen className="h-4 w-4 shrink-0" />
                                <span className="truncate text-[12px] font-semibold tracking-wide">
                                  User guides
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                            </button>
                            {clubUserGuidesOpen && (
                              <div className="border-t border-teal-900/40 bg-[#2b2b2b] text-white">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2.5 border-b border-gray-600/60 py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                >
                                  <Info className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                                  <span className="text-[12px] font-normal leading-snug">
                                    Help documents
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-start gap-2.5 border-b border-gray-600/60 py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                >
                                  <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                                  <div className="min-w-0 leading-tight">
                                    <span className="block text-[12px] font-bold text-white">FAQs</span>
                                    <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                                      Frequently asked questions
                                    </span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2.5 py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                >
                                  <Monitor className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} />
                                  <span className="text-[12px] font-normal leading-snug">
                                    Video tutorials
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="border-b border-blue-900/40">
                            <button
                              type="button"
                              onClick={() => setClubCurrentOperatorsOpen((v) => !v)}
                              className={`flex w-full items-center justify-between py-2 pl-2 pr-2 text-left text-white transition-colors ${
                                clubCurrentOperatorsOpen
                                  ? 'bg-[#3d4d5c] hover:bg-[#354654]'
                                  : 'bg-blue-700 hover:bg-blue-600'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Users2 className="h-4 w-4 shrink-0" />
                                <span className="truncate text-[12px] font-semibold tracking-wide">
                                  Current Operators
                                </span>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                  clubCurrentOperatorsOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {clubCurrentOperatorsOpen && (
                              <div className="bg-[#2a2a2a] text-white">
                                <div className="bg-[#c4c4c4] py-1.5 text-center text-[11px] font-semibold tracking-wide text-gray-900">
                                  Administrator
                                </div>
                                <div className="flex gap-2 border-b border-gray-700 px-2 py-2">
                                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-gray-600">
                                    {clubAdminOperatorImageSrc ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        key={clubAdminOperatorImageSrc}
                                        src={clubAdminOperatorImageSrc}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                      />
                                    ) : (
                                      <UserCircle className="h-10 w-10 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 text-[11px] leading-snug">
                                    <div className="flex items-center gap-1.5 text-white">
                                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                      <span>Online</span>
                                    </div>
                                    <div className="text-yellow-300">Admin</div>
                                    <div className="truncate font-bold text-white">
                                      {clubAdminOperatorDisplayName}
                                    </div>
                                    <div className="text-yellow-300">Country</div>
                                    <div className="truncate text-white">
                                      {clubAdminOperatorCountry || '-'}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between border-b border-gray-700 bg-[#333333] px-2 py-1.5 text-left text-[11px] text-white hover:bg-[#3a3a3a]"
                                >
                                  <div className="flex items-center gap-2">
                                    <Router className="h-3.5 w-3.5 shrink-0 opacity-90" />
                                    <span>Current Logged</span>
                                  </div>
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-90" />
                                </button>

                                <div className="border-b border-gray-700">
                                  <div className="flex items-center justify-between bg-[#c4c4c4] px-2 py-1.5 text-[11px] font-semibold text-gray-900">
                                    <span>Co-admins</span>
                                    <button
                                      type="button"
                                      onClick={() => goToClubStaffList('coadmin')}
                                      className="flex items-center gap-0.5 font-semibold hover:underline"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                  {clubStaffItems
                                    .filter((item) => item.staffType === 'coadmin')
                                    .map((item) => {
                                      const src = resolvePublicImageUrl(item.image);
                                      return (
                                        <div key={item.id} className="flex items-center gap-2 px-2 py-2">
                                          {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
                                          ) : (
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gray-600">
                                              <UserCircle className="h-7 w-7 text-gray-400" />
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-[11px] font-medium text-yellow-300">
                                              {item.name}
                                            </div>
                                            <div className="truncate text-[11px] text-white">@{item.username}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => void removeClubStaff(item.id)}
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/50 hover:bg-white/10"
                                            aria-label="Remove"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>

                                <div className="border-b border-gray-700">
                                  <div className="flex items-center justify-between bg-[#c4c4c4] px-2 py-1.5 text-[11px] font-semibold text-gray-900">
                                    <div className="flex items-center gap-2">
                                      <UserCircle className="h-4 w-4 text-emerald-700" />
                                      <span>Operators</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => goToClubStaffList('operator')}
                                      className="flex items-center gap-0.5 font-semibold hover:underline"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                  {clubStaffItems
                                    .filter((item) => item.staffType === 'operator')
                                    .map((item) => {
                                      const src = resolvePublicImageUrl(item.image);
                                      return (
                                        <div key={item.id} className="flex items-center gap-2 px-2 py-2">
                                          {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
                                          ) : (
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gray-600">
                                              <UserCircle className="h-7 w-7 text-gray-400" />
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-[11px] font-medium text-yellow-300">
                                              {item.name}
                                            </div>
                                            <div className="truncate text-[11px] text-white">@{item.username}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => void removeClubStaff(item.id)}
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/50 hover:bg-white/10"
                                            aria-label="Remove"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>

                                <div>
                                  <div className="flex items-center justify-between bg-[#c4c4c4] px-2 py-1.5 text-[11px] font-semibold text-gray-900">
                                    <div className="flex items-center gap-2">
                                      <UserCircle className="h-4 w-4 text-emerald-700" />
                                      <span>Collaborators</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => goToClubStaffList('collaborator')}
                                      className="flex items-center gap-0.5 font-semibold hover:underline"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                  {clubStaffItems
                                    .filter((item) => item.staffType === 'collaborator')
                                    .map((item) => {
                                      const src = resolvePublicImageUrl(item.image);
                                      return (
                                        <div key={item.id} className="flex items-center gap-2 px-2 py-2">
                                          {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
                                          ) : (
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gray-600">
                                              <UserCircle className="h-7 w-7 text-gray-400" />
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="truncate text-[11px] font-medium text-yellow-300">
                                              {item.name}
                                            </div>
                                            <div className="truncate text-[11px] text-white">@{item.username}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => void removeClubStaff(item.id)}
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/50 hover:bg-white/10"
                                            aria-label="Remove"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="border-b border-blue-900/40">
                            <button
                              type="button"
                              onClick={() => setAccountsAndDeviceOpen((v) => !v)}
                              className={`flex w-full items-center justify-between py-2 pl-2 pr-2 text-left text-white transition-colors ${
                                accountsAndDeviceOpen
                                  ? 'bg-[#455a64] hover:bg-[#4a6068]'
                                  : 'bg-blue-700 hover:bg-blue-600'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex shrink-0 items-center gap-0.5">
                                  <Shield className="h-3.5 w-3.5" />
                                  <CreditCard className="h-3.5 w-3.5" />
                                </span>
                                <span className="truncate text-[12px] font-semibold tracking-wide">
                                  Accounts and Device
                                </span>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                  accountsAndDeviceOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {accountsAndDeviceOpen && (
                              <div className="border-t border-gray-700/90 bg-[#1e272a] text-white">
                                {/* Accounts */}
                                <div className="border-b border-gray-700/80">
                                  <button
                                    type="button"
                                    onClick={() => setClubAccountsSectionOpen((v) => !v)}
                                    className={`flex w-full items-center justify-between py-2 pl-3 pr-2 text-left transition-colors ${
                                      clubAccountsSectionOpen
                                        ? 'bg-[#455a64] hover:bg-[#4a6068]'
                                        : 'bg-[#37474f] hover:bg-[#3f525c]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <Shield className="h-4 w-4 shrink-0 opacity-95" />
                                      <span className="text-[12px] font-semibold tracking-wide">Accounts</span>
                                    </div>
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-white opacity-90 transition-transform duration-200 ${
                                        clubAccountsSectionOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {clubAccountsSectionOpen && (
                                    <div className="bg-[#263238]">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 border-b border-gray-700/80 py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                      >
                                        <Bookmark className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                        <span className="font-medium">Club account & Subscriptions</span>
                                      </button>
                                      <div className="border-b border-gray-700/80">
                                        <button
                                          type="button"
                                          onClick={() => setClubManageAccountsOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <CheckSquare className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                            <span className="font-medium">Manage accounts</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubManageAccountsOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubManageAccountsOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 border-b border-gray-700/60 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-white hover:bg-[#333]"
                                            >
                                              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                                              <span>Enable members</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 border-b border-gray-700/60 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-white hover:bg-[#333]"
                                            >
                                              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                                              <span>Members</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 border-b border-gray-700/60 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-white hover:bg-[#333]"
                                            >
                                              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                                              <span>Summary & Renewals</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-white hover:bg-[#333]"
                                            >
                                              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                                              <span>Account Status</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => setClubAccountsYellowOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <Bookmark className="h-3.5 w-3.5 shrink-0 text-yellow-300" />
                                            <span className="font-medium text-yellow-300">Accounts</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubAccountsYellowOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubAccountsYellowOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            {(
                                              [
                                                { dot: 'bg-amber-400', label: 'Price list' },
                                                { dot: 'bg-red-500', label: 'Requests of accounts' },
                                                { dot: 'bg-lime-400', label: 'Accounts purchased' },
                                                {
                                                  dot: 'bg-emerald-800',
                                                  label: "Manage member's accounts",
                                                  last: true,
                                                },
                                              ] as const
                                            ).map((item) => (
                                              <button
                                                key={item.label}
                                                type="button"
                                                disabled
                                                title="Club account purchase is available only during club registration / creation."
                                                className={`flex w-full cursor-not-allowed items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-gray-500 opacity-60 ${
                                                  'last' in item && item.last
                                                    ? ''
                                                    : 'border-b border-gray-700/60'
                                                }`}
                                              >
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                                                <span>{item.label}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {/* Id devices */}
                                <div className="border-b border-gray-700/80">
                                  <button
                                    type="button"
                                    onClick={() => setClubIdDevicesSectionOpen((v) => !v)}
                                    className={`flex w-full items-center justify-between py-2 pl-3 pr-2 text-left transition-colors ${
                                      clubIdDevicesSectionOpen
                                        ? 'bg-[#455a64] hover:bg-[#4a6068]'
                                        : 'bg-[#37474f] hover:bg-[#3f525c]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <CreditCard className="h-4 w-4 shrink-0 opacity-95" />
                                      <span className="text-[12px] font-semibold tracking-wide">Id devices</span>
                                    </div>
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-white opacity-90 transition-transform duration-200 ${
                                        clubIdDevicesSectionOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {clubIdDevicesSectionOpen && (
                                    <div className="bg-[#263238]">
                                      <div className="border-b border-gray-700/80">
                                        <button
                                          type="button"
                                          onClick={() => setClubQrCodesOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <QrCode className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                            <span className="font-medium">QR Codes</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubQrCodesOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubQrCodesOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            {(
                                              [
                                                { dot: 'bg-amber-400', label: 'Price list' },
                                                { dot: 'bg-red-500', label: 'Requests of QR Code' },
                                                { dot: 'bg-lime-400', label: 'QR Code purchased' },
                                                {
                                                  dot: 'bg-sky-400',
                                                  label: 'Manage QR Code assignement',
                                                  last: true,
                                                },
                                              ] as const
                                            ).map((item) => (
                                              <button
                                                key={item.label}
                                                type="button"
                                                disabled
                                                title={REGISTRATION_ONLY_ID_CARDS_TOOLTIP}
                                                className={`flex w-full cursor-not-allowed items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-gray-500 opacity-60 ${
                                                  'last' in item && item.last
                                                    ? ''
                                                    : 'border-b border-gray-700/60'
                                                }`}
                                              >
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                                                <span>{item.label}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="border-b border-gray-700/80">
                                        <button
                                          type="button"
                                          onClick={() => setClubRfidBadgesOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <RadioTower className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                            <span className="font-medium">Rfid Badges\Bracelets</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubRfidBadgesOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubRfidBadgesOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            {(
                                              [
                                                { dot: 'bg-amber-400', label: 'Price list' },
                                                { dot: 'bg-red-500', label: 'Requests of Rfids' },
                                                { dot: 'bg-lime-400', label: 'Rfids purchased' },
                                                {
                                                  dot: 'bg-sky-400',
                                                  label: 'Manage rfidbadge assignement',
                                                  last: true,
                                                },
                                              ] as const
                                            ).map((item) => (
                                              <button
                                                key={item.label}
                                                type="button"
                                                disabled
                                                title={REGISTRATION_ONLY_ID_CARDS_TOOLTIP}
                                                className={`flex w-full cursor-not-allowed items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-gray-500 opacity-60 ${
                                                  'last' in item && item.last
                                                    ? ''
                                                    : 'border-b border-gray-700/60'
                                                }`}
                                              >
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                                                <span>{item.label}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="border-b border-gray-700/80">
                                        <button
                                          type="button"
                                          onClick={() => setClubMagneticOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <RectangleHorizontal className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                            <span className="font-medium">Magnetic</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubMagneticOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubMagneticOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            {(
                                              [
                                                { dot: 'bg-amber-400', label: 'Price list' },
                                                { dot: 'bg-red-500', label: 'Requests of badges' },
                                                { dot: 'bg-lime-400', label: 'Badges purchased' },
                                                {
                                                  dot: 'bg-sky-400',
                                                  label: 'Manage magnetic assignement',
                                                  last: true,
                                                },
                                              ] as const
                                            ).map((item) => (
                                              <button
                                                key={item.label}
                                                type="button"
                                                disabled
                                                title={REGISTRATION_ONLY_ID_CARDS_TOOLTIP}
                                                className={`flex w-full cursor-not-allowed items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-gray-500 opacity-60 ${
                                                  'last' in item && item.last
                                                    ? ''
                                                    : 'border-b border-gray-700/60'
                                                }`}
                                              >
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                                                <span>{item.label}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => setClubSmartcardsOpen((v) => !v)}
                                          className="flex w-full items-center justify-between py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                        >
                                          <div className="flex min-w-0 items-center gap-2">
                                            <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                            <span className="font-medium">Smartcards</span>
                                          </div>
                                          <ChevronDown
                                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
                                              clubSmartcardsOpen ? 'rotate-180' : ''
                                            }`}
                                          />
                                        </button>
                                        {clubSmartcardsOpen && (
                                          <div className="border-t border-gray-700/70 bg-[#2a2a2a]">
                                            {(
                                              [
                                                { dot: 'bg-amber-400', label: 'Price list' },
                                                { dot: 'bg-red-500', label: 'Requests of badges' },
                                                { dot: 'bg-lime-400', label: 'Badges purchased' },
                                                {
                                                  dot: 'bg-sky-400',
                                                  label: 'Manage smartcard assignement',
                                                  last: true,
                                                },
                                              ] as const
                                            ).map((item) => (
                                              <button
                                                key={item.label}
                                                type="button"
                                                disabled
                                                title={REGISTRATION_ONLY_ID_CARDS_TOOLTIP}
                                                className={`flex w-full cursor-not-allowed items-center gap-2 py-2 pl-8 pr-2 text-left text-[11px] font-medium text-gray-500 opacity-60 ${
                                                  'last' in item && item.last
                                                    ? ''
                                                    : 'border-b border-gray-700/60'
                                                }`}
                                              >
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                                                <span>{item.label}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {/* Hardwares */}
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setClubHardwaresSectionOpen((v) => !v)}
                                    className={`flex w-full items-center justify-between py-2 pl-3 pr-2 text-left transition-colors ${
                                      clubHardwaresSectionOpen
                                        ? 'bg-[#455a64] hover:bg-[#4a6068]'
                                        : 'bg-[#37474f] hover:bg-[#3f525c]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <ShipWheel className="h-4 w-4 shrink-0 opacity-95" />
                                      <span className="text-[12px] font-semibold tracking-wide">Hardwares</span>
                                    </div>
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-white opacity-90 transition-transform duration-200 ${
                                        clubHardwaresSectionOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {clubHardwaresSectionOpen && (
                                    <div className="border-t border-gray-700/80 bg-[#263238]">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 border-b border-gray-700/80 py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                      >
                                        <ShoppingCart className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                        <span className="font-medium">General list of product purchased</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 py-2 pl-5 pr-2 text-left text-[11px] text-white hover:bg-[#2e3c43]"
                                      >
                                        <Wallet className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                        <span className="font-medium">List of payment</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between bg-blue-700 hover:bg-blue-600 border-b border-gray-700 py-2 pl-2 pr-2 text-left text-white"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Stamp className="w-4 h-4 shrink-0" />
                              <span className="text-[12px] font-semibold tracking-wide truncate">Administration</span>
                            </div>
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-90" />
                          </button>

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubMonitoringsOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Monitor className="h-4 w-4 shrink-0 opacity-95" />
                                  <span className="truncate text-[12px] font-medium text-white">
                                    Monitorings
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubMonitoringsOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubMonitoringsOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between border-b border-gray-600/70 py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Star className="h-4 w-4 shrink-0 text-white" strokeWidth={1.75} />
                                    <span className="text-[12px] font-medium text-yellow-300">Dashboard</span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Settings className="h-3.5 w-3.5 text-white opacity-90" />
                                    <ChevronRight className="h-3.5 w-3.5 text-white opacity-90" />
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between border-b border-gray-600/70 py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Camera className="h-4 w-4 shrink-0 text-white opacity-95" />
                                    <span className="text-[12px] font-medium text-yellow-300">
                                      General overview
                                    </span>
                                  </div>
                                  <Settings className="h-3.5 w-3.5 shrink-0 text-white opacity-90" />
                                </button>
                                <div className="border-b border-gray-600/70">
                                  <button
                                    type="button"
                                    onClick={() => setClubAdminSubscriptionsOpen((v) => !v)}
                                    className="flex w-full items-center justify-between py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <MousePointerClick className="h-4 w-4 shrink-0 text-white opacity-95" />
                                      <span className="text-[12px] font-medium text-yellow-300">
                                        Subscriptions
                                      </span>
                                    </div>
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-white opacity-90 transition-transform duration-200 ${
                                        clubAdminSubscriptionsOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {clubAdminSubscriptionsOpen && (
                                    <div className="border-t border-gray-600/60 bg-[#1e272a]">
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 border-b border-gray-600/50 py-2 pl-6 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#2a3438]"
                                      >
                                        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                        <span className="leading-snug">
                                          Overview of the courses or areas in a year
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 py-2 pl-6 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#2a3438]"
                                      >
                                        <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                        <span className="leading-snug">
                                          Overview of the courses or areas in a month
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#3d3d3d] hover:ring-1 hover:ring-inset hover:ring-gray-500"
                                >
                                  <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                                    <Calendar className="h-4 w-4 text-white opacity-95" />
                                    <span className="absolute text-[7px] font-bold leading-none text-white">
                                      7
                                    </span>
                                  </div>
                                  <span className="text-[12px] font-medium text-yellow-300">
                                    Checking expirations
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubAdminInsertNewItemOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <PlusCircle className="h-4 w-4 shrink-0 opacity-95" strokeWidth={1.75} />
                                  <span className="truncate text-[12px] font-medium text-white">
                                    Insert a new item
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubAdminInsertNewItemOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubAdminInsertNewItemOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                {CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS.map((group, gi) => (
                                  <div
                                    key={gi}
                                    className={
                                      gi > 0 ? 'border-t border-gray-600/70' : ''
                                    }
                                  >
                                    {group.map((item, ii) => (
                                      <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => {
                                          if ('path' in item && item.path) {
                                            router.push(item.path);
                                          }
                                        }}
                                        className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333] ${
                                          ii < group.length - 1
                                            ? 'border-b border-gray-600/50'
                                            : ''
                                        } ${'path' in item && item.path ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
                                      >
                                        {renderClubAdminInsertItemLeading(item)}
                                        <span className="min-w-0 leading-snug">{item.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubArchivesOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <FolderOpen className="h-4 w-4 shrink-0 opacity-95" />
                                  <span className="truncate text-[12px] font-medium text-white">
                                    Archives
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubArchivesOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubArchivesOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                {CLUB_ADMIN_ARCHIVE_GROUPS.map((group, gi) => (
                                  <div
                                    key={gi}
                                    className={
                                      gi > 0 ? 'border-t border-gray-600/70' : ''
                                    }
                                  >
                                    {group.map((item, ii) => (
                                      <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => {
                                          if ('path' in item && item.path) {
                                            if (isClubAccountUserType(userType)) {
                                              writeClubWorkspaceTab('my-entity');
                                              setCurrentTab('my-entity');
                                            }
                                            router.push(item.path);
                                          }
                                          // Handle click event
                                        }}
                                        className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333] ${
                                          ii < group.length - 1
                                            ? 'border-b border-gray-600/50'
                                            : ''
                                        }`}
                                      >
                                        {renderClubAdminArchiveLeading(item)}
                                        <span className="min-w-0 leading-snug">{item.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {(
                            [
                              { Icon: ShoppingCart, label: 'Shop', arrow: 'right' as const },
                              {
                                Icon: ScanLine,
                                label: 'Access Control',
                                arrow: 'down' as const,
                                yellow: true,
                              },
                            ] as const
                          ).map((row, idx) => {
                            const { Icon, label, arrow } = row;
                            const yellow = 'yellow' in row && row.yellow;
                            return (
                              <button
                                key={`${label}-${idx}`}
                                type="button"
                                className="flex w-full items-stretch border-b border-gray-600/90 bg-[#5c5c5c] text-left text-white hover:bg-[#656565]"
                              >
                                <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                    <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                  </div>
                                </div>
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Icon className="h-4 w-4 shrink-0 opacity-95" />
                                    <span
                                      className={`truncate text-[12px] font-medium ${yellow ? 'text-yellow-300' : 'text-white'}`}
                                    >
                                      {label}
                                    </span>
                                  </div>
                                  {arrow === 'right' ? (
                                    <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubGeneralSettingsOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Settings className="h-4 w-4 shrink-0 opacity-95" />
                                  <span
                                    className={`truncate text-[12px] font-medium ${
                                      clubGeneralSettingsOpen ? 'text-yellow-300' : 'text-white'
                                    }`}
                                  >
                                    General settings
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubGeneralSettingsOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubGeneralSettingsOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                {(
                                  [
                                    {
                                      Icon: UserCircle2,
                                      label: 'Clubs profile & permissions',
                                    },
                                    {
                                      Icon: Contact2,
                                      label: "Default for member's profiles",
                                    },
                                    {
                                      Icon: Fingerprint,
                                      label: 'Identification devices',
                                      panel: 'identification-devices' as const,
                                    },
                                    {
                                      Icon: List,
                                      label: 'Typologies of subscription',
                                      path: '/club/settings/typology_subscription',
                                    },
                                    { Icon: Settings, label: 'System settings' },
                                    {
                                      Icon: CreditCard,
                                      label: 'Accesses controls',
                                      path: '/club/settings/access_settings',
                                    },
                                    {
                                      Icon: Settings2,
                                      label: 'Other settings',
                                      path: '/club/settings/other_settings',
                                    },
                                    {
                                      Icon: LayoutGrid,
                                      label: 'Tables',
                                      path: '/club/settings/tables/areas',
                                    },
                                    {
                                      Icon: List,
                                      label: 'Customized fields',
                                      path: '/club/settings/customized-fields',
                                    },
                                    {
                                      Icon: Volume2,
                                      label: 'Access of outcome settings',
                                      path: '/club/settings/outcome_settings',
                                    },
                                    { Icon: Mic, label: 'Audio messages' },
                                    {
                                      Icon: Import,
                                      label: 'Load dbase from other apps',
                                      path: '/club/settings/preset_settings',
                                    },
                                    {
                                      Icon: Check,
                                      label: 'Enable-disable functions',
                                      path: '/club/settings/enable_disable_functions',
                                    },
                                  ] as const
                                ).map((item, subIdx, arr) => {
                                  const { Icon: SubIcon, label: subLabel } = item;
                                  const path = 'path' in item ? item.path : undefined;
                                  const panel =
                                    'panel' in item ? item.panel : undefined;
                                  return (
                                    <button
                                      key={subLabel}
                                      type="button"
                                      onClick={() => {
                                        if (panel === 'identification-devices') {
                                          onIdentificationDevicesClick?.();
                                          return;
                                        }
                                        if (path) {
                                          if (isClubAccountUserType(userType)) {
                                            writeClubWorkspaceTab('my-entity');
                                            setCurrentTab('my-entity');
                                          }
                                          const href: string =
                                            path === '/club/settings/outcome_settings' &&
                                            selectedEntityId
                                              ? `${path}?clubId=${encodeURIComponent(selectedEntityId)}`
                                              : path;
                                          router.push(href);
                                        }
                                      }}
                                      className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333] ${
                                        subIdx < arr.length - 1 ? 'border-b border-gray-600/70' : ''
                                      }`}
                                    >
                                      <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                      <span className="leading-snug">{subLabel}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubSecurityOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Lock className="h-4 w-4 shrink-0 opacity-95" />
                                  <span className="truncate text-[12px] font-medium text-yellow-300">
                                    Security
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubSecurityOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubSecurityOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between border-b border-gray-600/70 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333]"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Lock className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                    <span className="leading-snug">Access to Security menu</span>
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white opacity-90" />
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 border-b border-gray-600/70 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333]"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                  <span className="leading-snug">Change my password</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 border-b border-gray-600/70 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333]"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                  <span className="leading-snug">Management of your database</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333]"
                                >
                                  <Check className="h-3.5 w-3.5 shrink-0 opacity-95" />
                                  <span className="leading-snug">Authorizes this computer</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {(
                            [
                              { Icon: Pencil, label: 'Agenda and Planner', arrow: 'down' as const },
                              { Icon: ClipboardList, label: 'Notice-board', arrow: 'down' as const },
                              { Icon: BarChart3, label: 'Statistics & Trends', arrow: 'down' as const },
                              { Icon: Printer, label: 'Print reports', arrow: 'down' as const },
                              { Icon: ArrowUpSquare, label: 'Staff attendances', arrow: 'down' as const },
                              { Icon: Link2, label: 'CRM Customer care', arrow: 'down' as const },
                            ] as const
                          ).map((row, idx) => {
                            const { Icon, label } = row;
                            const yellow = 'yellow' in row && row.yellow;
                            return (
                              <button
                                key={`${label}-${idx}`}
                                type="button"
                                className="flex w-full items-stretch border-b border-gray-600/90 bg-[#5c5c5c] text-left text-white hover:bg-[#656565]"
                              >
                                <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                    <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                  </div>
                                </div>
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Icon className="h-4 w-4 shrink-0 opacity-95" />
                                    <span
                                      className={`truncate text-[12px] font-medium ${yellow ? 'text-yellow-300' : 'text-white'}`}
                                    >
                                      {label}
                                    </span>
                                  </div>
                                  <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                                </div>
                              </button>
                            );
                          })}

                          <div className="border-b border-gray-600/90">
                            <button
                              type="button"
                              onClick={() => setClubMarketingOpen((v) => !v)}
                              className="flex w-full items-stretch bg-[#5c5c5c] text-left text-white transition-colors hover:bg-[#656565]"
                            >
                              <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                  <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Monitor className="h-4 w-4 shrink-0 opacity-95" />
                                  <span className="truncate text-[12px] font-medium text-white">
                                    Marketing
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 opacity-90 transition-transform duration-200 ${
                                    clubMarketingOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>
                            {clubMarketingOpen && (
                              <div className="border-t border-gray-600/80 bg-[#2a2a2a]">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 border-b border-gray-600/50 py-2 pl-3 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#333]"
                                >
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                                  <span className="leading-snug">Club Presentation</span>
                                </button>
                                <div className="border-b border-gray-600/70">
                                  <button
                                    type="button"
                                    onClick={() => setClubMarketingClubStaffOpen((v) => !v)}
                                    className="flex w-full items-center justify-between border-b border-gray-600/50 py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="h-3 w-3 shrink-0 rounded-full bg-pink-400" />
                                      <span className="text-[12px] font-semibold text-white">
                                        Club Staff
                                      </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <Settings className="h-3.5 w-3.5 text-gray-400" />
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                                          clubMarketingClubStaffOpen ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </div>
                                  </button>
                                  {clubMarketingClubStaffOpen && (
                                    <div className="bg-[#252525]">
                                      {(
                                        [
                                          'All the Staff',
                                          'Instructors',
                                          'Personal Trainers',
                                          'Customer Care',
                                        ] as const
                                      ).map((subLabel, si, arr) => (
                                        <button
                                          key={subLabel}
                                          type="button"
                                          className={`flex w-full items-center gap-2 py-2 pl-6 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#2e2e2e] ${
                                            si < arr.length - 1
                                              ? 'border-b border-gray-600/50'
                                              : ''
                                          }`}
                                        >
                                          <span className="h-2 w-2 shrink-0 rounded-full bg-pink-400" />
                                          <span className="leading-snug">{subLabel}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="border-t border-gray-600/80">
                                  <button
                                    type="button"
                                    onClick={() => setClubMarketingCoursesOpen((v) => !v)}
                                    className="flex w-full items-center justify-between border-b border-gray-600/50 py-2 pl-3 pr-2 text-left transition-colors hover:bg-[#333]"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="h-3 w-3 shrink-0 rounded-full bg-amber-300" />
                                      <span className="text-[12px] font-semibold text-white">
                                        Courses
                                      </span>
                                    </div>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                                        clubMarketingCoursesOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {clubMarketingCoursesOpen && (
                                    <div className="bg-[#252525]">
                                      {(
                                        [
                                          'Weekly Plan of the courses',
                                          'Courses of the Day',
                                          'Timetable course by course',
                                          'Time Slots of the courses',
                                        ] as const
                                      ).map((subLabel, si, arr) => (
                                        <button
                                          key={subLabel}
                                          type="button"
                                          className={`flex w-full items-center gap-2 py-2 pl-6 pr-2 text-left text-[11px] font-medium text-white transition-colors hover:bg-[#2e2e2e] ${
                                            si < arr.length - 1
                                              ? 'border-b border-gray-600/50'
                                              : ''
                                          }`}
                                        >
                                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                                          <span className="leading-snug">{subLabel}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {(
                            [{ Icon: Briefcase, label: 'Utilities', arrow: 'down' as const }] as const
                          ).map((row, idx) => {
                            const { Icon, label } = row;
                            const yellow = 'yellow' in row && row.yellow;
                            return (
                              <button
                                key={`${label}-${idx}`}
                                type="button"
                                className="flex w-full items-stretch border-b border-gray-600/90 bg-[#5c5c5c] text-left text-white hover:bg-[#656565]"
                              >
                                <div className="flex w-9 shrink-0 items-center justify-center border-r border-gray-600/60 py-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-teal-800">
                                    <Move className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                                  </div>
                                </div>
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-2 pl-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Icon className="h-4 w-4 shrink-0 opacity-95" />
                                    <span
                                      className={`truncate text-[12px] font-medium ${yellow ? 'text-yellow-300' : 'text-white'}`}
                                    >
                                      {label}
                                    </span>
                                  </div>
                                  <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full bg-[#0f3f3a] border-b border-teal-700 py-2">
                    <div className="w-full bg-fuchsia-800 text-white border border-fuchsia-600/40">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[12px] font-extrabold tracking-wide uppercase">CLUB&apos;S MANAGEMENT</span>
                        <ChevronDown className="w-4 h-4 opacity-90" />
                      </div>
                    </div>
                    <div className="mx-3">
                      <button
                        type="button"
                        className="w-full mt-2 bg-blue-700 hover:bg-blue-600 text-white border border-white/25 transition-colors mx-3"
                      >
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-[12px] font-semibold">Services at my club</span>
                          <ChevronDown className="w-4 h-4 opacity-90" />
                        </div>
                      </button>

                      <button
                        type="button"
                        className="w-full mt-2 bg-blue-400 hover:bg-blue-300 text-white border border-white/25 transition-colors mx-3"
                      >
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-[12px] font-semibold">My administrative data</span>
                          <ChevronDown className="w-4 h-4 opacity-90" />
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {renderFriendsAndCommunitiesMenus({ showEvents: true })}
              </div>
            ) : (
              <>
                {/* Non-club entity types keep existing simple menu UI */}
                <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5" />
                    <span>{t('sidebar_user_guides')}</span>
                  </div>
                </button>

                {isTeamManagerUser && (
                  <>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5" />
                        <span>Team Management</span>
                      </div>
                    </button>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Athletes</span>
                      </div>
                    </button>
                  </>
                )}

                {userType === 'GROUP_ADMIN' && (
                  <>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Group Management</span>
                      </div>
                    </button>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Members</span>
                      </div>
                    </button>
                  </>
                )}

                {userType === 'COACH' && (
                  <>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Athlete Management</span>
                      </div>
                    </button>
                    <button className="w-full bg-teal-800 hover:bg-teal-700 text-white py-3 px-4 flex items-center justify-between transition-colors border-b border-teal-700">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        <span>Athletes</span>
                      </div>
                    </button>
                  </>
                )}

                {showSuggestMovesbook && (
                  <div className="py-3 px-3 bg-gray-850 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={handleSuggestMovesbookClick}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded text-sm font-medium transition-colors"
                    >
                      Suggest Movesbook to your friends
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
    <SelectClubForTopicsModal
      isOpen={clubTopicsPickerOpen}
      onClose={() => setClubTopicsPickerOpen(false)}
      clubs={clubsForTopicsPicker}
      onSelectClub={handleClubSelectedForTopics}
    />
    {youtubeModalOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="youtube-channel-modal-title"
          >
            <div className="w-full max-w-md overflow-hidden rounded border border-zinc-600 bg-zinc-800 shadow-2xl">
              <div
                id="youtube-channel-modal-title"
                className="flex items-center justify-between gap-2 bg-[#8b0000] px-3 py-2 text-sm font-semibold text-white"
              >
                <span className="min-w-0 flex-1">{t('modal_youtube_channel_title')}</span>
                <span className="flex shrink-0 gap-0.5 text-white/90" aria-hidden>
                  <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                  <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                  <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={youtubeUrlDraft}
                    onChange={(e) => setYoutubeUrlDraft(e.target.value)}
                    placeholder={t('modal_youtube_channel_placeholder')}
                    className="min-w-0 flex-1 rounded border border-zinc-500 bg-white px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={openYoutubeDraftInNewTab}
                    disabled={!normalizeYoutubeUrlForOpen(youtubeUrlDraft)}
                    title={t('modal_youtube_open_draft_tab')}
                    aria-label={t('modal_youtube_open_draft_tab')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Youtube className="h-5 w-5" />
                  </button>
                </div>
                {!youtubeDraftValid && (
                  <p className="text-xs text-amber-300">{t('modal_youtube_channel_invalid')}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setYoutubeModalOpen(false)}
                    className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600"
                  >
                    {t('btn_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!youtubeDraftValid || youtubeSaveLoading}
                    onClick={() => void handleSaveYoutubeUrl()}
                    className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {t('btn_save')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  );
}

