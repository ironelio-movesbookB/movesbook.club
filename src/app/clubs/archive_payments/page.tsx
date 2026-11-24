'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import {
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import EditPaymentModal from '@/components/club/archives/EditPaymentModal';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import type { ProcedureTab } from '@/components/procedures/types';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import { fetchClubArchive } from '@/lib/club/archives/clubArchiveClient';
import { createProcedureClient } from '@/lib/club/procedureClient';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import { clubApiFetch, formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import type { Column, Member } from '@/types/clubTable';

const PAGE_SIZE = 25;

const columns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Detail' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'paid', header: 'Payment IN', render: (v) => formatEuro(v) },
  {
    key: 'originalDebt',
    header: 'OF..',
    render: (_, row) =>
      `${Number(row.residualDebt ?? 0).toFixed(2)} / ${Number(row.originalDebt ?? 0).toFixed(2)}`,
  },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'casual', header: 'Notes' },
  { key: 'operator', header: 'Operator' },
  { key: 'edit', header: 'Edit', sortable: false },
  { key: 'delete', header: 'Delete', sortable: false },
];

function recordIdOf(row: Member): string | undefined {
  return row.procedureRecordId ?? row.id;
}

function ArchivePaymentsPageInner() {
  const scope = useArchiveScope();
  const filters = useArchiveListFilters();
  const [data, setData] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editTarget, setEditTarget] = useState<{ code: ProcedureTypeCode; row: Member } | null>(null);
  const [onlyToBeVerified, setOnlyToBeVerified] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<Member | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const openEdit = useCallback((row: Member) => {
    const code = row.procedureType as ProcedureTypeCode | undefined;
    if (!code || !row.id) return;
    setEditTarget({ code, row });
  }, []);

  const performDelete = useCallback(
    async (row: Member) => {
      const code = row.procedureType as ProcedureTypeCode | undefined;
      if (!code || !row.id) return;
      try {
        await createProcedureClient(code).deletePayment(row.id);
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [reload]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchClubArchive('payments', {
        page,
        pageSize,
        ...scope.filters,
        ...filters.applied,
        toBeVerified: onlyToBeVerified,
      });
      setTotal(res.total);
      setData(
        res.items.map((row) => ({
          ...row,
          edit: <EditRowButton onClick={() => requestPassword(() => openEdit(row))} />,
          delete: <DeleteRowButton onClick={() => requestPassword(() => performDelete(row))} />,
        }))
      );
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, scope.filters, filters.applied, onlyToBeVerified, requestPassword, openEdit, performDelete]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied, scope.filters, onlyToBeVerified]);

  const confirmVerification = async () => {
    if (!verifyTarget?.id) return;
    setVerifying(true);
    try {
      await clubApiFetch('/api/club/payment-verification', {
        method: 'POST',
        body: JSON.stringify({ paymentId: verifyTarget.id }),
      });
      setVerifyTarget(null);
      reload();
    } catch (e) {
      setVerifyTarget(null);
      setError(e instanceof Error ? e.message : 'Confirmation failed');
    } finally {
      setVerifying(false);
    }
  };

  // Same as Deadlines: the selected row travels to sibling archives via recordId + memberId.
  const selectedRow = useMemo(
    () => (selectedId ? data.find((r) => r.id === selectedId) ?? null : null),
    [data, selectedId]
  );
  const scopeQuery = archiveScopeQuery(
    selectedRow ? recordIdOf(selectedRow) : scope.recordId,
    selectedRow?.userId ?? selectedRow?.memberId ?? scope.memberId
  );

  const tabs: ProcedureTab[] = [
    { id: 'deadlines', label: 'Archive of Deadlines', href: `/clubs/archive_deadlines${scopeQuery}` },
    { id: 'payments', label: 'Archive of Payments', href: `/clubs/archive_payments${scopeQuery}` },
    { id: 'receipts', label: 'Archive of Receipts', href: `/clubs/archive_receipts${scopeQuery}` },
  ];

  function handleDeleteSelected() {
    const rows = data.filter((r) => r.id && selectedIds.has(r.id));
    if (rows.length === 0) return;
    requestPassword(async () => {
      try {
        for (const row of rows) {
          const code = row.procedureType as ProcedureTypeCode | undefined;
          if (!code || !row.id) continue;
          await createProcedureClient(code).deletePayment(row.id);
        }
        setSelectedIds(new Set());
        reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  return (
    <ProcedureArchiveShell
      title="Archive of Payments"
      activeTab="payments"
      tabs={tabs}
      tabsTrailing={
        <ArchiveScopeRadios state={scope} name="paymentsScope" onChange={() => setPage(1)} />
      }
      error={error}
      footerHint="All typologies (Services, Products, Expenses, Member debts, …). Select a row then open Deadlines/Receipts to keep that record/member. Check rows to delete selected. Edit and Delete ask for your password."
    >
      <ArchiveListToolbar
        title="Filter · Archive of Payments"
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-800">
          <button
            type="button"
            role="switch"
            aria-checked={onlyToBeVerified}
            onClick={() => setOnlyToBeVerified((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              onlyToBeVerified ? 'bg-red-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                onlyToBeVerified ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          Payments to be verified
          <span className="text-xs font-normal text-gray-500">{onlyToBeVerified ? 'On' : 'Off'}</span>
        </label>
        <p className="text-xs text-gray-500">Grey rows are payments to be verified — click one to confirm it.</p>
      </div>
      <ProcedureArchiveTable
        columns={columns}
        rows={data}
        selectedId={selectedId}
        loading={loading}
        selectable
        selectOnlyOpenRest={false}
        selectedIds={selectedIds}
        getRowClassName={(row) => (row.toBeVerified ? 'text-gray-400' : 'text-black')}
        onRowClick={(row) => {
          if (!row.id) return;
          setSelectedId(row.id);
          if (row.toBeVerified) setVerifyTarget(row);
        }}
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
      />

      {passwordModal}

      <PromocodeConfirmModal
        open={Boolean(verifyTarget)}
        title="Payment to be verified"
        message={
          verifyTarget
            ? `Confirm that the payment of ${formatEuro(Number(verifyTarget.paid ?? 0))} by ${String(
                verifyTarget.name ?? '',
              )} was really received?`
            : ''
        }
        confirmLabel="Confirm payment"
        loading={verifying}
        onClose={() => setVerifyTarget(null)}
        onConfirm={() => void confirmVerification()}
      />

      {editTarget && (
        <EditPaymentModal
          isOpen
          procedureCode={editTarget.code}
          onClose={() => setEditTarget(null)}
          onSaved={reload}
          payment={{
            id: editTarget.row.id!,
            paymentDate:
              typeof editTarget.row.insertDate === 'string'
                ? editTarget.row.insertDate
                : editTarget.row.insertDate?.toISOString() ?? null,
            description: String(editTarget.row.casual ?? ''),
            operatorId: editTarget.row.operatorId ?? null,
          }}
        />
      )}
    </ProcedureArchiveShell>
  );
}

export default function ArchivePaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ArchivePaymentsPageInner />
    </Suspense>
  );
}
