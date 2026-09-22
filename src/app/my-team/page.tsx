'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, UserPlus, X, Loader2, Pencil } from 'lucide-react';
import AdvertisementCarousel from '@/components/AdvertisementCarousel';
import ModernNavbar from '@/components/ModernNavbar';
import ManagedEntitySidebarAvatar from '@/components/entity/ManagedEntitySidebarAvatar';
import { useAuth } from '@/hooks/useAuth';
import {
  getClubMyPageDisplayName,
  isClubCreatedFromForm,
} from '@/lib/club/clubSidebarLabel';
import { useEntityDirectAccessGuard } from '@/hooks/useEntityDirectAccessGuard';
import {
  getEntityDirectAccessLock,
  getEntityDirectAccessProfilePath,
} from '@/lib/entity/entityDirectAccessSession';
import { isTeamAccountUserType } from '@/utils/dashboardRouting';

interface TeamMember {
  id: string;
  athlete: {
    id: string;
    name: string;
    username: string;
    email: string;
    userType: string;
  };
  role: string | null;
  jerseyNumber: number | null;
  joinedAt: Date;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  sport: string | null;
  imageUrl?: string | null;
}

function MyTeamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  useEntityDirectAccessGuard(!authLoading && !!user);
  const teamId = searchParams?.get('teamId');

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [addMemberPassword, setAddMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const loadTeamData = useCallback(async () => {
    if (!teamId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/teams/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeam(data.team);
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Resolve teamId: direct-access lock, selectedTeam, or first owned team.
  useEffect(() => {
    if (authLoading || !user || teamId) return;

    const lock = getEntityDirectAccessLock();
    if (lock?.kind === 'team') {
      router.replace(getEntityDirectAccessProfilePath(lock));
      return;
    }

    if (!isTeamAccountUserType(user.userType)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const resolveTeam = async () => {
      const saved =
        typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null;
      if (saved) {
        if (!cancelled) {
          router.replace(`/my-team?teamId=${encodeURIComponent(saved)}`);
        }
        return;
      }
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          if (!cancelled) setLoading(false);
          return;
        }
        const res = await fetch('/api/teams/my-teams', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as { teams?: Array<{ id: string }> };
        const first = data.teams?.[0]?.id ?? null;
        if (first) {
          localStorage.setItem('selectedTeam', first);
          if (!cancelled) {
            router.replace(`/my-team?teamId=${encodeURIComponent(first)}`);
          }
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    };
    void resolveTeam();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, teamId, router]);

  useEffect(() => {
    if (authLoading || !user || !teamId) return;
    const lock = getEntityDirectAccessLock();
    if (lock?.kind === 'team' && teamId !== lock.entityId) {
      router.replace(getEntityDirectAccessProfilePath(lock));
      return;
    }
    loadTeamData();
  }, [teamId, user, router, authLoading, loadTeamData]);

  // Don't render if not authenticated
  if (authLoading || !user) {
    return null;
  }

  const handleAddMember = async () => {
    if (!teamId || !addMemberUsername || !addMemberPassword) {
      setAddMemberError('Please enter both username and password');
      return;
    }

    setAddingMember(true);
    setAddMemberError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/teams/${teamId}/members/add`, {
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
        await loadTeamData();
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

  const canEditProfile = Boolean(team && isClubCreatedFromForm(team));
  const editProfileHref = teamId
    ? `/my-team/edit?teamId=${encodeURIComponent(teamId)}`
    : '/my-team/edit';
  const teamDisplayName = team ? getClubMyPageDisplayName(team) : 'Loading...';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <ModernNavbar />
      
      <div className="flex-1 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex-shrink-0">
          <AdvertisementCarousel />
        </div>

        <div className="flex-1 flex gap-8 min-h-0">
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
              <div className="text-center mb-8">
                <div className="mx-auto mb-4 w-20 h-20">
                  <ManagedEntitySidebarAvatar
                    description={team?.description}
                    imageUrl={team?.imageUrl}
                    userImageUrl={user?.image}
                    alt={team?.name || 'Team'}
                  />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{teamDisplayName}</h2>
                <p className="text-gray-600 text-sm mt-2">{team?.sport || 'Team'}</p>
                {canEditProfile ? (
                  <Link
                    href={editProfileHref}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit team profile
                  </Link>
                ) : null}
              </div>

              <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4">
                  Team Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Total Athletes</span>
                    <span className="font-bold text-blue-600 text-lg">{members.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : !teamId ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex flex-col items-center justify-center">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Team Selected</h3>
                <p className="text-gray-600 mb-6">
                  Create or select a team from the Team dashboard, then open My Team again.
                </p>
                <button
                  onClick={() => router.push('/team/dashboard')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Go to Team dashboard
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold text-gray-900">Team Athletes</h2>
                  <div className="text-sm text-gray-600">
                    Total: <span className="font-bold text-blue-600">{members.length}</span>
                  </div>
                </div>

                {members.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Users className="w-20 h-20 mx-auto mb-6 opacity-60" />
                      <p className="text-2xl font-bold mb-2">No Athletes Yet</p>
                      <p className="text-lg">Add athletes to get started</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {members.map((member) => (
                        <div key={member.id} className="p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                              {member.athlete.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 text-lg">{member.athlete.name}</h4>
                              <p className="text-sm text-gray-600">@{member.athlete.username}</p>
                              <p className="text-sm text-gray-500">{member.athlete.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{member.athlete.userType}</span>
                                {member.role && (
                                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">{member.role}</span>
                                )}
                                {member.jerseyNumber && (
                                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">#{member.jerseyNumber}</span>
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
            )}
          </div>

          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Team Management</h3>
              
              <div className="space-y-4 flex-1">
                <button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="w-full flex items-center justify-between p-5 border-2 border-dashed border-blue-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group"
                >
                  <span className="text-base font-semibold text-gray-700 group-hover:text-blue-700">Add New Athlete</span>
                  <UserPlus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add an Athlete</h3>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setAddMemberUsername('');
                  setAddMemberPassword('');
                  setAddMemberError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a user of Movesbook
                </label>
                <input
                  type="text"
                  placeholder="Type his/her username"
                  value={addMemberUsername}
                  onChange={(e) => setAddMemberUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Type his/her password"
                  value={addMemberPassword}
                  onChange={(e) => setAddMemberPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">If correct, the user will be added to the team</p>
              </div>

              {addMemberError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {addMemberError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setAddMemberUsername('');
                    setAddMemberPassword('');
                    setAddMemberError('');
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={addingMember || !addMemberUsername || !addMemberPassword}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingMember ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'OK'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTeam() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <MyTeamContent />
    </Suspense>
  );
}

