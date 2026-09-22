'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ClubMemberProfileEditor, {
  type ProfileTabId,
} from '@/components/club/memberProfile/ClubMemberProfileEditor';
import DuplicateMemberDataPanel from '@/components/club/memberProfile/DuplicateMemberDataPanel';
import type { MemberProfileBundle } from '@/lib/club/memberProfileTypes';
import { isMemberUnderage } from '@/lib/club/memberProfileDefaults';
import { PARENTS_TAB_LABEL } from '@/lib/club/memberProfileTypes';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';

type TabMeta = { id: ProfileTabId; label: string; clubScoped: boolean };

const SHARED_TABS: TabMeta[] = [
  { id: 'owner-profile', label: 'Member profile', clubScoped: false },
  { id: 'contacts', label: 'Contacts', clubScoped: false },
  { id: 'activities', label: 'My Activities', clubScoped: false },
  { id: 'references', label: 'References', clubScoped: false },
];

const CLUB_TABS: TabMeta[] = [
  { id: 'parents', label: PARENTS_TAB_LABEL, clubScoped: true },
  { id: 'pay-for', label: 'Pay for…', clubScoped: true },
  { id: 'other-details', label: 'Other Club data', clubScoped: true },
  { id: 'settings', label: 'Settings', clubScoped: true },
  { id: 'messages-staff', label: 'Alert posted', clubScoped: true },
  { id: 'notes-coach', label: 'Coach notes', clubScoped: true },
  { id: 'presences', label: 'Presences', clubScoped: true },
];

function tabVisibleForViewer(tab: TabMeta, data: MemberProfileBundle): boolean {
  if (!tab.clubScoped) return true;
  // Team workspace has no staff/coach note store yet.
  if (
    data.workspaceKind === 'team' &&
    (tab.id === 'messages-staff' || tab.id === 'notes-coach')
  ) {
    return false;
  }
  if (data.viewer.isClubAdmin) return true;

  const v = data.club.visibility;

  switch (tab.id) {
    case 'pay-for':
      return Boolean(v.payFor);
    case 'other-details':
      return Boolean(v.otherDetails);
    case 'parents': {
      const dob = data.owner.personal.dateOfBirth || data.user.birthdate || '';
      if (!isMemberUnderage(dob)) return false;
      if (data.viewer.isClubAdmin) return true;
      return Boolean(v.parents);
    }
    case 'settings':
      return Boolean(v.settings);
    case 'messages-staff':
      return Boolean(v.messagesStaff);
    case 'notes-coach':
      return Boolean(v.notesCoach);
    case 'presences':
      return Boolean(v.presences);
    default:
      return true;
  }
}

function profileQuery(workspaceId: string, isTeam: boolean, mode: 'view' | 'edit') {
  const q = new URLSearchParams();
  if (isTeam) q.set('teamId', workspaceId);
  else q.set('clubId', workspaceId);
  q.set('mode', mode);
  return q.toString();
}

