'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, UserCircle2, X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import { ENTITY_SPORT_OPTIONS } from '@/lib/sport/entitySportOptions';
import {
  WORK_GROUP_CATEGORIES,
  emptyWorkGroupInput,
  notifyWorkGroupsChanged,
  workGroupSeasonOptions,
  type WorkGroup,
  type WorkGroupInput,
  type WorkGroupMeta,
  type WorkGroupPerson,
} from '@/lib/club/clubWorkGroup.constants';
import WorkGroupTimetable from './WorkGroupTimetable';
import WorkGroupPayments from './WorkGroupPayments';
import WorkGroupAnnouncements from './WorkGroupAnnouncements';
import WorkGroupSubscriptions from './WorkGroupSubscriptions';

type Props = { mode: 'create' | 'edit'; groupId?: string };
type Tab = 'profile' | 'announcements' | 'subscriptions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Group profile' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'subscriptions', label: 'Manage subscriptions' },
];

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <h2 className="w-full shrink-0 pt-1 text-sm font-semibold text-gray-800 lg:w-56">{title}</h2>
      <div className="min-w-0 flex-1 rounded-lg bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function PersonChip({ person, onRemove }: { person: WorkGroupPerson; onRemove: () => void }) {
  const src = person.image ? resolvePublicImageUrl(person.image) : null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 py-1 pl-1 pr-2 text-sm text-violet-900 ring-1 ring-violet-100">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <UserCircle2 className="h-6 w-6 text-violet-300" />
      )}
      <span translate="no">{person.name}</span>
      {person.username ? (
        <span className="text-xs text-violet-500" translate="no">
          @{person.username}
        </span>
      ) : null}
      <button type="button" onClick={onRemove} aria-label="Remove" className="text-violet-400 hover:text-red-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function inputFromGroup(group: WorkGroup): WorkGroupInput {
  const { id: _id, coaches, members, createdAt: _c, ...rest } = group;
  return { ...rest, coachIds: coaches.map((c) => c.id), memberIds: members.map((m) => m.id) };
}

