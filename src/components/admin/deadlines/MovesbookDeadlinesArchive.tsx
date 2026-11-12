'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil, X } from 'lucide-react';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import ProcedurePagination from '@/components/procedures/ProcedurePagination';
import type { Column, Member } from '@/types/clubTable';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import {
  DEADLINE_PAY_MODES,
  MOVESBOOK_TYPOLOGIES,
  type MovesbookDeadlineRow,
  type MovesbookTypology,
} from '@/lib/movesbookDeadlines/movesbookDeadlines.shared';

type ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  totals: { amountEur: number; paidEur: number; restEur: number };
  items: MovesbookDeadlineRow[];
};

type Filters = { search: string; fromDate: string; toDate: string; order: string };
const EMPTY_FILTERS: Filters = { search: '', fromDate: '', toDate: '', order: 'due_asc' };
const API = '/api/admin/movesbook-deadlines';

function euro(value: number | undefined): string {
  return `€${(value ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dmy(value: string | null | undefined): string {
  if (!value) return '-';
  const d = value.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : value;
}

async function authFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminBearerToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
}

/**
 * Archive of Deadlines of the payments users owe to Movesbook — same layout as the club
 * Archive of Deadlines, with the Movesbook product sectors (A–G) as typologies.
 */
export default function MovesbookDeadlinesArchive() {
  const [typology, setTypology] = useState<MovesbookTypology | ''>('');
  const [includePaid, setIncludePaid] = useState(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<MovesbookDeadlineRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), order: filters.order });
      if (typology) qs.set('typology', typology);
      if (includePaid) qs.set('includePaid', '1');
      if (filters.search) qs.set('search', filters.search);
      if (filters.fromDate) qs.set('fromDate', filters.fromDate);
      if (filters.toDate) qs.set('toDate', filters.toDate);
      setData(await authFetch<ListResponse>(`${API}?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the deadlines.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typology, includePaid, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = new Map((data?.items ?? []).map((d) => [d.id, d]));
  const rows: Member[] = (data?.items ?? []).map((d) => ({
    id: d.id,
    userId: d.userId,
    name: d.fullName,
    username: d.username,
    typology: d.typologyLabel,
    service: d.detail,
    deadlineNo: `${d.deadlineNo}/${d.deadlinesTotal}`,
    insertDate: d.createdAt,
    expirationDate: d.dueDate,
    value: d.amountEur,
    paid: d.paidEur,
    rest: d.restEur,
    dateEnd: d.paidAt ?? undefined,
    casual: [d.payMode, d.notes].filter(Boolean).join(' — '),
    operator: d.operator ?? '',
    edit:
      d.restEur > 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPaying(d);
          }}
          className="text-teal-700 hover:text-teal-900"
          title="Register a payment"
          aria-label={`Register a payment for ${d.fullName}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <span className="text-xs font-semibold text-green-700">Paid</span>
      ),
  }));

  const columns: Column[] = [
    { key: 'name', header: 'Full Name', sortable: false },
    { key: 'typology', header: 'Typology', sortable: false },
    { key: 'service', header: 'Detail', sortable: false },
    { key: 'deadlineNo', header: 'Deadline', sortable: false },
    { key: 'insertDate', header: 'Date', sortable: false, render: (v) => dmy(v) },
    { key: 'expirationDate', header: 'Expiration Date', sortable: false, render: (v) => dmy(v) },
    { key: 'value', header: 'Cost', sortable: false, render: (v) => euro(v) },
    { key: 'paid', header: 'Paid', sortable: false, render: (v) => euro(v) },
    { key: 'rest', header: 'Rest', sortable: false, render: (v) => euro(v) },
    { key: 'dateEnd', header: 'Last payment', sortable: false, render: (v) => dmy(v) },
    { key: 'casual', header: 'Notes', sortable: false },
    { key: 'operator', header: 'Operator', sortable: false },
    { key: 'edit', header: 'Edit', sortable: false },
  ];

  const applyFilters = (e?: FormEvent) => {
    e?.preventDefault();
    setFilters(draft);
    setPage(1);
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg bg-teal-800 px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">Archive of Deadlines — Movesbook</h1>
        <Link
          href="/admin/payments"
          className="rounded bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-yellow-300"
        >
          Archive of Payments
        </Link>
      </div>

      <div className="rounded-b-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center gap-1">
          <span className="mr-2 text-xs font-bold text-red-600">Deadlines incoming - Payment will be IN</span>
          <TypologyPill label="All" active={typology === ''} onClick={() => { setTypology(''); setPage(1); }} />
          {(Object.keys(MOVESBOOK_TYPOLOGIES) as MovesbookTypology[]).map((code) => (
            <TypologyPill
              key={code}
              label={`${code} - ${MOVESBOOK_TYPOLOGIES[code]}`}
              active={typology === code}
              onClick={() => {
                setTypology(code);
                setPage(1);
              }}
            />
          ))}
        </div>

        <div className="mb-3 flex items-end gap-1 border-b border-gray-200">
          <span className="border-b-2 border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800">
            Archive of Deadlines
          </span>
          <Link href="/admin/payments" className="px-3 py-2 text-sm text-gray-600 hover:text-teal-800">
            Archive of Payments
          </Link>
          <label className="ml-auto flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includePaid}
              onChange={(e) => {
                setIncludePaid(e.target.checked);
                setPage(1);
              }}
            />
            Display also paid
          </label>
        </div>

        <form onSubmit={applyFilters} className="mb-3 grid gap-3 rounded border border-teal-100 bg-teal-50/40 p-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <label className="text-sm">
            <span className="block text-xs text-gray-600">Search</span>
            <input
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="Name, username, detail, notes…"
              className="h-9 w-full rounded border border-gray-300 px-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-600">From</span>
            <input type="date" value={draft.fromDate} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} className="h-9 rounded border border-gray-300 px-2" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-600">To</span>
            <input type="date" value={draft.toDate} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} className="h-9 rounded border border-gray-300 px-2" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-600">Order</span>
            <select value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value })} className="h-9 rounded border border-gray-300 px-2">
              <option value="due_asc">Expiration date ↑</option>
              <option value="due_desc">Expiration date ↓</option>
              <option value="recent">Most recent</option>
              <option value="name">Full name</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-9 rounded bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
              Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="h-9 rounded border border-gray-300 px-4 text-sm"
            >
              Clear
            </button>
          </div>
        </form>

        {data && (
          <p className="mb-2 text-sm text-gray-700">
            {data.total} deadline{data.total === 1 ? '' : 's'} — Cost <strong>{euro(data.totals.amountEur)}</strong>, Paid{' '}
            <strong className="text-green-700">{euro(data.totals.paidEur)}</strong>, Rest{' '}
            <strong className="text-red-700">{euro(data.totals.restEur)}</strong>
          </p>
        )}
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <ProcedureArchiveTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No deadlines found."
          getRowClassName={(row) => (byId.get(String(row.id))?.overdue ? 'text-red-700' : '')}
          bordered
        />

        {data && data.total > 0 && (
          <ProcedurePagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
        <p className="mt-2 text-xs text-gray-500">Overdue deadlines (expired and not fully paid) are shown in red.</p>
      </div>

      {paying && (
        <PayDeadlineModal
          deadline={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function TypologyPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-[13px] font-bold text-white shadow-sm ${
        active ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-[#222] hover:bg-black'
      }`}
    >
      {label}
    </button>
  );
}

