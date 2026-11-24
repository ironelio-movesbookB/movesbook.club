'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import { buildProcedureColumns } from '@/components/procedures/configs/buildColumns';
import EditRecordModal from '@/components/club/archives/EditRecordModal';
import {
  createProcedureClient,
  type ProcedureRecordView,
} from '@/lib/club/procedureClient';
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

function toTableRow(
  record: ProcedureRecordView,
  index: number,
  onEdit: (record: ProcedureRecordView) => void,
  onDelete: (id: string) => void
): Member {
  return {
    id: record.id,
    userId: record.userId,
    number: index + 1,
    name: record.memberName,
    typology: record.typology,
    service: record.primaryLabel,
    course: record.secondaryLabel || undefined,
    insertDate: record.recordDate ?? undefined,
    expirationDate: record.expireDate ?? undefined,
    value: record.value,
    paid: record.pay,
    rest: record.rest,
    casual: record.notes,
    operator: record.operatorName,
    dateEnd: record.lastPaymentDate ?? undefined,
    edit: <EditRowButton onClick={() => onEdit(record)} />,
    delete: <DeleteRowButton onClick={() => onDelete(record.id)} />,
  };
}

function ProcedureRecordsArchiveInner({ procedureCode, activeTab }: Props) {
  const router = useRouter();
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const columns = useMemo(() => buildProcedureColumns(def), [def]);
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();
  const filters = useArchiveListFilters();
  const scope = useArchiveScope();

  const [data, setData] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(client.pageSize);
  const [total, setTotal] = useState(0);
  const [editTarget, setEditTarget] = useState<ProcedureRecordView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.fetchRecords({
        page,
        pageSize,
        ...filters.applied,
        ...scope.filters,
      });
      setTotal(res.total);
      setData(
        res.items.map((record, i) =>
          toTableRow(
            record,
            (page - 1) * pageSize + i,
            (target) => requestPassword(() => setEditTarget(target)),
            (id) =>
              requestPassword(async () => {
                try {
                  await client.deleteRecord(id);
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
  }, [client, page, pageSize, requestPassword, filters.applied, scope.filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied, pageSize, scope.filters]);

  const selectedMemberId = useMemo(
    () =>
      scope.memberId ||
      (selectedId ? data.find((r) => r.id === selectedId)?.userId ?? null : null),
    [data, selectedId, scope.memberId]
  );

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    requestPassword(async () => {
      try {
        for (const id of ids) {
          await client.deleteRecord(id);
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
      title={def.archiveTitles.records}
      activeTab={activeTab}
      tabs={getProcedureTabs(procedureCode, activeTab, selectedId, selectedMemberId)}
      headerAction={
        <button
          type="button"
          onClick={() => router.push(def.routes.form)}
          className="text-sm bg-white text-teal-800 px-3 py-1 rounded hover:bg-teal-50"
        >
          {def.archiveTitles.newRecordButton}
        </button>
      }
      error={error}
      footerHint="Check rows to delete selected · Click to select · Double-click to open payment form · Edit and Delete ask for your password"
    >
      <div className="mb-2 px-1">
        <ArchiveScopeRadios state={scope} name={`${procedureCode}-recordsScope`} onChange={() => setPage(1)} />
      </div>
      <ArchiveListToolbar
        title={`Filter · ${def.archiveTitles.records}`}
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
        columns={columns.recordColumns}
        rows={data}
        selectedId={selectedId}
        selectedIds={selectedIds}
        selectable
        selectOnlyOpenRest={false}
        loading={loading}
        onRowClick={(row) => row.id && setSelectedId(row.id)}
        onRowDoubleClick={(row) => row.id && router.push(def.routes.paymentDetail(row.id))}
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
        <EditRecordModal
          isOpen
          procedureCode={procedureCode}
          onClose={() => setEditTarget(null)}
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
    </ProcedureArchiveShell>
  );
}

export default function ProcedureRecordsArchive(props: Props) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <ProcedureRecordsArchiveInner {...props} />
    </Suspense>
  );
}
