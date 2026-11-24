'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import {
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import { buildProcedureColumns } from '@/components/procedures/configs/buildColumns';
import EditReceiptModal from '@/components/club/archives/EditReceiptModal';
import { createProcedureClient, type ProcedureReceiptView } from '@/lib/club/procedureClient';
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

function toReceiptRow(
  receipt: ProcedureReceiptView,
  onEdit: (receipt: ProcedureReceiptView) => void,
  onDelete: (id: string) => void
): Member {
  return {
    id: receipt.id,
    name: receipt.memberName,
    typology: receipt.typology,
    service: receipt.primaryLabel,
    insertDate: receipt.receiptDate ?? undefined,
    category: receipt.documentType,
    contract: receipt.documentNumber,
    value: receipt.cost,
    paid: receipt.paymentIn,
    casual: receipt.annotations,
    operator: receipt.operatorName,
    edit: <EditRowButton onClick={() => onEdit(receipt)} />,
    delete: <DeleteRowButton onClick={() => onDelete(receipt.id)} />,
  };
}

function ProcedureReceiptsArchiveInner({ procedureCode, activeTab }: Props) {
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const columns = useMemo(() => buildProcedureColumns(def), [def]);
  const scope = useArchiveScope();
  const filters = useArchiveListFilters();
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();

  const [data, setData] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(client.pageSize);
  const [total, setTotal] = useState(0);
  const [editTarget, setEditTarget] = useState<ProcedureReceiptView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.fetchReceipts({
        page,
        pageSize,
        ...scope.filters,
        ...filters.applied,
      });
      setTotal(res.total);
      setData(
        res.items.map((receipt) =>
          toReceiptRow(
            receipt,
            (target) => requestPassword(() => setEditTarget(target)),
            (id) =>
              requestPassword(async () => {
                try {
                  await client.deleteReceipt(id);
                  load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Delete failed');
                }
              })
          )
        )
      );
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [client, page, pageSize, scope.filters, filters.applied, requestPassword]);

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
          await client.deleteReceipt(id);
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
      title={def.archiveTitles.receipts}
      activeTab={activeTab}
      tabs={getProcedureTabs(procedureCode, activeTab, scope.recordId, scope.memberId)}
      tabsTrailing={
        <ArchiveScopeRadios state={scope} name="receiptsScope" onChange={() => setPage(1)} />
      }
      error={error}
      footerHint="Check rows to delete selected · Edit and Delete ask for your password."
    >
      <ArchiveListToolbar
        title={`Filter · ${def.archiveTitles.receipts}`}
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
        columns={columns.receiptColumns}
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
        <EditReceiptModal
          isOpen
          procedureCode={procedureCode}
          onClose={() => setEditTarget(null)}
          onSaved={() => load()}
          receipt={{
            id: editTarget.id,
            documentType: editTarget.documentType,
            documentNumber: editTarget.documentNumber,
            annotations: editTarget.annotations,
          }}
        />
      )}
    </ProcedureArchiveShell>
  );
}

export default function ProcedureReceiptsArchive(props: Props) {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ProcedureReceiptsArchiveInner {...props} />
    </Suspense>
  );
}
