'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSportText, translateSportLabel } from '@/lib/sport/sportI18n';
import {
  WORK_GROUP_CATEGORIES,
  WORK_GROUPS_CHANGED_EVENT,
  formatWorkGroupDate,
  notifyWorkGroupsChanged,
  workGroupSeasonOptions,
  type WorkGroupListItem,
  type WorkGroupMeta,
} from '@/lib/club/clubWorkGroup.constants';

const selectClass = 'h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800';

export default function ClubWorkGroupList() {
  const router = useRouter();
  const { t } = useLanguage();
  const [items, setItems] = useState<WorkGroupListItem[]>([]);
  const [workspace, setWorkspace] = useState<WorkGroupMeta['workspace'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [category, setCategory] = useState('');
  const [season, setSeason] = useState('');
  const [confirm, setConfirm] = useState<WorkGroupListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meta, list] = await Promise.all([
        clubApiFetch<WorkGroupMeta>('/api/club/work-groups/meta'),
        clubApiFetch<{ items: WorkGroupListItem[] }>('/api/club/work-groups'),
      ]);
      setWorkspace(meta.workspace);
      setItems(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChanged = () => void load();
    window.addEventListener(WORK_GROUPS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(WORK_GROUPS_CHANGED_EVENT, onChanged);
  }, [load]);

  const sports = useMemo(() => [...new Set(items.map((i) => i.sport).filter(Boolean))].sort(), [items]);
  const seasons = useMemo(() => workGroupSeasonOptions(items.map((i) => i.season)), [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q)) &&
        (!sport || i.sport === sport) &&
        (!category || i.category === category) &&
        (!season || i.season === season),
    );
  }, [category, items, search, season, sport]);

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await clubApiFetch(`/api/club/work-groups/${encodeURIComponent(confirm.id)}`, { method: 'DELETE' });
      setConfirm(null);
      notifyWorkGroupsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col gap-4 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">List of groups</h1>
          <p className="text-xs text-gray-500">
            <span>Groups of work</span> &gt; <span>List of groups</span>
            {workspace ? <span translate="no"> · {workspace.name}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/club/work-groups/new')}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <Plus className="h-4 w-4" /> Create new
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-start-3">
          <select value={season} onChange={(e) => setSeason(e.target.value)} className={selectClass}>
            <option value="">All the sport seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className={selectClass}
        />
        <select value={sport} onChange={(e) => setSport(e.target.value)} className={selectClass}>
          <option value="">Filter by sport</option>
          {sports.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
          <option value="">Filter by category</option>
          {WORK_GROUP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">N° members</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Sport</th>
              <th className="px-4 py-3 font-medium">Sport season</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Coaches</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  {items.length === 0 ? 'No groups yet. Create the first one with + Create new.' : 'No groups match the filters.'}
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr key={g.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900" translate="no">
                    {g.name}
                  </td>
                  <td className="px-4 py-3">{g.memberCount}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">{g.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    {g.sport ? <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">{g.sport}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">{g.season || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                    {g.dateFrom || g.dateTo ? `${formatWorkGroupDate(g.dateFrom) || '…'} - ${formatWorkGroupDate(g.dateTo) || '…'}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700" translate="no">
                    {g.coachNames.join(', ') || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => router.push(`/club/work-groups/${encodeURIComponent(g.id)}`)}
                      className="rounded-md border border-violet-700 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(g)}
                      className="ml-2 p-1 text-gray-500 hover:text-red-600"
                      aria-label={formatSportText(t, 'Delete {0}', g.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PromocodeConfirmModal
        open={confirm !== null}
        title={translateSportLabel(t, 'Delete group')}
        message={confirm ? formatSportText(t, 'Delete the group {0}? Its announcements history will be removed too. This cannot be undone.', confirm.name) : ''}
        confirmLabel={translateSportLabel(t, 'Delete')}
        destructive
        loading={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
