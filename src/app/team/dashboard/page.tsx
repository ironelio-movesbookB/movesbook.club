'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Loader2 } from 'lucide-react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import DarkSidebar from '@/components/DarkSidebar';
import SimpleFooter from '@/components/SimpleFooter';
import AddMemberModal from '@/components/AddMemberModal';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import CreateEntityModal from '@/components/entity/CreateEntityModal';
import RightSidebar from '@/components/dashboard/RightSidebar';
import DisplayOptionsToolbar from '@/app/my-page/components/DisplayOptionsToolbar';
import ManagedEntityDashboardBanner from '@/components/dashboard/ManagedEntityDashboardBanner';
import ChangeBannerModal, { type BannerAlignment } from '@/components/athlete/ChangeBannerModal';
import { getHeroBannerDisplayUrl } from '@/lib/profileBannerSequence';
import { getManagedEntityProfilePath } from '@/lib/dashboard/managedEntityDashboardLabels';
import { useDisplayLayoutOptions } from '@/hooks/useDisplayLayoutOptions';
import { useDashboardBannerProfile } from '@/hooks/useDashboardBannerProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import TeamGrid from './components/TeamGrid';
import { useTeamDashboard } from './hooks/useTeamDashboard';
import { useManagedEntityCreation } from '@/hooks/useManagedEntityCreation';
import {
  useEntityDirectAccessGuard,
  useEntityDirectAccessLockedForKind,
} from '@/hooks/useEntityDirectAccessGuard';
import { clearEntityCompanyLoginSession, isEntityWorkspaceSession } from '@/lib/entity/entityDirectAccessSession';
import { useEntityWorkspaceDashboardNav } from '@/hooks/useEntityWorkspaceDashboardNav';
import { writeClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';
import MyStaffFeedbacksPanel from '@/components/messages/MyStaffFeedbacksPanel';

function TeamDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const {
    user,
    loading,
    teams,
    formCreatedTeams,
    hasFormTeam,
    selectedTeamId,
    setSelectedTeamId,
    activeTab,
    setActiveTab,
    loadTeams,
    handleTeamSelect,
  } = useTeamDashboard();

  const entityDirectAccessLocked = useEntityDirectAccessLockedForKind('team');
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
  const { bannerProfile, setBannerProfile } = useDashboardBannerProfile(!loading && !!user);
  const [showChangeBannerModal, setShowChangeBannerModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showWorkoutSection, setShowWorkoutSection] = useState(false);
  const [showStaffFeedbacks, setShowStaffFeedbacks] = useState(false);
  /** My Team tab visible only after opening a team from the sidebar (hidden on My Page). */
  const [myEntityTabVisible, setMyEntityTabVisible] = useState(false);

  const entityCreation = useManagedEntityCreation({
    createApiPath: '/api/teams',
    responseEntityKey: 'team',
    entityKind: 'team',
    onReload: loadTeams,
    storageKey: 'selectedTeam',
    onEntityCreated: (id) => {
      setSelectedTeamId(id);
      setMyEntityTabVisible(true);
      setActiveTab('my-entity');
    },
  });

  const showMyEntityTab = useCallback(() => setMyEntityTabVisible(true), []);
  const hideMyEntityTab = useCallback(() => setMyEntityTabVisible(false), []);

  useEntityWorkspaceDashboardNav({
    kind: 'team',
    searchParams,
    router,
    entityDirectAccessLocked,
    activeTab,
    setActiveTab,
    setSelectedEntityId: setSelectedTeamId,
    setMyEntityTabVisible: setMyEntityTabVisible,
  });

  const handleMyPageTabClick = useCallback(() => {
    clearEntityCompanyLoginSession();
    hideMyEntityTab();
    setActiveTab('my-page');
  }, [hideMyEntityTab, setActiveTab]);

  const handleTabChange = useCallback(
    (tab: 'my-page' | 'my-entity') => {
      if (tab === 'my-page') {
        clearEntityCompanyLoginSession();
        hideMyEntityTab();
      }
      writeClubWorkspaceTab(tab);
      setActiveTab(tab);
    },
    [hideMyEntityTab, setActiveTab],
  );

  const handleTeamSelectWithTab = useCallback(
    (teamId: string) => {
      showMyEntityTab();
      writeClubWorkspaceTab('my-entity');
      setActiveTab('my-entity');
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedClub', teamId);
        localStorage.setItem('selectedTeam', teamId);
      }
      handleTeamSelect(teamId);
    },
    [showMyEntityTab, handleTeamSelect, setActiveTab],
  );

  // Reset workout section when switching to my-page; hide My Team tab on My Page
  useEffect(() => {
    if (activeTab === 'my-page') {
      setShowWorkoutSection(false);
      if (!isEntityWorkspaceSession('team')) {
        setMyEntityTabVisible(false);
      }
    }
  }, [activeTab]);

  // Auto-hide left sidebar when workout section opens
  useEffect(() => {
    if (showWorkoutSection) {
      setShowLeftSidebar(false);
    } else {
      setShowLeftSidebar(true);
    }
  }, [showWorkoutSection, setShowLeftSidebar]);

  const activeTeam = selectedTeamId
    ? formCreatedTeams.find((team) => team.id === selectedTeamId) ?? null
    : null;
  const bannerTeam = activeTeam ?? formCreatedTeams[0] ?? null;
  const dashboardShellActiveTab: 'my-page' | 'my-entity' =
    activeTab === 'my-entity' &&
    selectedTeamId &&
    (myEntityTabVisible || entityDirectAccessLocked)
      ? 'my-entity'
      : selectedTeamId && hasFormTeam
        ? activeTab
        : 'my-page';

  // Don't render if not authenticated
  if (loading || !user) {
    return null;
  }

  return (
    <div className="bg-gray-50 flex flex-col" style={{ minHeight: '100vh' }}>
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
          <div className="flex-shrink-0">
            <AdvertisementCarousel />
          </div>
        )}

        {showPersonalBanner && hasFormTeam && bannerTeam && (
          <div className="flex-shrink-0 px-4">
            <ManagedEntityDashboardBanner
              entityKind="team"
              entityName={bannerTeam.name ?? ''}
              entityId={bannerTeam.id}
              onEntityProfileClick={() => {
                router.push(getManagedEntityProfilePath('team', bannerTeam.id));
              }}
              coverImageUrl={getHeroBannerDisplayUrl(bannerProfile)}
              coverBannerAlignment={
                bannerProfile?.profileBannerAlignment === 'center' ? 'center' : 'default'
              }
              onCoverCameraClick={() => setShowChangeBannerModal(true)}
              showSponsored={dashboardShellActiveTab === 'my-page'}
              activeTab={dashboardShellActiveTab}
              showWorkoutSection={showWorkoutSection}
              onWorkoutsToggle={() => setShowWorkoutSection((v) => !v)}
            />
          </div>
        )}

        <div className="flex-1 flex gap-0">
          {showLeftSidebar && (
            <div className="w-80 flex-shrink-0 sticky top-0 self-start">
              <DarkSidebar
                userType={user?.userType || ''}
                entities={teams}
                selectedEntityId={selectedTeamId}
                clubMyClubTabVisible={myEntityTabVisible || entityDirectAccessLocked}
                hideMyPageTab={entityDirectAccessLocked}
                onEntitySelect={handleTeamSelectWithTab}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onMyPageClick={handleMyPageTabClick}
                onMyTeamClick={() => {
                  if (!myEntityTabVisible) return;
                  setActiveTab('my-entity');
                  if (selectedTeamId) {
                    window.location.href = `/my-team?teamId=${selectedTeamId}`;
                  } else if (formCreatedTeams.length > 0) {
                    window.location.href = `/my-team?teamId=${formCreatedTeams[0].id}`;
                  }
                }}
                onCreateTeamClick={entityCreation.openCreateFlow}
                onSuggestMovesbookClick={() => router.push('/users/notification_by_promocode')}
                onMyFeedbacksStaffClick={() => {
                  setActiveTab('my-page');
                  setShowStaffFeedbacks(true);
                }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col px-4">
            {showStaffFeedbacks ? (
              <MyStaffFeedbacksPanel onClose={() => setShowStaffFeedbacks(false)} />
            ) : (
              <>
            {activeTab === 'my-page' && (
              <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">My Page</h2>
                {!hasFormTeam ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Users className="w-20 h-20 mx-auto mb-6 opacity-60" />
                      <p className="text-2xl font-bold mb-2">Set up your team</p>
                      <p className="text-lg mb-4 max-w-md">
                        Expand <strong>My teams</strong> in the sidebar, click <strong>Create a team</strong>,
                        and save your team profile.
                      </p>
                      <button
                        type="button"
                        onClick={entityCreation.openCreateFlow}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                      >
                        Create a team
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
                    <p className="text-gray-700">
                      Your personal team manager page. Use the sidebar to open a team or manage
                      workouts.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'my-entity' && !showWorkoutSection && (
              <div className="bg-white rounded-lg shadow-sm border p-8 flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Your Team</h2>
                  <p className="text-gray-600 mb-6">Click on "Workouts section" in the navigation bar above to view and manage workouts.</p>
                  <button 
                    onClick={() => setShowWorkoutSection(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Go to Workouts Section
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'my-entity' && showWorkoutSection && (
              <TeamGrid
                teams={formCreatedTeams}
                onTeamSelect={handleTeamSelectWithTab}
                onCreateTeam={entityCreation.openCreateFlow}
              />
            )}
              </>
            )}
          </div>

          {showRightSidebar && (
            <RightSidebar
              onAddMember={() => setShowAddMemberModal(true)}
              workoutPlanLabel="Team Workout Plan"
              context={activeTab === 'my-page' ? 'my-page' : 'my-club'}
              activeTab={activeTab}
            />
          )}
          
          <AddMemberModal
            isOpen={showAddMemberModal}
            onClose={() => setShowAddMemberModal(false)}
            onAddNewUser={(data) => {
              console.log('Add new user with password:', data);
              setShowAddMemberModal(false);
            }}
            onAddExistingUser={(data) => {
              console.log('Add existing user:', data);
              setShowAddMemberModal(false);
            }}
            entityType="team"
          />

          <AdminPasswordConfirmModal
            isOpen={entityCreation.showAdminPasswordConfirm}
            onClose={() => entityCreation.setShowAdminPasswordConfirm(false)}
            onVerified={entityCreation.handleAdminPasswordVerified}
            adminUsername={user?.username ?? user?.name ?? 'username'}
            entityKind="team"
          />

          <CreateEntityModal
            key={entityCreation.createModalKey}
            entityKind="team"
            isOpen={entityCreation.showCreateModal}
            onClose={() => entityCreation.setShowCreateModal(false)}
            adminUsername={user?.username ?? user?.name ?? 'username'}
            saving={entityCreation.createSaving}
            onSave={entityCreation.handleCreateSave}
          />
        </div>
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

      <SimpleFooter />
    </div>
  );
}

export default function TeamDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <TeamDashboardContent />
    </Suspense>
  );
}
