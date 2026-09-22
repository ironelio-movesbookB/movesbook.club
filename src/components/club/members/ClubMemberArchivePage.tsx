'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Calendar,
  Filter,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import { fetchClubArchive, type ArchiveFetchParams } from '@/lib/club/archives/clubArchiveClient';
import { clubApiFetch, getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import {
  memberArchiveStatusDotClass,
  memberArchiveStatusLabel,
  memberArchiveStatusTextClass,
  normalizeMemberArchiveStatus,
  type MemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import type { Column, Member } from '@/types/clubTable';

type ViewMode = 'all' | 'groups' | 'favourites' | 'group-members';

type MemberGroupSummary = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

type Props = {
  columns: Column[];
  pageSize?: number;
  footerHint?: string;
  refreshKey?: number;
  addMemberAction?: ReactNode;
  /**
   * Filter list by archive status.
   * `all` = All the users profiles (A+B+C, excludes archived).
   * `member` / `pending` / `not_member` / `archived` = dedicated sections.
   */
  membershipStatusFilter?: MemberArchiveStatus | 'all';
  /** Called after a successful status change so parent can refresh. */
  onMembershipStatusChanged?: () => void;
};

function memberTypeBadge(value: unknown) {
  const label = String(value ?? 'Standard').trim() || 'Standard';
  const lower = label.toLowerCase();
  const className =
    lower.includes('premium') || lower.includes('gold')
      ? 'bg-violet-100 text-violet-800'
      : lower.includes('vip')
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function formatGroupDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const filterLabelClass = 'mb-1 block text-sm font-medium text-gray-700';
/** Shared control height — also kills global `form select { margin-bottom: 10px }`. */
const filterSelectClass =
  '!mb-0 box-border h-[38px] min-h-[38px] max-h-[38px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm leading-[38px] text-gray-900 outline-none focus:border-gray-400';
const filterCalendarShellClass =
  'box-border flex h-[38px] min-h-[38px] max-h-[38px] w-full items-center gap-2 overflow-hidden rounded-lg border border-gray-300 bg-white px-3';
const filterActionClass =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50';
/** Hide the native date glyph so only the Lucide calendar icon shows (reference chrome). */
const filterDateInputClass =
  'h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-none text-gray-900 outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:m-0';

export default function ClubMemberArchivePage({
  columns,
  pageSize = 25,
  footerHint,
  refreshKey = 0,
  addMemberAction,
  membershipStatusFilter = 'all',
  onMembershipStatusChanged,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [groups, setGroups] = useState<MemberGroupSummary[]>([]);
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [orderBy, setOrderBy] = useState<'recent' | 'old'>('recent');
  const [sportFilter, setSportFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState<ArchiveFetchParams>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false);
  const [showGroupNameModal, setShowGroupNameModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{
    member: Member;
    next: MemberArchiveStatus;
    title: string;
    message: string;
  } | null>(null);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setError('');
    try {
      const res = await clubApiFetch<{ groups: MemberGroupSummary[] }>('/api/club/member-groups');
      setGroups(res.groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let res: { items: Member[]; total: number };

      if (viewMode === 'favourites') {
        const url = withSelectedClubId(
          `/api/club/member-favourites?page=${page}&pageSize=${pageSize}` +
            (appliedFilters.search ? `&search=${encodeURIComponent(appliedFilters.search)}` : '') +
            (appliedFilters.fromDate ? `&fromDate=${appliedFilters.fromDate}` : '') +
            (appliedFilters.toDate ? `&toDate=${appliedFilters.toDate}` : '') +
            (appliedFilters.orderBy ? `&orderBy=${appliedFilters.orderBy}` : '') +
            (appliedFilters.sport ? `&sport=${encodeURIComponent(appliedFilters.sport)}` : '') +
            (appliedFilters.groupTrained
              ? `&groupTrained=${encodeURIComponent(appliedFilters.groupTrained)}`
              : '')
        );
        const fetchRes = await fetch(url, { headers: getAuthHeaders() });
        const payload = await fetchRes.json().catch(() => ({}));
        if (!fetchRes.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load favourites');
        }
        res = { items: payload.items as Member[], total: payload.total as number };
      } else if (viewMode === 'group-members' && selectedGroupId) {
        const url = withSelectedClubId(
          `/api/club/member-groups/${encodeURIComponent(selectedGroupId)}?page=${page}&pageSize=${pageSize}` +
            (appliedFilters.search ? `&search=${encodeURIComponent(appliedFilters.search)}` : '') +
            (appliedFilters.fromDate ? `&fromDate=${appliedFilters.fromDate}` : '') +
            (appliedFilters.toDate ? `&toDate=${appliedFilters.toDate}` : '') +
            (appliedFilters.orderBy ? `&orderBy=${appliedFilters.orderBy}` : '') +
            (appliedFilters.sport ? `&sport=${encodeURIComponent(appliedFilters.sport)}` : '') +
            (appliedFilters.groupTrained
              ? `&groupTrained=${encodeURIComponent(appliedFilters.groupTrained)}`
              : '')
        );
        const fetchRes = await fetch(url, { headers: getAuthHeaders() });
        const payload = await fetchRes.json().catch(() => ({}));
        if (!fetchRes.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load group members');
        }
        if (payload.group?.name) setSelectedGroupName(payload.group.name);
        res = { items: payload.items as Member[], total: payload.total as number };
      } else {
        const archiveRes = await fetchClubArchive('members', {
          page,
          pageSize,
          ...appliedFilters,
          membershipStatus: membershipStatusFilter,
        });
        res = { items: archiveRes.items as Member[], total: archiveRes.total };
      }

      setTotal(res.total);
      setData(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    void refreshKey; // parent bump forces reload
  }, [
    appliedFilters,
    membershipStatusFilter,
    page,
    pageSize,
    selectedGroupId,
    viewMode,
    refreshKey,
  ]);

  useEffect(() => {
    if (viewMode === 'groups') {
      loadGroups();
    } else {
      loadMembers();
    }
  }, [viewMode, loadGroups, loadMembers]);

  useEffect(() => {
    setSelectedIds(new Set());
    setViewSelectedOnly(false);
    setPage(1);
  }, [viewMode, selectedGroupId, membershipStatusFilter]);

  const changeMembershipStatus = useCallback(
    async (row: Member, next: MemberArchiveStatus) => {
      const memberId = String(row.memberId || row.id || '').trim();
      if (!memberId || row.isStaffOnly) return;
      setSaving(true);
      setError('');
      try {
        const res = await fetch(withSelectedClubId('/api/club/members/membership-status'), {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, membershipStatus: next }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof payload.error === 'string' ? payload.error : 'Failed to update status',
          );
        }
        setActionMessage(`Updated to ${memberArchiveStatusLabel(next)}.`);
        onMembershipStatusChanged?.();
        await loadMembers();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
      } finally {
        setSaving(false);
      }
    },
    [loadMembers, onMembershipStatusChanged],
  );

  const handleStatusDotClick = useCallback(
    (row: Member) => {
      if (row.isStaffOnly || saving) return;
      const status = normalizeMemberArchiveStatus(row.membershipStatus);

      if (status === 'member') {
        setStatusConfirm({
          member: row,
          next: 'archived',
          title: 'Members Archived',
          message:
            'Move this user to the list of Members Archived?',
        });
        return;
      }

      if (status === 'pending') {
        setStatusConfirm({
          member: row,
          next: 'member',
          title: 'Athlete\\Member',
          message: 'Put this user as official Athlete\\Member?',
        });
        return;
      }

      if (status === 'archived') {
        setStatusConfirm({
          member: row,
          next: 'member',
          title: 'Restore member',
          message: 'Put this user back as official Athlete\\Member?',
        });
        return;
      }

      // not_member — ask official or pending
      const choice = window.prompt(
        'Choose status for this athlete:\n1 = Official Athlete\\Member\n2 = Member in pending\n\nEnter 1 or 2:',
        '1',
      );
      if (choice === '1') void changeMembershipStatus(row, 'member');
      else if (choice === '2') void changeMembershipStatus(row, 'pending');
    },
    [changeMembershipStatus, saving],
  );

  const tableColumns = useMemo(() => {
    const base = columns.filter((col) => col.key !== 'checked');
    return base.map((col) => {
      if (col.key !== 'image') return col;
      const originalRender = col.render;
      return {
        ...col,
        render: (value: unknown, row: Member) => {
          const status = normalizeMemberArchiveStatus(row.membershipStatus);
          const clickable = !row.isStaffOnly;
          const imageNode = originalRender ? (
            originalRender(value, row)
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(value)}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
              —
            </span>
          );
          const title =
            status === 'member'
              ? 'Move to Members Archived'
              : status === 'archived'
                ? 'Restore as Athlete\\Member'
                : memberArchiveStatusLabel(status);
          return (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                title={title}
                disabled={!clickable || saving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusDotClick(row);
                }}
                className={`h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 ${memberArchiveStatusDotClass(
                  status,
                )} ${clickable ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
                aria-label={title}
              />
              {imageNode}
            </div>
          );
        },
      };
    });
  }, [columns, handleStatusDotClick, saving]);

  const displayedRows = useMemo(() => {
    if (!viewSelectedOnly) return data;
    return data.filter((row) => row.id && selectedIds.has(row.id));
  }, [data, selectedIds, viewSelectedOnly]);

  function applyFilterForm(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({
      search: search.trim() || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      orderBy,
      sport: sportFilter !== 'all' ? sportFilter : undefined,
      groupTrained: groupFilter !== 'all' ? groupFilter : undefined,
    });
  }

  function clearFilters() {
    setSearch('');
    setFromDate('');
    setToDate('');
    setOrderBy('recent');
    setSportFilter('all');
    setGroupFilter('all');
    setPage(1);
    setAppliedFilters({});
    setViewSelectedOnly(false);
  }

  function toggleSelect(row: Member) {
    if (!row.id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id!)) next.delete(row.id!);
      else next.add(row.id!);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    const ids = displayedRows.map((r) => r.id).filter(Boolean) as string[];
    setSelectedIds(new Set(ids));
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    setSelectedGroupId(null);
    setSelectedGroupName('');
    setActionMessage('');
  }

  function openGroupMembers(group: MemberGroupSummary) {
    setSelectedGroupId(group.id);
    setSelectedGroupName(group.name);
    setViewMode('group-members');
    setPage(1);
    setAppliedFilters({});
  }

  async function handleDeleteGroup(groupId: string) {
    if (!window.confirm('Delete this group? Members are not removed from the club.')) return;
    setError('');
    try {
      const url = withSelectedClubId(`/api/club/member-groups/${encodeURIComponent(groupId)}`);
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to delete group');
      }
      setActionMessage('Group deleted.');
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete group');
    }
  }

  async function handleSaveAsGroup() {
    if (selectedIds.size === 0) {
      setError('Select at least one member.');
      return;
    }
    setGroupNameInput('');
    setShowGroupNameModal(true);
  }

  async function confirmSaveAsGroup() {
    const name = groupNameInput.trim();
    if (!name) {
      setError('Enter a group name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await clubApiFetch('/api/club/member-groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          memberIds: Array.from(selectedIds),
        }),
      });
      setShowGroupNameModal(false);
      setGroupNameInput('');
      setActionMessage(`Group "${name}" saved.`);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsFavourites() {
    if (selectedIds.size === 0) {
      setError('Select at least one member.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await clubApiFetch<{ added: number }>('/api/club/member-favourites', {
        method: 'POST',
        body: JSON.stringify({ memberIds: Array.from(selectedIds) }),
      });
      setActionMessage(
        res.added === 1 ? '1 member saved as favourite.' : `${res.added} members saved as favourites.`
      );
      setSelectedIds(new Set());
      if (viewMode === 'favourites') loadMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save favourites');
    } finally {
      setSaving(false);
    }
  }

  const title =
    viewMode === 'groups'
      ? 'Archive — Users — Groups'
      : viewMode === 'favourites'
        ? 'Archive — Users — Favourites'
        : viewMode === 'group-members' && selectedGroupName
          ? `Archive — Users — ${selectedGroupName}`
          : 'Archive — Users';

  const showMemberFilters = viewMode === 'all' || viewMode === 'favourites' || viewMode === 'group-members';
  const showBulkActions = viewMode === 'all';

  return (
    <>
      <ProcedureArchiveShell
        title={title}
        activeTab=""
        tabs={[]}
        headerAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => switchView(viewMode === 'groups' ? 'all' : 'groups')}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${
                viewMode === 'groups' || viewMode === 'group-members'
                  ? 'bg-white text-teal-800'
                  : 'bg-teal-700 text-white hover:bg-teal-600'
              }`}
            >
              Groups
            </button>
            <button
              type="button"
              onClick={() => switchView(viewMode === 'favourites' ? 'all' : 'favourites')}
              className={`inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm font-semibold ${
                viewMode === 'favourites'
                  ? 'bg-white text-teal-800'
                  : 'bg-teal-700 text-white hover:bg-teal-600'
              }`}
            >
              <Star className="h-4 w-4" />
              Favourites
            </button>
            {addMemberAction}
          </div>
        }
        error={error || undefined}
        footerHint={footerHint}
        pagination={undefined}
      >
        {actionMessage ? (
          <p className="mb-2 text-sm text-teal-700">{actionMessage}</p>
        ) : null}

        {viewMode === 'group-members' ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => switchView('groups')}
              className="text-sm text-teal-700 hover:text-teal-900 underline"
            >
              ← Back to groups
            </button>
          </div>
        ) : viewMode === 'groups' || viewMode === 'favourites' ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => switchView('all')}
              className="text-sm text-teal-700 hover:text-teal-900 underline"
            >
              ← Back to Archive-Members
            </button>
          </div>
        ) : null}

        {showMemberFilters && (
          <form onSubmit={applyFilterForm} className="member-archive-filters no-print mb-4 space-y-3">
            <div className="w-full overflow-x-auto">
              <div className="grid min-w-[56rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.7fr)] items-end gap-3">
              <label className="block min-w-0 text-sm">
                <span className={filterLabelClass}>Order</span>
                <select
                  className={filterSelectClass}
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value as 'recent' | 'old')}
                >
                  <option value="recent">Most recent</option>
                  <option value="old">Oldest first</option>
                </select>
              </label>
              <label className="block min-w-0 text-sm">
                <span className={filterLabelClass}>Sport</span>
                <select
                  className={filterSelectClass}
                  value={sportFilter}
                  onChange={(e) => setSportFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {Array.from(
                    new Set(
                      data
                        .map((row) => String(row.sport ?? '').trim())
                        .filter((v) => v && v !== '-'),
                    ),
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((sport) => (
                      <option key={sport} value={sport}>
                        {sport}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block min-w-0 text-sm">
                <span className={filterLabelClass}>Group of training</span>
                <select
                  className={filterSelectClass}
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {Array.from(
                    new Set(
                      data
                        .map((row) => String(row.groupTrained ?? '').trim())
                        .filter((v) => v && v !== '-'),
                    ),
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                </select>
              </label>
              <div className="block min-w-0 text-sm">
                <span className={filterLabelClass}>Calendar</span>
                <div className={filterCalendarShellClass}>
                  <label className="relative flex h-full min-w-0 flex-1 items-center gap-1.5">
                    <span className="sr-only">From</span>
                    <input
                      type="date"
                      className={filterDateInputClass}
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                    <Calendar size={16} className="pointer-events-none shrink-0 text-gray-500" />
                  </label>
                  <ArrowRight size={16} className="shrink-0 text-gray-400" aria-hidden />
                  <label className="relative flex h-full min-w-0 flex-1 items-center gap-1.5">
                    <span className="sr-only">To</span>
                    <input
                      type="date"
                      className={filterDateInputClass}
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                    <Calendar size={16} className="pointer-events-none shrink-0 text-gray-500" />
                  </label>
                </div>
              </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="relative min-w-[16rem] flex-1">
                <span className="sr-only">Search</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search...."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={filterActionClass}>
                  <Filter size={16} />
                  Filter
                </button>
                <button type="button" onClick={clearFilters} className={filterActionClass}>
                  <RotateCcw size={16} />
                  Clear
                </button>
                {showBulkActions && selectedIds.size > 0 ? (
                  <label className={`${filterActionClass} cursor-pointer`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={viewSelectedOnly}
                      onChange={(e) => setViewSelectedOnly(e.target.checked)}
                    />
                    View selected
                  </label>
                ) : null}
                {showBulkActions ? (
                  <>
                    <button
                      type="button"
                      disabled={saving || selectedIds.size === 0}
                      onClick={handleSaveAsGroup}
                      className={filterActionClass}
                    >
                      <Users size={16} />
                      Save as a group
                    </button>
                    <button
                      type="button"
                      disabled={saving || selectedIds.size === 0}
                      onClick={handleSaveAsFavourites}
                      className={filterActionClass}
                    >
                      <Star size={16} />
                      Save as favourites
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </form>
        )}

        {viewMode !== 'groups' && total > 0 ? (
          <div className="no-print mb-3">
            <ProcedurePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        ) : null}

        {viewMode === 'groups' ? (
          groupsLoading ? (
            <div className="p-4 text-gray-500">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p>No groups yet. Select members and use &quot;Save as a group&quot;.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-teal-800 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Group name</th>
                    <th className="px-3 py-2 text-left">Members</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id} className="border-t bg-white hover:bg-teal-50">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openGroupMembers(group)}
                          className="font-medium text-teal-800 hover:underline"
                        >
                          {group.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{group.memberCount}</td>
                      <td className="px-3 py-2 text-gray-700">{formatGroupDate(group.createdAt)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <ProcedureArchiveTable
            columns={tableColumns}
            rows={displayedRows}
            emptyMessage={
              viewMode === 'favourites'
                ? 'No favourite members yet. Select members and use "Save as favourites".'
                : 'No records found.'
            }
            selectable={showBulkActions}
            selectableAll
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            getRowClassName={(row) =>
              memberArchiveStatusTextClass(
                normalizeMemberArchiveStatus(row.membershipStatus),
              )
            }
          />
        )}
      </ProcedureArchiveShell>

      {showGroupNameModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Save as a group</h2>
            <p className="mt-1 text-sm text-gray-600">
              {selectedIds.size} member{selectedIds.size === 1 ? '' : 's'} selected
            </p>
            <label className="mt-4 block">
              <span className="text-sm text-gray-700">Group name</span>
              <input
                type="text"
                autoFocus
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmSaveAsGroup();
                  }
                }}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Enter group name..."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGroupNameModal(false);
                  setGroupNameInput('');
                }}
                className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSaveAsGroup()}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PromocodeConfirmModal
        open={Boolean(statusConfirm)}
        title={statusConfirm?.title ?? 'Confirm'}
        message={statusConfirm?.message ?? ''}
        confirmLabel="OK"
        cancelLabel="Cancel"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setStatusConfirm(null);
        }}
        onConfirm={() => {
          if (!statusConfirm) return;
          const { member, next } = statusConfirm;
          setStatusConfirm(null);
          void changeMembershipStatus(member, next);
        }}
      />
    </>
  );
}

export { memberTypeBadge };
