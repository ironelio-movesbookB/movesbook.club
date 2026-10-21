'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import {
  DeleteRowButton,
  EditRowButton,
  PrintRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import { printAcceptanceReceipt } from '@/components/procedures/printAcceptanceReceipt';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import { buildProcedureColumns } from '@/components/procedures/configs/buildColumns';
import EditPaymentModal from '@/components/club/archives/EditPaymentModal';
import { createProcedureClient, type ProcedurePaymentView } from '@/lib/club/procedureClient';
import {
  getProcedureDefinition,
  getProcedureTabs,
  type ProcedureArchiveTabId,
} from '@/lib/procedures/registry';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import type { Member } from '@/types/clubTable';

type Props = {
  procedureCode: ProcedureTypeCode;
  activeTab: ProcedureArchiveTabId;
};

function toPaymentRow(
  payment: ProcedurePaymentView,
  onEdit: (payment: ProcedurePaymentView) => void,
  onDelete: (id: string) => void,
  onPrint?: (payment: ProcedurePaymentView) => void
): Member {
  return {
    id: payment.id,
    name: payment.memberName,
    typology: payment.typology,
    service: payment.primaryLabel,
    insertDate: payment.paymentDate ?? undefined,
    paid: payment.paid,
    originalDebt: payment.originalDebt,
    residualDebt: payment.residualDebt,
    rest: payment.balance,
    casual: payment.description,
    operator: payment.operatorName,
    print: onPrint ? <PrintRowButton onClick={() => onPrint(payment)} /> : undefined,
    edit: <EditRowButton onClick={() => onEdit(payment)} />,
    delete: <DeleteRowButton onClick={() => onDelete(payment.id)} />,
  };
}

function ProcedurePaymentsArchiveInner({ procedureCode, activeTab }: Props) {
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const columns = useMemo(() => buildProcedureColumns(def), [def]);
  const scope = useArchiveScope();
  const filters = useArchiveListFilters(def.metadataKeys.direction === 'OUT' ? 'recent' : 'old');
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();
  const isOut = def.metadataKeys.direction === 'OUT';

  const [data, setData] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(client.pageSize);
  const [total, setTotal] = useState(0);
  const [editTarget, setEditTarget] = useState<ProcedurePaymentView | null>(null);
  const isExpense = procedureCode === 'expense';
  const [expenseTypes, setExpenseTypes] = useState<{ id: string; name: string }[]>([]);
  const [draftExpenseName, setDraftExpenseName] = useState('');
  const [appliedExpenseName, setAppliedExpenseName] = useState('');

  useEffect(() => {
    if (!isExpense) return;
    let active = true;
    client
      .fetchFormOptions<{ expenses: { id: string; name: string }[] }>()
      .then((options) => {
        if (active) setExpenseTypes(options.expenses);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load expense types');
      });
    return () => {
      active = false;
    };
  }, [client, isExpense]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.fetchPayments({
        page,
        pageSize,
        ...scope.filters,
        ...filters.applied,
        ...(isExpense && appliedExpenseName ? { expenseName: appliedExpenseName } : {}),
      });
      setTotal(res.total);
      const printReceipt = isOut
        ? (payment: ProcedurePaymentView) => {
            const opened = printAcceptanceReceipt({
              clubName: res.clubName,
              recipientName: payment.memberName,
              amount: payment.paid,
              paymentDate: payment.paymentDate,
              detail: payment.primaryLabel,
              notes: payment.description,
              payMode: payment.payMode,
              operatorName: payment.operatorName,
              typology: payment.typology,
              totalAmount: payment.originalDebt,
              residualAmount: payment.balance,
            });
            if (!opened) setError('Allow pop-ups for this site to print the receipt.');
          }
        : undefined;
      setData(
        res.items.map((payment) =>
          toPaymentRow(
            payment,
            (target) => requestPassword(() => setEditTarget(target)),
            (id) =>
              requestPassword(async () => {
                try {
                  await client.deletePayment(id);
                  load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Delete failed');
                }
              }),
            printReceipt
          )
        )
      );
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [client, isExpense, appliedExpenseName, isOut, page, pageSize, scope.filters, filters.applied, requestPassword]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied, scope.filters]);

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    requestPassword(async () => {
      try {
        for (const id of ids) {
          await client.deletePayment(id);
        }
        setSelectedIds(new Set());
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  return (
    <ProcedureArchiveShell
      title={def.archiveTitles.payments}
      activeTab={activeTab}
      tabs={getProcedureTabs(procedureCode, activeTab, scope.recordId, scope.memberId)}
      tabsTrailing={
        <ArchiveScopeRadios state={scope} name="paymentsScope" onChange={() => setPage(1)} />
      }
      error={error}
      footerHint={
        isOut
          ? 'Outgoing payments (OUT) · Print the receipt for the recipient to sign for acceptance · Edit and Delete ask for your password.'
          : 'Check rows to delete selected · Edit and Delete ask for your password.'
      }
    >
      <ArchiveListToolbar
        title={`Filter · ${def.archiveTitles.payments}`}
        orderFirst={isExpense}
        additionalFilter={
          isExpense ? (
            <label className="flex min-w-[180px] flex-col">
              <span className="mb-1 block text-[12px] font-semibold text-gray-800">Type of expense</span>
              <select
                className="block h-9 w-full rounded border border-gray-400 bg-white px-2.5 text-[13px] text-gray-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                value={draftExpenseName}
                onChange={(event) => setDraftExpenseName(event.target.value)}
              >
                <option value="">All types</option>
                {expenseTypes.map((expense) => (
                  <option key={expense.id} value={expense.name}>
                    {expense.name}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        values={filters.draft}
        onChange={filters.onChange}
        onApply={() => {
          if (filters.apply()) {
            setAppliedExpenseName(draftExpenseName);
            setPage(1);
          }
        }}
        onClear={() => {
          filters.clear();
          setDraftExpenseName('');
          setAppliedExpenseName('');
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
        columns={columns.paymentColumns}
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
      />

      {passwordModal}

      {editTarget && (
        <EditPaymentModal
          isOpen
          procedureCode={procedureCode}
          onClose={() => setEditTarget(null)}
          onSaved={() => load()}
          payment={{
            id: editTarget.id,
            paymentDate: editTarget.paymentDate,
            description: editTarget.description,
            operatorId: editTarget.operatorId,
          }}
        />
      )}
    </ProcedureArchiveShell>
  );
}

export default function ProcedurePaymentsArchive(props: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ProcedurePaymentsArchiveInner {...props} />
    </Suspense>
  );
}
