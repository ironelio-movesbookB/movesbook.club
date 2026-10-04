'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Calendar,
  FileSpreadsheet,
  Filter,
  MessageSquare,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Share2,
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
  memberArchiveStatusBorderClass,
  memberArchiveStatusDotClass,
  memberArchiveStatusDotStyle,
  memberArchiveStatusLabel,
  memberArchiveStatusTextClass,
  normalizeMemberArchiveStatus,
  type MemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import ShareModal from '@/components/ShareModal';
import type { Column, Member } from '@/types/clubTable';

export type MemberArchiveViewMode = 'all' | 'groups' | 'favourites' | 'group-members';
type ViewMode = MemberArchiveViewMode;

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
  /** Lets row actions (e.g. delete) behave per view — Favourites delete only unfavourites. */
  onViewModeChange?: (mode: MemberArchiveViewMode) => void;
  /** Coach workspace: athletes trained have no membership status, so the dots are display-only. */
  statusChangesEnabled?: boolean;
};

function memberTypeBadge(value: unknown) {
  const label = String(value ?? '').trim();
  if (!label || label === '-') return <span className="text-gray-400">-</span>;
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

const MEMBER_ACTION_LIMIT = 2000;

function currentUserEmail(): string {
  try {
    const raw = localStorage.getItem('user');
    const email = raw ? (JSON.parse(raw) as { email?: unknown }).email : '';
    return typeof email === 'string' ? email : '';
  } catch {
    return '';
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_COLUMNS: Array<{ header: string; value: (row: Member) => unknown }> = [
  { header: 'Surname', value: (r) => r.surname },
  { header: 'Name', value: (r) => r.name },
  { header: 'Gender', value: (r) => r.gender },
  { header: 'Date of Birth', value: (r) => r.dateOfBirth },
  { header: 'Type of User', value: (r) => r.operator },
  { header: 'Member Type', value: (r) => r.memberType },
  { header: 'Local City', value: (r) => r.localCity },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Insert Date', value: (r) => r.insertDateDisplay ?? r.insertDate },
  {
    header: 'Status',
    value: (r) => memberArchiveStatusLabel(normalizeMemberArchiveStatus(r.membershipStatus)),
  },
];

function writePrintableMembers(win: Window, heading: string, rows: Member[]) {
  const head = PRINT_COLUMNS.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const body = rows
    .map(
      (row, i) =>
        `<tr><td>${i + 1}</td>${PRINT_COLUMNS.map((c) => {
          const v = String(c.value(row) ?? '').trim();
          return `<td>${escapeHtml(v || '-')}</td>`;
        }).join('')}</tr>`,
    )
    .join('');
  const printedOn = new Date().toLocaleString();
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 12px; color: #555; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
  th { background: #f0f0f0; }
  tr { page-break-inside: avoid; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${escapeHtml(heading)}</h1>
<p>${rows.length} member(s) · printed ${escapeHtml(printedOn)}</p>
<table><thead><tr><th>#</th>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`);
  win.document.close();
}

export default function ClubMemberArchivePage({
  columns,
  pageSize = 25,
  footerHint,
  refreshKey = 0,
  addMemberAction,
  membershipStatusFilter = 'all',
  onMembershipStatusChanged,
  onViewModeChange,
  statusChangesEnabled = true,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);
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
  const [renameGroup, setRenameGroup] = useState<MemberGroupSummary | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<MemberGroupSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<'print' | 'message' | 'data' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ rows: Member[] } | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageInApp, setMessageInApp] = useState(true);
  const [messageByEmail, setMessageByEmail] = useState(false);
  const [dataDialog, setDataDialog] = useState<{ rows: Member[] } | null>(null);
  const [dataEmail, setDataEmail] = useState('');
  const [dataNote, setDataNote] = useState('');
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

  const fetchMemberRows = useCallback(
    async (pageArg: number, pageSizeArg: number): Promise<{ items: Member[]; total: number }> => {
      let res: { items: Member[]; total: number };

      if (viewMode === 'favourites') {
        const url = withSelectedClubId(
          `/api/club/member-favourites?page=${pageArg}&pageSize=${pageSizeArg}` +
            (appliedFilters.search ? `&search=${encodeURIComponent(appliedFilters.search)}` : '') +
            (appliedFilters.fromDate ? `&fromDate=${appliedFilters.fromDate}` : '') +
            (appliedFilters.toDate ? `&toDate=${appliedFilters.toDate}` : '') +
            (appliedFilters.orderBy ? `&orderBy=${appliedFilters.orderBy}` : '') +
            (appliedFilters.sport ? `&sport=${encodeURIComponent(appliedFilters.sport)}` : '') +
            (appliedFilters.memberGroupId
              ? `&memberGroupId=${encodeURIComponent(appliedFilters.memberGroupId)}`
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
          `/api/club/member-groups/${encodeURIComponent(selectedGroupId)}?page=${pageArg}&pageSize=${pageSizeArg}` +
            (appliedFilters.search ? `&search=${encodeURIComponent(appliedFilters.search)}` : '') +
            (appliedFilters.fromDate ? `&fromDate=${appliedFilters.fromDate}` : '') +
            (appliedFilters.toDate ? `&toDate=${appliedFilters.toDate}` : '') +
            (appliedFilters.orderBy ? `&orderBy=${appliedFilters.orderBy}` : '') +
            (appliedFilters.sport ? `&sport=${encodeURIComponent(appliedFilters.sport)}` : '') +
            (appliedFilters.memberGroupId
              ? `&memberGroupId=${encodeURIComponent(appliedFilters.memberGroupId)}`
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
          page: pageArg,
          pageSize: pageSizeArg,
          ...appliedFilters,
          membershipStatus: membershipStatusFilter,
        });
        res = { items: archiveRes.items as Member[], total: archiveRes.total };
      }
      return res;
    },
    [appliedFilters, membershipStatusFilter, selectedGroupId, viewMode],
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMemberRows(page, pageSize);
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
  }, [fetchMemberRows, page, pageSize, refreshKey]);

  useEffect(() => {
    if (viewMode === 'groups') {
      loadGroups();
    } else {
      loadMembers();
    }
  }, [viewMode, loadGroups, loadMembers]);

  // Group of training dropdown lists saved groups; load quietly so filters work before opening Groups.
  useEffect(() => {
    let cancelled = false;
    clubApiFetch<{ groups: MemberGroupSummary[] }>('/api/club/member-groups')
      .then((res) => {
        if (!cancelled) setGroups(res.groups);
      })
      .catch(() => {
        /* dropdown just stays at "All" */
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
      if (row.isStaffOnly || saving || !statusChangesEnabled) return;
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
    [changeMembershipStatus, saving, statusChangesEnabled],
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
          const clickable = !row.isStaffOnly && statusChangesEnabled;
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
          const isCoach = Boolean(row.isCoach);
          const statusTitle =
            status === 'member'
              ? 'Move to Members Archived'
              : status === 'archived'
                ? 'Restore as Athlete\\Member'
                : memberArchiveStatusLabel(status);
          const title = !statusChangesEnabled
            ? `${memberArchiveStatusLabel(status)} — status is managed by the athlete's club or team`
            : isCoach
              ? `Coach — ${statusTitle}`
              : statusTitle;
          return (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                title={title}
                disabled={row.isStaffOnly || saving}
                aria-disabled={!clickable}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusDotClick(row);
                }}
                style={memberArchiveStatusDotStyle(isCoach)}
                className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                  isCoach ? memberArchiveStatusBorderClass(status) : 'border-black/10'
                } ${memberArchiveStatusDotClass(status)} ${
                  clickable ? 'cursor-pointer' : 'cursor-default opacity-90'
                }`}
                aria-label={title}
              />
              {imageNode}
            </div>
          );
        },
      };
    });
  }, [columns, handleStatusDotClick, saving, statusChangesEnabled]);

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
      memberGroupId: groupFilter !== 'all' ? groupFilter : undefined,
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

  function openRenameGroup(group: MemberGroupSummary) {
    setRenameGroup(group);
    setRenameInput(group.name);
  }

  async function confirmRenameGroup() {
    if (!renameGroup) return;
    const name = renameInput.trim();
    if (!name) {
      setError('Enter a group name.');
      return;
    }
    if (name === renameGroup.name) {
      setRenameGroup(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = withSelectedClubId(`/api/club/member-groups/${encodeURIComponent(renameGroup.id)}`);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to rename group');
      }
      const renamedId = renameGroup.id;
      setGroups((prev) => prev.map((g) => (g.id === renamedId ? { ...g, name } : g)));
      if (selectedGroupId === renamedId) setSelectedGroupName(name);
      setRenameGroup(null);
      setActionMessage(`Group renamed to "${name}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename group');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setError('');
    try {
      const url = withSelectedClubId(`/api/club/member-groups/${encodeURIComponent(groupId)}`);
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to delete group');
      }
      setActionMessage('Group deleted.');
      if (groupFilter === groupId) {
        setGroupFilter('all');
        setAppliedFilters((prev) => ({ ...prev, memberGroupId: undefined }));
      }
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
      void loadGroups();
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

  /** Ticked members if any, otherwise every row of the current filtered list (all pages). */
  async function resolveTargetRows(): Promise<Member[]> {
    const res = await fetchMemberRows(1, MEMBER_ACTION_LIMIT);
    if (res.total > res.items.length) {
      throw new Error(
        `This list has ${res.total} members; the limit is ${MEMBER_ACTION_LIMIT}. Narrow it with the filters.`,
      );
    }
    const rows = selectedIds.size > 0
      ? res.items.filter((row) => row.id && selectedIds.has(row.id))
      : res.items;
    if (rows.length === 0) throw new Error('No members to use for this action.');
    return rows;
  }

  function targetLabel(count: number) {
    const who = count === 1 ? '1 member' : `${count} members`;
    return selectedIds.size > 0 ? `${who} (selected)` : `${who} (current list)`;
  }

  function targetIds(rows: Member[]) {
    return rows.map((row) => String(row.memberId || row.id || '')).filter(Boolean);
  }

  const actionMembershipStatus = viewMode === 'all' ? membershipStatusFilter : 'all';

  async function startMemberAction(kind: 'print' | 'message' | 'data' | 'share') {
    setError('');
    setActionMessage('');
    if (kind === 'share') {
      setShareOpen(true);
      return;
    }
    if (kind === 'print') {
      // Open synchronously so popup blockers treat it as user-initiated.
      const win = window.open('', '_blank');
      if (!win) {
        setError('Allow pop-ups for this site to print the list.');
        return;
      }
      win.document.write('<p style="font-family:sans-serif">Preparing list…</p>');
      setActionBusy('print');
      try {
        const rows = await resolveTargetRows();
        writePrintableMembers(win, title, rows);
      } catch (e) {
        win.close();
        setError(e instanceof Error ? e.message : 'Failed to prepare the list');
      } finally {
        setActionBusy(null);
      }
      return;
    }
    setActionBusy(kind);
    try {
      const rows = await resolveTargetRows();
      if (kind === 'message') {
        setMessageText('');
        setMessageInApp(true);
        setMessageByEmail(false);
        setMessageDialog({ rows });
      } else {
        setDataEmail(currentUserEmail());
        setDataNote('');
        setDataDialog({ rows });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setActionBusy(null);
    }
  }

  async function confirmSendMessage() {
    if (!messageDialog) return;
    const content = messageText.trim();
    if (!content) {
      setError('Write a message.');
      return;
    }
    if (!messageInApp && !messageByEmail) {
      setError('Choose Club Channel and/or email.');
      return;
    }
    setActionBusy('message');
    setError('');
    try {
      const res = await clubApiFetch<{
        recipients: number;
        channelUsed: boolean;
        inApp: number;
        emailed: number;
        emailFailed: number;
        noEmail: number;
      }>('/api/club/members/send-message', {
        method: 'POST',
        body: JSON.stringify({
          memberIds: targetIds(messageDialog.rows),
          membershipStatus: actionMembershipStatus,
          content,
          inApp: messageInApp,
          byEmail: messageByEmail,
        }),
      });
      const parts: string[] = [];
      if (res.channelUsed) {
        parts.push(`sent in Club Channel to ${res.inApp}`);
        const notMembers = res.recipients - res.inApp;
        if (notMembers > 0) parts.push(`${notMembers} staff-only not in Club Channel`);
      }
      if (messageByEmail) {
        parts.push(`emailed to ${res.emailed}`);
        if (res.noEmail) parts.push(`${res.noEmail} without email`);
        if (res.emailFailed) parts.push(`${res.emailFailed} email(s) failed`);
      }
      setActionMessage(`Message ${parts.join(', ')}.`);
      setMessageDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send the message');
    } finally {
      setActionBusy(null);
    }
  }

  async function confirmSendData() {
    if (!dataDialog) return;
    const email = dataEmail.trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setActionBusy('data');
    setError('');
    try {
      const res = await clubApiFetch<{ sent: number; email: string }>('/api/club/members/send-data', {
        method: 'POST',
        body: JSON.stringify({
          memberIds: targetIds(dataDialog.rows),
          membershipStatus: actionMembershipStatus,
          email,
          note: dataNote.trim(),
        }),
      });
      setActionMessage(`Data of ${res.sent} member(s) sent to ${res.email} (Excel + CSV).`);
      setDataDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send the data');
    } finally {
      setActionBusy(null);
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
  const actionHint =
    selectedIds.size > 0
      ? `Uses the ${selectedIds.size} selected member(s)`
      : 'Uses all members of the current (filtered) list';

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
                  {[...groups]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
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
                <span className="mx-1 hidden w-px self-stretch bg-gray-200 sm:block" aria-hidden />
                <button
                  type="button"
                  disabled={actionBusy !== null || total === 0}
                  onClick={() => void startMemberAction('print')}
                  className={filterActionClass}
                  title={actionHint}
                >
                  <Printer size={16} />
                  {actionBusy === 'print' ? 'Preparing…' : 'Print'}
                </button>
                <button
                  type="button"
                  disabled={actionBusy !== null || total === 0}
                  onClick={() => void startMemberAction('message')}
                  className={filterActionClass}
                  title={actionHint}
                >
                  <MessageSquare size={16} />
                  Send Msg
                </button>
                <button
                  type="button"
                  disabled={actionBusy !== null || total === 0}
                  onClick={() => void startMemberAction('data')}
                  className={filterActionClass}
                  title={actionHint}
                >
                  <FileSpreadsheet size={16} />
                  Send Data
                </button>
                <button
                  type="button"
                  onClick={() => void startMemberAction('share')}
                  className={filterActionClass}
                  title="Share the link of this list"
                >
                  <Share2 size={16} />
                  Share
                </button>
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
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-teal-800 text-white">
                  <tr>
                    <th className="w-[30%] border border-gray-300 px-3 py-2 text-left">Group name</th>
                    <th className="w-[24%] border border-gray-300 px-3 py-2 text-left">Members</th>
                    <th className="w-[26%] border border-gray-300 px-3 py-2 text-left">Created</th>
                    <th className="w-[20%] whitespace-nowrap border border-gray-300 px-3 py-2 text-left">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id} className="bg-white hover:bg-teal-50">
                      <td className="border border-gray-300 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openGroupMembers(group)}
                          className="break-words text-left font-medium text-teal-800 hover:underline"
                        >
                          {group.name}
                        </button>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-gray-700">{group.memberCount}</td>
                      <td className="border border-gray-300 px-3 py-2 text-gray-700">
                        {formatGroupDate(group.createdAt)}
                      </td>
                      <td className="whitespace-nowrap border border-gray-300 px-3 py-2">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => openRenameGroup(group)}
                            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-800"
                            title="Rename group"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                          </button>
                          <span className="h-5 w-px bg-gray-300" aria-hidden />
                          <button
                            type="button"
                            onClick={() => setDeleteGroupTarget(group)}
                            className="inline-flex items-center rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                            title="Delete group"
                            aria-label="Delete group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
            bordered
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

      {messageDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Send message</h2>
            <p className="mt-1 text-sm text-gray-600">To: {targetLabel(messageDialog.rows.length)}</p>
            <label className="mt-4 block">
              <span className="text-sm text-gray-700">Message</span>
              <textarea
                autoFocus
                rows={6}
                maxLength={5000}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Write your message..."
              />
            </label>
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={messageInApp}
                  onChange={(e) => setMessageInApp(e.target.checked)}
                />
                Send in the Club Channel (only these members will see it)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={messageByEmail}
                  onChange={(e) => setMessageByEmail(e.target.checked)}
                />
                Also send by email
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessageDialog(null);
                  setError('');
                }}
                className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy === 'message' || !messageText.trim()}
                onClick={() => void confirmSendMessage()}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {actionBusy === 'message' ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dataDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Send data</h2>
            <p className="mt-1 text-sm text-gray-600">
              {targetLabel(dataDialog.rows.length)} will be sent as an Excel (.xlsx) and CSV attachment.
            </p>
            <label className="mt-4 block">
              <span className="text-sm text-gray-700">Send to email</span>
              <input
                type="email"
                autoFocus
                value={dataEmail}
                onChange={(e) => setDataEmail(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="name@example.com"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm text-gray-700">Note (optional)</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={dataNote}
                onChange={(e) => setDataNote(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDataDialog(null);
                  setError('');
                }}
                className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy === 'data' || !dataEmail.trim()}
                onClick={() => void confirmSendData()}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {actionBusy === 'data' ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this list"
        description="The link opens this Archive of Users. Only people logged in with access to this club can see the members."
        hidePost
        showEmail
      />

      {showGroupNameModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Save as a group</h2>
            <p className="mt-1 text-sm text-gray-600">
              {selectedIds.size === 1 ? '1 member selected' : `${selectedIds.size} members selected`}
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

      {renameGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Rename group</h2>
            <label className="mt-4 block">
              <span className="text-sm text-gray-700">Group name</span>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmRenameGroup();
                  }
                }}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Enter group name..."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setRenameGroup(null)}
                className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !renameInput.trim()}
                onClick={() => void confirmRenameGroup()}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PromocodeConfirmModal
        open={Boolean(deleteGroupTarget)}
        title="Delete group"
        message={`Delete group "${deleteGroupTarget?.name ?? ''}"? Members are not removed from the club.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onClose={() => {
          if (saving) return;
          setDeleteGroupTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteGroupTarget) return;
          setSaving(true);
          try {
            await handleDeleteGroup(deleteGroupTarget.id);
          } finally {
            setSaving(false);
            setDeleteGroupTarget(null);
          }
        }}
      />

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