export default function ClubWorkGroupEditor({ mode, groupId }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('profile');
  const [meta, setMeta] = useState<WorkGroupMeta | null>(null);
  const [value, setValue] = useState<WorkGroupInput>(() => emptyWorkGroupInput());
  const [members, setMembers] = useState<WorkGroupPerson[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [coachToAdd, setCoachToAdd] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<WorkGroupPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    clubApiFetch<WorkGroupMeta>('/api/club/work-groups/meta')
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !groupId) return;
    setLoading(true);
    clubApiFetch<{ group: WorkGroup }>(`/api/club/work-groups/${encodeURIComponent(groupId)}`)
      .then(({ group }) => {
        setValue(inputFromGroup(group));
        setMembers(group.members);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the group'))
      .finally(() => setLoading(false));
  }, [groupId, mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      clubApiFetch<{ items: WorkGroupPerson[] }>(`/api/club/work-groups/members-lookup?q=${encodeURIComponent(q)}`)
        .then(({ items }) => seq === searchSeq.current && setMatches(items))
        .catch(() => seq === searchSeq.current && setMatches([]))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const patch = (next: Partial<WorkGroupInput>) => {
    setSaved(false);
    setValue((prev) => ({ ...prev, ...next }));
  };

  const coaches = useMemo(() => meta?.coaches ?? [], [meta]);
  const selectedCoaches = useMemo(
    () => value.coachIds.map((id) => coaches.find((c) => c.id === id)).filter((c): c is WorkGroupPerson => Boolean(c)),
    [coaches, value.coachIds],
  );
  const seasonOptions = useMemo(() => workGroupSeasonOptions([value.season]), [value.season]);
  const sportOptions = useMemo(
    () => (value.sport && !(ENTITY_SPORT_OPTIONS as readonly string[]).includes(value.sport) ? [value.sport, ...ENTITY_SPORT_OPTIONS] : ENTITY_SPORT_OPTIONS),
    [value.sport],
  );

  const addCoach = () => {
    if (!coachToAdd || value.coachIds.includes(coachToAdd)) return;
    patch({ coachIds: [...value.coachIds, coachToAdd] });
    setCoachToAdd('');
  };

  const addMember = (person: WorkGroupPerson) => {
    if (!value.memberIds.includes(person.id)) {
      patch({ memberIds: [...value.memberIds, person.id] });
      setMembers((prev) => [...prev, person]);
    }
    setQuery('');
    setMatches([]);
  };

  const removeMember = (id: string) => {
    patch({ memberIds: value.memberIds.filter((m) => m !== id) });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const save = async () => {
    if (!value.name.trim()) {
      setError('Group name is required');
      setTab('profile');
      return;
    }
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      setError('The end date must be after the start date');
      setTab('profile');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'edit' && groupId) {
        const { group } = await clubApiFetch<{ group: WorkGroup }>(`/api/club/work-groups/${encodeURIComponent(groupId)}`, {
          method: 'PATCH',
          body: JSON.stringify(value),
        });
        setValue(inputFromGroup(group));
        setMembers(group.members);
        setSaved(true);
      } else {
        const { group } = await clubApiFetch<{ group: WorkGroup }>('/api/club/work-groups', {
          method: 'POST',
          body: JSON.stringify(value),
        });
        router.replace(`/club/work-groups/${encodeURIComponent(group.id)}`);
      }
      notifyWorkGroupsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? value.name || translateSportLabel(t, 'Group') : translateSportLabel(t, 'Create group');
  const entityKind = meta?.workspace.kind ?? 'club';

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            <span translate={mode === 'edit' && value.name ? 'no' : undefined}>{title}</span>
            {value.sport ? <span className="ml-2 text-xs font-semibold text-gray-500">({value.sport})</span> : null}
          </h1>
          <p className="text-xs text-gray-500">
            <Link href="/club/work-groups" className="hover:underline">
              Groups of work
            </Link>
            {meta ? <span translate="no"> · {meta.workspace.name}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/club/work-groups"
            className="rounded-md border border-violet-700 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            ← <span>Groups list</span>
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="rounded-md bg-teal-700 px-8 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((item) => {
          const disabled = item.id !== 'profile' && mode === 'create';
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              title={disabled ? translateSportLabel(t, 'Save the group first') : undefined}
              onClick={() => setTab(item.id)}
              className={`-mb-px rounded-t-md border px-4 py-2 text-sm font-semibold ${
                tab === item.id
                  ? 'border-gray-200 border-b-white bg-white text-violet-800'
                  : 'border-transparent text-gray-600 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{translateSportLabel(t, error)}</p>
      ) : null}
      {saved ? <p className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Group saved.</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === 'announcements' && groupId ? (
        <WorkGroupAnnouncements groupId={groupId} memberCount={value.memberIds.length} />
      ) : tab === 'subscriptions' ? (
        <WorkGroupSubscriptions />
      ) : (
        <div className="space-y-4">
          <Section title="Group data">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                Group name <span>*</span>
                <input value={value.name} onChange={(e) => patch({ name: e.target.value })} className={inputClass} translate="no" />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Category
                <select value={value.category} onChange={(e) => patch({ category: e.target.value })} className={inputClass}>
                  {WORK_GROUP_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Sport
                <select value={value.sport} onChange={(e) => patch({ sport: e.target.value })} className={inputClass}>
                  <option value="">—</option>
                  {sportOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Sport season
                <select value={value.season} onChange={(e) => patch({ season: e.target.value })} className={inputClass}>
                  {seasonOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Duration from
                <input type="date" value={value.dateFrom} onChange={(e) => patch({ dateFrom: e.target.value })} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Duration to
                <input type="date" value={value.dateTo} onChange={(e) => patch({ dateTo: e.target.value })} className={inputClass} />
              </label>
            </div>
          </Section>

          <Section title="Registration form">
            <p className="text-sm text-gray-600">Decide whether to show the group and the note in the registration form.</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={value.showInRegistration}
                onChange={(e) => patch({ showInRegistration: e.target.checked })}
                className="h-4 w-4 accent-violet-700"
              />
              Show in the selection of the groups
            </label>
            <label className="mt-4 block text-xs font-semibold text-gray-600">
              Note to show after the selection
              <span className="block font-normal text-gray-500">
                Useful to show fees, training sessions or other information about the group during the registration of the members.
              </span>
              <textarea
                rows={3}
                value={value.registrationNote}
                onChange={(e) => patch({ registrationNote: e.target.value })}
                className={inputClass}
              />
            </label>
          </Section>

          <Section title="Periodic training sessions">
            <WorkGroupTimetable
              groupName={value.name}
              value={value.timetable}
              onChange={(timetable) => patch({ timetable })}
              rooms={meta?.rooms ?? []}
              onRoomAdded={(room) =>
                setMeta((m) => (m ? { ...m, rooms: [...m.rooms.filter((r) => r.id !== room.id), room].sort((a, b) => a.name.localeCompare(b.name)) } : m))
              }
            />
          </Section>

          <Section title="Coaches">
            <div className="flex flex-wrap items-center gap-2">
              <select value={coachToAdd} onChange={(e) => setCoachToAdd(e.target.value)} className="h-10 min-w-[260px] rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select a coach…</option>
                {coaches
                  .filter((c) => !value.coachIds.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id} translate="no">
                      {c.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addCoach}
                disabled={!coachToAdd}
                className="inline-flex h-10 items-center gap-1 rounded-md bg-violet-50 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add to the list
              </button>
              <Link href="/club/coaches/new" target="_blank" className="ml-auto text-right text-xs text-violet-700 hover:underline">
                Coach not in the list? Click here to create it
              </Link>
            </div>
            {coaches.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">There are no coaches yet. Create them in Coaches.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedCoaches.length === 0 ? <p className="text-sm text-gray-500">No coaches selected.</p> : null}
              {selectedCoaches.map((c) => (
                <PersonChip key={c.id} person={c} onRemove={() => patch({ coachIds: value.coachIds.filter((id) => id !== c.id) })} />
              ))}
            </div>
          </Section>

          <Section title="Athletes">
            <div className="flex flex-wrap items-start gap-2">
              <div className="relative min-w-[260px] flex-1 md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search athlete…"
                  className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm"
                />
                {query.trim().length >= 2 ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {searching && matches.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500">Searching…</p>
                    ) : matches.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500">
                        {entityKind === 'team' ? 'No members of this team match.' : 'No members of this club match.'}
                      </p>
                    ) : (
                      matches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addMember(m)}
                          disabled={value.memberIds.includes(m.id)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-violet-50 disabled:opacity-50"
                        >
                          <span className="font-medium text-gray-900" translate="no">
                            {m.name}
                          </span>
                          <span className="text-xs text-gray-500" translate="no">
                            @{m.username}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <Link
                href="/clubMembers/memberList?section=athletes&nav=archive"
                target="_blank"
                className="ml-auto text-right text-xs text-violet-700 hover:underline"
              >
                Athlete not yet a member? Click here to create it
              </Link>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {entityKind === 'team' ? 'Only members of the team can be added.' : 'Only members of the club can be added.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {members.length === 0 ? <p className="text-sm text-gray-500">No athletes in the group.</p> : null}
              {members.map((m) => (
                <PersonChip key={m.id} person={m} onRemove={() => removeMember(m.id)} />
              ))}
            </div>
          </Section>

          <Section title="Price and deadlines">
            <WorkGroupPayments
              price={value.price}
              onPriceChange={(price) => patch({ price })}
              plans={value.paymentPlans}
              onPlansChange={(paymentPlans) => patch({ paymentPlans })}
              defaultFirstDate={value.dateFrom}
            />
          </Section>
        </div>
      )}
    </div>
  );
}
