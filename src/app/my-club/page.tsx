'use client';

import SharingNotifications from '@/components/sharing/SharingNotifications';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Users, 
  BarChart3, 
  Calendar,
  UserPlus,
  FileText,
  Award,
  Target,
  TrendingUp,
  Loader2,
  ArrowLeft,
  Pencil
} from 'lucide-react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import DisplayOptionsToolbar from '@/app/my-page/components/DisplayOptionsToolbar';
import { useDisplayLayoutOptions } from '@/hooks/useDisplayLayoutOptions';
import { useAuth } from '@/hooks/useAuth';
import ClubOverviewPanel from '@/components/club/ClubOverviewPanel';
import ManagedEntitySidebarAvatar from '@/components/entity/ManagedEntitySidebarAvatar';
import {
  getClubMyPageDisplayName,
  isClubCreatedFromForm,
  parseClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { isClubAccountUserType } from '@/utils/dashboardRouting';
import { useEntityDirectAccessGuard } from '@/hooks/useEntityDirectAccessGuard';
import {
  getEntityDirectAccessLock,
  getEntityDirectAccessProfilePath,
} from '@/lib/entity/entityDirectAccessSession';

interface ClubMember {
  id: string;
  member: {
    id: string;
    name: string;
    username: string;
    email: string;
    userType: string;
  };
  role: string | null;
  membershipType: string | null;
  joinedAt: Date;
}

interface Club {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  imageUrl?: string | null;
}

function MyClubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  useEntityDirectAccessGuard(!authLoading && !!user);
  const clubId = searchParams?.get('clubId');

  // All hooks must be called before any conditional returns
  const [activeSection, setActiveSection] = useState<'overview' | 'members' | 'workouts' | 'analytics'>('overview');
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [addMemberPassword, setAddMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');
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

  // Helper function for loading club data
  const loadClubData = useCallback(async () => {
    if (!clubId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clubs/${clubId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setClub(data.club);
        setMembers(data.members || []);
      } else {
        console.error('Failed to load club data');
      }
    } catch (error) {
      console.error('Error loading club data:', error);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  const handleAddMember = async () => {
    if (!clubId || !addMemberUsername || !addMemberPassword) {
      setAddMemberError('Please enter both username and password');
      return;
    }

    setAddingMember(true);
    setAddMemberError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clubs/${clubId}/members/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: addMemberUsername,
          password: addMemberPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh members list
        await loadClubData();
        // Close modal and reset form
        setShowAddMemberModal(false);
        setAddMemberUsername('');
        setAddMemberPassword('');
        setAddMemberError('');
      } else {
        setAddMemberError(data.error || 'Failed to add member');
      }
    } catch (error: any) {
      setAddMemberError(error.message || 'An error occurred');
    } finally {
      setAddingMember(false);
    }
  };

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const verifyClubProfileAccess = useCallback(async (): Promise<boolean> => {
    if (!clubId) return false;
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await fetch('/api/clubs/my-clubs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        clubProfiles?: { id: string; description?: string | null }[];
        clubs?: { id: string; hasClubProfile?: boolean; description?: string | null }[];
      };
      const profiles =
        data.clubProfiles ??
        (data.clubs ?? []).filter((c) =>
          c.hasClubProfile ?? isClubCreatedFromForm(c)
        );
      return profiles.some((c) => c.id === clubId);
    } catch {
      return false;
    }
  }, [clubId]);

  // Load club data when clubId changes (only for clubs created via profile form)
  useEffect(() => {
    const lock = getEntityDirectAccessLock();
    if (!clubId) {
      if (lock?.kind === 'club') {
        router.replace(getEntityDirectAccessProfilePath(lock));
        return;
      }
      if (user && isClubAccountUserType(user.userType)) {
        router.replace('/club/dashboard');
        return;
      }
      setLoading(false);
      return;
    }

    if (lock?.kind === 'club' && clubId !== lock.entityId) {
      router.replace(getEntityDirectAccessProfilePath(lock));
      return;
    }

    let cancelled = false;
    void (async () => {
      const allowed = await verifyClubProfileAccess();
      if (cancelled) return;
      if (!allowed) {
        if (lock?.kind === 'club') {
          router.replace(getEntityDirectAccessProfilePath(lock));
        } else {
          router.replace('/club/dashboard');
        }
        return;
      }
      await loadClubData();
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId, user, router, loadClubData, verifyClubProfileAccess]);

  // Don't render if not authenticated
  if (authLoading || !user) {
    return null;
  }

  const clubDisplayName = club ? getClubMyPageDisplayName(club) : 'Loading...';
  const clubSubtitle = club
    ? (() => {
        const meta = parseClubDescriptionMeta(club.description);
        const parts = [meta.category?.trim(), club.location?.trim()].filter(Boolean);
        return parts.join(' · ') || meta.username?.trim() || '';
      })()
    : '';
  const clubProfileEditHref = clubId
    ? `/my-club/edit?clubId=${encodeURIComponent(clubId)}`
    : '/my-club/edit';
  const directAccessLock = getEntityDirectAccessLock();
  const backToMenuHref =
    directAccessLock?.kind === 'club'
      ? getEntityDirectAccessProfilePath(directAccessLock)
      : '/club/dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
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

      <div className="flex-1 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-8">
        {showAdBanner && (
          <div className="mb-8 flex-shrink-0">
            <AdvertisementCarousel />
          </div>
        )}

        {/* Main Content Area - Fills remaining space */}
        <div className="flex-1 flex gap-8 min-h-0 min-w-0 w-full overflow-x-hidden">
          {/* Left Sidebar */}
          {showLeftSidebar && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
              <Link
                href={backToMenuHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mb-4"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                Back to menu
              </Link>

              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="mx-auto mb-4 w-20 h-20">
                    <ManagedEntitySidebarAvatar
                      description={club?.description}
                      imageUrl={club?.imageUrl}
                      alt={clubDisplayName}
                    />
                  </div>
                  <div className="flex items-start justify-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900 text-center flex-1">
                      {clubDisplayName}
                    </h2>
                    {clubId && (
                      <Link
                        href={clubProfileEditHref}
                        className="inline-flex items-center gap-1 shrink-0 text-sm font-semibold text-red-600 hover:text-red-800 mt-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                    )}
                  </div>
                </div>

                {clubSubtitle ? (
                  <p className="text-gray-600 text-sm text-center border-t border-gray-100 pt-4 px-1">
                    {clubSubtitle}
                  </p>
                ) : null}
              </div>

              <nav className="space-y-3 flex-1">
                <button
                  onClick={() => setActiveSection('overview')}
                  className={`w-full flex items-center px-4 py-4 text-base font-semibold rounded-2xl transition-all duration-300 ${
                    activeSection === 'overview'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-2xl transform scale-105'
                      : 'text-gray-700 hover:bg-gray-100 hover:shadow-lg'
                  }`}
                >
                  <Users className="w-5 h-5 mr-3" />
                  Club Overview
                </button>
                
                <button
                  onClick={() => setActiveSection('members')}
                  className={`w-full flex items-center px-4 py-4 text-base font-semibold rounded-2xl transition-all duration-300 ${
                    activeSection === 'members'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-2xl transform scale-105'
                      : 'text-gray-700 hover:bg-gray-100 hover:shadow-lg'
                  }`}
                >
                  <UserPlus className="w-5 h-5 mr-3" />
                  Members
                </button>
                
                <button
                  onClick={() => setActiveSection('workouts')}
                  className={`w-full flex items-center px-4 py-4 text-base font-semibold rounded-2xl transition-all duration-300 ${
                    activeSection === 'workouts'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-2xl transform scale-105'
                      : 'text-gray-700 hover:bg-gray-100 hover:shadow-lg'
                  }`}
                >
                  <Calendar className="w-5 h-5 mr-3" />
                  Club Workouts
                </button>
                
                <button
                  onClick={() => setActiveSection('analytics')}
                  className={`w-full flex items-center px-4 py-4 text-base font-semibold rounded-2xl transition-all duration-300 ${
                    activeSection === 'analytics'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-2xl transform scale-105'
                      : 'text-gray-700 hover:bg-gray-100 hover:shadow-lg'
                  }`}
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Analytics
                </button>
              </nav>

              {/* Quick Stats */}
              <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Club Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Total Members</span>
                    <span className="font-bold text-blue-600 text-lg">{members.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Active Today</span>
                    <span className="font-bold text-green-600 text-lg">8</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">This Week</span>
                    <span className="font-bold text-purple-600 text-lg">42</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Main Content - Stretched to fill remaining space */}
          <div className="flex-1 min-w-0 max-w-full flex flex-col overflow-hidden">
            <SharingNotifications scope={clubId ? { type: 'party', kind: 'club', id: clubId } : null} />
            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : !clubId ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex flex-col items-center justify-center">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Club Selected</h3>
                <p className="text-gray-600 mb-6">Please select a club from My Page to view club details.</p>
                <button
                  onClick={() => window.location.href = '/my-page'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Go to My Page
                </button>
              </div>
            ) : (
              <>
                {activeSection === 'overview' && (
                  <ClubOverviewPanel
                    club={club}
                    members={members}
                    clubProfileEditHref={clubProfileEditHref}
                    onAddMembers={() => setShowAddMemberModal(true)}
                  />
                )}
                {activeSection === 'members' && <MembersSection members={members} />}
                {activeSection === 'workouts' && <ClubWorkouts />}
                {activeSection === 'analytics' && <AnalyticsSection />}
              </>
            )}
          </div>

          {/* Right Sidebar */}
          {showRightSidebar && (
          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Club Management
              </h3>
              
              <div className="space-y-4 flex-1">
                <button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="w-full flex items-center justify-between p-5 border-2 border-dashed border-blue-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group"
                >
                  <span className="text-base font-semibold text-gray-700 group-hover:text-blue-700">Add New Member</span>
                  <UserPlus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </button>
                
                <button className="w-full flex items-center justify-between p-5 border-2 border-dashed border-green-200 rounded-2xl hover:border-green-300 hover:bg-green-50 transition-all duration-300 group">
                  <span className="text-base font-semibold text-gray-700 group-hover:text-green-700">Create Group Workout</span>
                  <Calendar className="w-5 h-5 text-gray-400 group-hover:text-green-500" />
                </button>
                
                <button className="w-full flex items-center justify-between p-5 border-2 border-dashed border-purple-200 rounded-2xl hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 group">
                  <span className="text-base font-semibold text-gray-700 group-hover:text-purple-700">Generate Report</span>
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-purple-500" />
                </button>
              </div>

              {/* Recent Club Activities */}
              <div className="mt-8">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  Recent Activities
                </h4>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    🏊‍♂️ <strong>John Doe</strong> completed advanced swim workout
                  </div>
                  <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    👋 <strong>Sarah Wilson</strong> joined the club as new member
                  </div>
                  <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    🏃‍♀️ Group running session scheduled for Saturday
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Member</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={addMemberUsername}
                  onChange={(e) => setAddMemberUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Member username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={addMemberPassword}
                  onChange={(e) => setAddMemberPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Member password"
                />
              </div>
              {addMemberError && (
                <p className="text-sm text-red-600">{addMemberError}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setAddMemberError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddMember()}
                disabled={addingMember}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {addingMember ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyClub() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <MyClubContent />
    </Suspense>
  );
}

function MembersSection({ members }: { members: ClubMember[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Club Members</h2>
        <div className="text-sm text-gray-600">
          Total: <span className="font-bold text-blue-600">{members.length}</span>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Users className="w-20 h-20 mx-auto mb-6 opacity-60" />
            <p className="text-2xl font-bold mb-2">No Members Yet</p>
            <p className="text-lg">Add members to get started</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member) => (
              <div key={member.id} className="p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                    {member.member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 text-lg">{member.member.name}</h4>
                    <p className="text-sm text-gray-600">@{member.member.username}</p>
                    <p className="text-sm text-gray-500">{member.member.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{member.member.userType}</span>
                      {member.role && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{member.role}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClubWorkouts() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex-1 flex flex-col">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Club Workouts</h2>
      <div className="grid grid-cols-2 gap-8 flex-1">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center p-12">
          <div className="text-center text-gray-500">
            <Calendar className="w-20 h-20 mx-auto mb-6 opacity-60" />
            <p className="text-2xl font-bold mb-2">Workout Schedule</p>
            <p className="text-lg">Plan and schedule group workouts</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center p-12">
          <div className="text-center text-gray-500">
            <Target className="w-20 h-20 mx-auto mb-6 opacity-60" />
            <p className="text-2xl font-bold mb-2">Training Programs</p>
            <p className="text-lg">Create custom training programs</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex-1 flex flex-col">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Club Analytics</h2>
      <div className="grid grid-cols-2 gap-8 flex-1">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center p-12">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-20 h-20 mx-auto mb-6 opacity-60" />
            <p className="text-2xl font-bold mb-2">Performance Analytics</p>
            <p className="text-lg">Track club-wide performance metrics</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center p-12">
          <div className="text-center text-gray-500">
            <TrendingUp className="w-20 h-20 mx-auto mb-6 opacity-60" />
            <p className="text-2xl font-bold mb-2">Progress Reports</p>
            <p className="text-lg">Generate detailed progress reports</p>
          </div>
        </div>
      </div>
    </div>
  );
}
