'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { eventApi } from '@/lib/club/events/eventClient';
import { CLUB_EVENT_TYPES, formatEventEuro, todayYmd } from '@/lib/club/events/eventConstants';
import type {
  EventArchiveMoneyRow,
  EventArchiveRow,
  EventArchiveSubscriber,
} from '@/lib/club/events/eventArchiveService';

type SortKey = 'startDate' | 'name' | 'eventType' | 'subscribers' | 'amountDue' | 'paid' | 'rest';
type DetailTab = 'subscribers' | 'payments' | 'receipts';
type Detail = {
  subscribers: EventArchiveSubscriber[];
  payments: EventArchiveMoneyRow[];
  receipts: EventArchiveMoneyRow[];
};

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'startDate', label: 'Date' },
  { key: 'name', label: 'Event' },
  { key: 'eventType', label: 'Type' },
  { key: 'subscribers', label: 'Subscribers' },
  { key: 'amountDue', label: 'Total' },
  { key: 'paid', label: 'Paid' },
  { key: 'rest', label: 'Rest' },
];

function formatDay(ymd: string | null): string {
  if (!ymd) return '-';
  const [y, m, d] = ymd.split('-');
  return d && m && y ? `${d}/${m}/${y}` : ymd;
}

export default function EventsArchivePage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [period, setPeriod] = useState<'all' | 'upcoming' | 'past'>('all');
  const [payFilter, setPayFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [showRemoved, setShowRemoved] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'startDate', dir: 'desc' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('subscribers');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await eventApi<{ events: EventArchiveRow[] }>('/archive');
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    eventApi<Detail>(`/${encodeURIComponent(selectedId)}/archive`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the event');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const rows = useMemo(() => {
    const today = todayYmd();
    const q = search.trim().toLowerCase();
    const list = events.filter((e) => {
      if (!showRemoved && e.removed) return false;
      if (typeFilter && e.eventType !== typeFilter) return false;
      if (period === 'upcoming' && e.endDate < today) return false;
      if (period === 'past' && e.endDate >= today) return false;
      if (payFilter === 'open' && e.rest <= 0) return false;
      if (payFilter === 'paid' && e.rest > 0) return false;
      if (q && !`${e.name} ${e.eventType} ${e.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [events, search, typeFilter, period, payFilter, showRemoved, sort]);

  const selected = events.find((e) => e.id === selectedId) || null;
  const currency = selected?.currency || events[0]?.currency || 'EUR';

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const openPayment = (recordId: string | null) => {
    if (recordId) router.push(`/clubs/events/payment_detail/${encodeURIComponent(recordId)}`);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive of Events</h1>
          <p className="text-sm text-gray-600">
            Events of Manage Events. Select an event to see its subscribers, payments and receipts.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/clubs/events" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
            Manage Events
          </Link>
          <Link
            href="/clubs/events/deadlines"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            Deadlines of events
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Search</span>
          <input
            className="w-56 rounded border border-gray-300 px-2 py-1"
            placeholder="Event, type, place…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Type</span>
          <select className="rounded border border-gray-300 px-2 py-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            {CLUB_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Period</span>
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming / in progress</option>
            <option value="past">Ended</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-600">Payments</span>
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value as typeof payFilter)}
          >
            <option value="all">All</option>
            <option value="open">Still to collect</option>
            <option value="paid">Fully paid</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
          Show removed events
        </label>
        <span className="ml-auto pb-1 text-xs text-gray-500">{rows.length} event(s)</span>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
            <tr>
              {SORTS.map((s) => (
                <th key={s.key} className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort(s.key)}>
                  {s.label}
                  {sort.key === s.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th className="px-3 py-2">Place</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => {
                    setSelectedId(e.id);
                    setTab('subscribers');
                  }}
                  className={`cursor-pointer border-t border-gray-100 hover:bg-yellow-50 ${
                    selectedId === e.id ? 'bg-yellow-100' : ''
                  } ${e.removed ? 'text-gray-400' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDay(e.startDate)}
                    {e.endDate !== e.startDate ? ` – ${formatDay(e.endDate)}` : ''}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {e.name}
                    {e.removed ? <span className="ml-1 text-xs">(removed)</span> : null}
                  </td>
                  <td className="px-3 py-2">{e.eventType}</td>
                  <td className="px-3 py-2">
                    {e.subscribers}
                    {e.subscribers ? <span className="text-xs text-gray-500"> ({e.confirmed} confirmed)</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatEventEuro(e.amountDue, e.currency)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatEventEuro(e.paid, e.currency)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${e.rest > 0 ? 'font-semibold text-red-600' : ''}`}>
                    {formatEventEuro(e.rest, e.currency)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.location || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 pt-3">
            <span className="mr-3 pb-2 font-bold text-gray-900">{selected.name}</span>
            {(['subscribers', 'payments', 'receipts'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-t-md px-3 py-1.5 text-sm font-semibold ${
                  tab === t ? 'bg-[#8B0000] text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t === 'subscribers' ? 'Subscribers' : t === 'payments' ? 'Payments' : 'Receipts'}
                {detail ? ` (${detail[t].length})` : ''}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto p-3">
            {detailLoading || !detail ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : tab === 'subscribers' ? (
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-600">
                  <tr>
                    {['Name', 'Surname', 'Gender', 'Member', 'Status', 'Deadline date', 'Cost', 'Paid', 'Rest', 'N. Invoice'].map(
                      (h) => (
                        <th key={h} className="px-2 py-1.5">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.subscribers.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-t border-gray-100 ${s.rest > 0 && s.procedureRecordId ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                      onDoubleClick={() => (s.rest > 0 ? openPayment(s.procedureRecordId) : undefined)}
                      title={s.rest > 0 && s.procedureRecordId ? 'Double-click to pay' : undefined}
                    >
                      <td className="px-2 py-1.5">{s.name}</td>
                      <td className="px-2 py-1.5">{s.surname}</td>
                      <td className="px-2 py-1.5">{s.gender || '-'}</td>
                      <td className={`px-2 py-1.5 ${s.isMember ? '' : 'text-red-600'}`}>{s.isMember ? 'Member' : 'Non member'}</td>
                      <td className={`px-2 py-1.5 ${s.confirmed ? 'text-emerald-700' : 'text-orange-600'}`}>
                        {s.confirmed ? 'Confirmed' : 'Not confirmed'}
                      </td>
                      <td className="px-2 py-1.5">{formatDay(s.deadlineDate)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{formatEventEuro(s.cost, currency)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{formatEventEuro(s.paid, currency)}</td>
                      <td className={`whitespace-nowrap px-2 py-1.5 ${s.rest > 0 ? 'font-semibold text-red-600' : ''}`}>
                        {formatEventEuro(s.rest, currency)}
                      </td>
                      <td className="px-2 py-1.5">{s.invoice || '-'}</td>
                    </tr>
                  ))}
                  {!detail.subscribers.length ? (
                    <tr>
                      <td colSpan={10} className="px-2 py-4 text-center text-gray-500">
                        No subscribers yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : (
              <MoneyTable rows={detail[tab]} currency={currency} kind={tab} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MoneyTable({
  rows,
  currency,
  kind,
}: {
  rows: EventArchiveMoneyRow[];
  currency: string;
  kind: 'payments' | 'receipts';
}) {
  const headers =
    kind === 'payments'
      ? ['Date', 'Full name', 'Amount', 'Payment mode', 'Operator', 'Notes']
      : ['Date', 'Full name', 'Document', 'Amount', 'Operator', 'Notes'];
  return (
    <table className="min-w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-600">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-2 py-1.5">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-gray-100">
            <td className="px-2 py-1.5">{formatDay(r.date)}</td>
            <td className="px-2 py-1.5">{r.name}</td>
            {kind === 'receipts' ? <td className="px-2 py-1.5">{r.document || '-'}</td> : null}
            <td className="whitespace-nowrap px-2 py-1.5">{formatEventEuro(r.amount, currency)}</td>
            {kind === 'payments' ? <td className="px-2 py-1.5">{r.payMode || '-'}</td> : null}
            <td className="px-2 py-1.5">{r.operator || '-'}</td>
            <td className="px-2 py-1.5">{r.notes || '-'}</td>
          </tr>
        ))}
        {!rows.length ? (
          <tr>
            <td colSpan={6} className="px-2 py-4 text-center text-gray-500">
              {kind === 'payments' ? 'No payments yet.' : 'No receipts yet.'}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
