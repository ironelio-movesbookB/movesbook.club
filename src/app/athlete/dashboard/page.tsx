'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
import { 
  Calendar, 
  BarChart3, 
  Settings, 
  Dumbbell,
  Target,
  Award,
  Plus,
  CheckCircle,
  Eye,
  EyeOff,
  Users,
  Building2,
  ChevronRight,
  ChevronDown,
  UserCircle,
  Activity,
  TrendingUp,
  Home,
  Menu,
  HelpCircle,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  User,
  Save,
  Mail,
  Filter,
  Palette,
  ExternalLink,
  Star,
  Trophy,
  Grid,
  Download,
  MessageSquare,
  Loader2,
  Bell
} from 'lucide-react';

/** Static barbell / split icon (legacy toolbar, matches design reference). */
function BannerBarbellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 12"
      className={className}
      width={20}
      height={12}
      aria-hidden
    >
      <rect x="1" y="2" width="4" height="8" rx="0.5" fill="currentColor" />
      <rect x="19" y="2" width="4" height="8" rx="0.5" fill="currentColor" />
      <rect x="6" y="5" width="12" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import DarkSidebar from '@/components/DarkSidebar';
import SimpleFooter from '@/components/SimpleFooter';
import AddMemberModal from '@/components/AddMemberModal';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import WorkoutSection from '@/components/workouts/WorkoutSection';
import NutritionSection from '@/components/nutrition/NutritionSection';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatAudienceSelectModal from '@/components/chat/ChatAudienceSelectModal';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import type { ChatAudience } from '@/lib/chat/chatAudience';
import { useChatUnreadCount } from '@/hooks/useChatUnreadCount';
import BackgroundsColorsSettings from '@/components/settings/BackgroundsColorsSettings';
import ToolsSettings from '@/components/settings/ToolsSettings';
import FavouritesSettings from '@/components/settings/FavouritesSettings';
import MyBestSettings from '@/components/settings/MyBestSettings';
import GridDisplaySettings from '@/components/settings/GridDisplaySettings';
import NewsOGPPanel from '@/components/news/NewsOGPPanel';
import MyMusicPanel from '@/components/music/MyMusicPanel';
import MusicOGPPanel from '@/components/music/MusicOGPPanel';
import PostsPanel from '@/components/posts/PostsPanel';
import MyStaffFeedbacksPanel from '@/components/messages/MyStaffFeedbacksPanel';
import ClubNewsArchivePanel from '@/components/club/ClubNewsArchivePanel';
import ClubSharedNewsPanel from '@/components/club/ClubSharedNewsPanel';
import ClubMovesbookNewsPanel from '@/components/club/ClubMovesbookNewsPanel';
import AthleteLegacyBanner, {
  type AthleteLegacyBannerProfile,
} from '@/components/athlete/AthleteLegacyBanner';
import ChangeBannerModal, {
  type BannerAlignment,
} from '@/components/athlete/ChangeBannerModal';
import ChangeProfilePhotoModal from '@/components/athlete/ChangeProfilePhotoModal';
import { getHeroBannerDisplayUrl } from '@/lib/profileBannerSequence';
import AthleteMyPageRightSidebarExtras from '@/components/dashboard/AthleteMyPageRightSidebarExtras';
import AthleteMyClubRightSidebar from '@/components/dashboard/AthleteMyClubRightSidebar';
import MemberRegistrationInfoPanel from '@/components/member/MemberRegistrationInfoPanel';
import MemberVisitorContactActivitiesPanel from '@/components/member/MemberVisitorContactActivitiesPanel';
import { isClubAccountUserType, showSuggestMovesbookForTab } from '@/utils/dashboardRouting';
import {
  getEntityDirectAccessLock,
  getEntityDirectAccessProfilePath,
} from '@/lib/entity/entityDirectAccessSession';

type AthleteClubMainPanel =
  | 'default'
  | 'club-news'
  | 'club-news-ogp'
  | 'club-global-news'
  | 'club-movesbook-news';

function heroBannerStripBgUrl(p: AthleteLegacyBannerProfile | null): string {
  return getHeroBannerDisplayUrl(p);
}

