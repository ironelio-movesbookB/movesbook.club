'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Mail,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { useClubWorkspace } from '@/contexts/ClubWorkspaceContext';
import { fetchClubArchive } from '@/lib/club/archives/clubArchiveClient';
import {
  appendMemberIdToPath,
  CLUB_ADMIN_ARCHIVE_GROUPS,
  CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS,
  MEMBER_OVERVIEW_MNGMNT_LINKS,
} from '@/lib/club/clubAdminMenus';
import { writeClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';
import type { SelectedClubMember } from '@/lib/club/selectedClubMember';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import type { Member } from '@/types/clubTable';
import ClubNotificationsPanel from '@/components/notifications/ClubNotificationsPanel';
import ClubAdminMenuDropdown from '@/components/club/topbar/ClubAdminMenuDropdown';

type TopTab = 'overview' | 'bookings' | 'archive' | 'insert';
type Section =
  | 'home'
  | 'profile'
  | 'notifies'
  | 'audio'
  | 'feedbacks'
  | 'posts'
  | 'photo'
  | 'video'
  | 'friends'
  | 'mngmnt';

const SECTION_BUTTONS: { id: Section; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'notifies', label: 'Notifies' },
  { id: 'audio', label: 'Audio' },
  { id: 'feedbacks', label: 'Feedbacks' },
  { id: 'posts', label: 'Posts' },
  { id: 'photo', label: 'Photo' },
  { id: 'video', label: 'Video' },
  { id: 'friends', label: 'Friends' },
  { id: 'mngmnt', label: 'Mngmnt' },
];

function memberLabel(m: Pick<SelectedClubMember, 'name' | 'surname' | 'username'>) {
  const full = `${m.name || ''} ${m.surname || ''}`.trim();
  return full || m.username || 'Member';
}

function toSelected(m: Member): SelectedClubMember | null {
  const memberId = String(m.memberId || m.id || m.userId || '');
  if (!memberId) return null;
  return {
    memberId,
    name: String(m.name || ''),
    surname: String(m.surname || ''),
    username: m.username ? String(m.username) : undefined,
    image: m.image ? String(m.image) : null,
    dateOfBirth: (() => {
      const raw = m.dateOfBirthDisplay
        ? String(m.dateOfBirthDisplay)
        : m.dateOfBirth
          ? String(m.dateOfBirth)
          : '';
      const trimmed = raw.trim();
      return trimmed && trimmed !== '-' ? trimmed : null;
    })(),
  };
}

