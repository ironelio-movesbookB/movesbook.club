'use client';

import { useSportT } from '@/components/sport/useSportT';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import ClubMemberProfileEditor, {
  type ProfileTabId,
} from '@/components/club/memberProfile/ClubMemberProfileEditor';
import type { MemberProfileBundle } from '@/lib/club/memberProfileTypes';
import { isMemberUnderage } from '@/lib/club/memberProfileDefaults';
import { PARENTS_TAB_LABEL } from '@/lib/club/memberProfileTypes';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import AutoTranslate, { useAutoTranslateRef } from '@/components/i18n/AutoTranslate';
import ScrollArrowsRow from '@/components/ui/ScrollArrowsRow';

type ClubOption = { id: string; name: string };

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
  { id: 'stats', label: 'Stats', clubScoped: true },
];

/** Short “what this section does” copy shown to members. */
const TAB_FUNCTION_HELP: Partial<Record<ProfileTabId, string>> = {
  'owner-profile':
    'Your personal identity data (login, address, personal and medical info). Shared across every club. Managed by you (*Member profile can be shared).',
  contacts:
    'Your public contact details and social links. Managed by you; shared across every club.',
  activities:
    'Preferred days and free-time activities (Music, Sport, Travels, …). Managed by you; shared across every club.',
  references:
    'Your references text and level. Managed by you; shared across every club.',
  'pay-for':
    'Lists other club members whose fees or purchases you pay for (family members, children, etc.). Managed by the club admin for this club.',
  'other-details':
    'Other Club/Team data for this membership (status, membership dates, tutors, insurance, news permissions). Most fields are managed by the club/team admin; signatures and rule/privacy acceptance are managed by the member.',
  parents:
    'Parent / tutor contacts for underage members in this club. Managed by the club admin; visible only when the member is under 18.',
  settings:
    'How this club shows your profile (theme, sharing, follow-up). Managed by the club admin.',
  'messages-staff':
    'Alerts posted by club staff about your membership. Visible when the admin enables this label for you.',
  'notes-coach':
    'Notes written by coaches for you (login/logout notices, training comments). Visible when enabled by the club admin.',
  presences:
    'Graphs and history of your attendances / accesses at this club. Visible when enabled by the club admin.',
  stats:
    'Your sport statistics per season, recorded by the club/team admin. Visible when enabled by the club admin.',
};

