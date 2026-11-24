'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTabs from '@/components/procedures/ProcedureArchiveTabs';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import DeadlineTypologyNav from '@/components/procedures/DeadlineTypologyNav';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import {
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import { buildProcedureColumns } from '@/components/procedures/configs/buildColumns';
import EditRecordModal from '@/components/club/archives/EditRecordModal';
import type { ProcedureTab } from '@/components/procedures/types';
import { createProcedureClient, type ProcedureRecordView } from '@/lib/club/procedureClient';
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

type DeadlineRow = Member & {
  id: string;
  memberId: string;
  rest: number;
};

function toDeadlineRow(
  record: ProcedureRecordView,
  onEdit: (record: ProcedureRecordView) => void,
  onDelete: (id: string) => void
): DeadlineRow {
  return {
    id: record.id,
    memberId: record.userId,
    name: record.memberName,
    image: record.memberImage ?? undefined,
    typology: record.typology,
    procedureType: record.procedureType,
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

function selectionIsPayable(rows: DeadlineRow[]): boolean {
  if (rows.length === 0) return false;
  const memberId = rows[0].memberId;
  return rows.every((r) => r.memberId === memberId && Number(r.rest) > 0);
}

export default function ProcedureDeadlinesArchive({ procedureCode, activeTab }: Props) {
  const router = useRouter();
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const columns = useMemo(() => buildProcedureColumns(def), [def]);
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();
  const filters = useArchiveListFilters();

  const [editTarget, setEditTarget] = useState<ProcedureRecordView | null>(null);
  const [data, setData] = useState<DeadlineRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [displayAlsoPaid, setDisplayAlsoPaid] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(client.pageSize);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectionError('');
    try {
      const res = await client.fetchDeadlines({
        page,
        pageSize,
        includePaid: displayAlsoPaid,
        ...filters.applied,
      });
      setTotal(res.total);
      setData(
        res.items.map((record) =>
          toDeadlineRow(
            record,
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
      setCheckedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [client, page, pageSize, displayAlsoPaid, filters.applied, requestPassword]);

  useEffect(() => {
    load();
  }, [load]);

  const checkedRows = useMemo(
    () => data.filter((r) => checkedIds.has(r.id)),
    [data, checkedIds]
  );

  const selectedMemberId = useMemo(
    () => (selectedId ? data.find((r) => r.id === selectedId)?.memberId ?? null : null),
    [data, selectedId]
  );
  const memberQuery = selectedMemberId ? `?memberId=${encodeURIComponent(selectedMemberId)}` : '';

  /** PHP: Pay deadlines selected requires 2+ rows, same member, all Rest > 0. */
  const canPaySelected = checkedRows.length > 1 && selectionIsPayable(checkedRows);

  function openPayment(ids: string[]) {
    if (ids.length === 0) return;
    const [primary, ...rest] = ids;
    const deadline = data.find((r) => r.id === primary);
    const code = deadline?.procedureType as ProcedureTypeCode | undefined;
    const routeDef = code ? getProcedureDefinition(code) : def;

    const base = routeDef?.routes.paymentDetail(primary) ?? def.routes.paymentDetail(primary);
    const href =
      rest.length > 0
        ? `${base}?ids=${encodeURIComponent(ids.join(','))}`
        : base;
    router.push(href);
  }

  function handleDoubleClick(row: Member) {
    const deadline = data.find((r) => r.id === row.id);
    if (!deadline) return;
    if (Number(deadline.rest) <= 0) {
      setSelectionError('Payment is not possible because deadline results already paid');
      return;
    }
    openPayment([deadline.id]);
  }

  function handleToggleCheck(row: Member) {
    if (!row.id) return;
    setSelectionError('');
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id!)) next.delete(row.id!);
      else next.add(row.id!);
      return next;
    });
    setSelectedId(row.id);
  }

  function handleToggleCheckAll(checked: boolean) {
    setSelectionError('');
    if (!checked) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(new Set(data.filter((r) => Number(r.rest) > 0).map((r) => r.id)));
  }

  function handlePaySelected() {
    setSelectionError('');
    if (!canPaySelected) {
      setSelectionError(
        'Select 2 or more deadlines with Rest > 0 that belong to the same member.'
      );
      return;
    }
    openPayment(checkedRows.map((r) => r.id));
  }

  function handleDeleteSelected() {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    requestPassword(async () => {
      try {
        for (const id of ids) {
          await client.deleteRecord(id);
        }
        setCheckedIds(new Set());
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  const tabs: ProcedureTab[] = [
    ...getProcedureTabs(procedureCode, activeTab, selectedId, selectedMemberId),
    {
      id: 'pay-selected' as any,
      label: 'Pay more deadlines',
      onClick: handlePaySelected,
      disabled: !canPaySelected,
    },
  ];

  const displayAlsoPaidToggle = (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none ml-auto pb-2">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
        checked={displayAlsoPaid}
        onChange={(e) => {
          setDisplayAlsoPaid(e.target.checked);
          setPage(1);
          setSelectedId(null);
          setSelectionError('');
        }}
      />
      Display also paid
    </label>
  );

  const typologyButtons = <DeadlineTypologyNav activeHref={def.routes.deadlines} />;

  return (
    <ProcedureArchiveShell
      title={def.archiveTitles.deadlines}
      activeTab={activeTab}
      tabs={tabs}
      tabActions={
        <div className="w-full">
          {typologyButtons}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <ProcedureArchiveTabs tabs={tabs} activeTab={activeTab} />
            {displayAlsoPaidToggle}
          </div>
        </div>
      }
      error={error || selectionError}
      footerHint="Double-click a row with Rest > 0 to pay. Or check several (same member, Rest > 0) and use Pay more deadlines. Edit and Delete ask for your password."
    >
      <ArchiveListToolbar
        title={`Filter · ${def.archiveTitles.deadlines}`}
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
        selectedCount={checkedIds.size}
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
        columns={columns.deadlineColumns}
        rows={data}
        selectedId={selectedId}
        selectedIds={checkedIds}
        selectable={true}
        loading={loading}
        onRowClick={(row) => row.id && setSelectedId(row.id)}
        onRowDoubleClick={handleDoubleClick}
        onToggleSelect={handleToggleCheck}
        onToggleSelectAll={handleToggleCheckAll}
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