function PayDeadlineModal({
  deadline,
  onClose,
  onPaid,
}: {
  deadline: MovesbookDeadlineRow;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState(deadline.restEur.toFixed(2));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [payMode, setPayMode] = useState<string>(DEADLINE_PAY_MODES[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await authFetch(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'pay', id: deadline.id, amountEur: Number(amount.replace(',', '.')), paidOn, payMode, notes }),
      });
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-teal-800 px-4 py-3 text-white">
          <h2 className="font-semibold">Register a payment</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <p>
            <strong>{deadline.fullName}</strong> — {deadline.detail}
            <br />
            Deadline {deadline.deadlineNo}/{deadline.deadlinesTotal}, expiring {dmy(deadline.dueDate)}. Rest to pay:{' '}
            <strong>{euro(deadline.restEur)}</strong>
          </p>
          <label className="block">
            <span className="text-xs text-gray-600">Amount paid (€)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="h-9 w-full rounded border border-gray-300 px-2" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Payment date</span>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="h-9 w-full rounded border border-gray-300 px-2" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Pay mode</span>
            <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="h-9 w-full rounded border border-gray-300 px-2">
              {DEADLINE_PAY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className="h-9 w-full rounded border border-gray-300 px-2" />
          </label>
          {error && <p className="text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save payment
          </button>
        </div>
      </form>
    </div>
  );
}
