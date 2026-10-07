'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { clubApiFetch, getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import ClubCoachArchive from '@/components/club/coaches/ClubCoachArchive';
import StaffGroupRolesGrid from '@/components/club/staff/StaffGroupRolesGrid';
import { canAccessClubWorkspace, isTeamAccountUserType } from '@/utils/dashboardRouting';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSportText, translateSportLabel } from '@/lib/sport/sportI18n';
import {
  CLUB_STAFF_TABS,
  CLUB_STAFF_TYPES,
  notifyClubStaffChanged,
  staffRowTextClass,
  type ClubStaffListItem,
  type ClubStaffTabId,
} from '@/lib/club/clubStaff.constants';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function matchesTab(item: ClubStaffListItem, tab: ClubStaffTabId): boolean {
  if (tab === 'all') return true;
  if (tab === 'board-members') return item.boardMember;
  const tabMeta = CLUB_STAFF_TABS.find((entry) => entry.id === tab);
  const role = tabMeta && 'role' in tabMeta ? tabMeta.role : null;
  return Boolean(role && item.role === role);
}

export default function ClubStaffList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const preset = searchParams?.get('preset') ?? '';
  const [tab, setTab] = useState<ClubStaffTabId | 'coaches'>(() => {
    const requested = searchParams?.get('tab') ?? '';
    if (requested === 'coaches') return 'coaches';
    return CLUB_STAFF_TABS.find((entry) => entry.id === requested)?.id ?? 'all';
  });
  const [items, setItems] = useState<ClubStaffListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState('all');
  const [ordering, setOrdering] = useState<'username-asc' | 'username-desc' | 'name-asc'>('username-asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [canManageCoaches, setCanManageCoaches] = useState(false);

  useEffect(() => {
    try {
      const userType = String(JSON.parse(localStorage.getItem('user') || '{}')?.userType ?? '');
      const allowed = canAccessClubWorkspace(userType) || isTeamAccountUserType(userType);
      setCanManageCoaches(allowed);
      if (!allowed) setTab((current) => (current === 'coaches' ? 'all' : current));
    } catch {
      setCanManageCoaches(false);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await clubApiFetch<{ items: ClubStaffListItem[] }>('/api/club/staff');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load club staff');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [tab, search, staffTypeFilter, ordering, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (tab === 'coaches' || tab === 'groups-roles') return [];
    let rows = items.filter((item) => matchesTab(item, tab));
    if (staffTypeFilter !== 'all') {
      rows = rows.filter((item) => item.staffType === staffTypeFilter);
    }
    if (q) {
      rows = rows.filter((item) => {
        const hay = `${item.username} ${item.name} ${item.staffTypeLabel} ${item.role} ${item.email}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const admin = rows.filter((item) => item.isClubAdmin);
    const rest = rows.filter((item) => !item.isClubAdmin);
    rest.sort((a, b) => {
      if (ordering === 'name-asc') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      const cmp = a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
      return ordering === 'username-desc' ? -cmp : cmp;
    });
    return [...admin, ...rest];
  }, [items, ordering, search, staffTypeFilter, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectableIds = pageRows.filter((row) => !row.isClubAdmin).map((row) => row.id);
  const allPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const goAddNew = () => {
    const type = isPresetType(preset) ? preset : '';
    router.push(type ? `/club/staff/new?type=${encodeURIComponent(type)}` : '/club/staff/new');
  };

  const deleteIds = async (ids: string[]) => {
    const valid = ids.filter((id) => !id.startsWith('admin:'));
    if (valid.length === 0) return;
    const question =
      valid.length === 1
        ? translateSportLabel(t, 'Delete this club staff member?')
        : formatSportText(t, 'Delete {0} club staff members?', String(valid.length));
    if (!window.confirm(question)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(withSelectedClubId('/api/club/staff'), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids: valid }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to delete');
      setSelectedIds(new Set());
      notifyClubStaffChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col p-4">
      <div className="mb-0 flex flex-wrap gap-0">
        {CLUB_STAFF_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === entry.id
                ? 'bg-[#4f4f4f] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {entry.label}
          </button>
        ))}
        {canManageCoaches && (
        <button
          type="button"
          onClick={() => setTab('coaches')}
          className={`px-4 py-2.5 text-sm font-medium transition ${
            tab === 'coaches' ? 'bg-[#4f4f4f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Coaches
        </button>
        )}
      </div>

      {tab === 'coaches' ? (
        <div className="border border-gray-200 bg-gray-50 p-3">
          <ClubCoachArchive embedded />
        </div>
      ) : tab === 'groups-roles' ? (
        <StaffGroupRolesGrid />
      ) : (
      <>
      <div className="bg-[#c4b5e0] px-4 py-2.5 text-base font-semibold text-gray-900">
        Operator List
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-gray-200 border-t-0 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Filter
          <select
            value={staffTypeFilter}
            onChange={(e) => setStaffTypeFilter(e.target.value)}
            className="mt-1 min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
          >
            <option value="all">All types</option>
            {CLUB_STAFF_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Ordering
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as typeof ordering)}
            className="mt-1 min-w-[160px] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
          >
            <option value="username-asc">Username A-Z</option>
            <option value="username-desc">Username Z-A</option>
            <option value="name-asc">Name A-Z</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nickname, name, role"
            className="mt-1 w-56 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={busy || selectedIds.size === 0}
            onClick={() => void deleteIds([...selectedIds])}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={goAddNew}
            className="rounded bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Add new
          </button>
          {canManageCoaches && (
            <button
              type="button"
              onClick={() => router.push('/club/coaches/new')}
              className="rounded bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Add a coach
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-gray-200 border-t-0 bg-white px-4 py-2 text-sm">
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 py-1 font-medium">{currentPage}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
        <span className="text-gray-500">
          {formatSportText(t, '{0} staff', String(filtered.length))}
        </span>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto border border-gray-300 border-t-0 bg-white">
        <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
          <thead>
            <tr className="bg-[#efe7b3] text-left text-gray-900">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(e) => {
                    const next = new Set(selectedIds);
                    if (e.target.checked) selectableIds.forEach((id) => next.add(id));
                    else selectableIds.forEach((id) => next.delete(id));
                    setSelectedIds(next);
                  }}
                  aria-label="Select all staff on this page"
                />
              </th>
              <th className="px-3 py-2 font-semibold">Operator Nickname</th>
              <th className="px-3 py-2 font-semibold">Operator Name</th>
              <th className="px-3 py-2 font-semibold">Staff Type</th>
              <th className="px-3 py-2 font-semibold">Employment Area</th>
              <th className="px-3 py-2 font-semibold">Company role</th>
              <th className="px-3 py-2 font-semibold">Operative Level</th>
              <th className="px-3 py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No club staff found.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const textClass = staffRowTextClass(row);
                const imageSrc = resolvePublicImageUrl(row.image);
                return (
                  <tr
                    key={row.id}
                    className={row.isClubAdmin ? 'bg-[#efe7b3]' : 'bg-[#e8f4fc]'}
                  >
                    <td className="px-3 py-2">
                      {row.isClubAdmin ? null : (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelectedIds(next);
                          }}
                          aria-label={formatSportText(t, 'Select {0}', row.username)}
                        />
                      )}
                    </td>
                    <td className={`px-3 py-2 ${textClass}`} translate="no">{row.username}</td>
                    <td className={`px-3 py-2 ${textClass}`}>
                      <div className="flex items-center gap-2">
                        {imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageSrc}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[9px] leading-tight text-gray-500">
                            NO IMAGE
                          </span>
                        )}
                        <span translate="no">{row.name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 ${textClass}`}>{row.staffTypeLabel}</td>
                    <td className={`px-3 py-2 ${textClass}`}>{row.role}</td>
                    <td className={`px-3 py-2 ${textClass}`}>
                      {row.companyRole}
                      {row.boardMember ? <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">Board</span> : null}
                      {row.volunteer ? <span className="ml-1 rounded bg-green-100 px-1.5 text-xs text-green-800">Volunteer</span> : null}
                    </td>
                    <td className={`px-3 py-2 ${textClass}`}>{row.operativeLevel}</td>
                    <td className="px-3 py-2">
                      {row.isClubAdmin ? null : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/club/staff/${row.id}`)}
                            className="rounded p-1 text-gray-700 hover:bg-white/70"
                            aria-label={formatSportText(t, 'Edit {0}', row.username)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteIds([row.id])}
                            className="rounded p-1 text-red-700 hover:bg-white/70"
                            aria-label={formatSportText(t, 'Delete {0}', row.username)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

function isPresetType(value: string): value is 'coadmin' | 'operator' | 'collaborator' {
  return value === 'coadmin' || value === 'operator' || value === 'collaborator';
}
