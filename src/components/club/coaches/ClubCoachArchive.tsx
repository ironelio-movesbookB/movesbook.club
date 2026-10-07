'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ClipboardList, Download, Pencil, Plus, Trash2, UserCircle2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import SocialShareModal from '@/components/news/SocialShareModal';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSportText, translateSportLabel } from '@/lib/sport/sportI18n';
import {
  CLUB_COACH_ROLES,
  CLUB_COACHES_CHANGED_EVENT,
  clubCoachesExportTable,
  coachFullName,
  coachInviteUrl,
  formatCoachDate,
  notifyClubCoachesChanged,
  type ClubCoach,
  type ClubCoachGroupOption,
  type ClubCoachStatus,
} from '@/lib/club/clubCoach.constants';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const PHOTO_PREF_KEY = 'clubCoachesShowPhoto';

type Meta = { workspace: { kind: 'club' | 'team'; id: string; name: string }; groups: ClubCoachGroupOption[] };
type Ordering = 'name-asc' | 'name-desc' | 'tax-asc' | 'newest';
type Filters = { search: string; groupId: string; role: string };

const TABS: { id: ClubCoachStatus; label: string }[] = [
  { id: 'active', label: 'Coaches' },
  { id: 'pending', label: 'Pending registrations' },
  { id: 'archived', label: 'Archived' },
];

const EMPTY_FILTERS: Filters = { search: '', groupId: '', role: '' };