export default function MemberOverviewPanel() {
  const router = useRouter();
  const { selectedClubId, selectedMember, setSelectedMember } = useClubWorkspace();
  const [topTab, setTopTab] = useState<TopTab>('overview');
  const [section, setSection] = useState<Section>('home');
  const [members, setMembers] = useState<SelectedClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadMembers = useCallback(async () => {
    if (!selectedClubId) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    setLoadError('');
    try {
      const result = await fetchClubArchive('members', {
        clubId: selectedClubId,
        page: 1,
        pageSize: 500,
        membershipStatus: 'member',
        orderBy: 'recent',
      });
      const list = (result.items || [])
        .map(toSelected)
        .filter((m): m is SelectedClubMember => Boolean(m));
      setMembers(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load members');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [selectedClubId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const photoUrl = useMemo(
    () => resolvePublicImageUrl(selectedMember?.image || null),
    [selectedMember?.image],
  );

  const requireMember = (): SelectedClubMember | null => {
    if (!selectedMember) {
      window.alert('Select a member first.');
      return null;
    }
    return selectedMember;
  };

  const openArchiveForMember = (path: string) => {
    const m = requireMember();
    if (!m) return;
    writeClubWorkspaceTab('my-entity');
    router.push(appendMemberIdToPath(path, m.memberId));
  };

  const onSelectMemberId = (memberId: string) => {
    const found = members.find((m) => m.memberId === memberId) || null;
    setSelectedMember(found);
    setSection('home');
    setTopTab('overview');
  };

  if (!selectedClubId) {
    return (
      <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Select a club from the sidebar (My clubs) before using Member Overview.
      </div>
    );
  }

  return (
    <div className="mt-3 mb-8 space-y-0">
      {/* Top tabs */}
      <div className="flex flex-wrap gap-1">
        {(
          [
            { id: 'overview' as const, label: 'Member Overview' },
            { id: 'bookings' as const, label: 'Bookings' },
            { id: 'archive' as const, label: 'Archive data' },
            { id: 'insert' as const, label: 'Insert data' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setTopTab(tab.id);
              if (tab.id === 'overview') setSection('home');
            }}
            className={`min-w-[120px] px-4 py-2 text-sm font-medium text-white ${
              topTab === tab.id ? 'bg-black' : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {topTab === 'bookings' ? (
        <div className="mt-3 min-h-[180px] rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {/* Kept blank per client request */}
        </div>
      ) : null}

      {topTab === 'archive' ? (
        <div className="mt-3 rounded border border-gray-300 bg-[#2a2a2a] p-2">
          <p className="mb-2 px-2 text-xs text-gray-300">Archive data — same links as the club Archives menu</p>
          <div className="max-h-[60vh] overflow-y-auto">
            {CLUB_ADMIN_ARCHIVE_GROUPS.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-600/70' : ''}>
                {group.map((item) => {
                  if (item.kind === 'group') {
                    const Icon = item.Icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-white"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </div>
                    );
                  }
                  const path = 'path' in item ? item.path : undefined;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={!path}
                      onClick={() => {
                        if (!path) return;
                        writeClubWorkspaceTab('my-entity');
                        router.push(path);
                      }}
                      className={`flex w-full px-3 py-2 text-left text-[13px] text-white hover:bg-[#333] disabled:opacity-70 ${
                        item.kind === 'child' ? 'pl-10' : ''
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 px-2">
            <ClubAdminMenuDropdown variant="archive" tone="light" />
          </div>
        </div>
      ) : null}

      {topTab === 'insert' ? (
        <div className="mt-3 rounded border border-gray-300 bg-[#2a2a2a] p-2">
          <p className="mb-2 px-2 text-xs text-gray-300">Insert data — same links as Insert a new item</p>
          <div className="max-h-[60vh] overflow-y-auto">
            {CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-600/70' : ''}>
                {group.map((item) => {
                  const path = 'path' in item ? item.path : undefined;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={!path}
                      onClick={() => {
                        if (!path) return;
                        writeClubWorkspaceTab('my-entity');
                        router.push(path);
                      }}
                      className="flex w-full px-3 py-2 text-left text-[13px] text-white hover:bg-[#333] disabled:opacity-70"
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 px-2">
            <ClubAdminMenuDropdown variant="insert" tone="dark" />
          </div>
        </div>
      ) : null}

      {topTab === 'overview' ? (
        <>
          {/* Select a member */}
          <div className="mt-0 flex flex-wrap items-center gap-3 border border-t-0 border-gray-300 bg-gray-100 px-3 py-2">
            <span className="text-sm font-medium text-gray-800">Select a member</span>
            <select
              className="min-w-[220px] rounded border border-gray-400 bg-white px-2 py-1.5 text-sm"
              value={selectedMember?.memberId || ''}
              onChange={(e) => onSelectMemberId(e.target.value)}
              disabled={loadingMembers}
            >
              <option value="">
                {loadingMembers ? 'Loading…' : '— choose —'}
              </option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
            {selectedMember?.image || selectedMember ? (
              <span className="inline-flex h-9 w-9 overflow-hidden rounded-full border border-gray-400 bg-gray-200">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="m-auto h-5 w-5 text-gray-500" />
                )}
              </span>
            ) : null}
            {loadError ? <span className="text-xs text-red-600">{loadError}</span> : null}
          </div>

          {/* Member card + sections */}
          {selectedMember ? (
            <div className="border border-t-0 border-gray-300 bg-white">
              {section !== 'notifies' ? (
                <div className="relative m-3 rounded border border-sky-300 bg-sky-100 p-4">
                  <div className="absolute left-3 top-3 flex gap-2">
                    <button
                      type="button"
                      title="View profile"
                      onClick={() => {
                        const m = requireMember();
                        if (!m || !selectedClubId) return;
                        writeClubWorkspaceTab('my-entity');
                        router.push(
                          `/clubMembers/memberProfile/${encodeURIComponent(m.memberId)}?clubId=${encodeURIComponent(selectedClubId)}&mode=edit`,
                        );
                      }}
                      className="text-gray-800 hover:text-black"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      title="Notifies"
                      onClick={() => setSection('notifies')}
                      className="text-gray-800 hover:text-black"
                    >
                      <Mail size={16} />
                    </button>
                    <button
                      type="button"
                      title="Settings"
                      onClick={() => {
                        const m = requireMember();
                        if (!m || !selectedClubId) return;
                        writeClubWorkspaceTab('my-entity');
                        router.push(
                          `/clubMembers/memberProfile/${encodeURIComponent(m.memberId)}?clubId=${encodeURIComponent(selectedClubId)}&mode=edit`,
                        );
                      }}
                      className="text-gray-800 hover:text-black"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-start gap-4 pl-0 sm:pl-16">
                    <div className="h-28 w-28 shrink-0 overflow-hidden border border-gray-400 bg-white">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <UserIcon size={40} />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-gray-900">
                        {selectedMember.name || '—'}
                      </div>
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-gray-900">
                        {selectedMember.surname || '—'}
                      </div>
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-700">
                        {selectedMember.dateOfBirth || 'Date of birthday'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1 px-3 pb-2">
                {SECTION_BUTTONS.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => {
                      if (btn.id === 'profile') {
                        const m = requireMember();
                        if (!m || !selectedClubId) return;
                        writeClubWorkspaceTab('my-entity');
                        router.push(
                          `/clubMembers/memberProfile/${encodeURIComponent(m.memberId)}?clubId=${encodeURIComponent(selectedClubId)}&mode=edit`,
                        );
                        return;
                      }
                      setSection(btn.id);
                    }}
                    className={`min-w-[72px] px-3 py-2 text-sm font-medium ${
                      section === btn.id
                        ? 'bg-black text-yellow-300'
                        : 'bg-black text-white hover:bg-gray-900'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {section === 'mngmnt' ? (
                <div className="flex flex-wrap gap-1 border-t border-gray-200 bg-gray-100 px-3 py-2">
                  {MEMBER_OVERVIEW_MNGMNT_LINKS.map((link) => (
                    <button
                      key={link.label}
                      type="button"
                      onClick={() => openArchiveForMember(link.path)}
                      className="min-w-[88px] bg-gray-400 px-3 py-2 text-sm font-medium text-white hover:bg-gray-500"
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {section === 'notifies' && selectedMember ? (
                <div className="border-t border-gray-200 p-3">
                  <p className="mb-2 text-xs text-gray-600">
                    Notifications sent to club members (audience: members) for the selected club.
                    Use Add New on the club notification admin to create test entries.
                  </p>
                  <ClubNotificationsPanel
                    clubId={selectedClubId}
                    initialAudienceKind="members"
                    memberAudienceOnly
                  />
                </div>
              ) : null}

              {(section === 'audio' ||
                section === 'feedbacks' ||
                section === 'posts' ||
                section === 'photo' ||
                section === 'video' ||
                section === 'friends') && (
                <div className="border-t border-gray-200 px-4 py-8 text-sm text-gray-500">
                  {section === 'feedbacks'
                    ? 'Feedbacks — section under development. Data to display will be defined soon.'
                    : `${SECTION_BUTTONS.find((b) => b.id === section)?.label || section} — coming soon.`}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-t-0 border-gray-300 bg-white px-4 py-8 text-sm text-gray-500">
              Select a member of the current club to open Member Overview.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
