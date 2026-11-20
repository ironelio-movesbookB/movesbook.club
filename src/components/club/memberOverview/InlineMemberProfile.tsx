'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ClubMemberProfileEditor, {
  type ProfileTabId,
} from '@/components/club/memberProfile/ClubMemberProfileEditor';
import MemberAdministrationPanel from '@/components/club/memberProfile/MemberAdministrationPanel';
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
  { id: 'administration', label: 'Administration', clubScoped: true },
  { id: 'presences', label: 'Presences', clubScoped: true },
  { id: 'stats', label: 'Stats', clubScoped: true },
];

function tabVisible(tab: TabMeta, data: MemberProfileBundle): boolean {
  if (!tab.clubScoped) return true;
  if (data.workspaceKind === 'coach') return false;
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
      return Boolean(v.parents);
    }
    case 'administration':
      return false;
    case 'settings':
      return Boolean(v.settings);
    case 'messages-staff':
      return Boolean(v.messagesStaff);
    case 'notes-coach':
      return Boolean(v.notesCoach);
    case 'presences':
      return Boolean(v.presences);
    case 'stats':
      return Boolean(v.stats);
    default:
      return true;
  }
}

function defaultTabForFocus(focus: Props['focus']): ProfileTabId {
  if (focus === 'administration') return 'administration';
  if (focus === 'settings') return 'settings';
  return 'owner-profile';
}

type Props = {
  clubId: string;
  memberId: string;
  /**
   * Profile opens Member profile.
   * Settings opens Settings.
   * Administration opens the Administration whole page (archives + Current subscription).
   */
  focus: 'profile' | 'settings' | 'administration';
};

export default function InlineMemberProfile({ clubId, memberId, focus }: Props) {
  const [data, setData] = useState<MemberProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ProfileTabId>(() => defaultTabForFocus(focus));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = withSelectedClubId(
        `/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/profile`,
      );
      const res = await fetch(path, { headers: getAuthHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load profile');
      }
      setData(json as MemberProfileBundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clubId, memberId]);

  useEffect(() => {
    setActiveTab(defaultTabForFocus(focus));
    void load();
  }, [load, focus]);

  const tabs = useMemo(() => {
    const shared = data ? SHARED_TABS.filter((tab) => tabVisible(tab, data)) : SHARED_TABS;
    const club = data ? CLUB_TABS.filter((tab) => tabVisible(tab, data)) : CLUB_TABS;
    return { shared, club, all: [...shared, ...club] };
  }, [data]);

  useEffect(() => {
    if (!tabs.all.some((t) => t.id === activeTab)) {
      setActiveTab(tabs.all[0]?.id || 'owner-profile');
    }
  }, [tabs, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-6 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error || 'Profile unavailable.'}
      </div>
    );
  }

  const activeMeta = tabs.all.find((tab) => tab.id === activeTab);
  const isAdminTab = activeTab === 'administration';

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="border-b border-gray-300 px-3 pt-2">
        <div className="flex flex-wrap items-stretch gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold text-gray-700">
              Managed by the member (*Member profile can be shared)
            </p>
            <div className="flex flex-wrap gap-1">
              {tabs.shared.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
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
          {tabs.club.length > 0 ? (
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-semibold text-red-700">Managed by the Club Admin</p>
              <div className="flex flex-wrap gap-1">
                {tabs.club.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded px-2 py-1 text-xs font-medium ${
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
          ) : null}
        </div>
      </div>

      <div className={isAdminTab ? 'p-0' : 'p-4'}>
        {!isAdminTab && activeMeta ? (
          <div
            className={`mb-4 px-3 py-2 text-sm font-semibold text-white ${
              activeMeta.clubScoped ? 'bg-sky-700' : 'bg-[#2f6fb5]'
            }`}
          >
            {activeMeta.label}
            {activeMeta.clubScoped ? ` · ${data.clubName}` : ' · shared profile'}
          </div>
        ) : null}

        {isAdminTab ? (
          <MemberAdministrationPanel data={data} onChange={setData} onReload={() => void load()} />
        ) : activeMeta ? (
          <ClubMemberProfileEditor
            data={data}
            activeTab={activeMeta.id}
            mode="edit"
            onChange={setData}
            onReload={() => void load()}
          />
        ) : null}
      </div>
    </div>
  );
}
