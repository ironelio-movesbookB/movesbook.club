'use client';
import Image from 'next/image';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Eye, Pencil, Trash2, UserPlus } from 'lucide-react';
import ClubMemberArchivePage, {
  memberTypeBadge,
  type MemberArchiveViewMode,
} from '@/components/club/members/ClubMemberArchivePage';
import AddMemberModal from '@/components/AddMemberModal';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import ClubMemberArchiveHeader from './components/status';
import MemberArchiveTopNav, {
  MemberArchiveTitle,
  type MemberArchiveNavMode,
  type MemberArchiveNavRole,
  type MemberArchiveSection,
  memberArchiveNavSections,
} from '@/components/club/memberArchive/MemberArchiveTopNav';
import ArchiveEntityProfilePanel from '@/components/club/memberArchive/ArchiveEntityProfilePanel';
import AthletesParentsArchive from '@/components/club/memberArchive/AthletesParentsArchive';
import ClubStaffList from '@/components/club/staff/ClubStaffList';
import { clubApiFetch, getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import {
  computeClubMemberCapacity,
  type ClubMemberCapacityStats,
} from '@/lib/club/clubMemberCapacity';
import {
  getUsersAvailableFirstSubscription,
  getUsersAvailableRenewal,
} from '@/lib/admin/subscriptionManageableUsers';
import { SUBSCRIPTION_SETTINGS_UPDATED_EVENT } from '@/lib/admin/subscriptionSettingsMock';
import { useClubWorkspace } from '@/contexts/ClubWorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import {
  getArchiveEntityProfileSectionLabel,
  managedEntityKindFromUserType,
} from '@/lib/entity/entityProfileLabels';
import type { Column, Member } from '@/types/clubTable';
import { staffRowTextClass } from '@/lib/club/clubStaff.constants';
import {
  memberArchiveStatusShortLabel,
  memberArchiveStatusTextClass,
  normalizeMemberArchiveStatus,
  type MemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';
import AutoTranslate from '@/components/i18n/AutoTranslate';

type MemberCapacityResponse = {
  subscriptionSettingId: number | null;
  capacity: ClubMemberCapacityStats;
};

const MEMBER_ARCHIVE_SECTIONS: MemberArchiveSection[] = [
  'athletes',
  'pending',
  'archived',
  'not-members',
  'parents',
  'staff',
  'club-profile',
  'settings',
];

function parseArchiveSection(value: string | null): MemberArchiveSection | null {
  return MEMBER_ARCHIVE_SECTIONS.find((section) => section === value) ?? null;
}

function parseArchiveNavMode(value: string | null): MemberArchiveNavMode {
  return value === 'athletes' ? 'athletes' : 'archive';
}

function archiveNavRoleFromUserType(
  userType: string | null | undefined,
): MemberArchiveNavRole {
  return managedEntityKindFromUserType(userType) === 'coaching-group'
    ? 'coach'
    : 'club-or-team';
}

/**
 * Default nav mode from section when `nav` is omitted (e.g. old bookmarks).
 * Pending / not-members imply Athletes\\Members header; everything else → Archive of Users.
 */
function defaultNavModeForSection(section: MemberArchiveSection): MemberArchiveNavMode {
  if (section === 'pending' || section === 'not-members') return 'athletes';
  return 'archive';
}

function formatDisplayDate(value: unknown) {
  if (!value) return '-';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    }
  }
  return raw;
}

function MemberListPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { selectedClubId: contextClubId } = useClubWorkspace();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberPendingDelete, setMemberPendingDelete] = useState<Member | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addError, setAddError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveViewMode, setArchiveViewMode] = useState<MemberArchiveViewMode>('all');
  const [favouritePendingRemove, setFavouritePendingRemove] = useState<Member | null>(null);
  const [capacityPayload, setCapacityPayload] = useState<MemberCapacityResponse | null>(null);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [teamId, setTeamId] = useState<string | null>(null);

  const entityKind = useMemo(
    () => managedEntityKindFromUserType(user?.userType),
    [user?.userType],
  );
  const isTeamWorkspace = entityKind === 'team';
  /** Coach (ID6): athletes trained + groups trained of the signed-in coach. */
  const isCoachWorkspace = entityKind === 'coaching-group';

  const archiveNavRole = useMemo(
    () => archiveNavRoleFromUserType(user?.userType),
    [user?.userType],
  );

  const profileSectionLabel = useMemo(
    () => getArchiveEntityProfileSectionLabel(entityKind),
    [entityKind],
  );

  // ?section= is the source of truth so the sidebar (Archives → Archive of Users) and the
  // top nav can never disagree about which section is open.
  const archiveSection = useMemo(() => {
    const parsed = parseArchiveSection(searchParams?.get('section') ?? null) ?? 'athletes';
    return parsed;
  }, [searchParams]);

  const archiveNavMode = useMemo(() => {
    const fromQuery = searchParams?.get('nav');
    if (fromQuery === 'athletes' || fromQuery === 'archive') {
      return parseArchiveNavMode(fromQuery);
    }
    return defaultNavModeForSection(archiveSection);
  }, [archiveSection, searchParams]);

  const allowedNavSections = useMemo(
    () =>
      memberArchiveNavSections(archiveNavRole, archiveNavMode, profileSectionLabel),
    [archiveNavRole, archiveNavMode, profileSectionLabel],
  );

  // Keep URL valid for the current one-row header (e.g. pending is invalid on Archive of Users nav).
  useEffect(() => {
    if (allowedNavSections.includes(archiveSection)) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('section', 'athletes');
    if (!params.get('nav')) {
      params.set('nav', archiveNavMode);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    allowedNavSections,
    archiveNavMode,
    archiveSection,
    pathname,
    router,
    searchParams,
  ]);

  const membershipStatusFilter = useMemo((): MemberArchiveStatus | 'all' => {
    if (archiveSection === 'pending') return 'pending';
    if (archiveSection === 'not-members') return 'not_member';
    if (archiveSection === 'archived') return 'archived';
    // All the users profiles: athletes + archive nav → show A+B+C (not archived)
    if (archiveSection === 'athletes' && archiveNavMode === 'archive') return 'all';
    // Athletes\\Members dedicated tab → official members only
    if (archiveSection === 'athletes') return 'member';
    return 'all';
  }, [archiveSection, archiveNavMode]);

  const showMembersArchive =
    archiveSection === 'athletes' ||
    archiveSection === 'pending' ||
    archiveSection === 'not-members' ||
    archiveSection === 'archived';

  const setArchiveSection = useCallback(
    (section: MemberArchiveSection) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('section', section);
      params.set('nav', archiveNavMode);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [archiveNavMode, pathname, router, searchParams],
  );

  const clubId = useMemo(() => {
    if (isTeamWorkspace || isCoachWorkspace) return null;
    if (contextClubId) return contextClubId;
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('selectedClub');
  }, [contextClubId, isTeamWorkspace, isCoachWorkspace]);

  useEffect(() => {
    if (!isTeamWorkspace) {
      setTeamId(null);
      return;
    }
    let cancelled = false;
    const resolveTeam = async () => {
      const saved =
        typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null;
      if (saved) {
        if (!cancelled) setTeamId(saved);
        return;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        if (!cancelled) setTeamId(null);
        return;
      }
      try {
        const res = await fetch('/api/teams/my-teams', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setTeamId(null);
          return;
        }
        const data = (await res.json()) as { teams?: Array<{ id: string }> };
        const first = data.teams?.[0]?.id ?? null;
        if (first) localStorage.setItem('selectedTeam', first);
        if (!cancelled) setTeamId(first);
      } catch {
        if (!cancelled) setTeamId(null);
      }
    };
    void resolveTeam();
    return () => {
      cancelled = true;
    };
  }, [isTeamWorkspace, refreshKey]);

  const workspaceId = isCoachWorkspace ? user?.id ?? null : isTeamWorkspace ? teamId : clubId;

  const openMemberProfile = useCallback(
    (member: Member, mode: 'view' | 'edit') => {
      const id = member.memberId || member.id;
      if (!id) return;
      const q = new URLSearchParams();
      if (isCoachWorkspace && user?.id) q.set('coachId', user.id);
      else if (isTeamWorkspace && teamId) q.set('teamId', teamId);
      else if (clubId) q.set('clubId', clubId);
      q.set('mode', mode);
      router.push(`/clubMembers/memberProfile/${encodeURIComponent(id)}?${q.toString()}`);
    },
    [clubId, isCoachWorkspace, isTeamWorkspace, router, teamId, user?.id],
  );

  const requestDeleteMember = useCallback((member: Member) => {
    setAddError('');
    setMemberPendingDelete(member);
  }, []);

  const handleConfirmRemoveFavourite = useCallback(async () => {
    const member = favouritePendingRemove;
    if (!member) return;
    const id = member.memberId || member.id;
    if (!id) {
      setFavouritePendingRemove(null);
      return;
    }
    setBusyId(id);
    setAddError('');
    try {
      const res = await fetch(withSelectedClubId('/api/club/member-favourites'), {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: [id] }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to remove from Favourites',
        );
      }
      setFavouritePendingRemove(null);
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to remove from Favourites');
    } finally {
      setBusyId(null);
    }
  }, [favouritePendingRemove]);

  const handleConfirmDeleteMember = useCallback(async () => {
    const member = memberPendingDelete;
    if (!member) return;

    const id = member.memberId || member.id;
    const resolvedWorkspaceId =
      workspaceId ||
      (typeof window !== 'undefined'
        ? isTeamWorkspace
          ? localStorage.getItem('selectedTeam')
          : localStorage.getItem('selectedClub')
        : null);
    if (!id || !resolvedWorkspaceId) {
      setAddError(
        isTeamWorkspace
          ? 'Select a team under My Team before managing members.'
          : 'Select a club under My clubs before managing members.',
      );
      setMemberPendingDelete(null);
      return;
    }

    setBusyId(id);
    setAddError('');
    try {
      const url = isCoachWorkspace
        ? `/api/coach/athletes/${encodeURIComponent(id)}`
        : isTeamWorkspace
        ? `/api/teams/${encodeURIComponent(resolvedWorkspaceId)}/members/${encodeURIComponent(id)}`
        : withSelectedClubId(
            `/api/clubs/${encodeURIComponent(resolvedWorkspaceId)}/members/${encodeURIComponent(id)}`,
          );
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to remove member',
        );
      }
      setMemberPendingDelete(null);
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setBusyId(null);
    }
  }, [isCoachWorkspace, isTeamWorkspace, memberPendingDelete, workspaceId]);

  const deleteConfirmMessage = useMemo(() => {
    if (!memberPendingDelete) return '';
    const label =
      [memberPendingDelete.surname, memberPendingDelete.name]
        .filter(Boolean)
        .join(' ') ||
      memberPendingDelete.username ||
      memberPendingDelete.memberId ||
      memberPendingDelete.id;
    if (isCoachWorkspace) {
      return `Stop training ${label}? They are also removed from your groups trained. Their Movesbook account will not be deleted.`;
    }
    return `Remove ${label} from this ${isTeamWorkspace ? 'team' : 'club'}? Their Movesbook account will not be deleted.`;
  }, [isCoachWorkspace, isTeamWorkspace, memberPendingDelete]);

  const columns: Column[] = useMemo(
    () => [
  {
    key: 'image',
    header: 'Image',
    render: (value) =>
      value ? (
            <Image
          src={String(value)}
          alt=""
              className="h-10 w-10 rounded-full object-cover"
              width={40}
              height={40}
              unoptimized
        />
      ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
          —
        </span>
      ),
  },
  { key: 'surname', header: 'Surname' },
  { key: 'name', header: 'Name' },
  { key: 'gender', header: 'Gender' },
      {
        key: 'dateOfBirth',
        header: 'Date of Birth',
        render: (value, row) =>
          String(row.dateOfBirthDisplay || formatDisplayDate(value) || '-'),
      },
      {
        key: 'operator',
        header: 'Type of User',
        render: (value, row) => {
          const label = String(value ?? 'Member');
          const staffType = String(row.staffType ?? '');
          if (staffType) {
            return (
              <span className={staffRowTextClass({ staffType, role: String(row.staffRole ?? '') })}>
                {label}
              </span>
            );
          }
          // Coach view labels (Coach / Athlete trained) are not membership statuses.
          if (label !== 'Member') return <span>{label}</span>;
          const status = normalizeMemberArchiveStatus(String(row.membershipStatus ?? ''));
          return (
            <span className={memberArchiveStatusTextClass(status)}>
              {memberArchiveStatusShortLabel(status)}
            </span>
          );
        },
      },
  {
    key: 'memberType',
    header: 'Member Type',
    render: (value) => memberTypeBadge(value),
  },
  {
    key: 'localCity',
    header: 'Local City',
    render: (value, row) => String(value || row.Localcity || '-'),
  },
  { key: 'phone', header: 'Phone' },
  {
    key: 'insertDate',
    header: 'Insert Date',
        render: (_value, row) =>
          String(row.insertDateDisplay || formatDisplayDate(row.insertDate) || '-'),
      },
      {
        key: 'options',
        header: 'Options',
        render: (_value, row) => {
          const id = row.memberId || row.id || '';
          const busy = busyId === id;
          return (
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <button
                type="button"
                title="Open member profile"
                disabled={busy}
                onClick={() => openMemberProfile(row, 'view')}
                className="rounded p-1 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Edit member profile"
                disabled={busy}
                onClick={() => openMemberProfile(row, 'edit')}
                className="rounded p-1 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-40"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Membership calendar (soon)"
                disabled
                className="rounded p-1 opacity-40"
              >
                <CalendarClock className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={
                  archiveViewMode === 'favourites'
                    ? 'Remove from Favourites'
                    : isCoachWorkspace
                      ? 'Stop training'
                      : isTeamWorkspace
                      ? 'Remove from team'
                      : 'Remove from club'
                }
                disabled={busy}
                onClick={() => {
                  if (archiveViewMode === 'favourites') {
                    setAddError('');
                    setFavouritePendingRemove(row);
                  } else {
                    requestDeleteMember(row);
                  }
                }}
                className="rounded p-1 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [archiveViewMode, busyId, isCoachWorkspace, isTeamWorkspace, openMemberProfile, requestDeleteMember],
  );

  const capacityOwnerId = isCoachWorkspace ? null : workspaceId;
  const loadCapacity = useCallback(async () => {
    if (!capacityOwnerId) {
      setCapacityPayload(null);
      return;
    }
    try {
      const param = isTeamWorkspace ? 'teamId' : 'clubId';
      const response = await clubApiFetch<MemberCapacityResponse>(
        `/api/club/member-capacity?${param}=${encodeURIComponent(capacityOwnerId)}`,
      );
      setCapacityPayload(response);
    } catch {
      setCapacityPayload(null);
    }
  }, [capacityOwnerId, isTeamWorkspace]);

  useEffect(() => {
    void loadCapacity();
  }, [loadCapacity, refreshKey]);

  useEffect(() => {
    const refresh = () => setSettingsRevision((value) => value + 1);
    window.addEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const capacity = useMemo(() => {
    void settingsRevision;
    if (!capacityPayload?.capacity) return null;

    const base = capacityPayload.capacity;
    const subscriptionSettingId = capacityPayload.subscriptionSettingId;
    if (!subscriptionSettingId) return base;

    return computeClubMemberCapacity({
      membersAdded: base.membersAdded,
      membersPurchasedBase: base.membersPurchasedBase,
      subscriptionSettingId,
      subscriptionPhase: base.subscriptionPhase,
      subscriptionEndDate: base.subscriptionEndDateIso
        ? new Date(`${base.subscriptionEndDateIso}T12:00:00.000Z`)
        : null,
      usersAllowanceFirst: getUsersAvailableFirstSubscription(subscriptionSettingId),
      usersAllowanceRenewal: getUsersAvailableRenewal(subscriptionSettingId),
    });
  }, [capacityPayload, settingsRevision]);

  const handleAddExistingUser = useCallback(
    async (data: {
      username: string;
      password: string;
      membershipStatus?: MemberArchiveStatus;
    }) => {
      setAddError('');
      const resolvedWorkspaceId =
        workspaceId ||
        (typeof window !== 'undefined'
          ? isTeamWorkspace
            ? localStorage.getItem('selectedTeam')
            : localStorage.getItem('selectedClub')
          : null);
      if (!resolvedWorkspaceId) {
        throw new Error(
          isTeamWorkspace
            ? 'Select a team under My Team before adding members.'
            : 'Select a club under My clubs before adding members.',
        );
      }
      if (isCoachWorkspace) {
        const response = await fetch('/api/coach/athletes/add', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: data.username, password: data.password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === 'string' ? payload.error : 'Failed to add athlete',
          );
        }
        setRefreshKey((k) => k + 1);
        return;
      }
      if (!data.membershipStatus) {
        throw new Error('Please choose which list to put the new member in.');
      }

      const url = isTeamWorkspace
        ? `/api/teams/${encodeURIComponent(resolvedWorkspaceId)}/members/add`
        : withSelectedClubId(
            `/api/clubs/${encodeURIComponent(resolvedWorkspaceId)}/members/add`,
          );
      const response = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username: data.username,
            password: data.password,
          membershipStatus: data.membershipStatus,
          }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to add member',
        );
      }

      setRefreshKey((k) => k + 1);
    },
    [isCoachWorkspace, isTeamWorkspace, workspaceId],
  );

  return (
    <div className="w-full h-full flex flex-col p-4 gap-4">
      <MemberArchiveTopNav
        active={archiveSection}
        onChange={setArchiveSection}
        profileSectionLabel={profileSectionLabel}
        navRole={archiveNavRole}
        navMode={archiveNavMode}
      />

      <MemberArchiveTitle
        settingsActive={archiveSection === 'settings'}
        onSettingsClick={() => setArchiveSection('settings')}
      />

      {showMembersArchive ? (
        <>
          {archiveSection === 'athletes' && capacity ? (
            <ClubMemberArchiveHeader
              capacity={capacity}
              onPurchaseMembers={() => {
                window.alert(
                  'Purchase members — additional slot packs will be added to Members purchased.',
                );
              }}
              onStatusAccounts={() => {
                window.alert('Status accounts — member account status overview.');
              }}
            />
          ) : null}

          {archiveSection === 'athletes' && !capacity && capacityOwnerId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Loading member capacity from your subscription version…
            </div>
          ) : null}

          {!workspaceId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {isTeamWorkspace
                ? 'Select a team under My Team to view members.'
                : 'Select a club workspace to view member capacity from your subscription version.'}
            </div>
      ) : null}

          {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
          <ClubMemberArchivePage
        columns={columns}
        refreshKey={refreshKey}
            membershipStatusFilter={membershipStatusFilter}
            onMembershipStatusChanged={() => setRefreshKey((k) => k + 1)}
            onViewModeChange={setArchiveViewMode}
            statusChangesEnabled={!isCoachWorkspace}
            footerHint={
              isCoachWorkspace
                ? 'Athletes trained by you: added directly or members of your groups trained. Groups and the Group of training filter use your groups trained.'
                : membershipStatusFilter === 'all'
                ? 'All profiles: black = Athlete\\Member (green → archive), red = pending, blue = not member. Archived members are under Members Archived.'
                : membershipStatusFilter === 'archived'
                  ? 'Members Archived — grey rows. Click the grey circle to restore as Athlete\\Member.'
                : isTeamWorkspace
                  ? 'Live data from team members in the database.'
                  : 'Live data from club members in the database.'
            }
            addMemberAction={
              archiveSection === 'athletes' ? (
          <button
            type="button"
            onClick={() => {
              setAddError('');
              setShowAddMemberModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            <UserPlus className="h-4 w-4" />
            Add a member
          </button>
              ) : null
            }
          />
        </>
      ) : archiveSection === 'parents' && isCoachWorkspace ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
          Parents &amp; tutors are kept by the athletes&apos; clubs and teams. Open an athlete
          trained from Members to read their profile.
        </div>
      ) : archiveSection === 'parents' ? (
        workspaceId ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <AthletesParentsArchive
              clubId={isTeamWorkspace ? null : workspaceId}
              teamId={isTeamWorkspace ? workspaceId : null}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {isTeamWorkspace
              ? 'Select a team under My Team to view parents & tutors.'
              : 'Select a club workspace to view parents & tutors.'}
          </div>
        )
      ) : archiveSection === 'staff' ? (
        <div className="min-h-0 flex-1">
          <ClubStaffList />
        </div>
      ) : archiveSection === 'club-profile' ? (
        <ArchiveEntityProfilePanel clubId={clubId} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">
          <h2 className="mb-2 text-lg font-bold text-gray-900">Settings</h2>
          <p>Archive settings for this club/team will appear here.</p>
        </div>
      )}

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        entityType={isCoachWorkspace ? 'coaching-group' : isTeamWorkspace ? 'team' : 'club'}
        onAddExistingUser={handleAddExistingUser}
      />

      <PromocodeConfirmModal
        open={Boolean(memberPendingDelete)}
        title={isCoachWorkspace ? 'Stop training' : isTeamWorkspace ? 'Remove from team' : 'Remove from club'}
        message={deleteConfirmMessage}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        loading={Boolean(
          memberPendingDelete &&
            busyId ===
              (memberPendingDelete.memberId || memberPendingDelete.id),
        )}
        onClose={() => {
          if (busyId) return;
          setMemberPendingDelete(null);
        }}
        onConfirm={() => void handleConfirmDeleteMember()}
      />

      <PromocodeConfirmModal
        open={Boolean(favouritePendingRemove)}
        title="Remove from Favourites"
        message={`Remove ${
          [favouritePendingRemove?.name, favouritePendingRemove?.surname].filter(Boolean).join(' ') ||
          'this member'
        } from Favourites? The member stays in the club list.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        loading={Boolean(
          favouritePendingRemove &&
            busyId === (favouritePendingRemove.memberId || favouritePendingRemove.id),
        )}
        onClose={() => {
          if (busyId) return;
          setFavouritePendingRemove(null);
        }}
        onConfirm={() => void handleConfirmRemoveFavourite()}
      />
    </div>
  );
}

export default function MemberListPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
      <AutoTranslate>
        <MemberListPageContent />
      </AutoTranslate>
    </Suspense>
  );
}
