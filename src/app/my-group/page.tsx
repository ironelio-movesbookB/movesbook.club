'use client';

import SharingNotifications from '@/components/sharing/SharingNotifications';
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
import { isGroupAccountUserType } from '@/utils/dashboardRouting';

interface GroupMember {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    userType: string;
  };
  role: string | null;
  joinedAt: Date;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  groupType: string | null;
  imageUrl?: string | null;
}

function MyGroupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  useEntityDirectAccessGuard(!authLoading && !!user);
  const groupId = searchParams?.get('groupId');

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [addMemberPassword, setAddMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const loadGroupData = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGroup(data.group);
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    const lock = getEntityDirectAccessLock();
    if (!groupId) {
      if (lock?.kind === 'group') {
        router.replace(getEntityDirectAccessProfilePath(lock));
        return;
      }
      if (user && isGroupAccountUserType(user.userType)) {
        router.replace('/group/dashboard');
        return;
      }
      setLoading(false);
    } else {
      if (lock?.kind === 'group' && groupId !== lock.entityId) {
        router.replace(getEntityDirectAccessProfilePath(lock));
        return;
      }
      loadGroupData();
    }
  }, [groupId, user, router, authLoading, loadGroupData]);

  // Don't render if not authenticated
  if (authLoading || !user) {
    return null;
  }

  const handleAddMember = async () => {
    if (!groupId || !addMemberUsername || !addMemberPassword) {
      setAddMemberError('Please enter both username and password');
      return;
    }

    setAddingMember(true);
    setAddMemberError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${groupId}/members/add`, {
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
        await loadGroupData();
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

  const canEditProfile = Boolean(group && isClubCreatedFromForm(group));
  const editProfileHref = groupId
    ? `/my-group/edit?groupId=${encodeURIComponent(groupId)}`
    : '/my-group/edit';
  const groupDisplayName = group ? getClubMyPageDisplayName(group) : 'Loading...';

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
                    description={group?.description}
                    imageUrl={group?.imageUrl}
                    userImageUrl={user?.image}
                    alt={group?.name || 'Group'}
                  />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{groupDisplayName}</h2>
                <p className="text-gray-600 text-sm mt-2">{group?.groupType || 'Group'}</p>
                {canEditProfile ? (
                  <Link
                    href={editProfileHref}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit group profile
                  </Link>
                ) : null}
              </div>

              <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4">
                  Group Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Total Members</span>
                    <span className="font-bold text-blue-600 text-lg">{members.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <SharingNotifications scope={groupId ? { type: 'party', kind: 'group', id: groupId } : null} />
            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : !groupId ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex flex-col items-center justify-center">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Group Selected</h3>
                <p className="text-gray-600 mb-6">Please select a group from My Page to view group details.</p>
                <button
                  onClick={() => window.location.href = '/my-page'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                >
                  Go to My Page
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold text-gray-900">Group Members</h2>
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
                              {member.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 text-lg">{member.user.name}</h4>
                              <p className="text-sm text-gray-600">@{member.user.username}</p>
                              <p className="text-sm text-gray-500">{member.user.email}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{member.user.userType}</span>
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
            )}
          </div>

          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Group Management</h3>
              
              <div className="space-y-4 flex-1">
                <button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="w-full flex items-center justify-between p-5 border-2 border-dashed border-blue-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group"
                >
                  <span className="text-base font-semibold text-gray-700 group-hover:text-blue-700">Add New Member</span>
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
              <h3 className="text-2xl font-bold text-gray-900">Add a Member</h3>
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
                <p className="text-xs text-gray-500 mt-1">If correct, the user will be added to the group</p>
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

export default function MyGroup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <MyGroupContent />
    </Suspense>
  );
}

