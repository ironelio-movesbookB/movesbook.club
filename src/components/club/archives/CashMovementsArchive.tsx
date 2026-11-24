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
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import { fetchClubArchive } from '@/lib/club/archives/clubArchiveClient';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { parseCashMovementId } from '@/lib/club/cashMovementClient';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import type { Column, Member } from '@/types/clubTable';

type ViewMode = 'historical' | 'details_deadline' | 'totals_payments';

type CashRow = Member & {
  id: string;
  procedureRecordId?: string;
  procedureType?: string;
};

type Props = {
  title: string;
  direction: 'all' | 'IN' | 'OUT';
  columns: Column[];
  footerHint?: string;
  onEditItem?: (item: Member) => void;
  onDeleteItem?: (item: Member) => void;
};

const deadlineColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Service / Product' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'expirationDate', header: 'Expiration Date', render: (v) => formatDate(v) },
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
}: Props) {
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();
  const filters = useArchiveListFilters();
  const [view, setView] = useState<ViewMode>('historical');
  const [historical, setHistorical] = useState<CashRow[]>([]);
  const [detailRows, setDetailRows] = useState<Member[]>([]);
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
    [historical, selectedId]
  );

  const loadHistorical = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchClubArchive('cash-movements', {
        page,
        pageSize,
        direction,
        ...filters.applied,
      });
      setTotal(res.total);
      const items = (res.items as CashRow[]).map((item) => {
        const enriched: CashRow = { ...item };
        if (onEditItem) {
          enriched.edit = (
            <EditRowButton
              onClick={() => requestPassword(() => onEditItem(item))}
            />
          );
        }
        if (onDeleteItem) {
          enriched.delete = (
            <DeleteRowButton
              onClick={() => requestPassword(() => onDeleteItem(item))}
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
  }, [filters.applied, direction, onDeleteItem, onEditItem, page, pageSize, requestPassword]);

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
      const client = createProcedureClient(row.procedureType as ProcedureTypeCode);
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
      setError(e instanceof Error ? e.message : 'Failed to load deadline details');
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
      const client = createProcedureClient(row.procedureType as ProcedureTypeCode);
      // Resolve the member, then list THAT member's payments only (not the whole club).
      const { record } = await client.fetchRecord(row.procedureRecordId);
      const res = await client.fetchPayments({
        memberId: record.userId,
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
        }))
      );
      setView('totals_payments');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payment totals');
    } finally {
      setDetailLoading(false);
    }
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
    const items = historical.filter((r) => checkedIds.has(r.id));
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
    </>
  );

  return (
    <ProcedureArchiveShell
      title={title}
      activeTab=""
      tabs={[]}
      tabActions={tabActions}
      error={error || undefined}
      footerHint={
        showingHistorical
          ? footerHint ??
            'Select a payment, then open Details deadline or Totals about payments. Check rows to delete selected.'
          : view === 'details_deadline'
            ? 'Parent deadline / debt related to the selected payment. Click Historical to go back.'
            : 'All payments of the same member (same typology) as the selected row. Click Historical to go back.'
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
                if (!row.id) return;
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
                setCheckedIds(new Set(historical.map((r) => r.id).filter(Boolean)));
              }
            : undefined
        }
      />
      {passwordModal}
    </ProcedureArchiveShell>
  );
}