export default function ClubMemberProfilePage() {
  const params = useParams() ?? {};
  const searchParams = useSearchParams();
  const router = useRouter();
  const memberId = String(
    (params as { memberId?: string | string[] }).memberId || '',
  );
  const clubIdParam = searchParams?.get('clubId') || '';
  const teamIdParam = searchParams?.get('teamId') || '';
  const isTeamWorkspace = Boolean(teamIdParam) && !clubIdParam;
  const workspaceId = clubIdParam || teamIdParam;
  const mode = searchParams?.get('mode') === 'view' ? 'view' : 'edit';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<MemberProfileBundle | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('owner-profile');

  const load = useCallback(async () => {
    if (!memberId || !workspaceId) {
      setError(
        isTeamWorkspace || teamIdParam
          ? 'Missing member or team. Open this page from Archive of Members.'
          : 'Missing member or club. Open this page from Archive of Members.',
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const path = `/api/clubs/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}/profile`;
      const withQs = isTeamWorkspace
        ? `${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(workspaceId)}`
        : withSelectedClubId(path);
      const res = await fetch(withQs, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load profile');
      }
      setData(json as MemberProfileBundle);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [memberId, workspaceId, isTeamWorkspace, teamIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs = useMemo(() => {
    const otherLabel =
      data?.workspaceKind === 'team' || isTeamWorkspace ? 'Other Team data' : 'Other Club data';
    const clubBase = CLUB_TABS.map((tab) =>
      tab.id === 'other-details' ? { ...tab, label: otherLabel } : tab,
    );
    if (!data) {
      return { shared: SHARED_TABS, club: clubBase, all: [...SHARED_TABS, ...clubBase] };
    }
    const shared = SHARED_TABS.filter((t) => tabVisibleForViewer(t, data));
    const club = clubBase.filter((t) => tabVisibleForViewer(t, data));
    return { shared, club, all: [...shared, ...club] };
  }, [data, isTeamWorkspace]);

  useEffect(() => {
    if (!tabs.all.some((t) => t.id === activeTab)) {
      setActiveTab(tabs.all[0]?.id || 'owner-profile');
    }
  }, [tabs, activeTab]);

  const activeMeta = tabs.all.find((t) => t.id === activeTab);
  const teamMode = data?.workspaceKind === 'team' || isTeamWorkspace;

  const displayName = data
    ? [data.user.firstName || data.user.name, data.user.surname].filter(Boolean).join(' ') ||
      data.user.username
    : 'Member';

  const modeSwitchHref = workspaceId
    ? `/clubMembers/memberProfile/${encodeURIComponent(memberId)}?${profileQuery(
        workspaceId,
        teamMode,
        mode === 'edit' ? 'view' : 'edit',
      )}`
    : '/clubMembers/memberList';

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/clubMembers/memberList')}
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Archive of Members
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'edit' ? (
            <Link
              href={modeSwitchHref}
              className="rounded bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800"
            >
              Switch to view
            </Link>
          ) : (
            <Link
              href={modeSwitchHref}
              className="rounded bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white"
            >
              Switch to edit
            </Link>
          )}
          <span className="rounded bg-gray-800 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {mode === 'view' ? 'View mode' : 'Edit mode'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading member profile…
        </div>
      ) : error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}{' '}
          <Link href="/clubMembers/memberList" className="underline">
            Return to archive
          </Link>
        </div>
      ) : data ? (
        <>
          <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-base font-semibold uppercase tracking-wide text-teal-700">
              {teamMode ? 'Team' : 'Club'} member profile — {data.clubName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{displayName}</h1>
            <p className="mt-1 text-sm text-gray-600">
              @{data.user.username}
              {data.user.email ? ` · ${data.user.email}` : ''}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Grey tabs are shared across {teamMode ? 'teams' : 'clubs'} (user DB). Blue tabs load
              from this {teamMode ? 'team' : 'club'}&apos;s data ({data.clubName}).
            </p>
          </div>

          {data.viewer.isClubAdmin ? (
            <div className="mb-4">
              <DuplicateMemberDataPanel
                workspaceId={workspaceId}
                isTeamWorkspace={teamMode}
                currentMemberId={data.memberId}
                members={data.clubMembersForPayFor}
                disabled={mode === 'view'}
                onDuplicated={() => void load()}
              />
            </div>
          ) : null}

          <div className="mb-0 border-b border-gray-300">
            <nav
              className="flex w-full flex-nowrap items-end gap-px overflow-x-auto"
              aria-label="Member profile sections"
            >
              <div className="flex shrink-0 flex-col">
                <p className="mb-1 px-1 text-[11px] font-semibold whitespace-nowrap text-gray-700 sm:text-xs">
                  Managed by the member (*Member profile can be shared)
                </p>
                <div className="flex flex-nowrap gap-px">
                  {tabs.shared.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={tab.label}
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 rounded-t px-2.5 py-2 text-center text-[11px] font-medium leading-tight whitespace-nowrap sm:px-3 sm:text-xs md:text-sm ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex shrink-0 flex-col">
                <p className="mb-1 px-1 text-[11px] font-semibold whitespace-nowrap text-red-700 sm:text-xs">
                  Managed by the {teamMode ? 'Team' : 'Club'} Admin
                </p>
                <div className="flex flex-nowrap gap-px">
                  {tabs.club.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={tab.label}
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 rounded-t px-2.5 py-2 text-center text-[11px] font-medium leading-tight whitespace-nowrap sm:px-3 sm:text-xs md:text-sm ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-sky-100 text-sky-900 hover:bg-sky-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>

          <div className="rounded-b-lg border border-t-0 border-gray-300 bg-white p-4 md:p-6">
            <div
              className={`mb-4 px-3 py-2 font-semibold text-white ${
                activeMeta?.id === 'pay-for' ? 'text-lg' : 'text-sm'
              } ${activeMeta?.clubScoped ? 'bg-sky-700' : 'bg-[#2f6fb5]'}`}
            >
              {activeMeta?.label}
              {activeMeta?.clubScoped ? (
                <>
                  {' · '}
                  <span className={activeMeta?.id === 'pay-for' ? 'text-xl' : 'text-base'}>
                    {data.clubName}
                  </span>
                </>
              ) : (
                ' · shared profile'
              )}
            </div>

            <ClubMemberProfileEditor
              data={data}
              activeTab={activeTab}
              mode={mode}
              onChange={setData}
              onReload={() => void load()}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
