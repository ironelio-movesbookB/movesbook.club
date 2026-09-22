'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import { fetchClubArchive, type ArchiveType } from '@/lib/club/archives/clubArchiveClient';
import type { Column, Member } from '@/types/clubTable';

type Props = {
  title: string;
  archiveType: ArchiveType;
  columns: Column[];
  pageSize?: number;
  direction?: 'all' | 'IN' | 'OUT';
  footerHint?: string;
  emptyMessage?: string;
  showFilters?: boolean;
  /** Show row checkboxes (without requiring delete handlers). */
  selectable?: boolean;
  /** Prefer this club when the admin owns more than one. */
  clubId?: string | null;
  /** Prefer this team when the admin is a Team Admin. */
  teamId?: string | null;
  headerAction?: ReactNode;
  /** Bump to force a reload (e.g. after adding a member). */
  refreshKey?: number;
  onEditItem?: (item: Member) => void;
  onDeleteItem?: (item: Member) => void;
};

export default function ClubArchivePage({
  title,
  archiveType,
  columns,
  pageSize: initialPageSize = 25,
  direction,
  footerHint,
  emptyMessage = 'No records found.',
  showFilters = true,
  selectable = false,
  clubId,
  teamId,
  headerAction,
  refreshKey = 0,
  onEditItem,
  onDeleteItem,
}: Props) {
  const filters = useArchiveListFilters();
  const [data, setData] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchClubArchive(archiveType, {
        page,
        pageSize,
        direction: archiveType === 'cash-movements' ? direction : undefined,
        clubId: clubId || undefined,
        teamId: teamId || undefined,
        ...filters.applied,
      });
      setTotal(res.total);
      const items = res.items as Member[];
      if (onEditItem || onDeleteItem) {
        setData(
          items.map((item) => ({
            ...item,
            edit: onEditItem ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditItem(item);
                }}
                className="text-blue-600 hover:text-blue-800"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : undefined,
            delete: onDeleteItem ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item);
                }}
                className="text-red-500 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : undefined,
          }))
        );
      } else {
        setData(items);
      }
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
    void refreshKey; // parent bump forces reload
  }, [
    archiveType,
    filters.applied,
    direction,
    page,
    pageSize,
    clubId,
    teamId,
    onEditItem,
    onDeleteItem,
    refreshKey,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied]);

  function handleDeleteSelected() {
    if (!onDeleteItem) return;
    const items = data.filter((r) => r.id && selectedIds.has(r.id));
    if (items.length === 0) return;
    if (!window.confirm(`Delete ${items.length} selected record(s)?`)) return;
    for (const item of items) {
      onDeleteItem(item);
    }
    setSelectedIds(new Set());
  }

  const pagination = (
    <ProcedurePagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
      onPageSizeChange={(n) => {
        setPageSize(n);
        setPage(1);
      }}
    />
  );

  return (
    <ProcedureArchiveShell
      title={title}
      activeTab=""
      tabs={[]}
      headerAction={headerAction}
      error={error || undefined}
      footerHint={footerHint}
    >
      <ArchiveListToolbar
        title={`Filter · ${title}`}
        values={filters.draft}
        onChange={filters.onChange}
        onApply={() => {
          if (filters.apply()) setPage(1);
        }}
        onClear={() => {
          filters.clear();
          setPage(1);
        }}
        dateRangeError={filters.dateRangeError}
        hideFilters={!showFilters}
        pagination={pagination}
        selectedCount={onDeleteItem ? selectedIds.size : undefined}
        onDeleteSelected={onDeleteItem ? handleDeleteSelected : undefined}
      />
      <ProcedureArchiveTable
        columns={columns}
        rows={data}
        loading={loading}
        emptyMessage={emptyMessage}
        selectable={selectable || !!onDeleteItem}
        selectOnlyOpenRest={false}
        selectedIds={selectable || onDeleteItem ? selectedIds : undefined}
        onToggleSelect={
          selectable || onDeleteItem
            ? (row) => {
                if (!row.id) return;
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id!)) next.delete(row.id!);
                  else next.add(row.id!);
                  return next;
                });
              }
            : undefined
        }
        onToggleSelectAll={
          selectable || onDeleteItem
            ? (checked) => {
                if (!checked) {
                  setSelectedIds(new Set());
                  return;
                }
                setSelectedIds(new Set(data.map((r) => r.id).filter(Boolean) as string[]));
              }
            : undefined
        }
      />
    </ProcedureArchiveShell>
  );
}