export default function ClubCoachArchive({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<ClubCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ClubCoachStatus>('active');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [ordering, setOrdering] = useState<Ordering>('name-asc');
  const [showPhoto, setShowPhoto] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    title: string;
    message: string;
    confirmLabel: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [metaData, list] = await Promise.all([
        clubApiFetch<Meta>('/api/club/coaches/meta'),
        clubApiFetch<{ items: ClubCoach[] }>('/api/club/coaches'),
      ]);
      setMeta(metaData);
      setItems(Array.isArray(list.items) ? list.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load coaches');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    setShowPhoto(localStorage.getItem(PHOTO_PREF_KEY) !== '0');
    void load();
    const onChanged = () => void load();
    window.addEventListener(CLUB_COACHES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CLUB_COACHES_CHANGED_EVENT, onChanged);
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, filters, ordering, pageSize]);

  const counts = useMemo(() => {
    const c: Record<ClubCoachStatus, number> = { active: 0, pending: 0, archived: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const rows = items.filter((c) => {
      if (c.status !== tab) return false;
      if (filters.groupId && c.groupId !== filters.groupId) return false;
      if (filters.role && c.role !== filters.role) return false;
      if (!q) return true;
      return `${c.surname} ${c.firstName} ${c.firstName} ${c.surname} ${c.taxCode}`.toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      if (ordering === 'newest') return b.createdAt.localeCompare(a.createdAt);
      if (ordering === 'tax-asc') return a.taxCode.localeCompare(b.taxCode);
      const cmp = coachFullName(a).localeCompare(coachFullName(b), undefined, { sensitivity: 'base' });
      return ordering === 'name-desc' ? -cmp : cmp;
    });
    return rows;
  }, [filters, items, ordering, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const inviteUrl = meta && origin ? coachInviteUrl(origin, meta.workspace.id) : '';
  const entityLabel = meta?.workspace.kind === 'team' ? 'team' : 'club';

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(translateSportLabel(t, 'Copy the link'), inviteUrl);
    }
  };

  const togglePhoto = () => {
    setShowPhoto((prev) => {
      localStorage.setItem(PHOTO_PREF_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  const exportList = async () => {
    const XLSX = await import('xlsx');
    const table = clubCoachesExportTable(filtered, (text) => translateSportLabel(t, text));
    const sheet = XLSX.utils.aoa_to_sheet(table);
    sheet['!cols'] = table[0].map((_, col) => ({
      wch: Math.min(50, Math.max(10, ...table.map((row) => (row[col] ?? '').length + 2))),
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Coaches');
    XLSX.writeFile(book, `coaches-${(meta?.workspace.name ?? entityLabel).replace(/[^\w-]+/g, '_')}.xlsx`);
  };

  const runBulk = async (ids: string[], action: 'delete' | ClubCoachStatus) => {
    if (ids.length === 0) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'delete') {
        await clubApiFetch('/api/club/coaches', { method: 'DELETE', body: JSON.stringify({ ids }) });
      } else {
        await clubApiFetch('/api/club/coaches/status', { method: 'POST', body: JSON.stringify({ ids, status: action }) });
      }
      setSelected(new Set());
      notifyClubCoachesChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const askDelete = (ids: string[], name?: string) => {
    if (ids.length === 0) return;
    const reject = tab === 'pending';
    const count = String(ids.length);
    let message: string;
    if (reject) {
      message = name
        ? formatSportText(t, 'Reject the registration of {0}? The request will be removed.', name)
        : ids.length === 1
          ? translateSportLabel(t, 'Reject this registration? The request will be removed.')
          : formatSportText(t, 'Reject the {0} selected registrations? The requests will be removed.', count);
    } else {
      message = name
        ? formatSportText(t, 'Delete {0}? This cannot be undone.', name)
        : ids.length === 1
          ? translateSportLabel(t, 'Delete this coach? This cannot be undone.')
          : formatSportText(t, 'Delete the {0} selected coaches? This cannot be undone.', count);
    }
    setConfirmDelete({
      ids,
      title: translateSportLabel(t, reject ? 'Reject registration' : 'Delete coach'),
      message,
      confirmLabel: translateSportLabel(t, reject ? 'Reject' : 'Delete'),
    });
  };

  const confirmDeleteNow = async () => {
    if (!confirmDelete) return;
    await runBulk(confirmDelete.ids, 'delete');
    setConfirmDelete(null);
  };
  const selectedIds = [...selected];
  const colCount = 10 + (showPhoto ? 1 : 0);

  return (
    <div className={`flex w-full flex-col gap-4 ${embedded ? '' : 'min-h-full bg-gray-50 p-4'}`}>
      {embedded ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Coaches list</h1>
            <p className="text-xs text-gray-500">
              <span>Coaches</span> &gt; <span>Coaches list</span>
              {meta ? <span translate="no"> · {meta.workspace.name}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/club/coaches/new')}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
            >
              <Plus className="h-4 w-4" /> Create new
            </button>
            <button
              type="button"
              onClick={() => void exportList()}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-700 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export list
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <ClipboardList className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-gray-900">Invite coaches</h2>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {entityLabel === 'team'
            ? 'Copy, share or put on your website the link below and receive the registrations of coaches to your team.'
            : 'Copy, share or put on your website the link below and receive the registrations of coaches to your club.'}
          <br />
          {'You will find the requests in the section "Pending registrations".'}
        </p>
        <p className="mt-2 break-all text-sm text-emerald-700" translate="no">
          {inviteUrl || '…'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyInvite()}
            disabled={!inviteUrl}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {copied ? 'Link copied!' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            disabled={!inviteUrl}
            className="rounded-md border-2 border-teal-700 px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-teal-50 disabled:opacity-50"
          >
            Send the invite
          </button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-0">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`px-4 py-2.5 text-sm font-medium transition ${
                tab === entry.id ? 'bg-[#4f4f4f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {entry.label}
              {counts[entry.id] > 0 ? ` (${counts[entry.id]})` : ''}
            </button>
          ))}
        </div>

        <div className="bg-[#c4b5e0] px-4 py-2.5 text-base font-semibold text-gray-900">
          {tab === 'pending' ? 'Coach registrations waiting for approval' : tab === 'archived' ? 'Archived coaches' : 'Coach List'}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
          className="member-archive-filters flex flex-wrap items-end gap-2 border border-t-0 border-gray-200 bg-white px-3 py-3"
        >
          <label className="flex flex-col text-xs text-gray-600">
            Search
            <input
              type="text"
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="Name or tax code"
              className="mt-1 h-9 w-36 rounded border border-gray-300 bg-white px-2 text-sm text-gray-800"
            />
          </label>
          <label className="flex flex-col text-xs text-gray-600">
            Group
            <select
              value={draft.groupId}
              onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}
              className="mt-1 h-9 w-[8.5rem] rounded border border-gray-300 bg-white px-1.5 text-sm text-gray-800"
            >
              <option value="">Select a group</option>
              {(meta?.groups ?? []).map((g) => (
                <option key={g.id} value={g.id} translate="no">
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-600">
            Role
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              className="mt-1 h-9 w-[8.5rem] rounded border border-gray-300 bg-white px-1.5 text-sm text-gray-800"
            >
              <option value="">Select a role</option>
              {CLUB_COACH_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-9 rounded bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800">
            Search
          </button>
          <label className="flex flex-col text-xs text-gray-600">
            Ordering
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as Ordering)}
              className="mt-1 h-9 w-[7.5rem] rounded border border-gray-300 bg-white px-1.5 text-sm text-gray-800"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="tax-asc">Tax code A-Z</option>
              <option value="newest">Newest first</option>
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showPhoto} onChange={togglePhoto} />
            Photo
          </label>
          <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
            {tab === 'pending' ? (
              <>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={() => void runBulk(selectedIds, 'active')}
                  className="rounded bg-teal-700 h-9 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={() => askDelete(selectedIds)}
                  className="rounded bg-red-600 h-9 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={() => void runBulk(selectedIds, tab === 'archived' ? 'active' : 'archived')}
                  className="rounded border border-gray-400 bg-white h-9 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {tab === 'archived' ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={() => askDelete(selectedIds)}
                  className="rounded bg-red-600 h-9 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => router.push('/club/coaches/new')}
              className="rounded bg-teal-700 h-9 px-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Add a coach
            </button>
            {embedded ? (
              <button
                type="button"
                onClick={() => void exportList()}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1 rounded border border-violet-700 h-9 px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                title="Export list"
              >
                <Download className="h-4 w-4" /> Export
              </button>
            ) : null}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 border border-t-0 border-gray-200 bg-white px-4 py-2 text-sm">
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
            {filtered.length} {filtered.length === 1 ? 'coach' : 'coaches'}
          </span>
        </div>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto border border-t-0 border-gray-300 bg-white">
          <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
            <thead>
              <tr className="bg-[#efe7b3] text-left text-gray-900">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(e) => {
                      const next = new Set(selected);
                      pageRows.forEach((r) => (e.target.checked ? next.add(r.id) : next.delete(r.id)));
                      setSelected(next);
                    }}
                    aria-label="Select all coaches on this page"
                  />
                </th>
                {showPhoto ? <th className="px-3 py-2 font-semibold">Photo</th> : null}
                <th className="px-3 py-2 font-semibold">Full name</th>
                <th className="px-3 py-2 font-semibold">Tax code</th>
                <th className="px-3 py-2 font-semibold">Date of birth</th>
                <th className="px-3 py-2 font-semibold">Email</th>
                <th className="px-3 py-2 font-semibold">Phone</th>
                <th className="px-3 py-2 font-semibold">Membership no.</th>
                <th className="px-3 py-2 font-semibold">City</th>
                <th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount + 1} className="px-3 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount + 1} className="px-3 py-8 text-center text-gray-500">
                    {tab === 'pending'
                      ? 'No registrations waiting for approval.'
                      : tab === 'archived'
                        ? 'No archived coaches.'
                        : 'No coaches found.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const imageSrc = resolvePublicImageUrl(row.image);
                  return (
                    <tr key={row.id} className="bg-[#e8f4fc]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelected(next);
                          }}
                          aria-label={formatSportText(t, 'Select {0}', coachFullName(row))}
                        />
                      </td>
                      {showPhoto ? (
                        <td className="px-3 py-2">
                          {imageSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[9px] leading-tight text-gray-500">
                              NO IMAGE
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        <span className="inline-flex items-center gap-1.5" translate="no">
                          <UserCircle2 className="h-4 w-4 text-violet-600" />
                          {coachFullName(row)}
                        </span>
                        {row.source === 'invite' ? (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">via link</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" translate="no">{row.taxCode}</td>
                      <td className="px-3 py-2">{formatCoachDate(row.birthDate)}</td>
                      <td className="px-3 py-2" translate="no">{row.email}</td>
                      <td className="px-3 py-2" translate="no">{row.phone}</td>
                      <td className="px-3 py-2" translate="no">{row.membershipNumber}</td>
                      <td className="px-3 py-2" translate="no">
                        {row.city && row.province ? `${row.city} (${row.province})` : row.city || row.province}
                      </td>
                      <td className="px-3 py-2">{row.role}</td>
                      <td className="px-3 py-2" translate="no">{row.groupName}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {tab === 'pending' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runBulk([row.id], 'active')}
                              className="rounded p-1 text-teal-700 hover:bg-white/70"
                              aria-label={formatSportText(t, 'Approve {0}', coachFullName(row))}
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => router.push(`/club/coaches/${row.id}`)}
                            className="rounded p-1 text-gray-700 hover:bg-white/70"
                            aria-label={formatSportText(t, 'Edit {0}', coachFullName(row))}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => askDelete([row.id], coachFullName(row))}
                            className="rounded p-1 text-red-700 hover:bg-white/70"
                            aria-label={formatSportText(t, 'Delete {0}', coachFullName(row))}
                            title={tab === 'pending' ? 'Reject' : 'Delete'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SocialShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        articleUrl={inviteUrl}
        articleTitle={formatSportText(t, '{0} invites you to join as a coach on Movesbook. Register here:', meta?.workspace.name ?? '')}
        heading="Send the invite"
        showFacebook={false}
        mailSubject={formatSportText(t, 'Invitation to join {0} as a coach', meta?.workspace.name ?? '')}
      />

      <PromocodeConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.title}
        message={confirmDelete?.message ?? ''}
        confirmLabel={confirmDelete?.confirmLabel}
        destructive
        loading={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteNow()}
      />
    </div>
  );
}
