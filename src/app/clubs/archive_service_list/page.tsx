'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import DisplayAllArchivesCheckbox, {
  scopedArchiveQuery,
  useEffectiveScopedRecordIds,
  useScopedRecordIds,
} from '@/components/procedures/DisplayAllArchivesCheckbox';
import {
  getServiceSaleTabs,
  SERVICE_SALE_PAGE_SIZE,
  serviceSaleRecordColumns,
} from '@/components/procedures/configs/serviceSale';
import { Member } from '@/types/clubTable';
import {
  deletePurchase,
  fetchPurchases,
  type ServiceSalePurchase,
} from '@/lib/club/serviceSaleClient';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import EditRecordModal from '@/components/club/archives/EditRecordModal';

function mapPurchase(
  p: ServiceSalePurchase,
  i: number,
  onDelete: (id: string) => void,
  onEdit: (p: ServiceSalePurchase) => void
): Member {
  return {
    id: p.id,
    userId: p.userId,
    number: i + 1,
    name: p.memberName,
    typology: p.typology,
    course: p.sectorName,
    service: p.serviceName,
    insertDate: p.recordDate ?? undefined,
    expirationDate: p.expireDate ?? undefined,
    value: p.value,
    paid: p.pay,
    rest: p.rest,
    casual: p.notes,
    operator: p.operatorName,
    dateEnd: p.lastPaymentDate ?? undefined,
    edit: (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(p);
        }}
        className="text-blue-600 hover:text-blue-800"
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </button>
    ),
    delete: (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(p.id);
        }}
        className="text-red-500 hover:text-red-700"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    ),
  };
}

function ArchiveServiceListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedIds = useScopedRecordIds();
  const effectiveIds = useEffectiveScopedRecordIds();
  const scopeQuery = scopedArchiveQuery(searchParams);
  const filters = useArchiveListFilters();

  const [data, setData] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SERVICE_SALE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceSalePurchase | null>(null);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  const memberIdFromUrl = searchParams?.get('memberId') || null;

  const selectedMemberId = useMemo(
    () =>
      memberIdFromUrl ||
      (selectedId ? data.find((r) => r.id === selectedId)?.userId ?? null : null),
    [data, selectedId, memberIdFromUrl]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPurchases({
        page,
        pageSize,
        recordIds: effectiveIds.length > 0 ? effectiveIds : undefined,
        memberId: memberIdFromUrl || undefined,
        ...filters.applied,
      });
      setTotal(res.total);
      setData(
        res.items.map((p, i) =>
          mapPurchase(
            p,
            (page - 1) * pageSize + i,
            (id) => {
              setDeleteTargetIds([id]);
              setShowDeletePasswordModal(true);
            },
            (purchase) => {
              setEditTarget(purchase);
              setShowPasswordModal(true);
            }
          )
        )
      );
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, effectiveIds, filters.applied, memberIdFromUrl]);

  const performDelete = useCallback(
    async (ids: string[]) => {
      try {
        for (const id of ids) {
          await deletePurchase(id);
        }
        setSelectedIds(new Set());
        load();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const effectiveIdsKey = effectiveIds.join(',');

  useEffect(() => {
    setPage(1);
  }, [effectiveIdsKey, filters.applied]);

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteTargetIds(ids);
    setShowDeletePasswordModal(true);
  }

  return (
    <ProcedureArchiveShell
      title="Archive of Services"
      activeTab="historical"
      tabs={getServiceSaleTabs(
        'historical',
        selectedId,
        scopedIds.length > 0 ? scopedIds : null,
        scopeQuery || null,
        selectedMemberId
      )}
      tabsTrailing={<DisplayAllArchivesCheckbox archiveLabel="historicals" />}
      error={error}
      footerHint={
        effectiveIds.length > 0
          ? `Showing ${effectiveIds.length} selected deadline record(s) only. Check “Display all historicals” for the full list.`
          : 'Click to select · Double-click a row with Rest > 0 to open the payment form · Check rows to delete selected'
      }
    >
      <ArchiveListToolbar
        title="Filter · Archive of Services"
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
        selectedCount={selectedIds.size}
        onDeleteSelected={handleDeleteSelected}
        pagination={
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
        }
      />
      <ProcedureArchiveTable
        columns={serviceSaleRecordColumns}
        rows={data}
        selectedId={selectedId}
        loading={loading}
        selectable
        selectOnlyOpenRest={false}
        selectedIds={selectedIds}
        onToggleSelect={(row) => {
          if (!row.id) return;
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(row.id!)) next.delete(row.id!);
            else next.add(row.id!);
            return next;
          });
        }}
        onToggleSelectAll={(checked) => {
          if (!checked) {
            setSelectedIds(new Set());
            return;
          }
          setSelectedIds(new Set(data.map((r) => r.id).filter(Boolean) as string[]));
        }}
        onRowClick={(row) => {
          setError('');
          if (row.id) setSelectedId(row.id);
        }}
        onRowDoubleClick={(row) => {
          if (!row.id) return;
          if ((row.rest ?? 0) <= 0) {
            setError(
              'Payment is not possible because this service is already fully paid (Rest = €0.00).'
            );
            setSelectedId(row.id);
            return;
          }
          setError('');
          router.push(`/clubs/payment_detail/${row.id}`);
        }}
      />

      <AdminPasswordConfirmModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setEditTarget(null);
        }}
        onVerified={() => {
          setShowPasswordModal(false);
          setShowEditModal(true);
        }}
      />

      {editTarget && (
        <EditRecordModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditTarget(null);
          }}
          onSaved={() => load()}
          record={{
            id: editTarget.id,
            recordDate: editTarget.recordDate,
            paydate: editTarget.paydate,
            expireDate: editTarget.expireDate,
            notes: editTarget.notes,
            operatorId: editTarget.operatorId,
          }}
        />
      )}

      <AdminPasswordConfirmModal
        isOpen={showDeletePasswordModal}
        onClose={() => {
          setShowDeletePasswordModal(false);
          setDeleteTargetIds([]);
        }}
        onVerified={() => {
          setShowDeletePasswordModal(false);
          if (deleteTargetIds.length > 0) performDelete(deleteTargetIds);
          setDeleteTargetIds([]);
        }}
      />
    </ProcedureArchiveShell>
  );
}

export default function ArchiveServiceListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ArchiveServiceListInner />
    </Suspense>
  );
}
