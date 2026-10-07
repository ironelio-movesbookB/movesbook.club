'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  CLUB_COACH_ROLES,
  EMPTY_CLUB_COACH_INPUT,
  notifyClubCoachesChanged,
  type ClubCoach,
  type ClubCoachGroupOption,
  type ClubCoachInput,
  type ClubCoachProfileMatch,
} from '@/lib/club/clubCoach.constants';
import CoachFields, { validateCoachInput } from './CoachFields';

type Props = { mode: 'create' | 'edit'; coachId?: string };

type Meta = { workspace: { kind: 'club' | 'team'; name: string }; groups: ClubCoachGroupOption[] };

function inputFromCoach(coach: ClubCoach): ClubCoachInput {
  const { id: _id, status: _s, source: _src, userId: _u, groupName: _g, image: _i, createdAt: _c, ...input } = coach;
  return input;
}

export default function ClubCoachForm({ mode, coachId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<ClubCoachInput>(EMPTY_CLUB_COACH_INPUT);
  const [linked, setLinked] = useState<{ userId: string; label: string } | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ClubCoachProfileMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    clubApiFetch<Meta>('/api/club/coaches/meta')
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !coachId) return;
    setLoading(true);
    clubApiFetch<{ coach: ClubCoach }>(`/api/club/coaches/${encodeURIComponent(coachId)}`)
      .then(({ coach }) => {
        setValue(inputFromCoach(coach));
        setLinked(coach.userId ? { userId: coach.userId, label: '' } : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load coach'))
      .finally(() => setLoading(false));
  }, [coachId, mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      clubApiFetch<{ items: ClubCoachProfileMatch[] }>(`/api/club/coaches/lookup?q=${encodeURIComponent(q)}`)
        .then(({ items }) => {
          if (seq === searchSeq.current) setMatches(items);
        })
        .catch(() => {
          if (seq === searchSeq.current) setMatches([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const patch = (next: Partial<ClubCoachInput>) => setValue((prev) => ({ ...prev, ...next }));

  const applyMatch = (match: ClubCoachProfileMatch) => {
    patch({
      surname: match.surname || value.surname,
      firstName: match.firstName || value.firstName,
      email: match.email || value.email,
      birthDate: match.birthDate || value.birthDate,
      birthCountry: match.country || value.birthCountry,
    });
    setLinked({ userId: match.userId, label: `@${match.username}` });
    setQuery('');
    setMatches([]);
  };

  const save = async () => {
    const invalid = validateCoachInput(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'edit' && coachId) {
        await clubApiFetch(`/api/club/coaches/${encodeURIComponent(coachId)}`, {
          method: 'PATCH',
          body: JSON.stringify(value),
        });
      } else {
        await clubApiFetch('/api/club/coaches', {
          method: 'POST',
          body: JSON.stringify({ ...value, userId: linked?.userId ?? null }),
        });
      }
      notifyClubCoachesChanged();
      router.push('/club/coaches');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const entityLabel = meta?.workspace.kind === 'team' ? 'team' : 'club';

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{mode === 'edit' ? 'Edit coach' : 'Create coach'}</h1>
          <p className="text-xs text-gray-500">
            <Link href="/club/coaches" className="hover:underline">
              Coaches
            </Link>{' '}
            &gt; {meta ? <span translate="no">{meta.workspace.name}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="rounded-md bg-teal-700 px-8 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <h2 className="w-full shrink-0 text-sm font-semibold text-gray-800 lg:w-56">Personal data</h2>
        <div className="flex-1 space-y-6 rounded-lg bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {mode === 'create' ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Do you want to duplicate an existing profile?</h3>
                  <div className="relative mt-2 max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search member…"
                      className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-teal-600 focus:outline-none"
                    />
                    {query.trim().length >= 2 ? (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                        {searching && matches.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-500">Searching…</p>
                        ) : matches.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-500">
                            {entityLabel === 'team'
                              ? 'No members or staff of this team match.'
                              : 'No members or staff of this club match.'}
                          </p>
                        ) : (
                          matches.map((m) => (
                            <button
                              key={m.userId}
                              type="button"
                              onClick={() => applyMatch(m)}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                            >
                              <span className="font-medium text-gray-900" translate="no">
                                {[m.surname, m.firstName].filter(Boolean).join(' ') || m.username}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                <span translate="no">@{m.username}</span> · <span>{m.relation}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  {linked ? (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
                      <span>Linked to</span> <span translate="no">{linked.label}</span>
                      <button type="button" onClick={() => setLinked(null)} aria-label="Remove link" className="hover:text-teal-950">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  ) : null}
                  <h3 className="mt-5 text-sm font-bold text-slate-800">or enter the data manually</h3>
                </div>
              ) : linked ? (
                <p className="text-xs text-teal-800">This coach is linked to a Movesbook account.</p>
              ) : null}

              <CoachFields value={value} onChange={patch} />

              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {entityLabel === 'team' ? 'Role in the team' : 'Role in the club'}
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Role
                    <select
                      value={value.role}
                      onChange={(e) => patch({ role: e.target.value })}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">—</option>
                      {CLUB_COACH_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Group
                    <select
                      value={value.groupId}
                      onChange={(e) => patch({ groupId: e.target.value })}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">—</option>
                      {(meta?.groups ?? []).map((g) => (
                        <option key={g.id} value={g.id} translate="no">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
