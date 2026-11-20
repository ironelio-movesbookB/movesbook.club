'use client';

/**
 * Cash movements archive with PHP-style drill-down tabs:
 * Historical | Details deadline | Totals about payments
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import {
  CancelRowButton,
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from "@/components/procedures/ArchiveRowActions";
import ArchiveListToolbar from "@/components/procedures/ArchiveListToolbar";
import { useArchiveListFilters } from "@/components/procedures/useArchiveListFilters";
import { fetchClubArchive } from "@/lib/club/archives/clubArchiveClient";
import { createProcedureClient } from "@/lib/club/procedureClient";
import { parseCashMovementId } from "@/lib/club/cashMovementClient";
import { formatDate, formatEuro } from "@/lib/club/servicePurchasesClient";
import type { ProcedureTypeCode } from "@/lib/procedures/types";
import { payModeTone } from "@/lib/procedures/payModes";
import type { Column, Member } from "@/types/clubTable";

type ViewMode = 'historical' | 'details_deadline' | 'totals_payments';

type CashRow = Member & {
  id: string;
  procedureRecordId?: string;
  procedureType?: string;
};

type PaymentsScope = {
  procedureType: ProcedureTypeCode;
  recordId: string;
  memberId: string;
};

type Props = {
  title: string;
  direction: 'all' | 'IN' | 'OUT';
  columns: Column[];
  footerHint?: string;
  onEditItem?: (item: Member) => void;
  onDeleteItem?: (item: Member) => void;
  onCancelItem?: (item: Member) => void | Promise<void>;
};

const deadlineColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Service / Product' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  {
    key: 'expirationDate',
    header: 'Expiration Date',
    render: (v) => formatDate(v),
  },
  { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
  { key: 'casual', header: 'Description' },
  { key: 'operator', header: 'Operator' },
];

const totalsColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Service / Product' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'paid', header: 'Payment IN', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'payMod', header: 'Pay mode' },
  { key: 'casual', header: 'Causal Payment' },
  { key: 'operator', header: 'Operator' },
];

function tabClass(active: boolean) {
  if (active) {
    return 'mb-[-1px] rounded-t border border-b-0 border-teal-600 bg-white px-3 py-2 text-sm font-medium text-teal-700';
  }
  return 'mb-[-1px] rounded-t border border-b-0 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-gray-600 hover:text-teal-700';
}

export default function CashMovementsArchive({
  title,
  direction,
  columns,
  footerHint,
  onEditItem,
  onDeleteItem,
  onCancelItem,
}: Props) {
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();
  const filters = useArchiveListFilters();
  const [view, setView] = useState<ViewMode>('historical');
  const [historical, setHistorical] = useState<CashRow[]>([]);
  const [detailRows, setDetailRows] = useState<Member[]>([]);
  const [paymentsScope, setPaymentsScope] = useState<PaymentsScope | null>(
    null,
  );
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [hidePaymentsIn, setHidePaymentsIn] = useState(false);
  const [hidePaymentsOut, setHidePaymentsOut] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const selectedRow = useMemo(
    () => historical.find((r) => r.id === selectedId) ?? null,
    [historical, selectedId],
  );

  const loadHistorical = useCallback(async () => {
    setLoading(true);
    setError('');
    if (direction === 'all' && hidePaymentsIn && hidePaymentsOut) {
      setHistorical([]);
      setTotal(0);
      setSelectedId(null);
      setCheckedIds(new Set());
      setLoading(false);
      return;
    }
    try {
      const filteredDirection =
        direction !== 'all'
          ? direction
          : hidePaymentsIn
            ? 'OUT'
            : hidePaymentsOut
              ? 'IN'
              : 'all';
      const res = await fetchClubArchive('cash-movements', {
        page,
        pageSize,
        direction: filteredDirection,
        ...filters.applied,
      });
      setTotal(res.total);
      const items = (res.items as CashRow[]).map((item) => {
        const enriched: CashRow = { ...item };
        if (onEditItem && !item.cancelled && !item.reversalOfId) {
          enriched.edit = (
            <EditRowButton
              onClick={() => requestPassword(() => onEditItem(item))}
            />
          );
        }
        if (onDeleteItem && !item.reversalOfId) {
          enriched.delete = (
            <DeleteRowButton
              onClick={() => requestPassword(() => onDeleteItem(item))}
            />
          );
        }
        if (onCancelItem) {
          enriched.cancel = item.reversalOfId ? (
            <span className="text-xs text-gray-500">Reversal</span>
          ) : item.cancelled ? (
            <span className="text-xs font-semibold text-gray-500">
              Cancelled
            </span>
          ) : (
            <CancelRowButton
              onClick={() =>
                requestPassword(() => {
                  if (
                    window.confirm(
                      'Cancel this payment? An opposite transaction will be recorded and the related deadline balance restored.',
                    )
                  ) {
                    void Promise.resolve(onCancelItem(item)).catch((e) => {
                      setError(
                        e instanceof Error ? e.message : 'Cancel failed',
                      );
                    });
                  }
                })
              }
            />
          );
        }
        // Backfill procedureType from prefixed id when API older payloads omit it
        if (!enriched.procedureType && enriched.id) {
          const parsed = parseCashMovementId(enriched.id);
          if (parsed) {
            enriched.procedureType = parsed.procedureType;
          }
        }
        return enriched;
      });
      setHistorical(items);
      setCheckedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [
    filters.applied,
    direction,
    hidePaymentsIn,
    hidePaymentsOut,
    onCancelItem,
    onDeleteItem,
    onEditItem,
    page,
    pageSize,
    requestPassword,
  ]);

  useEffect(() => {
    loadHistorical();
  }, [loadHistorical]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied]);

  async function loadDetailsDeadline(row: CashRow) {
    if (!row.procedureRecordId || !row.procedureType) {
      window.alert('Please select at least one record');
      return;
    }
    setDetailLoading(true);
    setError('');
    try {
      const client = createProcedureClient(
        row.procedureType as ProcedureTypeCode,
      );
      const { record } = await client.fetchRecord(row.procedureRecordId);
      setDetailRows([
        {
          id: record.id,
          userId: record.userId,
          name: record.memberName,
          image: record.memberImage ?? undefined,
          typology: record.typology,
          service: record.primaryLabel,
          insertDate: record.recordDate ?? undefined,
          expirationDate: record.expireDate ?? undefined,
          value: record.value,
          paid: record.pay,
          rest: record.rest,
          casual: record.notes,
          operator: record.operatorName,
          dateEnd: record.lastPaymentDate ?? undefined,
        },
      ]);
      setView('details_deadline');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load deadline details',
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPaymentsForScope(scope: PaymentsScope, showAll: boolean) {
    setDetailLoading(true);
    setError('');
    try {
      const client = createProcedureClient(scope.procedureType);
      const res = await client.fetchPayments({
        ...(showAll
          ? { memberId: scope.memberId }
          : { recordId: scope.recordId }),
        page: 1,
        pageSize: 100,
      });
      setDetailRows(
        res.items.map((p) => ({
          id: p.id,
          name: p.memberName,
          typology: p.typology,
          service: p.primaryLabel,
          insertDate: p.paymentDate ?? undefined,
          paid: p.paid,
          rest: p.residualDebt ?? p.balance,
          payMod: p.payMode ?? undefined,
          casual: p.description,
          operator: p.operatorName,
        })),
      );
      setPaymentsScope(scope);
      setShowAllPayments(showAll);
      setView('totals_payments');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load payment totals',
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadTotalsPayments(row: CashRow) {
    if (!row.procedureRecordId || !row.procedureType) {
      window.alert('Please select at least one record');
      return;
    }
    setDetailLoading(true);
    setError('');
    try {
      const procedureType = row.procedureType as ProcedureTypeCode;
      const { record } = await createProcedureClient(procedureType).fetchRecord(
        row.procedureRecordId,
      );
      await loadPaymentsForScope(
        {
          procedureType,
          recordId: row.procedureRecordId,
          memberId: record.userId,
        },
        false,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load payment totals',
      );
      setDetailLoading(false);
    }
  }

  function toggleAllPayments() {
    if (!paymentsScope) return;
    void loadPaymentsForScope(paymentsScope, !showAllPayments);
  }

  function handleDetailsDeadline() {
    if (!selectedRow) {
      window.alert('Please select at least one record');
      return;
    }
    void loadDetailsDeadline(selectedRow);
  }

  function handleTotalsPayments() {
    if (!selectedRow) {
      window.alert('Please select at least one record');
      return;
    }
    void loadTotalsPayments(selectedRow);
  }

  function handleHistorical() {
    setView('historical');
    setDetailRows([]);
    setPaymentsScope(null);
    setShowAllPayments(false);
  }

  function applyFilterForm() {
    if (!filters.apply()) return;
    setPage(1);
    setView('historical');
  }

  function clearFilters() {
    filters.clear();
    setPage(1);
    setView('historical');
  }

  function handleDeleteSelected() {
    if (!onDeleteItem) return;
    const items = historical.filter(
      (r) => checkedIds.has(r.id) && !r.reversalOfId,
    );
    if (items.length === 0) return;
    requestPassword(async () => {
      try {
        for (const item of items) {
          await onDeleteItem(item);
        }
        setCheckedIds(new Set());
        loadHistorical();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  const showingHistorical = view === 'historical';
  const tableColumns = showingHistorical
    ? columns
    : view === 'details_deadline'
      ? deadlineColumns
      : totalsColumns;
  const tableRows = showingHistorical ? historical : detailRows;
  const tableLoading = showingHistorical ? loading : detailLoading;
  const getDirectionRowClassName = (row: Member) => {
    const rowDirection = row.direction ?? direction;
    if (rowDirection === "IN") {
      return payModeTone(String(row.payMod ?? "")) === "external"
        ? "text-blue-700 font-semibold"
        : "text-[#0b5d3c] font-semibold";
    }
    if (rowDirection === "OUT") return "text-red-700 font-semibold";
    return "";
  };

  const tabActions = (
    <>
      <button
        type="button"
        className={tabClass(view === 'historical')}
        onClick={handleHistorical}
      >
        Historical
      </button>
      <button
        type="button"
        className={tabClass(view === 'details_deadline')}
        onClick={handleDetailsDeadline}
      >
        Details deadline selected
      </button>
      <button
        type="button"
        className={tabClass(view === 'totals_payments')}
        onClick={handleTotalsPayments}
      >
        Payments record selected
      </button>
      {view === 'totals_payments' && (
        <button
          type="button"
          className="ml-auto px-3 py-2 text-sm font-medium text-teal-700 hover:text-teal-900"
          onClick={toggleAllPayments}
          disabled={detailLoading || !paymentsScope}
        >
          {showAllPayments ? 'Show selected record' : 'Show all'}
        </button>
      )}
    </>
  );

  const directionVisibilityControls = direction === 'all' && (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-sm">
      <label className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-[#0b5d3c]">
        <input
          type="checkbox"
          checked={hidePaymentsIn}
          onChange={(event) => {
            setHidePaymentsIn(event.target.checked);
            setPage(1);
            setSelectedId(null);
            setCheckedIds(new Set());
          }}
          className="h-4 w-4"
        />
        Hide payments IN
      </label>
      <label className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-red-700">
        <input
          type="checkbox"
          checked={hidePaymentsOut}
          onChange={(event) => {
            setHidePaymentsOut(event.target.checked);
            setPage(1);
            setSelectedId(null);
            setCheckedIds(new Set());
          }}
          className="h-4 w-4"
        />
        Hide payments OUT
      </label>
    </div>
  );

  return (
    <ProcedureArchiveShell
      title={title}
      activeTab=""
      tabs={[]}
      tabActions={tabActions}
      tabsTrailing={directionVisibilityControls}
      error={error || undefined}
      footerHint={
        showingHistorical
          ? (footerHint ??
            'Select a payment, then open Details deadline or Totals about payments. Check rows to delete selected.')
          : view === 'details_deadline'
            ? 'Parent deadline / debt related to the selected payment. Click Historical to go back.'
            : showAllPayments
              ? 'All payments of the current member (same typology) as the selected row. Click Historical to go back.'
              : 'Payments related to the selected record. Use Show all to view all payments of this member.'
      }
    >
      {showingHistorical && (
        <ArchiveListToolbar
          title="Filter movements"
          values={filters.draft}
          onChange={filters.onChange}
          onApply={applyFilterForm}
          onClear={clearFilters}
          dateRangeError={filters.dateRangeError}
          selectedCount={onDeleteItem ? checkedIds.size : undefined}
          onDeleteSelected={onDeleteItem ? handleDeleteSelected : undefined}
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
      )}

      <ProcedureArchiveTable
        columns={tableColumns}
        rows={tableRows}
        selectedId={showingHistorical ? selectedId : null}
        selectable={showingHistorical}
        selectOnlyOpenRest={false}
        selectedIds={showingHistorical ? checkedIds : undefined}
        loading={tableLoading}
        getRowClassName={getDirectionRowClassName}
        emptyMessage={
          showingHistorical
            ? 'No cash movements found.'
            : view === 'details_deadline'
              ? 'No related deadline found.'
              : 'No related payments found.'
        }
        onRowClick={
          showingHistorical
            ? (row) => {
                if (row.id) setSelectedId(row.id);
              }
            : undefined
        }
        onToggleSelect={
          showingHistorical
            ? (row) => {
                if (!row.id || row.reversalOfId) return;
                setSelectedId(row.id);
                setCheckedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id!)) next.delete(row.id!);
                  else next.add(row.id!);
                  return next;
                });
              }
            : undefined
        }
        onToggleSelectAll={
          showingHistorical
            ? (checked) => {
                if (!checked) {
                  setCheckedIds(new Set());
                  return;
                }
                setCheckedIds(
                  new Set(
                    historical
                      .filter((r) => !r.reversalOfId)
                      .map((r) => r.id)
                      .filter(Boolean),
                  ),
                );
              }
            : undefined
        }
      />
      {passwordModal}
    </ProcedureArchiveShell>
  );
}
