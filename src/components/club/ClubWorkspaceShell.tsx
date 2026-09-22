'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import DarkSidebar from '@/components/DarkSidebar';
import RightSidebar from '@/components/dashboard/RightSidebar';
import SimpleFooter from '@/components/SimpleFooter';
import DisplayOptionsToolbar from '@/app/my-page/components/DisplayOptionsToolbar';
import { useDisplayLayoutOptions } from '@/hooks/useDisplayLayoutOptions';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  canAccessClubMembersArchive,
  canAccessClubWorkspace,
  canAccessManagedArchiveShell,
  isManagedEntityAdminUserType,
  isTeamAccountUserType,
  showSuggestMovesbookForTab,
} from '@/utils/dashboardRouting';
import {
  getClubMyPageDisplayName,
  getFormCreatedClubsSortedByCreatedAt,
  sortClubsByCreatedAtAsc,
  userHasClubProfile,
} from '@/lib/club/clubSidebarLabel';
import {
  readClubWorkspaceTab,
  readSelectedClubHint,
  writeClubWorkspaceTab,
  writeClubFormProfileHint,
  isClubWorkspacePath,
  type ClubWorkspaceTab,
} from '@/lib/club/clubWorkspaceTab';
import ClubDashboardMyPageBanner from '@/app/club/dashboard/components/ClubDashboardMyPageBanner';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import CreateClubModal, { type CreateClubFormPayload } from '@/components/club/CreateClubModal';
import ChangeBannerModal, { type BannerAlignment } from '@/components/athlete/ChangeBannerModal';
import type { AthleteLegacyBannerProfile } from '@/components/athlete/AthleteLegacyBanner';
import { getHeroBannerDisplayUrl } from '@/lib/profileBannerSequence';
import {
  ClubWorkspaceContext,
  type ClubMyPageNewsPanel,
} from '@/contexts/ClubWorkspaceContext';
import { clubProfilePayloadForApi } from '@/lib/club/clubProfilePayload';
import { type CreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota.shared';
import {
  canCreateAnotherCompany,
  getCreatableCompaniesLimit,
  isCreatableCompaniesUnlimited,
  remainingCreatableCompanies,
} from '@/lib/admin/subscriptionManageableUsers';
import { SUBSCRIPTION_SETTINGS_UPDATED_EVENT } from '@/lib/admin/subscriptionSettingsMock';
import { getDefaultVersionId } from '@/lib/registration/waysToGetStarted';
import {
  applyEntityBannerOnSave,
  applyEntityLogoOnSave,
} from '@/lib/entity/applyEntityLogoOnSave';
import {
  useEntityDirectAccessGuard,
  useEntityDirectAccessLockedForKind,
} from '@/hooks/useEntityDirectAccessGuard';
import { clearEntityCompanyLoginSession, isEntityWorkspaceSession } from '@/lib/entity/entityDirectAccessSession';
import { fetchPcuAlert } from '@/lib/user/pcuAlertClient';
import { usePcuAlert } from '@/contexts/PcuAlertContext';
import { useEntityWorkspaceDashboardNav } from '@/hooks/useEntityWorkspaceDashboardNav';
import TopBar from '@/app/club/dashboard/components/topbar/TopBar';
import MyStaffFeedbacksPanel from '@/components/messages/MyStaffFeedbacksPanel';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatAudienceSelectModal from '@/components/chat/ChatAudienceSelectModal';
import type { ChatAudience } from '@/lib/chat/chatAudience';

function ClubWorkspaceShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { showAlert } = usePcuAlert();
  const clubDirectAccessLocked = useEntityDirectAccessLockedForKind('club');
  useEntityDirectAccessGuard(!loading && !!user);

  const {
    showAdBanner,
    showPersonalBanner,
    showLeftSidebar,
    showRightSidebar,
    setShowAdBanner,
    setShowPersonalBanner,
    setShowLeftSidebar,
    setShowRightSidebar,
  } = useDisplayLayoutOptions();

  const [clubs, setClubs] = useState<any[]>([]);
  const [clubsLoaded, setClubsLoaded] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClubWorkspaceTab>('my-page');
  const [bannerProfile, setBannerProfile] = useState<AthleteLegacyBannerProfile | null>(null);
  const [showChangeBannerModal, setShowChangeBannerModal] = useState(false);
  const [showAdminPasswordConfirm, setShowAdminPasswordConfirm] = useState(false);
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [createClubModalKey, setCreateClubModalKey] = useState(0);
  const [createClubSaving, setCreateClubSaving] = useState(false);
  const [myClubTabVisible, setMyClubTabVisible] = useState(false);
  const [subscriptionSettingId, setSubscriptionSettingId] = useState<number | null>(null);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [showStaffFeedbacks, setShowStaffFeedbacks] = useState(false);
  const [userTelegramAccount, setUserTelegramAccount] = useState<string | null>(null);
  const [telegramAccount, setTelegramAccount] = useState('');
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showChatAudienceModal, setShowChatAudienceModal] = useState(false);
  const [chatAudience, setChatAudience] = useState<ChatAudience | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [myPageNewsPanel, setMyPageNewsPanel] = useState<ClubMyPageNewsPanel>(null);

  const showMyClubTab = useCallback(() => {
    setMyClubTabVisible(true);
  }, []);

  const hideMyClubTab = useCallback(() => {
    setMyClubTabVisible(false);
  }, []);

  useEntityWorkspaceDashboardNav({
    kind: 'club',
    searchParams,
    router,
    entityDirectAccessLocked: clubDirectAccessLocked,
    activeTab,
    setActiveTab,
    setSelectedEntityId: setSelectedClubId,
    setMyEntityTabVisible: setMyClubTabVisible,
  });

  const isTeamWorkspaceUser = Boolean(user && isTeamAccountUserType(user.userType));

  const formClubs = useMemo(() => {
    // Teams are not "form-created clubs"; show all owned teams in the shell sidebar.
    if (isTeamWorkspaceUser) return sortClubsByCreatedAtAsc(clubs);
    return getFormCreatedClubsSortedByCreatedAt(clubs);
  }, [clubs, isTeamWorkspaceUser]);

  const creatableCompaniesQuota = useMemo((): CreatableCompaniesQuota | null => {
    void settingsRevision;
    const created = formClubs.length;
    const limit = getCreatableCompaniesLimit(subscriptionSettingId);
    if (limit == null) return null;

    const unlimited = isCreatableCompaniesUnlimited(limit);
    return {
      limit,
      created,
      remaining: remainingCreatableCompanies(limit, created),
      canCreate: canCreateAnotherCompany(limit, created),
      unlimited,
    };
  }, [formClubs.length, subscriptionSettingId, settingsRevision]);

  const hasFormClub = formClubs.length > 0;
  const activeClub = selectedClubId
    ? formClubs.find((c) => c.id === selectedClubId) ?? null
    : null;
  const bannerClub = activeClub ?? formClubs[0] ?? null;
  const shellActiveTab: ClubWorkspaceTab = activeClub ? activeTab : 'my-page';

  const loadClubs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      if (user && isTeamAccountUserType(user.userType)) {
        const response = await fetch('/api/teams/my-teams', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const list = (data.teams || []) as { id: string }[];
          setClubs(list);
          writeClubFormProfileHint(list.length > 0);
          const savedId = localStorage.getItem('selectedClub');
          setSelectedClubId((prev) => {
            if (prev && list.some((t) => t.id === prev)) return prev;
            if (savedId && list.some((t) => t.id === savedId)) return savedId;
            if (list[0]?.id) {
              localStorage.setItem('selectedClub', list[0].id);
              return list[0].id;
            }
            return prev;
          });
        }
        return;
      }

      const response = await fetch('/api/clubs/my-clubs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.clubs || [];
        setClubs(list);
        writeClubFormProfileHint(userHasClubProfile(list));
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setClubsLoaded(true);
    }
  }, [user]);

  const loadSubscriptionSettingId = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/user/member-registration-info', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        const fallbackId = getDefaultVersionId('club');
        if (fallbackId) setSubscriptionSettingId(fallbackId);
        return;
      }
      const data = (await response.json()) as { subscriptionSettingId?: number };
      if (typeof data.subscriptionSettingId === 'number') {
        setSubscriptionSettingId(data.subscriptionSettingId);
      }
    } catch {
      /* optional */
    }
  }, []);

  const loadBannerProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/user/profile', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
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
    } catch {
      /* optional */
    }
  }, []);

  const loadTelegramAccount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/user/telegram-account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserTelegramAccount(data.telegramAccount ?? null);
      }
    } catch (error) {
      console.error('Error loading Telegram account:', error);
    }
  }, []);

  const handleChatPanelClick = useCallback(() => {
    setShowStaffFeedbacks(false);
    writeClubWorkspaceTab('my-page');
    setActiveTab('my-page');
    if (userTelegramAccount) {
      setShowChatAudienceModal(true);
    } else {
      setShowJoinModal(true);
    }
  }, [userTelegramAccount]);

  const handleChatAudienceSelect = useCallback((audience: ChatAudience) => {
    setChatAudience(audience);
    setShowChatAudienceModal(false);
    setShowStaffFeedbacks(false);
    setShowChatPanel(true);
  }, []);

  const handleJoinChat = useCallback(async () => {
    if (!telegramAccount.trim()) {
      alert('Please enter your Telegram account');
      return;
    }

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ telegramAccount: formattedAccount }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserTelegramAccount(formattedAccount);
          setShowJoinModal(false);
          setTelegramAccount('');
          setShowChatAudienceModal(true);
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
  }, [telegramAccount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedClubId = localStorage.getItem('selectedClub');
    if (savedClubId) setSelectedClubId(savedClubId);
    const savedTab = readClubWorkspaceTab();
    if (savedTab) setActiveTab(savedTab);
  }, []);

  useEffect(() => {
    void loadSubscriptionSettingId();
  }, [loadSubscriptionSettingId]);

  useEffect(() => {
    const refresh = () => setSettingsRevision((value) => value + 1);
    window.addEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/my-club')) {
      const clubFromUrl = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
      ).get('clubId');
      const clubId = clubFromUrl ?? selectedClubId ?? localStorage.getItem('selectedClub');
      if (clubId) {
        if (!selectedClubId) setSelectedClubId(clubId);
        localStorage.setItem('selectedClub', clubId);
        setActiveTab('my-entity');
        writeClubWorkspaceTab('my-entity');
      }
      return;
    }

    /** Website settings / display opened from My Club must keep My Club tab active. */
    if (pathname?.startsWith('/WebsiteSettings')) {
      setActiveTab('my-entity');
      writeClubWorkspaceTab('my-entity');
      return;
    }

    const savedTab = readClubWorkspaceTab();
    const hasClubContext = Boolean(selectedClubId) || readSelectedClubHint();

    if (isClubWorkspacePath(pathname) && hasClubContext && savedTab === 'my-entity') {
      setActiveTab('my-entity');
      return;
    }

    if (savedTab) setActiveTab(savedTab);
  }, [pathname, selectedClubId]);

  const canUseClubShell = Boolean(user && canAccessClubWorkspace(user.userType));
  const onMembersArchivePath = Boolean(pathname?.startsWith('/clubMembers'));
  const onManagedArchiveShell = Boolean(
    user && canAccessManagedArchiveShell(user.userType, pathname),
  );
  const canUseMembersArchive = Boolean(
    user &&
      (canUseClubShell ||
        onManagedArchiveShell ||
        (onMembersArchivePath && canAccessClubMembersArchive(user.userType))),
  );
  /**
   * Narrow archive-only shell for non-club users who are not Team/Coach/Group admins.
   * Team/Coach/Group use my-entity (TEAM'S MANAGEMENT) on archive routes.
   */
  const archiveOnlyMembersAccess = Boolean(
    user &&
      onMembersArchivePath &&
      canAccessClubMembersArchive(user.userType) &&
      !canAccessClubWorkspace(user.userType) &&
      !isManagedEntityAdminUserType(user.userType),
  );

  useEffect(() => {
    if (archiveOnlyMembersAccess) return;
    if (clubsLoaded && !hasFormClub && activeTab === 'my-entity') {
      setActiveTab('my-page');
      writeClubWorkspaceTab('my-page');
    }
  }, [archiveOnlyMembersAccess, clubsLoaded, hasFormClub, activeTab]);

  useEffect(() => {
    if (archiveOnlyMembersAccess) return;
    if (clubsLoaded && !selectedClubId && activeTab === 'my-entity') {
      setActiveTab('my-page');
      writeClubWorkspaceTab('my-page');
    }
  }, [archiveOnlyMembersAccess, clubsLoaded, selectedClubId, activeTab]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || loading) return;
    if (canUseMembersArchive) return;
    router.push('/my-page');
  }, [user, loading, router, canUseMembersArchive]);

  /**
   * Team / Coach / Group on shared archive routes must stay on My Team (my-entity)
   * so TEAM'S MANAGEMENT → Archives remains clickable.
   */
  useEffect(() => {
    if (!user || loading) return;
    if (!isManagedEntityAdminUserType(user.userType)) return;
    if (canAccessClubWorkspace(user.userType)) return;
    if (!onManagedArchiveShell && !onMembersArchivePath) return;

    setMyClubTabVisible(true);
    setActiveTab('my-entity');
    writeClubWorkspaceTab('my-entity');
  }, [user, loading, onManagedArchiveShell, onMembersArchivePath]);

  useEffect(() => {
    if (!archiveOnlyMembersAccess) return;
    setActiveTab('my-entity');
    writeClubWorkspaceTab('my-entity');
    setMyClubTabVisible(true);
  }, [archiveOnlyMembersAccess]);

  useEffect(() => {
    if (!user) return;
    if (canUseClubShell || canUseMembersArchive) {
      void loadClubs();
      void loadBannerProfile();
      void loadTelegramAccount();
    }
  }, [user, canUseClubShell, canUseMembersArchive, loadClubs, loadBannerProfile, loadTelegramAccount]);

  const handleTabChange = useCallback((tab: ClubWorkspaceTab) => {
    if (tab === 'my-page') {
      clearEntityCompanyLoginSession();
      hideMyClubTab();
      setMyPageNewsPanel(null);
    } else {
      setShowChatPanel(false);
      setChatAudience(null);
      setShowStaffFeedbacks(false);
      setMyPageNewsPanel(null);
    }
    writeClubWorkspaceTab(tab);
    setActiveTab(tab);
  }, [hideMyClubTab]);

  const handleClubSelect = useCallback(
    async (clubId: string) => {
      const openWorkspace = () => {
        localStorage.setItem('selectedClub', clubId);
        if (isTeamWorkspaceUser) {
          localStorage.setItem('selectedTeam', clubId);
        }
        setSelectedClubId(clubId);
        writeClubWorkspaceTab('my-entity');
        setActiveTab('my-entity');
        setMyPageNewsPanel(null);
        showMyClubTab();
      };

      if (!isTeamWorkspaceUser && !isEntityWorkspaceSession('club')) {
        const alert = await fetchPcuAlert('login', user?.language || 'en', clubId);
        if (alert) {
          showAlert(alert, openWorkspace);
          return;
        }
      }

      openWorkspace();
    },
    [showAlert, showMyClubTab, user?.language, isTeamWorkspaceUser],
  );

  const handleMyPageTabClick = useCallback(() => {
    clearEntityCompanyLoginSession();
    hideMyClubTab();
    writeClubWorkspaceTab('my-page');
    setActiveTab('my-page');
    setShowChatPanel(false);
    setChatAudience(null);
    setMyPageNewsPanel(null);
    if (isTeamWorkspaceUser) {
      router.push('/team/dashboard');
      return;
    }
    if (pathname !== '/club/dashboard') {
      router.push('/club/dashboard');
    }
  }, [hideMyClubTab, pathname, router, isTeamWorkspaceUser]);

  const handleMyClubTabClick = useCallback(() => {
    const entityId = selectedClubId ?? formClubs[0]?.id ?? null;
    if (!entityId) return;

    if (!selectedClubId) {
      localStorage.setItem('selectedClub', entityId);
      setSelectedClubId(entityId);
    }

    writeClubWorkspaceTab('my-entity');
    setActiveTab('my-entity');
    setMyPageNewsPanel(null);
    showMyClubTab();

    if (isTeamWorkspaceUser) {
      localStorage.setItem('selectedTeam', entityId);
      // Stay on current archive route when already in Archives; otherwise open My Team.
      if (
        pathname?.startsWith('/clubMembers') ||
        pathname?.startsWith('/clubs/') ||
        pathname?.startsWith('/club/staff')
      ) {
        return;
      }
      router.push(`/my-team?teamId=${encodeURIComponent(entityId)}`);
      return;
    }

    router.push(`/my-club?clubId=${encodeURIComponent(entityId)}`);
  }, [selectedClubId, formClubs, router, isTeamWorkspaceUser, pathname, showMyClubTab]);

  const handleMyTeamClick = useCallback(() => {
    handleMyClubTabClick();
  }, [handleMyClubTabClick]);

  const openCreateClubFlow = () => {
    if (creatableCompaniesQuota && !creatableCompaniesQuota.canCreate) {
      showAlert({
        title: 'Company limit reached',
        bodyHtml: `<p>You cannot create more companies for this subscription version.</p><p><strong>Limit:</strong> ${creatableCompaniesQuota.limit} · <strong>Already created:</strong> ${creatableCompaniesQuota.created}</p>`,
      });
      return;
    }
    setShowAdminPasswordConfirm(true);
  };

  const handleAdminPasswordVerified = () => {
    setShowAdminPasswordConfirm(false);
    setCreateClubModalKey((k) => k + 1);
    setShowCreateClubModal(true);
  };

  const handleCreateClubSave = async (payload: CreateClubFormPayload) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not signed in');

    setCreateClubSaving(true);
    try {
      const response = await fetch('/api/clubs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ create: true, ...clubProfilePayloadForApi(payload) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create club');
      }
      const clubId = data.club?.id as string | undefined;
      if (clubId && (payload.logoFile || payload.removeLogo)) {
        await applyEntityLogoOnSave('club', clubId, payload);
      }
      if (clubId && (payload.bannerFile || payload.removeBanner)) {
        await applyEntityBannerOnSave('club', clubId, payload);
      }
      await loadClubs();
      if (clubId) {
        setSelectedClubId(clubId);
        localStorage.setItem('selectedClub', clubId);
        writeClubFormProfileHint(true);
        writeClubWorkspaceTab('my-entity');
        setActiveTab('my-entity');
        showMyClubTab();
      }
      setShowCreateClubModal(false);
    } finally {
      setCreateClubSaving(false);
    }
  };

  const goToDashboardPanel = useCallback(
    (
      panel:
        | 'identification-devices'
        | 'outcome-settings'
        | 'news'
        | 'mb-news'
        | 'suggest-movesbook'
        | 'chat'
        | 'club-news'
        | 'club-news-ogp'
        | 'club-global-news'
        | 'club-movesbook-news'
    ) => {
      if (!hasFormClub) return;
      const clubId = selectedClubId ?? formClubs[0]?.id ?? null;
      if (!selectedClubId && clubId) {
        setSelectedClubId(clubId);
        localStorage.setItem('selectedClub', clubId);
      }
      writeClubWorkspaceTab('my-entity');
      setActiveTab('my-entity');
      setMyPageNewsPanel(null);

      if (panel === 'outcome-settings') {
        const qs = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';
        router.push(`/club/settings/outcome_settings${qs}`);
        return;
      }

      const query =
        panel === 'news'
          ? 'open=news'
          : panel === 'mb-news'
            ? 'panel=mb-news'
            : `panel=${panel}`;
      router.push(`/club/dashboard?${query}`);
    },
    [formClubs, hasFormClub, router, selectedClubId],
  );

  const openMyPageNewsPanel = useCallback(
    (panel: Exclude<ClubMyPageNewsPanel, null>) => {
      setShowStaffFeedbacks(false);
      setShowChatPanel(false);
      setChatAudience(null);
      writeClubWorkspaceTab('my-page');
      setActiveTab('my-page');
      setMyPageNewsPanel(panel);
      if (pathname !== '/club/dashboard') {
        router.push('/club/dashboard');
      }
    },
    [pathname, router],
  );

  if (loading || !user || !canUseMembersArchive) {
    return null;
  }

  return (
    <ClubWorkspaceContext.Provider
      value={{
        activeTab: shellActiveTab,
        selectedClubId,
        myPageNewsPanel,
        setMyPageNewsPanel,
      }}
    >
    <div className="bg-gray-50 flex flex-col min-h-screen">
      <ModernNavbar />

      <DisplayOptionsToolbar
        showAdBanner={showAdBanner}
        showPersonalBanner={showPersonalBanner}
        showLeftSidebar={showLeftSidebar}
        showRightSidebar={showRightSidebar}
        onToggleAdBanner={setShowAdBanner}
        onTogglePersonalBanner={setShowPersonalBanner}
        onToggleLeftSidebar={setShowLeftSidebar}
        onToggleRightSidebar={setShowRightSidebar}
      />

      <div className="flex-1 flex flex-col w-full py-2">
        {showAdBanner && (
          <div className="flex-shrink-0 px-4">
            <AdvertisementCarousel />
          </div>
        )}

        {showPersonalBanner && hasFormClub && bannerClub && (
          <ClubDashboardMyPageBanner
            clubName={getClubMyPageDisplayName(bannerClub)}
            clubId={bannerClub.id}
            onClubProfileClick={() => {
              router.push(`/my-club?clubId=${encodeURIComponent(bannerClub.id)}`);
            }}
            coverImageUrl={getHeroBannerDisplayUrl(bannerProfile)}
            coverBannerAlignment={
              bannerProfile?.profileBannerAlignment === 'center' ? 'center' : 'default'
            }
            onCoverCameraClick={() => setShowChangeBannerModal(true)}
            onSuggestMovesbookClick={() => goToDashboardPanel('suggest-movesbook')}
            showSuggestMovesbook={showSuggestMovesbookForTab(user.userType, shellActiveTab)}
            showSponsored={shellActiveTab === 'my-page'}
          />
        )}

        <div className="flex-1 flex gap-0 min-h-0 py-2 px-4">
          {showLeftSidebar && (
            <aside className="w-80 flex-shrink-0 sticky top-0 self-start">
              <DarkSidebar
                userType={user.userType}
                entities={formClubs}
                selectedEntityId={selectedClubId}
                clubProfileLoaded={clubsLoaded}
                clubMyClubTabVisible={
                  myClubTabVisible ||
                  clubDirectAccessLocked ||
                  archiveOnlyMembersAccess ||
                  (isTeamWorkspaceUser && Boolean(selectedClubId))
                }
                hideMyPageTab={clubDirectAccessLocked || archiveOnlyMembersAccess}
                onEntitySelect={handleClubSelect}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onMyPageClick={handleMyPageTabClick}
                onMyClubClick={handleMyClubTabClick}
                onMyTeamClick={isTeamWorkspaceUser ? handleMyTeamClick : undefined}
                onClubAddSongsPlaylistsClick={() => router.push('/add-songs')}
                onClubMusicPanelClick={() => router.push('/music-panel')}
                onIdentificationDevicesClick={() => goToDashboardPanel('identification-devices')}
                onAccessOutcomeSettingsClick={() => goToDashboardPanel('outcome-settings')}
                onSuggestMovesbookClick={() => goToDashboardPanel('suggest-movesbook')}
                onClubChatClick={() => goToDashboardPanel('chat')}
                onClubNewsSectionClick={() => goToDashboardPanel('club-news')}
                onClubMovesbookNewsSectionClick={() => goToDashboardPanel('club-movesbook-news')}
                onClubOgpNewsSectionClick={() => goToDashboardPanel('club-news-ogp')}
                onClubGlobalNewsSectionClick={() => goToDashboardPanel('club-global-news')}
                onMyPageMovesbookNewsClick={() => openMyPageNewsPanel('movesbook-news')}
                onMyPageNewsClick={() => openMyPageNewsPanel('mb-news')}
                onMyPageOgpNewsClick={() => openMyPageNewsPanel('ogp-news')}
                onCreateClubClick={openCreateClubFlow}
                creatableCompaniesQuota={creatableCompaniesQuota}
                onMyFeedbacksStaffClick={() => {
                  setShowChatPanel(false);
                  setChatAudience(null);
                  setMyPageNewsPanel(null);
                  setActiveTab('my-page');
                  setShowStaffFeedbacks(true);
                }}
              />
            </aside>
          )}

          <main className="flex-1 min-w-0 flex flex-col px-4 overflow-y-auto">
            <TopBar onChatPanelClick={handleChatPanelClick} />
            {showStaffFeedbacks ? (
              <MyStaffFeedbacksPanel onClose={() => setShowStaffFeedbacks(false)} />
            ) : showChatPanel && chatAudience ? (
              <div className="flex-1 flex flex-col min-h-0 max-h-[75vh]">
                <ChatPanel
                  key={chatAudience}
                  embedded
                  chatAudience={chatAudience}
                  userType={user.userType}
                  onClose={() => {
                    setShowChatPanel(false);
                    setChatAudience(null);
                  }}
                />
              </div>
            ) : (
              children
            )}
          </main>

          {showRightSidebar && (
            <RightSidebar
              context={shellActiveTab === 'my-entity' ? 'my-club' : 'my-page'}
              activeTab={shellActiveTab}
              onAddMember={() => undefined}
              isClubAccount
              athleteMyPageRightSidebar={shellActiveTab === 'my-page'}
              athleteMyClubRightSidebar={shellActiveTab === 'my-entity'}
            />
          )}
        </div>
      </div>

      <AdminPasswordConfirmModal
        isOpen={showAdminPasswordConfirm}
        onClose={() => setShowAdminPasswordConfirm(false)}
        onVerified={handleAdminPasswordVerified}
        adminUsername={user.username ?? user.name ?? 'username'}
      />

      <CreateClubModal
        key={createClubModalKey}
        isOpen={showCreateClubModal}
        onClose={() => setShowCreateClubModal(false)}
        adminUsername={user.username ?? user.name ?? 'username'}
        saving={createClubSaving}
        onSave={handleCreateClubSave}
      />

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

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="p-6">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                Provide &apos;I&apos;ve joined&apos; confirmation button
              </h2>

              <div className="mb-6">
                <p className="mb-4 text-sm text-gray-600">
                  Let them confirm inside Movesbook chat page UI
                </p>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Telegram Account
                  </label>
                  <input
                    type="text"
                    value={telegramAccount}
                    onChange={(e) => setTelegramAccount(e.target.value)}
                    placeholder="@username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your Telegram username (e.g., @username)
                  </p>
                </div>

                {!telegramAccount && (
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="mb-2 text-sm text-gray-700">
                      Don&apos;t have a Telegram account?
                    </p>
                    <a
                      href="https://telegram.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Create a Telegram account
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setTelegramAccount('');
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleJoinChat()}
                  disabled={isLoadingTelegram || !telegramAccount.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          userType={user.userType}
          onSelect={handleChatAudienceSelect}
          onCancel={() => setShowChatAudienceModal(false)}
        />
      )}

      <SimpleFooter />
    </div>
    </ClubWorkspaceContext.Provider>
  );
}

export default function ClubWorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ClubWorkspaceShellInner>{children}</ClubWorkspaceShellInner>
    </Suspense>
  );
}