function tabVisibleForMember(tab: TabMeta, data: MemberProfileBundle | null): boolean {
  if (!tab.clubScoped) return true;
  if (!data) return true;
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

function clubTabBlockedContent(
  tab: TabMeta | undefined,
  data: MemberProfileBundle,
  clubName: string,
  st: (text: string) => string,
): { whatItDoes: string; whyBlocked: string } {
  const whatItDoes = st(
    (tab && TAB_FUNCTION_HELP[tab.id]) ||
      'This club section stores data linked to your membership.',
  );

  const dob = data.owner.personal.dateOfBirth || data.user.birthdate || '';
  const notEnabled = st(
    'The club admin has not enabled reading of this label for you. Use Change club to try another club, or ask the admin to enable it.',
  );
  let whyBlocked = clubName ? `${clubName}: ${notEnabled}` : notEnabled;

  if (tab?.id === 'parents' && !isMemberUnderage(dob)) {
    whyBlocked = st(
      'Parents is available only for underage members (under 18). Update the date of birth on Owner profile if needed, or ask the club admin.',
    );
  }

  return { whatItDoes, whyBlocked };
}

type Props = {
  userId: string;
  clubs: ClubOption[];
};

function MemberSelfProfilePanelView({ userId, clubs }: Props) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>('owner-profile');
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const st = useSportT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useAutoTranslateRef<HTMLDivElement>();
  const [pendingClubTab, setPendingClubTab] = useState<ProfileTabId | null>(null);
  const [data, setData] = useState<MemberProfileBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeMeta = useMemo(
    () => [...SHARED_TABS, ...CLUB_TABS].find((t) => t.id === activeTab),
    [activeTab],
  );

  const loadSelf = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/member-profile', {
        headers: getAuthHeaders(),
      });
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
  }, []);

  const loadClub = useCallback(
    async (clubId: string) => {
      if (!clubId || !userId) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          withSelectedClubId(
            `/api/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(userId)}/profile`,
          ),
          { headers: getAuthHeaders() },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load profile');
        }
        setData(json as MemberProfileBundle);
        setSelectedClubId(clubId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (clubs.length === 0) {
      void loadSelf();
    } else {
      void loadClub(clubs[0].id);
    }
  }, [clubs, loadSelf, loadClub]);

  const profileSource = clubs.length === 0 ? 'self' : 'club';

  // Always show all labels; enforce club-admin visibility after a club is selected.
  const tabs = useMemo(
    () => ({
      shared: SHARED_TABS,
      club: CLUB_TABS,
      all: [...SHARED_TABS, ...CLUB_TABS],
    }),
    [],
  );

  const clubTabBlocked =
    Boolean(activeMeta?.clubScoped) &&
    Boolean(data) &&
    data!.clubId === selectedClubId &&
    !tabVisibleForMember(activeMeta!, data);

  const openTab = (tab: TabMeta) => {
    if (!tab.clubScoped) {
      setActiveTab(tab.id);
      // Ensure shared data is loaded via any club membership
      if (clubs.length && !data) {
        void loadClub(selectedClubId || clubs[0].id);
      }
      return;
    }

    if (clubs.length === 0) {
      setError(st('You are not a member of any club or team yet. Join one to open this section.'));
      return;
    }

    if (clubs.length === 1) {
      setActiveTab(tab.id);
      void loadClub(clubs[0].id);
      return;
    }

    // Multiple clubs → ask which club DB to open (requirement)
    setPendingClubTab(tab.id);
    setPickerOpen(true);
  };

  const confirmClub = (clubId: string) => {
    const tab = pendingClubTab;
    setPickerOpen(false);
    setPendingClubTab(null);
    if (!tab) return;
    setActiveTab(tab);
    void loadClub(clubId);
  };

  const selectedClubName =
    clubs.find((c) => c.id === selectedClubId)?.name || data?.clubName || '';

  const mode: 'view' | 'edit' = activeMeta?.clubScoped ? 'view' : 'edit';

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">{st('Member info')}</h2>
      <p className="mb-4 text-sm text-gray-600">
        {st(
          'Grey labels are shared across all your clubs and teams (you edit them). Blue labels load data from the club or team you select and are managed by its admin — they may enable or hide each label for you.',
        )}
      </p>

      {clubs.length === 0 ? (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {st(
            'You are not a member of any club or team yet. Shared profile labels still work; blue labels need a club or team membership.',
          )}
        </p>
      ) : null}

      <div className="min-w-0 overflow-visible rounded-lg border border-gray-300 bg-white">
        <nav
          className="border-b border-gray-300 pl-1 pr-2 pt-1"
          aria-label="Member profile sections"
        >
          <ScrollArrowsRow activeKey={activeTab}>
            <div className="flex flex-nowrap items-stretch gap-px">
              <div className="flex flex-auto flex-col">
                <p
                  title={st('Managed by the member (*Member profile can be shared)')}
                  className="mb-1 w-0 min-w-full truncate px-1 text-[11px] font-semibold text-gray-700 sm:text-xs"
                >
                  {st('Managed by the member (*Member profile can be shared)')}
                </p>
                <div className="flex flex-1 flex-nowrap gap-px">
                  {tabs.shared.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={st(tab.label)}
                        data-scroll-active={active}
                        onClick={() => openTab(tab)}
                        className={`flex-auto rounded-t px-1.5 py-1.5 text-center text-xs font-medium leading-tight ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {st(tab.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-auto flex-col">
                <p
                  title={st('Managed by the Club/Team Admin')}
                  className="mb-1 w-0 min-w-full truncate px-1 text-[11px] font-semibold text-red-700 sm:text-xs"
                >
                  {st('Managed by the Club/Team Admin')}
                </p>
                <div className="flex flex-1 flex-nowrap gap-px">
                  {tabs.club.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        title={st(tab.label)}
                        data-scroll-active={active}
                        onClick={() => openTab(tab)}
                        className={`flex-auto rounded-t px-1.5 py-1.5 text-center text-xs font-medium leading-tight ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-sky-100 text-sky-900 hover:bg-sky-200'
                        }`}
                      >
                        {st(tab.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArrowsRow>
        </nav>

        <div className="p-4 md:p-5">
          <div
            className={`mb-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-semibold text-white ${
              activeMeta?.id === 'pay-for' ? 'text-lg' : 'text-sm'
            } ${activeMeta?.clubScoped ? 'bg-sky-700' : 'bg-[#2f6fb5]'}`}
          >
            <span>
              {activeMeta?.label ? st(activeMeta.label) : null}
              {activeMeta?.clubScoped ? (
                selectedClubName ? (
                  <>
                    {' · '}
                    <span className={activeMeta?.id === 'pay-for' ? 'text-xl' : 'text-base'}>
                      {selectedClubName}
                    </span>
                  </>
                ) : (
                  ` · ${st('select a club')}`
                )
              ) : (
                ` · ${st('shared profile')}`
              )}
            </span>
            {activeMeta?.clubScoped && clubs.length > 1 ? (
              <button
                type="button"
                className="rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
                onClick={() => {
                  setPendingClubTab(activeTab);
                  setPickerOpen(true);
                }}
              >
                {st('Change club')}
              </button>
            ) : null}
          </div>

          {activeMeta && TAB_FUNCTION_HELP[activeMeta.id] && !loading && !clubTabBlocked ? (
            <p className="mb-3 rounded border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              <span className="font-semibold">{st('What you can do here:')} </span>
              {st(TAB_FUNCTION_HELP[activeMeta.id]!)}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              {st('Loading profile…')}
            </div>
          ) : error ? (
            <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : clubTabBlocked ? (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              {(() => {
                const blocked = clubTabBlockedContent(activeMeta, data!, selectedClubName, st);
                return (
                  <>
                    <p>
                      <span className="font-semibold">{st('What this section is for:')} </span>
                      {blocked.whatItDoes}
                    </p>
                    <p>
                      <span className="font-semibold">{st('Why it is not available:')} </span>
                      {blocked.whyBlocked}
                    </p>
                  </>
                );
              })()}
            </div>
          ) : data ? (
            <ClubMemberProfileEditor
              data={data}
              activeTab={activeTab}
              mode={mode}
              profileSource={profileSource}
              onChange={setData}
              onReload={() =>
                void (profileSource === 'self'
                  ? loadSelf()
                  : loadClub(selectedClubId || clubs[0]?.id || ''))
              }
            />
          ) : clubs.length === 0 ? (
            <p className="text-sm text-gray-600">
              {st('Join a club (Become member) to load Owner profile and club sections.')}
            </p>
          ) : (
            <p className="text-sm text-gray-600">{st('Select a tab to load your profile.')}</p>
          )}
        </div>
      </div>

      {pickerOpen && typeof document !== 'undefined'
        ? createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                <div
                  ref={pickerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="club-picker-title"
                  className="relative z-[10000] w-full max-w-md rounded-lg bg-white shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h3 id="club-picker-title" className="text-base font-bold text-gray-900">
                      {st('Select which club or team')}
                    </h3>
                    <button
                      type="button"
                      aria-label="Close"
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      onClick={() => {
                        setPickerOpen(false);
                        setPendingClubTab(null);
                      }}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <p className="mb-3 text-sm text-gray-600">
                      {st(
                        'This section is stored in the club database. Choose which club you want to open (same clubs as under My clubs).',
                      )}
                    </p>
                    <ul className="space-y-2">
                      {clubs.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => confirmClub(c.id)}
                            className={`flex w-full items-center gap-2 rounded border px-3 py-2.5 text-left text-sm font-medium hover:border-sky-500 hover:bg-sky-50 ${
                              c.id === selectedClubId
                                ? 'border-sky-600 bg-sky-50 text-sky-900'
                                : 'border-gray-300 text-gray-800'
                            }`}
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                            {c.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function MemberSelfProfilePanel(props: Props) {
  return (
    <AutoTranslate>
      <MemberSelfProfilePanelView {...props} />
    </AutoTranslate>
  );
}