// 2026-01-22 13:30 UTC - Placeholder component for avatar images (replaces Unsplash timeout issues)
const AvatarPlaceholder = ({ size = 'w-10 h-10' }: { size?: string }) => (
  <div className={`${size} rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
    <User size={size.includes('12') ? 24 : 20} />
  </div>
);

function AthleteDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { unreadCount: chatUnreadCount } = useChatUnreadCount();
  
  // All hooks must be called before any conditional returns
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'workouts'
    | 'nutrition'
    | 'progress'
    | 'settings'
    | 'personal-settings'
    | 'chat'
    | 'news'
    | 'movesbook-news'
    | 'mb-news'
    | 'posts'
    | 'music'
    | 'music-editor'
    | 'registration-info'
    | 'contact-activities'
    | 'staff-feedbacks'
  >('overview');
  const [showAdBanner, setShowAdBanner] = useState(true);
  const [showPersonalBanner, setShowPersonalBanner] = useState(true);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [musicExpanded, setMusicExpanded] = useState(false);
  const [clubAddSongsOgpOpen, setClubAddSongsOgpOpen] = useState(false);
  const [clubAddSongsOgpExpanded, setClubAddSongsOgpExpanded] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const showLegacyButtonBars = false;
  const [activeRightTab, setActiveRightTab] = useState<'actions-planner' | 'chat-panel'>('actions-planner');
  const [expandedActionsPlanner, setExpandedActionsPlanner] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-page' | 'my-entity'>('my-page');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showChatAudienceModal, setShowChatAudienceModal] = useState(false);
  const [chatAudience, setChatAudience] = useState<ChatAudience | null>(null);
  const [telegramAccount, setTelegramAccount] = useState('');
  const [userTelegramAccount, setUserTelegramAccount] = useState<string | null>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  /** Open Club Channel chat on My Club tab (member view). */
  const [clubChatOpen, setClubChatOpen] = useState(false);
  /** After Telegram join, open club chat instead of My Page audience picker. */
  const [pendingClubChatOpen, setPendingClubChatOpen] = useState(false);
  /** My Club → Club News panels (member view). */
  const [clubMainPanel, setClubMainPanel] = useState<AthleteClubMainPanel>('default');
  
  // Entities athlete belongs to
  const [myCoaches, setMyCoaches] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [bannerProfile, setBannerProfile] = useState<AthleteLegacyBannerProfile | null>(null);
  const [showChangeBannerModal, setShowChangeBannerModal] = useState(false);
  const [showChangeProfilePhotoModal, setShowChangeProfilePhotoModal] = useState(false);

  const loadBannerProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/profile', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBannerProfile({
          image: data.image,
          profileBanner: data.profileBanner,
          profileBannerAlignment: data.profileBannerAlignment,
          profileBannerSequence: data.profileBannerSequence,
          profileBannerVideo: data.profileBannerVideo,
          name: data.name,
          firstName: data.firstName,
          surname: data.surname,
        });
      }
    } catch (e) {
      console.error('Error loading profile for banner:', e);
    }
  }, []);

  // Current period and week data
  const [currentPeriod, setCurrentPeriod] = useState<{ name: string; color: string } | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(1);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Redirect if not athlete: club accounts use /club/dashboard (e.g. News → ?open=news); others use legacy my-page.
  useEffect(() => {
    if (user && !['ATHLETE', 'ADMIN'].includes(user.userType)) {
      if (isClubAccountUserType(user.userType)) {
        const lock = getEntityDirectAccessLock();
        if (lock) {
          router.replace(getEntityDirectAccessProfilePath(lock));
          return;
        }
        const q = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
        router.replace(q ? `/club/dashboard?${q}` : '/club/dashboard');
      } else {
        router.push('/my-page');
      }
    }
  }, [user, router]);

  // Open News/OGP, My Music, or Music editor when navigating with ?open=news / ?open=music / ?open=add-songs
  useEffect(() => {
    if (searchParams == null) return;
    const open = searchParams.get('open');
    if (open === 'news') {
      setActiveTab('my-page');
      setActiveSection('news');
      router.replace('/athlete/dashboard', { scroll: false });
    } else if (open === 'registration-info') {
      setActiveTab('my-page');
      setActiveSection('registration-info');
      router.replace('/athlete/dashboard', { scroll: false });
    } else if (open === 'music') {
      setActiveTab('my-page');
      setActiveSection('music');
      setMusicExpanded(false);
      router.replace('/athlete/dashboard', { scroll: false });
    } else if (open === 'add-songs') {
      setActiveTab('my-page');
      setActiveSection('music-editor');
      setMusicExpanded(false);
      router.replace('/athlete/dashboard', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (activeTab !== 'my-entity') {
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubChatOpen(false);
      setClubMainPanel('default');
    }
  }, [activeTab]);

  useEffect(() => {
    if (myClubs.length === 0 && activeTab === 'my-entity') {
      setActiveTab('my-page');
      setClubChatOpen(false);
      setClubMainPanel('default');
    }
  }, [myClubs.length, activeTab]);

  const openClubNewsPanel = useCallback((panel: Exclude<AthleteClubMainPanel, 'default'>) => {
    setActiveTab('my-entity');
    setClubChatOpen(false);
    setClubAddSongsOgpOpen(false);
    setClubAddSongsOgpExpanded(false);
    setClubMainPanel(panel);
  }, []);

  const openMyPageNewsSection = useCallback(
    (section: 'movesbook-news' | 'mb-news' | 'news') => {
      setActiveTab('my-page');
      setClubChatOpen(false);
      setClubAddSongsOgpOpen(false);
      setClubAddSongsOgpExpanded(false);
      setClubMainPanel('default');
      setNewsExpanded(false);
      setActiveSection(section);
    },
    []
  );

  // Load entities the athlete belongs to
  useEffect(() => {
    if (user && ['ATHLETE', 'ADMIN'].includes(user.userType)) {
      loadMyCoaches();
      loadMyTeams();
      loadMyClubs();
      loadMyGroups();
      loadCurrentWeekAndPeriod();
      loadTelegramAccount();
      loadBannerProfile();
    }
  }, [user, loadBannerProfile]);

  const loadTelegramAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/telegram-account', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserTelegramAccount(data.telegramAccount);
      }
    } catch (error) {
      console.error('Error loading Telegram account:', error);
    }
  };

  const handleChatPanelClick = () => {
    setPendingClubChatOpen(false);
    if (userTelegramAccount) {
      // Ask who they want to chat with before opening the panel
      setShowChatAudienceModal(true);
    } else {
      // User hasn't joined, show join modal
      setShowJoinModal(true);
    }
  };

  const openClubChat = useCallback(() => {
    const clubId = selectedClubId ?? myClubs[0]?.id ?? null;
    if (!clubId) {
      alert('Join a club first to use Club Chat.');
      return;
    }
    if (!selectedClubId) {
      setSelectedClubId(clubId);
    }
    setActiveTab('my-entity');
    setClubAddSongsOgpOpen(false);
    setClubMainPanel('default');
    setClubChatOpen(true);
  }, [selectedClubId, myClubs]);

  const handleClubChatClick = () => {
    const clubId = selectedClubId ?? myClubs[0]?.id ?? null;
    if (!clubId) {
      alert('Join a club first to use Club Chat.');
      return;
    }
    if (userTelegramAccount) {
      openClubChat();
    } else {
      setPendingClubChatOpen(true);
      setShowJoinModal(true);
    }
  };

  const handleChatAudienceSelect = (audience: ChatAudience) => {
    setChatAudience(audience);
    setShowChatAudienceModal(false);
    setActiveSection('chat');
  };

  const handleJoinChat = async () => {
    if (!telegramAccount.trim()) {
      alert('Please enter your Telegram account');
      return;
    }

    // Ensure it starts with @
    const formattedAccount = telegramAccount.startsWith('@') 
      ? telegramAccount 
      : `@${telegramAccount}`;

    setIsLoadingTelegram(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/telegram-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ telegramAccount: formattedAccount })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserTelegramAccount(formattedAccount);
          setShowJoinModal(false);
          setTelegramAccount('');
          if (pendingClubChatOpen) {
            setPendingClubChatOpen(false);
            openClubChat();
          } else {
            // After joining Telegram, pick who to chat with
            setShowChatAudienceModal(true);
          }
        } else {
          alert(data.error || 'Failed to save Telegram account');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save Telegram account');
      }
    } catch (error) {
      console.error('Error saving Telegram account:', error);
      alert('Error saving Telegram account. Please try again.');
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  // Hide right sidebar when workout section or personal settings opens
  useEffect(() => {
    if (activeTab === 'my-page' && (activeSection === 'workouts' || activeSection === 'nutrition' || activeSection === 'personal-settings')) {
      setShowRightSidebar(false);
    } else {
      setShowRightSidebar(true);
    }
  }, [activeTab, activeSection]);

  // Don't render if not authenticated (after all hooks are called)
  if (loading || !user) {
    return null;
  }

  const loadMyCoaches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/athletes/my-coaching-groups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyCoaches(data.coachingGroups || []);
      }
    } catch (error) {
      console.error('Error loading my coaches:', error);
    }
  };

  const loadMyTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/athletes/my-teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Error loading my teams:', error);
    }
  };

  const loadMyClubs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/athletes/my-clubs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const clubs = data.clubs || [];
        setMyClubs(clubs);
        if (clubs.length > 0) {
          setSelectedClubId((prev) => {
            if (prev && clubs.some((c: { id: string }) => c.id === prev)) {
              return prev;
            }
            if (typeof window !== 'undefined') {
              const stored = localStorage.getItem('selectedClub');
              if (stored && clubs.some((c: { id: string }) => c.id === stored)) {
                return stored;
              }
            }
            return clubs[0].id;
          });
        }
      }
    } catch (error) {
      console.error('Error loading my clubs:', error);
    }
  };

  const loadMyGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/athletes/my-groups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error loading my groups:', error);
    }
  };

  const loadCurrentWeekAndPeriod = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workouts/plan?type=CURRENT_WEEKS', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.plan?.weeks && data.plan.weeks.length > 0) {
          // Find the current week (week 2 in Section A)
          const currentWeekData = data.plan.weeks.find((w: any) => w.weekNumber === 2);
          if (currentWeekData) {
            setCurrentWeek(currentWeekData.originalWeekNumber || currentWeekData.weekNumber);
            
            // Get period from the current week's first day or week itself
            if (currentWeekData.period) {
              setCurrentPeriod({
                name: currentWeekData.period.name || 'Base',
                color: currentWeekData.period.color || '#14b8a6'
              });
            } else if (currentWeekData.days && currentWeekData.days.length > 0) {
              const firstDay = currentWeekData.days[0];
              if (firstDay.periodName && firstDay.periodColor) {
                setCurrentPeriod({
                  name: firstDay.periodName,
                  color: firstDay.periodColor
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading current week and period:', error);
    }
  };

  const storeSelectedEntity = (entityType: string, entityId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`selected${entityType}`, entityId);
    }
  };

  const handleMyCoachingGroupSelect = (groupId: string) => {
    storeSelectedEntity('CoachingGroup', groupId);
    window.location.href = `/my-coaching-group?groupId=${groupId}`;
  };

  const handleMyTeamSelect = (teamId: string) => {
    storeSelectedEntity('Team', teamId);
  };

  const handleAthleteClubSelect = (clubId: string) => {
    storeSelectedEntity('Club', clubId);
    setSelectedClubId(clubId);
  };

  const handleMyGroupSelect = (groupId: string) => {
    storeSelectedEntity('Group', groupId);
    window.location.href = `/my-group?groupId=${groupId}`;
  };

  return (
    <div className="bg-gray-50 flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="print:hidden">
        <ModernNavbar />
      </div>
      
      {/* Display Options Toolbar */}
      <div className={`bg-white border-b px-4 py-1 transition-all duration-300 print:hidden ${showToolbar ? '' : 'overflow-hidden'}`}>
        <div className={`flex items-center justify-between flex-wrap gap-2 transition-all duration-300 ${showToolbar ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showAdBanner} onChange={(e) => setShowAdBanner(e.target.checked)} className="w-4 h-4" />
              <span className="flex items-center gap-1">
                {showAdBanner ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Advertising Banner
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showPersonalBanner} onChange={(e) => setShowPersonalBanner(e.target.checked)} className="w-4 h-4" />
              <span className="flex items-center gap-1">
                {showPersonalBanner ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Personal Banner & Picture
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showLeftSidebar} onChange={(e) => setShowLeftSidebar(e.target.checked)} className="w-4 h-4" />
              <span className="flex items-center gap-1">
                {showLeftSidebar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Left Sidebar
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showRightSidebar} onChange={(e) => setShowRightSidebar(e.target.checked)} className="w-4 h-4" />
              <span className="flex items-center gap-1">
                {showRightSidebar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Right Sidebar
              </span>
            </label>
            {showLegacyButtonBars && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('overview');
                  }}
                  className="bg-blue-800/90 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer text-sm"
                >
                  Activity Overview
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('workouts');
                  }}
                  className="bg-blue-800/90 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer text-sm"
                >
                  My Workouts
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('nutrition');
                  }}
                  className="bg-green-800/90 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700/90 transition-colors cursor-pointer text-sm"
                >
                  My Nutrition
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
              <input type="checkbox" checked={showToolbar} onChange={(e) => setShowToolbar(e.target.checked)} className="w-4 h-4" />
              <span className="flex items-center gap-1 text-gray-600">
                {showToolbar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="font-medium">Display Options</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full py-2">
        {showAdBanner && (
          <div className="flex-shrink-0">
            <AdvertisementCarousel />
          </div>
        )}
        {showLegacyButtonBars && (
          <div className="flex-shrink-0">
            <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('overview');
                  }}
                  className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer"
                >
                  Activity Overview
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('workouts');
                  }}
                  className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer"
                >
                  My Workouts
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('nutrition');
                  }}
                  className="bg-green-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700/90 transition-colors cursor-pointer"
                >
                  My Nutrition
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legacy-style athlete banner (cover + avatar + club + sponsored) */}
        {showPersonalBanner && ['ATHLETE', 'ADMIN'].includes(user.userType) && (
          <div className="flex-shrink-0 px-0">
            <AthleteLegacyBanner
              profile={bannerProfile}
              primaryClubName={
                myClubs.find((c) => c.id === selectedClubId)?.name ?? myClubs[0]?.name
              }
              onCoverCameraClick={() => setShowChangeBannerModal(true)}
              onAvatarCameraClick={() => setShowChangeProfilePhotoModal(true)}
              t={t}
            />
          </div>
        )}

        {/* Personal Banner - Horizontal Navigation Bar */}
        {showPersonalBanner && (
          <div className="flex-shrink-0">
            <div className="bg-gray-800 overflow-hidden shadow-lg relative" style={{ height: '52px' }}>
              {/* Background image with subtle overlay (matches legacy: same cover as main banner when set) */}
              <div 
                className="absolute inset-0 bg-cover opacity-20"
                style={{
                  backgroundImage: `url(${heroBannerStripBgUrl(bannerProfile)})`,
                  backgroundSize: 'cover',
                  backgroundPosition:
                    bannerProfile?.profileBannerAlignment === 'center' ? 'center center' : 'center top',
                }}
              ></div>
              
              <div className="flex items-center justify-between px-4 text-sm h-full relative">
                {/* Legacy-style strip (static controls; logic wired later) */}
                <div className="flex items-center gap-4 min-w-0 overflow-x-hidden">
                  <button
                    type="button"
                    className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  >
                    <Home className="w-4 h-4 shrink-0" />
                    <span>Home</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Barbell tools"
                    className="bg-transparent border-0 text-sm font-sans text-gray-300 hover:text-white shrink-0 inline-flex items-center justify-center cursor-pointer rounded p-0.5 -mx-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  >
                    <BannerBarbellIcon className="text-current" />
                  </button>
                  <button
                    type="button"
                    className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap shrink-0 font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  >
                    FAQ
                  </button>
                  {showSuggestMovesbookForTab(user?.userType ?? 'ATHLETE', activeTab) ? (
                    <button
                      type="button"
                      onClick={() => router.push('/users/notification_by_promocode')}
                      className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap shrink-0 font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    >
                      Suggest Movesbook
                    </button>
                  ) : null}
                  <div className="inline-flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => router.push('/users/mub_page')}
                      className="bg-transparent border-0 text-sm font-sans text-yellow-400 hover:text-yellow-300 whitespace-nowrap font-medium cursor-pointer rounded px-1 py-0.5 -mx-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    >
                      Most used buttons
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/users/mub_page?edit=1')}
                      className="bg-transparent border-0 text-gray-400 hover:text-gray-200 cursor-pointer rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70"
                      aria-label="Most used buttons settings"
                      title="Most used buttons settings"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap shrink-0">
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded"
                    aria-label="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded"
                    aria-label="Messages"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                {/* Right side - Action buttons (only for My Page) */}
                {activeTab === 'my-page' && (
                  <div className="flex items-center gap-3 flex-wrap border-l border-gray-600/60 pl-3 sm:pl-4">
                    <button
                      onClick={() => {
                        setActiveTab('my-page');
                        setActiveSection('overview');
                      }}
                      className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Activity Overview
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('my-page');
                        setActiveSection('workouts');
                      }}
                      className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      My Workouts
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('my-page');
                        setActiveSection('nutrition');
                      }}
                      className="bg-green-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700/90 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      My Nutrition
                    </button>
                    <button
                      onClick={handleChatPanelClick}
                      className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded transition-colors whitespace-nowrap text-sm font-medium flex items-center gap-2 border border-gray-300"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat panel
                      <ChatUnreadBadge count={chatUnreadCount} />
                    </button>
                    <button
                      type="button"
                      className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded transition-colors whitespace-nowrap text-sm font-medium border border-gray-300"
                    >
                      {t('athlete_banner_upgrade_info')}
                    </button>
                    <button
                      type="button"
                      className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded transition-colors whitespace-nowrap text-sm font-medium border border-gray-300"
                    >
                      {t('athlete_banner_logger')}
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!showPersonalBanner && (
          <div className="flex-shrink-0">
            <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('overview');
                  }}
                  className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer"
                >
                  Activity Overview
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('workouts');
                  }}
                  className="bg-blue-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700/90 transition-colors cursor-pointer"
                >
                  My Workouts
                </button>
                <button
                  onClick={() => {
                    setActiveTab('my-page');
                    setActiveSection('nutrition');
                  }}
                  className="bg-green-800/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700/90 transition-colors cursor-pointer"
                >
                  My Nutrition
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-0">
          {/* Left Sidebar - Hidden when News Expand is on */}
          {showLeftSidebar && !newsExpanded && !musicExpanded && !clubAddSongsOgpExpanded && (
            <div className="w-80 flex-shrink-0 sticky top-0 self-start print:hidden">
              <DarkSidebar
                userType={user?.userType || ''}
                entities={myClubs}
                athleteTeams={myTeams}
                onAthleteTeamSelect={handleMyTeamSelect}
                selectedEntityId={selectedClubId ?? myClubs[0]?.id ?? null}
                onEntitySelect={handleAthleteClubSelect}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                profileImageFromDb={bannerProfile?.image}
                onProfileImageSaved={(patch) => {
                  if (patch.image !== undefined) {
                    setBannerProfile((prev) => ({ ...(prev ?? {}), image: patch.image }));
                  }
                }}
                onMyPageClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('overview');
                }}
                onPostsClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('posts');
                }}
                onRegistrationInfoClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('registration-info');
                }}
                onContactActivitiesClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('contact-activities');
                }}
                onMyFeedbacksStaffClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('staff-feedbacks');
                }}
                onMyClubClick={() => setActiveTab('my-entity')}
                onClubChatClick={handleClubChatClick}
                onClubAddSongsPlaylistsClick={() => {
                  // Same as navbar "Add Songs" → Music OGP editor
                  setActiveTab('my-page');
                  setClubChatOpen(false);
                  setClubAddSongsOgpOpen(false);
                  setClubAddSongsOgpExpanded(false);
                  setClubMainPanel('default');
                  setActiveSection('music-editor');
                  setMusicExpanded(false);
                }}
                onSuggestMovesbookClick={() => router.push('/users/notification_by_promocode')}
                onClubMusicPanelClick={() => {
                  // Same as navbar "Music Panel" → My Music panel
                  setActiveTab('my-page');
                  setClubChatOpen(false);
                  setClubAddSongsOgpOpen(false);
                  setClubAddSongsOgpExpanded(false);
                  setClubMainPanel('default');
                  setActiveSection('music');
                  setMusicExpanded(false);
                }}
                onClubMovesbookNewsSectionClick={() => openClubNewsPanel('club-movesbook-news')}
                onClubNewsSectionClick={() => openClubNewsPanel('club-news')}
                onClubOgpNewsSectionClick={() => openClubNewsPanel('club-news-ogp')}
                onClubGlobalNewsSectionClick={() => openClubNewsPanel('club-global-news')}
                onMyPageMovesbookNewsClick={() => openMyPageNewsSection('movesbook-news')}
                onMyPageNewsClick={() => openMyPageNewsSection('mb-news')}
                onMyPageOgpNewsClick={() => openMyPageNewsSection('news')}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className={`flex-1 min-w-0 flex flex-col ${activeTab === 'my-page' && activeSection === 'personal-settings' ? '' : 'px-4'}`}>
            {activeTab === 'my-page' && (
              <div className="flex-1 flex flex-col min-h-0">
                {activeSection === 'overview' && (
                  <AthleteOverview
                    t={t}
                    currentPeriod={currentPeriod}
                    currentWeek={currentWeek}
                  />
                )}
                {activeSection === 'workouts' && <WorkoutSection onClose={() => setActiveSection('overview')} />}
                {activeSection === 'nutrition' && <NutritionSection onClose={() => setActiveSection('overview')} />}
                {activeSection === 'progress' && <AthleteProgress t={t} />}
                {activeSection === 'settings' && <AthleteSettings t={t} />}
                {activeSection === 'personal-settings' && <PersonalSettingsContent t={t} user={user} />}
                {activeSection === 'chat' && chatAudience && (
                  <div className="flex-1 flex flex-col min-h-0 max-h-[75vh]">
                    <ChatPanel
                      key={chatAudience}
                      embedded
                      chatAudience={chatAudience}
                      onClose={() => {
                        setActiveSection('overview');
                        setChatAudience(null);
                      }}
                    />
                  </div>
                )}
                {activeSection === 'movesbook-news' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <ClubMovesbookNewsPanel
                      title="Movesbook News"
                      onClose={() => setActiveSection('overview')}
                    />
                  </div>
                )}
                {activeSection === 'mb-news' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <ClubNewsArchivePanel
                      title="News"
                      onClose={() => setActiveSection('overview')}
                    />
                  </div>
                )}
                {activeSection === 'news' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <NewsOGPPanel
                      title="OGP News"
                      onClose={() => {
                        setActiveSection('overview');
                        setNewsExpanded(false);
                      }}
                      embedded
                      isExpanded={newsExpanded}
                      onExpandReduce={() => setNewsExpanded((prev) => !prev)}
                    />
                  </div>
                )}
                {activeSection === 'music' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <MyMusicPanel
                      onClose={() => {
                        setActiveSection('overview');
                        setMusicExpanded(false);
                      }}
                      embedded
                      isExpanded={musicExpanded}
                      onExpandReduce={() => setMusicExpanded((prev) => !prev)}
                    />
                  </div>
                )}
                {activeSection === 'music-editor' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <MusicOGPPanel
                      onClose={() => {
                        setActiveSection('overview');
                        setMusicExpanded(false);
                      }}
                      embedded
                      isExpanded={musicExpanded}
                      onExpandReduce={() => setMusicExpanded((prev) => !prev)}
                    />
                  </div>
                )}
                {activeSection === 'posts' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <PostsPanel
                      onClose={() => setActiveSection('overview')}
                      embedded
                    />
                  </div>
                )}
                {activeSection === 'registration-info' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <MemberRegistrationInfoPanel
                      embedded
                      onClose={() => setActiveSection('overview')}
                    />
                  </div>
                )}
                {activeSection === 'contact-activities' && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <MemberVisitorContactActivitiesPanel
                      embedded
                      onClose={() => setActiveSection('overview')}
                    />
                  </div>
                )}
                {activeSection === 'staff-feedbacks' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <MyStaffFeedbacksPanel onClose={() => setActiveSection('overview')} />
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'my-entity' &&
              (clubAddSongsOgpOpen ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <NewsOGPPanel
                    onClose={() => {
                      setClubAddSongsOgpOpen(false);
                      setClubAddSongsOgpExpanded(false);
                    }}
                    embedded
                    isExpanded={clubAddSongsOgpExpanded}
                    onExpandReduce={() => setClubAddSongsOgpExpanded((prev) => !prev)}
                  />
                </div>
              ) : clubChatOpen && (selectedClubId ?? myClubs[0]?.id) ? (
                <div className="flex-1 flex flex-col min-h-0 max-h-[75vh]">
                  <ChatPanel
                    key={`club-chat-${selectedClubId ?? myClubs[0]?.id}`}
                    embedded
                    clubId={selectedClubId ?? myClubs[0]?.id}
                    chatAudience="club-member"
                    onClose={() => setClubChatOpen(false)}
                  />
                </div>
              ) : clubMainPanel === 'club-news' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {selectedClubId ?? myClubs[0]?.id ? (
                    <ClubNewsArchivePanel
                      clubId={(selectedClubId ?? myClubs[0]?.id)!}
                      sharedWithClubOnly
                      title="News"
                      onClose={() => setClubMainPanel('default')}
                    />
                  ) : (
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                      <p className="py-12 text-center text-sm text-gray-600">
                        Select a club in the sidebar to view shared News.
                      </p>
                    </div>
                  )}
                </div>
              ) : clubMainPanel === 'club-news-ogp' ? (
                <div className="flex min-h-0 flex-1 flex-col py-4">
                  {selectedClubId ?? myClubs[0]?.id ? (
                    <NewsOGPPanel
                      title="OGP News"
                      clubId={(selectedClubId ?? myClubs[0]?.id)!}
                      sharedWithClubOnly
                      onClose={() => {
                        setClubMainPanel('default');
                        setClubAddSongsOgpExpanded(false);
                      }}
                      embedded
                      isExpanded={clubAddSongsOgpExpanded}
                      onExpandReduce={() => setClubAddSongsOgpExpanded((prev) => !prev)}
                    />
                  ) : (
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                      <p className="py-12 text-center text-sm text-gray-600">
                        Select a club in the sidebar to view shared OGP News.
                      </p>
                    </div>
                  )}
                </div>
              ) : clubMainPanel === 'club-global-news' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {selectedClubId ?? myClubs[0]?.id ? (
                    <ClubSharedNewsPanel
                      clubId={(selectedClubId ?? myClubs[0]?.id)!}
                      type="all"
                      title="Club News & OGP News"
                    />
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-6 shadow-sm">
                      <p className="py-12 text-center text-sm text-gray-600">
                        Select a club in the sidebar to view Club News & OGP News.
                      </p>
                    </div>
                  )}
                </div>
              ) : clubMainPanel === 'club-movesbook-news' ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ClubMovesbookNewsPanel title="Movesbook News" />
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border p-8 pt-12 flex-1 flex items-start justify-center">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">My Club Page</h2>
                    <p className="text-gray-600 mb-6">Club-related content will be displayed here.</p>
                  </div>
                </div>
              ))}
          </div>

          {/* Right Sidebar - Hidden when Personal Settings or News Expand is on */}
          {!(activeTab === 'my-page' && activeSection === 'personal-settings') &&
            showRightSidebar &&
            !newsExpanded &&
            !musicExpanded &&
            !clubAddSongsOgpExpanded && (
            <div className="w-80 flex-shrink-0 print:hidden">
              <div className="bg-white shadow-sm border h-full flex flex-col overflow-y-auto">
                {activeTab === 'my-entity' ? (
                  <AthleteMyClubRightSidebar />
                ) : (
                  <div className="p-4 flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('sidebar_quick_actions')}</h3>
                    <div className="space-y-2">
                      {/* Personal Settings Button - FIRST button in Quick Actions */}
                      <button
                        onClick={() => setActiveSection('personal-settings')}
                        className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                      >
                        <Settings className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          Personal settings
                        </span>
                      </button>

                      {/* Quick Actions for My Page (Athlete) */}
                      <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group">
                        <Calendar className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          {t('sidebar_plan_new_workout')}
                        </span>
                      </button>

                      <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group">
                        <CalendarDays className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          {t('sidebar_plan_3_weeks')}
                        </span>
                      </button>

                      <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group">
                        <CalendarCheck className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          {t('sidebar_plan_of_year')}
                        </span>
                      </button>

                      <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group">
                        <CheckSquare className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          {t('sidebar_log_completed')}
                        </span>
                      </button>

                      <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group">
                        <Save className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 text-left">
                          {t('sidebar_save_session')}
                        </span>
                      </button>
                    </div>

                    {activeTab === 'my-page' ? (
                      <AthleteMyPageRightSidebarExtras />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="print:hidden">
        <SimpleFooter />
      </div>

      <ChangeBannerModal
        isOpen={showChangeBannerModal}
        onClose={() => setShowChangeBannerModal(false)}
        onSaved={(patch) => {
          setBannerProfile((prev) => {
            const next = { ...(prev ?? {}) };
            if (patch.profileBanner !== undefined) next.profileBanner = patch.profileBanner;
            if (patch.profileBannerAlignment !== undefined) {
              next.profileBannerAlignment = patch.profileBannerAlignment;
            }
            if (patch.profileBannerSequence !== undefined) {
              next.profileBannerSequence = patch.profileBannerSequence;
            }
            if (patch.profileBannerVideo !== undefined) {
              next.profileBannerVideo = patch.profileBannerVideo;
            }
            return next;
          });
        }}
        currentBannerPath={bannerProfile?.profileBanner}
        currentAlignment={
          (bannerProfile?.profileBannerAlignment as BannerAlignment | null | undefined) ?? 'default'
        }
        currentBannerSequenceJson={bannerProfile?.profileBannerSequence}
        currentBannerVideoPath={bannerProfile?.profileBannerVideo}
        t={t}
      />

      <ChangeProfilePhotoModal
        isOpen={showChangeProfilePhotoModal}
        onClose={() => setShowChangeProfilePhotoModal(false)}
        onSaved={(patch) => {
          setBannerProfile((prev) => {
            const next = { ...(prev ?? {}) };
            if (patch.image !== undefined) next.image = patch.image;
            return next;
          });
          if (patch.image !== undefined && typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem('user');
              if (raw) {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                parsed.image = patch.image;
                localStorage.setItem('user', JSON.stringify(parsed));
              }
            } catch {
              /* ignore */
            }
          }
        }}
        currentImagePath={bannerProfile?.image}
        t={t}
      />

      {/* Join Chat Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Provide 'I've joined' confirmation button
              </h2>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Let them confirm inside Movesbook chat page UI
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telegram Account
                  </label>
                  <input
                    type="text"
                    value={telegramAccount}
                    onChange={(e) => setTelegramAccount(e.target.value)}
                    placeholder="@username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your Telegram username (e.g., @username)
                  </p>
                </div>

                {!telegramAccount && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-700 mb-2">
                      Don't have a Telegram account?
                    </p>
                    <a
                      href="https://telegram.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                    >
                      Create a Telegram account
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setTelegramAccount('');
                    setPendingClubChatOpen(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinChat}
                  disabled={isLoadingTelegram || !telegramAccount.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingTelegram ? 'Saving...' : "I've joined"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChatAudienceModal && (
        <ChatAudienceSelectModal
          onSelect={handleChatAudienceSelect}
          onCancel={() => setShowChatAudienceModal(false)}
        />
      )}

    </div>
  );
}

function AthleteOverview({
  t,
  currentPeriod,
  currentWeek,
}: {
  t: (key: string) => string;
  currentPeriod: { name: string; color: string } | null;
  currentWeek: number;
}) {
  const [stats, setStats] = useState({
    thisWeekWorkouts: 0,
    thisMonthWorkouts: 0,
    totalMoveframes: 0,
    completionRate: 0
  });
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkoutStats();
  }, []);

  const loadWorkoutStats = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Load current weeks plan to get workout data
      const response = await fetch('/api/workouts/plan?type=CURRENT_WEEKS', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const weeks = data.plan?.weeks || [];
        const storageZone = data.plan?.storageZone;
        
        // Calculate statistics
        let thisWeekCount = 0;
        let totalWorkouts = 0;
        let totalMoveframes = 0;
        const recentWorkoutsList: any[] = [];
        
        weeks.forEach((week: any) => {
          week.days?.forEach((day: any) => {
            day.workouts?.forEach((workout: any) => {
              totalWorkouts++;
              if (week.weekNumber === 2) { // Current week in Section A
                thisWeekCount++;
              }
              totalMoveframes += workout.moveframes?.length || 0;
              
              // Collect recent workouts
              if (recentWorkoutsList.length < 5) {
                recentWorkoutsList.push({
                  id: workout.id,
                  name: workout.name,
                  date: day.date,
                  weekNumber: week.weekNumber,
                  dayNumber: day.dayNumber,
                  storageZone: storageZone,
                  moveframeCount: workout.moveframes?.length || 0
                });
              }
            });
          });
        });
        
        setStats({
          thisWeekWorkouts: thisWeekCount,
          thisMonthWorkouts: totalWorkouts,
          totalMoveframes: totalMoveframes,
          completionRate: totalWorkouts > 0 ? Math.round((totalMoveframes / (totalWorkouts * 5)) * 100) : 0
        });
        
        setRecentWorkouts(recentWorkoutsList);
      }
    } catch (error) {
      console.error('Error loading workout stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workout data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col print-content activity-overview">
      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-300">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('dashboard_activity_overview')}</h1>
        <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between mb-6 print:hidden gap-4">
        <h2 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
          {t('dashboard_activity_overview')}
        </h2>

        {/* Period/Week/Next event summary (matches banner cards) */}
        <div className="flex flex-wrap gap-3 items-start justify-end">
          <div className="h-[84px] bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 text-white min-w-[120px] flex flex-col justify-between">
            <p className="text-xs text-gray-400 uppercase leading-none">Active Season</p>
            <p className="font-semibold leading-tight">2025 Indoor</p>
            <p className="text-sm leading-tight whitespace-nowrap">Championship</p>
          </div>
          <div
            className="h-[84px] backdrop-blur-sm rounded-lg p-3 text-white min-w-[120px] flex flex-col justify-between"
            style={{
              backgroundColor: currentPeriod?.color ? `${currentPeriod.color}e6` : '#14b8a6e6',
            }}
          >
            <p className="text-xs text-gray-200 uppercase leading-none">Period</p>
            <p className="font-semibold leading-tight">{currentPeriod?.name || 'Base'}</p>
            <p className="text-sm leading-tight whitespace-nowrap">Conditioning</p>
          </div>
          <div className="h-[84px] bg-blue-600/90 backdrop-blur-sm rounded-lg p-3 text-white min-w-[100px] flex flex-col justify-between">
            <p className="text-xs text-gray-200 uppercase leading-none">Week</p>
            <p className="text-2xl font-bold leading-none">{currentWeek}</p>
          </div>
          <div className="h-[84px] bg-green-700/90 backdrop-blur-sm rounded-lg p-3 text-white min-w-[140px] flex flex-col justify-between">
            <p className="text-xs text-gray-200 uppercase leading-none">Next Event</p>
            <p className="font-semibold leading-tight whitespace-nowrap">Continental Cup 21 Jul</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 page-break-avoid">
        <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium opacity-90">{t('dashboard_this_week')}</h3>
            <Calendar className="w-5 h-5 opacity-90 print:hidden" />
          </div>
          <p className="text-3xl font-bold mt-3">{stats.thisWeekWorkouts} {t('dashboard_workouts_count')}</p>
        </div>
        <div className="stat-card bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium opacity-90">Total Workouts</h3>
            <Target className="w-5 h-5 opacity-90 print:hidden" />
          </div>
          <p className="text-3xl font-bold mt-3">{stats.thisMonthWorkouts}</p>
        </div>
        <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium opacity-90">Total Moveframes</h3>
            <Award className="w-5 h-5 opacity-90 print:hidden" />
          </div>
          <p className="text-3xl font-bold mt-3">{stats.totalMoveframes}</p>
        </div>
      </div>
      <div className="flex-1 page-break-avoid">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard_recent_activity_feed')}</h3>
        {recentWorkouts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50 print:hidden" />
            <p className="text-lg">No workouts planned yet</p>
            <p className="text-sm mt-2 print:hidden">Click "My Workouts" to start planning</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentWorkouts.map((workout) => {
              // For Section A (storage zones A, B, C), display week/day numbers instead of dates
              const isTemplateSection = workout.storageZone === 'A' || workout.storageZone === 'B' || workout.storageZone === 'C';
              const dateInfo = isTemplateSection 
                ? `Week ${workout.weekNumber}, Day ${workout.dayNumber}`
                : new Date(workout.date).toLocaleDateString();
              
              return (
                <div key={workout.id} className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 page-break-avoid">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{workout.name || 'Workout Session'}</h4>
                      <p className="text-sm text-gray-500">
                        {dateInfo} • {workout.moveframeCount} moveframes
                      </p>
                    </div>
                    <Activity className="w-6 h-6 text-blue-500 print:hidden" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AthleteWorkouts({ t }: { t: (key: string) => string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboard_my_workouts')}</h2>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg">
          {t('dashboard_add_workout')}
        </button>
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard_personal_workout_plans')}</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Dumbbell className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Training Plan #{item}</h4>
                  <p className="text-sm text-gray-500">Active • 5 workouts scheduled</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Progress: 60%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AthleteProgress({ t }: { t: (key: string) => string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard_progress_analytics')}</h2>
      <div className="grid grid-cols-2 gap-6 flex-1">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-60" />
            <p className="text-lg font-medium">Progress Chart</p>
            <p className="text-sm mt-2">Your workout progress over time</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-60" />
            <p className="text-lg font-medium">Performance Trends</p>
            <p className="text-sm mt-2">Track your improvements</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AthleteSettings({ t }: { t: (key: string) => string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('sidebar_settings')}</h2>
      <div className="space-y-4 flex-1">
        <div className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all duration-200">
          <h3 className="font-semibold text-gray-900 mb-3 text-lg">Profile Settings</h3>
          <p className="text-gray-600">Manage your personal information and preferences</p>
        </div>
        <div className="p-6 border-2 border-gray-200 rounded-xl hover:border-green-300 transition-all duration-200">
          <h3 className="font-semibold text-gray-900 mb-3 text-lg">Workout Preferences</h3>
          <p className="text-gray-600">Customize your workout experience and default settings</p>
        </div>
      </div>
      <SimpleFooter />
    </div>
  );
}

function PersonalSettingsContent({ t, user }: { t: (key: string) => string; user: any }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'backgrounds' | 'tools' | 'favourites' | 'mybest' | 'grid'>('backgrounds');
  const [loading, setLoading] = useState(false);
  const userLanguage = user?.language || 'en';

  const loadDefaultSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/settings/load-defaults?language=${userLanguage}`);
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const token = localStorage.getItem('token');
          if (token) {
            await fetch('/api/user/settings/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(data.settings)
            });
          }
          
          alert(`✅ Default settings for ${data.language.toUpperCase()} loaded and applied successfully!`);
        } else {
          alert('Failed to load default settings. Please try again.');
        }
      } else {
        alert('Failed to load default settings. Please try again.');
      }
    } catch (error) {
      console.error('Error loading default settings:', error);
      alert('Error loading default settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const settingsSections = [
    { id: 'backgrounds' as const, label: 'Backgrounds & Colors', icon: Palette },
    { id: 'tools' as const, label: 'Tools', icon: Settings },
    { id: 'favourites' as const, label: 'Favourites', icon: Star },
    { id: 'mybest' as const, label: 'My Best', icon: Trophy },
    { id: 'grid' as const, label: 'Grid Display Mode', icon: Grid },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings size={24} />
            <span>Personal Settings</span>
          </h2>
          <p className="text-sm text-gray-300 mt-1">
            Language: <span className="font-semibold">{userLanguage.toUpperCase()}</span> - Configure your personal preferences
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex-1">
          <p className="text-sm text-gray-800">
            <strong>Your Personal Settings</strong> - Configure your own preferences
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Optional: Load {userLanguage.toUpperCase()} defaults created by admins as a starting template
          </p>
        </div>
        <button
          onClick={loadDefaultSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download size={16} />
          <span>{loading ? 'Loading...' : 'Load Admin Defaults'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <nav className="p-4 space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSettingsTab(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSettingsTab === section.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeSettingsTab === 'backgrounds' && <BackgroundsColorsSettings />}
          {activeSettingsTab === 'tools' && <ToolsSettings isAdmin={false} userType="ATHLETE" />}
          {activeSettingsTab === 'favourites' && <FavouritesSettings />}
          {activeSettingsTab === 'mybest' && <MyBestSettings />}
          {activeSettingsTab === 'grid' && <GridDisplaySettings />}
        </div>
      </div>

      {/* Footer - Auto-save enabled, no manual save button needed */}
      <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end flex-shrink-0">
        <p className="text-sm text-gray-600 italic">
          ✓ All changes are saved automatically
        </p>
      </div>
    </div>
  );
}

export default function AthleteDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <AthleteDashboardContent />
    </Suspense>
  );
}
