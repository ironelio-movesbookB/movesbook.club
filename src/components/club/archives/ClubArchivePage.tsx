'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
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
  /** Scope to one member (Member Overview → Mngmnt). Falls back to ?memberId=. */
  memberId?: string | null;
  headerAction?: ReactNode;
  /** Bump to force a reload (e.g. after adding a member). */
  refreshKey?: number;
  getRowClassName?: (row: Member) => string;
  /** Enables the with-photo / without-photo buttons in the archive toolbar. */
  photoMode?: 'with' | 'without';
  onPhotoModeChange?: (mode: 'with' | 'without') => void;
  onEditItem?: (item: Member) => void;
  onDeleteItem?: (item: Member) => void;
  bordered?: boolean;
  /** Hide the "Filter · …" title for a tighter toolbar (Administration). */
  compactFilters?: boolean;
  /**
   * Cap the table body height to roughly this many rows and scroll vertically
   * (Administration shows 5 rows on screen).
   */
  maxVisibleRows?: number;
};

function ClubArchivePageInner({
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
  memberId: memberIdProp,
  headerAction,
  refreshKey = 0,
  getRowClassName,
  photoMode,
  onPhotoModeChange,
  onEditItem,
  onDeleteItem,
  bordered = false,
  compactFilters = false,
  maxVisibleRows,
}: Props) {
  const searchParams = useSearchParams();
  const memberIdFromUrl = searchParams?.get('memberId') || null;
  const memberId = memberIdProp || memberIdFromUrl;
  const productId = searchParams?.get('productId') || undefined;
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
        memberId: memberId || undefined,
        productId,
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
    memberId,
    productId,
    onEditItem,
    onDeleteItem,
    refreshKey,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied, memberId, archiveType, productId]);

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

  const body = (
    <>
      {compactFilters && error ? (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      ) : null}
      {compactFilters && headerAction ? (
        <div className="mb-2 flex justify-end">{headerAction}</div>
      ) : null}
      <ArchiveListToolbar
        title={compactFilters ? 'Filter' : `Filter · ${title}`}
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
        compact={compactFilters}
        pagination={pagination}
        photoMode={photoMode}
        onPhotoModeChange={onPhotoModeChange}
        selectedCount={onDeleteItem ? selectedIds.size : undefined}
        onDeleteSelected={onDeleteItem ? handleDeleteSelected : undefined}
      />
      <div
        className={
          maxVisibleRows && maxVisibleRows > 0
            ? 'overflow-auto border border-teal-900/20'
            : undefined
        }
        style={
          maxVisibleRows && maxVisibleRows > 0
            ? // header ~40px + row ~41px each
              { maxHeight: `${40 + maxVisibleRows * 41}px` }
            : undefined
        }
      >
        <ProcedureArchiveTable
          bordered={bordered}
          columns={columns}
          rows={data}
          getRowClassName={getRowClassName}
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
      </div>
      {compactFilters && footerHint ? (
        <p className="mt-2 text-xs text-gray-500">{footerHint}</p>
      ) : null}
    </>
  );

  if (compactFilters) {
    return <div>{body}</div>;
  }

  return (
    <ProcedureArchiveShell
      title={title}
      activeTab=""
      tabs={[]}
      headerAction={headerAction}
      error={error || undefined}
      footerHint={footerHint}
    >
      {body}
    </ProcedureArchiveShell>
  );
}

export default function ClubArchivePage(props: Props) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <ClubArchivePageInner {...props} />
    </Suspense>
  );
}
