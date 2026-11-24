'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import DisplayAllArchivesCheckbox, {
  scopedArchiveQuery,
  useEffectiveScopedRecordIds,
  useScopedRecordIds,
} from '@/components/procedures/DisplayAllArchivesCheckbox';
import TaxDocumentModal, {
  type TaxDocumentFormValues,
} from '@/components/procedures/TaxDocumentModal';
import {
  getServiceSaleTabs,
  SERVICE_SALE_PAGE_SIZE,
  serviceSaleReceiptColumns,
} from '@/components/procedures/configs/serviceSale';
import { Member } from '@/types/clubTable';
import {
  fetchReceipts,
  deleteReceipt,
  updateReceipt,
  type ServiceSaleReceipt,
} from '@/lib/club/serviceSaleClient';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import EditReceiptModal from '@/components/club/archives/EditReceiptModal';

function mapReceipt(
  r: ServiceSaleReceipt,
  onEdit: (r: ServiceSaleReceipt) => void,
  onDelete: (id: string) => void
): Member {
  return {
    id: r.id,
    name: r.memberName,
    typology: r.typology,
    service: r.serviceName,
    insertDate: r.receiptDate ?? undefined,
    category: r.documentType,
    contract: r.documentNumber,
    value: r.cost,
    paid: r.paymentIn,
    residualDebt: r.residualDebt,
    casual: r.annotations,
    operator: r.operatorName,
    isDuplicate: r.isDuplicate,
    edit: (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(r);
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
          onDelete(r.id);
        }}
        className="text-red-500 hover:text-red-700"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    ),
  };
}

function ServiceReceiptsInner() {
  const searchParams = useSearchParams();
  const scopedIds = useScopedRecordIds();
  const effectiveIds = useEffectiveScopedRecordIds();
  const scopeQuery = scopedArchiveQuery(searchParams);
  const scope = useArchiveScope();
  const filters = useArchiveListFilters();

  const [data, setData] = useState<Member[]>([]);
  const [receiptsById, setReceiptsById] = useState<Record<string, ServiceSaleReceipt>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SERVICE_SALE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceSaleReceipt | null>(null);
  const [taxTarget, setTaxTarget] = useState<ServiceSaleReceipt | null>(null);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchReceipts({
        page,
        pageSize,
        recordIds: effectiveIds.length > 0 ? effectiveIds : undefined,
        ...scope.filters,
        ...filters.applied,
      });
      setTotal(res.total);
      const byId: Record<string, ServiceSaleReceipt> = {};
      for (const r of res.items) byId[r.id] = r;
      setReceiptsById(byId);
      setData(
        res.items.map((r) =>
          mapReceipt(
            r,
            (receipt) => {
              setEditTarget(receipt);
              setShowPasswordModal(true);
            },
            (id) => {
              setDeleteTargetIds([id]);
              setShowDeletePasswordModal(true);
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
  }, [page, pageSize, effectiveIds, scope.filters, filters.applied]);

  const performDelete = useCallback(
    async (ids: string[]) => {
      try {
        for (const id of ids) {
          await deleteReceipt(id);
        }
        setSelectedIds(new Set());
        load();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [load]
  );

  const handleOpenReceipt = useCallback(
    (row: Member) => {
      if (!row.id) return;
      const receipt = receiptsById[row.id];
      if (!receipt) return;
      setTaxTarget(receipt);
    },
    [receiptsById]
  );

  const handleSaveTaxDocument = useCallback(
    async (values: TaxDocumentFormValues) => {
      if (!taxTarget) return;
      await updateReceipt(taxTarget.id, {
        documentType: values.documentType || undefined,
        documentNumber: values.documentNumber || undefined,
        annotations: values.causal || undefined,
      });
      await load();
    },
    [taxTarget, load]
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
      title="Archive of Receipts (Services)"
      activeTab="receipts"
      tabs={getServiceSaleTabs(
        'receipts',
        scope.recordId,
        scopedIds.length > 0 ? scopedIds : null,
        scopeQuery || null,
        scope.memberId
      )}
      tabsTrailing={
        scopedIds.length > 0 ? (
          <DisplayAllArchivesCheckbox archiveLabel="receipts" />
        ) : (
          <ArchiveScopeRadios state={scope} name="receiptsScope" onChange={() => setPage(1)} />
        )
      }
      error={error}
      footerHint={
        effectiveIds.length > 0
          ? `Showing receipts for ${effectiveIds.length} selected deadline(s) only. Check “Display all receipts” for the full list.`
          : 'Check rows to delete selected · Double-click to open receipt'
      }
    >
      <ArchiveListToolbar
        title="Filter · Archive of Receipts (Services)"
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
        columns={serviceSaleReceiptColumns}
        rows={data}
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
        onRowDoubleClick={handleOpenReceipt}
      />

      {taxTarget && (
        <TaxDocumentModal
          open
          memberName={taxTarget.memberName}
          defaultCausal={taxTarget.annotations}
          defaultTotal={taxTarget.paymentIn}
          defaultResidual={taxTarget.residualDebt}
          saveLabel="Save document"
          initial={{
            documentType: taxTarget.documentType,
            documentNumber: taxTarget.documentNumber,
            documentDate: taxTarget.receiptDate ?? undefined,
            causal: taxTarget.annotations,
            total: taxTarget.paymentIn,
            residualTotal: taxTarget.residualDebt,
            memberDisplayName: taxTarget.memberName,
            originalMemberName: taxTarget.memberName,
            memberAlias: taxTarget.memberName,
          }}
          onClose={() => setTaxTarget(null)}
          onSave={handleSaveTaxDocument}
        />
      )}

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
        <EditReceiptModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditTarget(null);
          }}
          onSaved={() => load()}
          receipt={{
            id: editTarget.id,
            documentType: editTarget.documentType,
            documentNumber: editTarget.documentNumber,
            annotations: editTarget.annotations,
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

export default function ServiceReceiptsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ServiceReceiptsInner />
    </Suspense>
  );
}
