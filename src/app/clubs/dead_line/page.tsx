'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import ArchiveListToolbar from '@/components/procedures/ArchiveListToolbar';
import { useArchiveListFilters } from '@/components/procedures/useArchiveListFilters';
import ArchiveScopeRadios, { useArchiveScope } from '@/components/procedures/ArchiveScopeRadios';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import {
  DeleteRowButton,
  EditRowButton,
  usePasswordGate,
} from '@/components/procedures/ArchiveRowActions';
import {
  SERVICE_SALE_PAGE_SIZE,
  serviceSaleDeadlineColumns,
} from '@/components/procedures/configs/serviceSale';
import EditRecordModal from '@/components/club/archives/EditRecordModal';
import type { ProcedureTab } from '@/components/procedures/types';
import { Member } from '@/types/clubTable';
import {
  deleteDeadline,
  fetchDeadlines,
  type ServiceSalePurchase,
} from '@/lib/club/serviceSaleClient';

function sameMemberAndOpenRest(rows: Member[]): boolean {
  if (rows.length === 0) return false;
  const firstUserId = rows[0]?.userId;
  if (!firstUserId) return false;
  return rows.every((r) => r.userId === firstUserId && (r.rest ?? 0) > 0);
}

function DeadLinePageInner() {
  const router = useRouter();
  const scope = useArchiveScope();
  const filters = useArchiveListFilters();
  const [data, setData] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(SERVICE_SALE_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [displayAlsoPaid, setDisplayAlsoPaid] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceSalePurchase | null>(null);
  const { request: requestPassword, modal: passwordModal } = usePasswordGate();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDeadlines({
        page,
        pageSize,
        includePaid: displayAlsoPaid,
        ...scope.filters,
        ...filters.applied,
      });
      setTotal(res.total);
      setData(
        res.items.map((p) => {
          const row: Member = {
            id: p.id,
            userId: p.userId,
            name: p.memberName,
            typology: p.typology,
            service: p.serviceName,
            course: p.sectorName,
            insertDate: p.recordDate ?? undefined,
            expirationDate: p.expireDate ?? undefined,
            value: p.value,
            paid: p.pay,
            rest: p.rest,
            casual: p.notes,
            operator: p.operatorName,
            dateEnd: p.lastPaymentDate ?? undefined,
          };

          row.edit = <EditRowButton onClick={() => requestPassword(() => setEditTarget(p))} />;

          row.delete = (
            <DeleteRowButton
              onClick={() =>
                requestPassword(async () => {
                  try {
                    await deleteDeadline(p.id);
                    load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Delete failed');
                  }
                })
              }
            />
          );

          return row;
        })
      );
      setCheckedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, displayAlsoPaid, scope.filters, filters.applied, requestPassword]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters.applied]);

  const checkedRows = useMemo(
    () => data.filter((r) => r.id && checkedIds.has(r.id)),
    [data, checkedIds]
  );

  const canPaySelected =
    checkedRows.length > 1 && sameMemberAndOpenRest(checkedRows);

  function toggleSelect(row: Member) {
    if (!row.id || (row.rest ?? 0) <= 0) return;
    setSelectionError('');
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id!)) next.delete(row.id!);
      else next.add(row.id!);
      return next;
    });
    setSelectedId(row.id);
  }

  function toggleSelectAll(checked: boolean) {
    setSelectionError('');
    if (!checked) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(
      new Set(data.filter((r) => r.id && (r.rest ?? 0) > 0).map((r) => r.id!))
    );
  }

  function handlePaySelected() {
    setSelectionError('');
    if (checkedRows.length < 2) {
      setSelectionError('Select at least two deadlines with Rest > 0.');
      return;
    }
    if (!sameMemberAndOpenRest(checkedRows)) {
      setSelectionError(
        'Checked deadlines must belong to the same member and all have Rest > 0.'
      );
      return;
    }
    const ids = checkedRows.map((r) => r.id!).filter(Boolean);
    const primary = ids[0]!;
    router.push(`/clubs/payment_detail/${primary}?ids=${ids.join(',')}`);
  }

  function handleDeleteSelected() {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    requestPassword(async () => {
      try {
        for (const id of ids) {
          await deleteDeadline(id);
        }
        setCheckedIds(new Set());
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    });
  }

  // A row clicked here scopes the sibling archives; otherwise keep the scope we arrived with.
  const selectedMemberId = useMemo(
    () => (selectedId ? data.find((r) => r.id === selectedId)?.userId ?? null : null),
    [data, selectedId]
  );
  const outgoingQuery = archiveScopeQuery(
    selectedId ?? scope.recordId,
    selectedMemberId ?? scope.memberId
  );

  const tabs: ProcedureTab[] = [
    { id: 'historical', label: 'Historical', href: `/clubs/archive_service_list${outgoingQuery}` },
    {
      id: 'deadline',
      label: 'Archive of Deadlines',
      href: `/clubs/dead_line${outgoingQuery}`,
    },
    {
      id: 'pay-selected',
      label: 'Pay more deadlines',
      onClick: handlePaySelected,
      disabled: !canPaySelected,
    },
    { id: 'payments', label: 'Payments', href: `/clubs/service_payments${outgoingQuery}` },
    { id: 'receipts', label: 'Receipts', href: `/clubs/service_receipts${outgoingQuery}` },
  ];

  return (
    <ProcedureArchiveShell
      title="Archive of Deadlines (Services)"
      activeTab="deadline"
      tabs={tabs}
      tabsTrailing={
        <div className="flex items-center gap-4">
          <ArchiveScopeRadios state={scope} name="deadlinesScope" onChange={() => setPage(1)} />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
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
        </div>
      }
      error={error || selectionError}
      footerHint={
        displayAlsoPaid
          ? 'SERVICES only — showing open and fully paid deadlines. Double-click a row with Rest > 0 to record a payment. Edit and Delete ask for your password.'
          : 'SERVICES only — shows service purchases with remaining balance. Check “Display also paid” to include Rest = 0. Double-click to record a payment. Edit and Delete ask for your password.'
      }
    >
      <ArchiveListToolbar
        title="Filter · Archive of Deadlines (Services)"
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
        columns={serviceSaleDeadlineColumns}
        rows={data}
        selectedId={selectedId}
        loading={loading}
        selectable
        selectedIds={checkedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onRowClick={(row) => row.id && setSelectedId(row.id)}
        onRowDoubleClick={(row) => {
          if (!row.id) return;
          if ((row.rest ?? 0) <= 0) {
            setSelectionError('Payment is not possible because this deadline is already paid.');
            return;
          }
          router.push(`/clubs/payment_detail/${row.id}`);
        }}
      />

      {passwordModal}

      {editTarget && (
        <EditRecordModal
          isOpen
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

export default function DeadLinePage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <DeadLinePageInner />
    </Suspense>
  );
}
