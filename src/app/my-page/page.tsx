'use client';

import { useState, useEffect } from 'react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import DarkSidebar from '@/components/DarkSidebar';
import SimpleFooter from '@/components/SimpleFooter';
import AddMemberModal from '@/components/AddMemberModal';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useMyPageData } from './hooks/useMyPageData';
import { useMyPageHandlers } from './hooks/useMyPageHandlers';
import { getEntityType } from './utils/myPageUtils';
import {
  getDashboardPathForUserType,
  isClubAccountUserType,
  isGroupAccountUserType,
  isTeamAccountUserType,
  hasDedicatedDashboard,
} from '@/utils/dashboardRouting';
import WorkoutsSection from './components/WorkoutsSection';
import ProgressSection from './components/ProgressSection';
import SettingsSection from './components/SettingsSection';
import DisplayOptionsToolbar from './components/DisplayOptionsToolbar';
import PersonalBanner from './components/PersonalBanner';
import RightSidebar from './components/RightSidebar';
import { useDisplayLayoutOptions } from '@/hooks/useDisplayLayoutOptions';
import { useEntityDirectAccessGuard } from '@/hooks/useEntityDirectAccessGuard';
import {
  getEntityDirectAccessLock,
  getEntityDirectAccessProfilePath,
} from '@/lib/entity/entityDirectAccessSession';
import MyStaffFeedbacksPanel from '@/components/messages/MyStaffFeedbacksPanel';
import { getThemeColorById } from '@/lib/club/memberProfileTypes';

