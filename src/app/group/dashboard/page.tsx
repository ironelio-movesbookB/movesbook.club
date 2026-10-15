'use client';

import SharingNotifications from '@/components/sharing/SharingNotifications';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { 
  Users, 
  Dumbbell,
  BarChart3,
  Calendar,
  Settings,
  UserCircle,
  Plus,
  Target,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Menu,
  HelpCircle,
  CalendarDays,
  CalendarCheck,
  CheckSquare,
  Save,
  Archive,
  FolderOpen,
  CalendarRange,
  Mail,
  Filter,
  Loader2,
} from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import {
  filterFormCreatedEntities,
  useManagedEntityCreation,
} from '@/hooks/useManagedEntityCreation';
import MyStaffFeedbacksPanel from '@/components/messages/MyStaffFeedbacksPanel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDashboardPathForUserType, isGroupAccountUserType } from '@/utils/dashboardRouting';
import {
  useEntityDirectAccessGuard,
  useEntityDirectAccessLockedForKind,
} from '@/hooks/useEntityDirectAccessGuard';
import { clearEntityCompanyLoginSession, isEntityWorkspaceSession } from '@/lib/entity/entityDirectAccessSession';
import { useEntityWorkspaceDashboardNav } from '@/hooks/useEntityWorkspaceDashboardNav';

function GroupDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const entityDirectAccessLocked = useEntityDirectAccessLockedForKind('group');
  useEntityDirectAccessGuard(!loading && !!user);
  
  // All hooks must be called before any conditional returns
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
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-page' | 'my-entity'>('my-page');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'actions-planner' | 'chat-panel'>('actions-planner');
  const [expandedActionsPlanner, setExpandedActionsPlanner] = useState(true);
  const [showWorkoutSection, setShowWorkoutSection] = useState(false);
  const [showStaffFeedbacks, setShowStaffFeedbacks] = useState(false);
  /** My Group tab visible only after opening a group from the sidebar (hidden on My Page). */
  const [myEntityTabVisible, setMyEntityTabVisible] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/groups/my-groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }, []);

  const entityCreation = useManagedEntityCreation({
    createApiPath: '/api/groups',
    responseEntityKey: 'group',
    entityKind: 'group',
    onReload: loadGroups,
    storageKey: 'selectedGroup',
    onEntityCreated: (id) => {
      setSelectedGroupId(id);
      setMyEntityTabVisible(true);
      setActiveTab('my-entity');
    },
  });

  const hideMyEntityTab = useCallback(() => setMyEntityTabVisible(false), []);

  useEntityWorkspaceDashboardNav({
    kind: 'group',
    searchParams,
    router,
    entityDirectAccessLocked,
    activeTab,
    setActiveTab,
    setSelectedEntityId: setSelectedGroupId,
    setMyEntityTabVisible: setMyEntityTabVisible,
  });

  const handleMyPageTabClick = useCallback(() => {
    clearEntityCompanyLoginSession();
    hideMyEntityTab();
    setActiveTab('my-page');
  }, [hideMyEntityTab]);

  const handleTabChange = useCallback(
    (tab: 'my-page' | 'my-entity') => {
      if (tab === 'my-page') {
        clearEntityCompanyLoginSession();
        hideMyEntityTab();
      }
      setActiveTab(tab);
    },
    [hideMyEntityTab],
  );

  const formCreatedGroups = useMemo(
    () => filterFormCreatedEntities(groups),
    [groups],
  );
  const hasFormGroup = formCreatedGroups.length > 0;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedGroup');
      if (saved) setSelectedGroupId(saved);
    }
  }, []);

  useEffect(() => {
    if (user && !isGroupAccountUserType(user.userType)) {
      router.replace(getDashboardPathForUserType(user.userType));
    }
  }, [user, router]);

  useEffect(() => {
    if (user && isGroupAccountUserType(user.userType)) {
      void loadGroups();
    }
  }, [user, loadGroups]);

  useEffect(() => {
    if (activeTab === 'my-page') {
      setShowWorkoutSection(false);
      if (!isEntityWorkspaceSession('group')) {
        setMyEntityTabVisible(false);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (isEntityWorkspaceSession('group')) return;
    if (!hasFormGroup && activeTab === 'my-entity') {
      setActiveTab('my-page');
    }
  }, [hasFormGroup, activeTab]);

  useEffect(() => {
    if (showWorkoutSection) {
      setShowLeftSidebar(false);
    } else {
      setShowLeftSidebar(true);
    }
  }, [showWorkoutSection, setShowLeftSidebar]);

  if (loading || !user) {
    return null;
  }

  const handleGroupSelect = (groupId: string) => {
    localStorage.setItem('selectedGroup', groupId);
    setSelectedGroupId(groupId);
    setMyEntityTabVisible(true);
    setActiveTab('my-entity');
  };

  const activeGroup = selectedGroupId
    ? formCreatedGroups.find((g) => g.id === selectedGroupId) ?? null
    : null;
  const bannerGroup = activeGroup ?? formCreatedGroups[0] ?? null;
  const dashboardShellActiveTab: 'my-page' | 'my-entity' =
    activeTab === 'my-entity' &&
    selectedGroupId &&
    (myEntityTabVisible || entityDirectAccessLocked)
      ? 'my-entity'
      : selectedGroupId && hasFormGroup
        ? activeTab
        : 'my-page';

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

        {showPersonalBanner && hasFormGroup && bannerGroup && (
          <div className="flex-shrink-0 px-4">
            <ManagedEntityDashboardBanner
              entityKind="group"
              entityName={bannerGroup.name ?? ''}
              entityId={bannerGroup.id}
              onEntityProfileClick={() => {
                router.push(getManagedEntityProfilePath('group', bannerGroup.id));
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
                entities={groups}
                selectedEntityId={selectedGroupId}
                clubMyClubTabVisible={myEntityTabVisible || entityDirectAccessLocked}
                hideMyPageTab={entityDirectAccessLocked}
                onEntitySelect={handleGroupSelect}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onMyPageClick={handleMyPageTabClick}
                onMyGroupClick={() => {
                  if (!myEntityTabVisible) return;
                  setActiveTab('my-entity');
                  if (selectedGroupId) {
                    window.location.href = `/my-group?groupId=${selectedGroupId}`;
                  } else if (formCreatedGroups.length > 0) {
                    window.location.href = `/my-group?groupId=${formCreatedGroups[0].id}`;
                  }
                }}
                onCreateGroupClick={entityCreation.openCreateFlow}
                onSuggestMovesbookClick={() => router.push('/users/notification_by_promocode')}
                onMyFeedbacksStaffClick={() => {
                  setActiveTab('my-page');
                  setShowStaffFeedbacks(true);
                }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col px-4">
            <SharingNotifications
              scope={
                activeTab === 'my-entity' && selectedGroupId
                  ? { type: 'party', kind: 'group', id: selectedGroupId }
                  : { type: 'mypage' }
              }
            />
            {showStaffFeedbacks ? (
              <MyStaffFeedbacksPanel onClose={() => setShowStaffFeedbacks(false)} />
            ) : (
              <>
            {activeTab === 'my-page' && (
              <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">My Page</h2>
                {!hasFormGroup ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Users className="w-20 h-20 mx-auto mb-6 opacity-60" />
                      <p className="text-2xl font-bold mb-2">Set up your group</p>
                      <p className="text-lg mb-4 max-w-md">
                        Expand <strong>My group</strong> in the sidebar, click <strong>Create a group</strong>,
                        and save your group profile.
                      </p>
                      <button
                        type="button"
                        onClick={entityCreation.openCreateFlow}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                      >
                        Create a group
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
                    <p className="text-gray-700">
                      Your personal group admin page. Use the sidebar to open a group or manage
                      workouts.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'my-entity' && !showWorkoutSection && (
              <div className="bg-white rounded-lg shadow-sm border p-8 flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Your Group</h2>
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
              <div className="bg-white rounded-lg shadow-sm border p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Workouts Section</h2>
                  <button
                    type="button"
                    onClick={entityCreation.openCreateFlow}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
                  >
                    Create a group
                  </button>
                </div>

                {formCreatedGroups.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Users className="w-20 h-20 mx-auto mb-6 opacity-60" />
                      <p className="text-2xl font-bold mb-2">No groups yet</p>
                      <p className="text-lg mb-4">Create your first group to start managing users</p>
                      <button
                        type="button"
                        onClick={entityCreation.openCreateFlow}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                      >
                        Create a group
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {formCreatedGroups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => handleGroupSelect(group.id)}
                        className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-2">{group.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{group.description || 'Group'}</p>
                        {group.groupType && <p className="text-xs text-gray-500 mb-4">{group.groupType}</p>}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">{group.memberCount || 0} members</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>

          {showRightSidebar && (
            <RightSidebar 
              context="my-club" 
              activeTab={activeTab}
              onAddMember={() => setShowAddMemberModal(true)}
            />
          )}
        </div>
      </div>
      
      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onAddNewUser={(data) => {
          console.log('Add new user with password:', data);
          // TODO: Call API to add new user with password
          setShowAddMemberModal(false);
        }}
        onAddExistingUser={(data) => {
          console.log('Add existing user:', data);
          // TODO: Call API to add existing user with username and password
          setShowAddMemberModal(false);
        }}
        entityType="group"
      />

      <AdminPasswordConfirmModal
        isOpen={entityCreation.showAdminPasswordConfirm}
        onClose={() => entityCreation.setShowAdminPasswordConfirm(false)}
        onVerified={entityCreation.handleAdminPasswordVerified}
        adminUsername={user?.username ?? user?.name ?? 'username'}
        entityKind="group"
      />

      <CreateEntityModal
        key={entityCreation.createModalKey}
        entityKind="group"
        isOpen={entityCreation.showCreateModal}
        onClose={() => entityCreation.setShowCreateModal(false)}
        adminUsername={user?.username ?? user?.name ?? 'username'}
        saving={entityCreation.createSaving}
        onSave={entityCreation.handleCreateSave}
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

      <SimpleFooter />
    </div>
  );
}

export default function GroupDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <GroupDashboardContent />
    </Suspense>
  );
}

