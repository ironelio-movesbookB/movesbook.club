'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTabs from '@/components/procedures/ProcedureArchiveTabs';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import DeadlineTypologyNav from '@/components/procedures/DeadlineTypologyNav';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import {
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import EditRecordModal from '@/components/club/archives/EditRecordModal';
import type { ProcedureTab } from '@/components/procedures/types';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import { deleteArchiveDeadline, fetchClubArchive } from '@/lib/club/archives/clubArchiveClient';
import { createProcedureClient, type ProcedureRecordView } from '@/lib/club/procedureClient';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import type { Column, Member } from '@/types/clubTable';

const PAGE_SIZE = 25;

/** A deadline row carries the installment id, so payment/edit/delete need the record behind it. */
function recordIdOf(row: Member): string | undefined {
  return row.procedureRecordId ?? row.id;
}

/** Expire date with the creation time, exactly as the payment form lists its deadlines. */
function formatDeadlineWhen(value: Date | string | undefined, createdAt?: string): string {
  const day = formatDate(value);
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return day;
  const time = new Date(createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${day} · ${time}`;
}

const recordColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Detail' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'expirationDate', header: 'Expiration Date', render: (v) => formatDate(v) },
  { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
  { key: 'casual', header: 'Notes' },
  { key: 'operator', header: 'Operator' },
  { key: 'edit', header: 'Edit', sortable: false },
  { key: 'delete', header: 'Delete', sortable: false },
];

const everyDeadlineColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  {
    key: 'service',
    header: 'Detail',
    render: (v, row) => (row.course ? `${row.course}-${String(v ?? '')}` : String(v ?? '-')),
  },
  { key: 'deadlineNo', header: 'Deadline' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  {
    key: 'expirationDate',
    header: 'Expiration Date',
    render: (v, row) => formatDeadlineWhen(v, row.expireAt),
  },
  { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
  { key: 'casual', header: 'Notes' },
  { key: 'operator', header: 'Operator' },
  { key: 'edit', header: 'Edit', sortable: false },
  { key: 'delete', header: 'Delete', sortable: false },
];

/** Same member + open rest — deadlines of different typologies can be paid together. */
function sameMemberAndOpenRest(rows: Member[]): boolean {
  if (rows.length === 0) return false;
  const firstUserId = rows[0]?.userId;
  if (!firstUserId) return false;
  return rows.every((r) => r.userId === firstUserId && (r.rest ?? 0) > 0);
}

/** Several checked deadlines can belong to one record; payment always happens per record. */
function checkedRecords(rows: Member[]): { id: string; procedureType: string }[] {
  const byId = new Map<string, { id: string; procedureType: string }>();
  for (const row of rows) {
    const id = recordIdOf(row);
    if (!id || !row.procedureType || byId.has(id)) continue;
    byId.set(id, { id, procedureType: row.procedureType });
  }
  return Array.from(byId.values());
}

/** A "Display every deadlines" row deletes only that deadline; a record row deletes the record. */
async function deleteRow(row: Member): Promise<void> {
  const code = row.procedureType as ProcedureTypeCode | undefined;
  const recordId = recordIdOf(row);
  if (!code || !recordId) return;
  if (row.deadlineNo && row.id) {
    await deleteArchiveDeadline(code, recordId, row.id);
  } else {
    await createProcedureClient(code).deleteRecord(recordId);
  }
}

function paymentHref(
  procedureType: string | undefined,
  recordId: string | undefined,
  ids?: string[]
): string | null {
  const code = procedureType as ProcedureTypeCode | undefined;
  if (!code || !recordId) return null;
  const def = getProcedureDefinition(code);
  if (!def) return null;
  const base = def.routes.paymentDetail(recordId);
  if (ids && ids.length > 1) {
    return `${base}?ids=${encodeURIComponent(ids.join(','))}`;
  }
  return base;
}

/** Multi-select payment across mixed typologies routes through the generic pay_deadlines page. */
function multiTypePayHref(records: { id: string; procedureType: string }[]): string {
  const ids = records.map((r) => r.id).join(',');
  const types = records.map((r) => r.procedureType).join(',');
  return `/clubs/pay_deadlines?ids=${encodeURIComponent(ids)}&types=${encodeURIComponent(types)}`;
}

export default function ArchiveDeadlinesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ArchiveDeadlinesPageInner />
    </Suspense>
  );
}

function ArchiveDeadlinesPageInner() {
  const router = useRouter();
  const scope = useArchiveScope();
  const filters = useArchiveListFilters();
  const [data, setData] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Keyed by row id and holding the row itself: a selection survives paging, so the rows it
  // refers to are no longer guaranteed to be on screen.
  const [selectedRows, setSelectedRows] = useState<Map<string, Member>>(new Map());
  const [selectionError, setSelectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [displayAlsoPaid, setDisplayAlsoPaid] = useState(false);
  const [displayEveryDeadline, setDisplayEveryDeadline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editTarget, setEditTarget] = useState<
    { code: ProcedureTypeCode; record: ProcedureRecordView } | null
  >(null);
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const openEdit = useCallback(async (row: Member) => {
    const code = row.procedureType as ProcedureTypeCode | undefined;
    const recordId = recordIdOf(row);
    if (!code || !recordId) return;
    try {
      const { record } = await createProcedureClient(code).fetchRecord(recordId);
      setEditTarget({ code, record });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this record');
    }
  }, []);

  const performDelete = useCallback(
    async (row: Member) => {
      try {
        await deleteRow(row);
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
      const res = await fetchClubArchive('deadlines', {
        page,
        pageSize,
        includePaid: displayAlsoPaid,
        expandDeadlines: displayEveryDeadline,
        ...scope.filters,
        ...filters.applied,
      });
      setTotal(res.total);
      setData(
        res.items.map((row) => ({
          ...row,
          edit: <EditRowButton onClick={() => requestPassword(() => openEdit(row))} />,
          delete: <DeleteRowButton onClick={() => requestPassword(() => performDelete(row))} />,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    displayAlsoPaid,
    displayEveryDeadline,
    scope.filters,
    filters.applied,
    requestPassword,
    openEdit,
    performDelete,
  ]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied, scope.filters]);

  const checkedIds = useMemo(() => new Set(selectedRows.keys()), [selectedRows]);
  const checkedRows = useMemo(() => Array.from(selectedRows.values()), [selectedRows]);

  const canPaySelected = checkedRows.length > 1 && sameMemberAndOpenRest(checkedRows);
  // The selected row travels to the sibling archives, which open on that record by default.
  const selectedRow = useMemo(
    () => (selectedId ? data.find((r) => r.id === selectedId) ?? null : null),
    [data, selectedId]
  );
  const scopeQuery = archiveScopeQuery(
    selectedRow ? recordIdOf(selectedRow) : scope.recordId,
    selectedRow?.userId ?? selectedRow?.memberId ?? scope.memberId
  );

  function clearSelection() {
    setSelectedRows(new Map());
    setSelectionError('');
  }

  function toggleSelect(row: Member) {
    if (!row.id || (row.rest ?? 0) <= 0) return;
    setSelectionError('');
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(row.id!)) next.delete(row.id!);
      else next.set(row.id!, row);
      return next;
    });
    setSelectedId(row.id);
  }

  /** The header checkbox marks the whole result set, including the pages not on screen. */
  async function toggleSelectAll(checked: boolean) {
    setSelectionError('');
    if (!checked) {
      setSelectedRows(new Map());
      return;
    }
    try {
      const res = await fetchClubArchive('deadlines', {
        page: 1,
        pageSize: Math.max(total, pageSize),
        includePaid: displayAlsoPaid,
        expandDeadlines: displayEveryDeadline,
        ...scope.filters,
        ...filters.applied,
      });
      setSelectedRows(
        new Map(
          res.items.filter((r) => r.id && (r.rest ?? 0) > 0).map((r) => [r.id!, r] as const)
        )
      );
    } catch (e) {
      setSelectionError(e instanceof Error ? e.message : 'Could not select every deadline');
    }
  }

  async function deleteSelected() {
    const perDeadline = checkedRows.some((row) => row.deadlineNo);
    const targets: Member[] = perDeadline
      ? checkedRows
      : checkedRecords(checkedRows).map(
          (record) => ({ id: record.id, procedureType: record.procedureType }) as Member
        );
    if (targets.length === 0) return;
    setSelectionError('');
    const failures: string[] = [];
    for (const row of targets) {
      try {
        await deleteRow(row);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : 'Delete failed');
      }
    }
    clearSelection();
    reload();
    if (failures.length > 0) {
      const reasons = Array.from(new Set(failures)).join(' ');
      setSelectionError(
        `${failures.length} of ${targets.length} deadlines could not be deleted. ${reasons}`
      );
    }
  }

  function handlePaySelected() {
    setSelectionError('');
    if (checkedRows.length < 2) {
      setSelectionError('Select at least two deadlines with Rest > 0.');
      return;
    }
    if (!sameMemberAndOpenRest(checkedRows)) {
      setSelectionError('Checked deadlines must belong to the same member and all have Rest > 0.');
      return;
    }
    const records = checkedRecords(checkedRows);
    if (records.length === 0) return;
    const sameType = records.every((r) => r.procedureType === records[0]!.procedureType);
    const href = sameType
      ? paymentHref(records[0]!.procedureType, records[0]!.id, records.map((r) => r.id))
      : multiTypePayHref(records);
    if (href) router.push(href);
  }

  const tabs: ProcedureTab[] = [
    { id: 'deadlines', label: 'Archive of Deadlines', href: `/clubs/archive_deadlines${scopeQuery}` },
    { id: 'payments', label: 'Archive of Payments', href: `/clubs/archive_payments${scopeQuery}` },
    { id: 'receipts', label: 'Archive of Receipts', href: `/clubs/archive_receipts${scopeQuery}` },
    {
      id: 'pay-selected',
      label: 'Pay more deadlines',
      onClick: handlePaySelected,
      disabled: !canPaySelected,
    },
  ];

  return (
    <ProcedureArchiveShell
      title="Archive of Deadlines"
      activeTab="deadlines"
      tabs={tabs}
      tabActions={
        <div className="w-full">
          <DeadlineTypologyNav />
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-gray-200">
            <ProcedureArchiveTabs tabs={tabs} activeTab="deadlines" />
            <div className="flex items-center gap-4 pb-2 shrink-0">
              <ArchiveScopeRadios state={scope} name="deadlinesScope" onChange={() => setPage(1)} />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
                  checked={displayEveryDeadline}
                  onChange={(e) => {
                    setDisplayEveryDeadline(e.target.checked);
                    setPage(1);
                    setSelectedId(null);
                    clearSelection();
                  }}
                />
                Display every deadlines
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
                  checked={displayAlsoPaid}
                  onChange={(e) => {
                    setDisplayAlsoPaid(e.target.checked);
                    setPage(1);
                    setSelectedId(null);
                    clearSelection();
                  }}
                />
                Display also paid
              </label>
            </div>
          </div>
        </div>
      }
      error={error || selectionError}
      footerHint={
        displayEveryDeadline
          ? 'One row per deadline: records split into instalments show each expire date, amount and rest, as in the payment form. Double-click a deadline to open its record. Delete removes only that deadline (its amount leaves the record total; a paid deadline cannot be deleted). Edit acts on the whole record. Both ask for your password.'
          : 'All typologies. Double-click a row with Rest > 0 to pay, or check several (same member, Rest > 0 — typology can differ) and use Pay more deadlines. Check "Display every deadlines" to list each deadline of a record separately (there, Delete removes a single deadline). Here Edit and Delete act on the whole record and ask for your password.'
      }
    >
      <ArchiveListToolbar
        title="Filter · Archive of Deadlines"
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
        onDeleteSelected={() => requestPassword(deleteSelected)}
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
        columns={displayEveryDeadline ? everyDeadlineColumns : recordColumns}
        rows={data}
        selectedId={selectedId}
        loading={loading}
        selectable
        selectedIds={checkedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onRowClick={(row) => row.id && setSelectedId(row.id)}
        onRowDoubleClick={(row) => {
          if (!row.id || (row.rest ?? 0) <= 0) {
            setSelectionError('Payment is not possible because this deadline is already paid.');
            return;
          }
          const href = paymentHref(row.procedureType, recordIdOf(row));
          if (href) router.push(href);
        }}
      />

      {passwordModal}

      {editTarget && (
        <EditRecordModal
          isOpen
          procedureCode={editTarget.code}
          onClose={() => setEditTarget(null)}
          onSaved={reload}
          record={{
            id: editTarget.record.id,
            recordDate: editTarget.record.recordDate,
            paydate: editTarget.record.paydate,
            expireDate: editTarget.record.expireDate,
            notes: editTarget.record.notes,
            operatorId: editTarget.record.operatorId,
          }}
        />
      )}
    </ProcedureArchiveShell>
  );
}