export default function MyPage() {
  const [activeSection, setActiveSection] = useState<'workouts' | 'progress' | 'settings' | 'staff-feedbacks'>('workouts');
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
  const [activeTab, setActiveTab] = useState<'my-page' | 'my-entity'>('my-page');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pageThemeColor, setPageThemeColor] = useState('#058592');

  const { user, loading } = useAuth();
  const router = useRouter();
  useEntityDirectAccessGuard(!loading && !!user);

  // All hooks must be called before any conditional returns
  const {
    clubs,
    clubProfiles,
    hasClubProfile,
    groups,
    teams,
    coachingGroups,
    myClubs,
    myTeams,
  } = useMyPageData(user);

  const {
    selectedClub,
    handleClubSelect,
    handleGroupSelect,
    handleTeamSelect,
    handleCoachingGroupSelect,
    handleMyClubSelect,
    handleMyTeamSelect,
  } = useMyPageHandlers();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedTeam');
      if (stored) setSelectedTeamId(stored);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const applyFromStorage = () => {
      try {
        const stored = localStorage.getItem('movesbook_mypage_theme_color');
        if (stored) setPageThemeColor(stored);
      } catch {
        /* ignore */
      }
    };
    applyFromStorage();

    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/user/member-profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const themeId = json?.owner?.otherReferences?.theme as string | undefined;
        if (cancelled || !themeId) return;
        const color = getThemeColorById(themeId);
        setPageThemeColor(color);
        try {
          localStorage.setItem('movesbook_mypage_theme_color', color);
          localStorage.setItem('movesbook_mypage_theme_id', themeId);
        } catch {
          /* ignore */
        }
      } catch {
        /* keep storage / default */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!isTeamAccountUserType(user?.userType || '')) return;
    if (teams.length === 0) return;
    setSelectedTeamId((prev) => {
      if (prev && teams.some((t: { id: string }) => t.id === prev)) return prev;
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('selectedTeam');
        if (stored && teams.some((t: { id: string }) => t.id === stored)) return stored;
      }
      return teams[0].id;
    });
  }, [teams, user?.userType]);

  useEffect(() => {
    if (!user || !isTeamAccountUserType(user.userType)) return;
    if (teams.length === 0 && activeTab === 'my-entity') {
      setActiveTab('my-page');
    }
  }, [teams.length, activeTab, user]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Team / group / coach / club / athlete accounts use their own dashboards
  useEffect(() => {
    if (!loading && user && hasDedicatedDashboard(user.userType)) {
      const lock = getEntityDirectAccessLock();
      if (lock) {
        router.replace(getEntityDirectAccessProfilePath(lock));
        return;
      }
      router.replace(getDashboardPathForUserType(user.userType));
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (
      user &&
      isClubAccountUserType(user.userType) &&
      !hasClubProfile &&
      activeTab === 'my-entity'
    ) {
      setActiveTab('my-page');
    }
  }, [user, hasClubProfile, activeTab]);

  // Don't render if not authenticated (after all hooks are called)
  if (loading || !user) {
    return null;
  }

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100vh', backgroundColor: pageThemeColor }}
    >      {/* Modern Navbar */}
      <ModernNavbar />

      {/* Display Options Toolbar - Always visible but can be collapsed */}
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

      <div className="flex-1 flex flex-col w-full py-6">
        {/* Advertisement Carousel - Top Section */}
        {showAdBanner && (
          <div className="mb-6 flex-shrink-0 px-4">
            <AdvertisementCarousel />
          </div>
        )}

        {/* Personal Banner - Horizontal Navigation Bar */}
        {showPersonalBanner ? (
          <PersonalBanner user={user} currentTab={activeTab}/>
        ) : null}

        {/* Main Content Area - Fills remaining space */}
        <div className="flex-1 flex gap-0">
          {/* Left Sidebar */}
          {showLeftSidebar && (
            <div className="w-80 flex-shrink-0 sticky top-0 self-start">
              <DarkSidebar
                userType={user?.userType || ''}
                entities={
                  isClubAccountUserType(user?.userType || '') ? clubProfiles :
                  user?.userType === 'ATHLETE' ? myClubs :
                  isTeamAccountUserType(user?.userType || '') ? teams :
                  isGroupAccountUserType(user?.userType || '') ? groups :
                  user?.userType === 'COACH' ? coachingGroups : []
                }
                athleteTeams={user?.userType === 'ATHLETE' ? myTeams : []}
                onAthleteTeamSelect={
                  user?.userType === 'ATHLETE' ? handleMyTeamSelect : undefined
                }
                selectedEntityId={
                  isClubAccountUserType(user?.userType || '') ? selectedClub :
                  user?.userType === 'ATHLETE'
                    ? (selectedClub ?? myClubs[0]?.id ?? null)
                    : isTeamAccountUserType(user?.userType || '')
                      ? (selectedTeamId ?? teams[0]?.id ?? null)
                      :
                  isGroupAccountUserType(user?.userType || '') ? null :
                  user?.userType === 'COACH' ? null : null
                }
                onEntitySelect={(id) => {
                  if (isClubAccountUserType(user?.userType || '')) {
                    handleClubSelect(id);
                  } else if (user?.userType === 'ATHLETE') {
                    handleMyClubSelect(id);
                  } else if (isTeamAccountUserType(user?.userType || '')) {
                    setSelectedTeamId(id);
                    handleTeamSelect(id);
                  } else if (isGroupAccountUserType(user?.userType || '')) {
                    handleGroupSelect(id);
                  } else if (user?.userType === 'COACH') {
                    handleCoachingGroupSelect(id);
                  }
                }}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onMyPageClick={() => setActiveTab('my-page')}
                onMyFeedbacksStaffClick={() => {
                  setActiveTab('my-page');
                  setActiveSection('staff-feedbacks');
                }}
                onMyClubClick={() => {
                  if (!hasClubProfile) return;
                  setActiveTab('my-entity');
                  if (selectedClub) {
                    window.location.href = `/my-club?clubId=${selectedClub}`;
                  } else if (clubProfiles.length > 0) {
                    window.location.href = `/my-club?clubId=${clubProfiles[0].id}`;
                  }
                }}
                onMyTeamClick={() => {
                  setActiveTab('my-entity');
                  if (teams.length > 0) {
                    window.location.href = `/my-team?teamId=${teams[0].id}`;
                  }
                }}
                onMyGroupClick={() => {
                  setActiveTab('my-entity');
                  if (groups.length > 0) {
                    window.location.href = `/my-group?groupId=${groups[0].id}`;
                  }
                }}
                onMyCoachingGroupClick={() => {
                  setActiveTab('my-entity');
                  if (coachingGroups.length > 0) {
                    window.location.href = `/my-coaching-group?groupId=${coachingGroups[0].id}`;
                  }
                }}
              />
            </div>
          )}

          {/* Main Content - Stretched to fill remaining space */}
          <div className="flex-1 min-w-0 flex flex-col px-4">
            {activeSection === 'staff-feedbacks' && (
              <MyStaffFeedbacksPanel onClose={() => setActiveSection('workouts')} />
            )}
            {activeSection === 'workouts' && <WorkoutsSection />}
            {activeSection === 'progress' && <ProgressSection />}
            {activeSection === 'settings' && <SettingsSection />}
          </div>

          {/* Right Sidebar */}
          {showRightSidebar && (
            <RightSidebar
              user={user}
              onAddMemberClick={() => setShowAddMemberModal(true)}
              activeTab={activeTab}
            />
          )}
        </div>

        {/* Add Member Modal */}
        <AddMemberModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onAddNewUser={(data) => {
            // Handle adding a new user (never registered)
            console.log('Add new user with password:', data);
            // TODO: Call API to add new user with password
            setShowAddMemberModal(false);
          }}
          onAddExistingUser={(data) => {
            // Handle adding existing Movesbook user
            console.log('Add existing user:', data);
            // TODO: Call API to add existing user with username and password
            setShowAddMemberModal(false);
          }}
          entityType={getEntityType(user?.userType)}
        />
        <SimpleFooter />
      </div>
    </div>
  );
}
