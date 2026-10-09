'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  BILLING_DOC_ORIGINS,
  BILLING_INVOICE_DIRECTIONS,
  formatEuro,
  formatYmd,
  type BillingInvoice,
} from '@/lib/club/clubBilling.constants';

type SortKey = 'date' | 'number' | 'supplier';

export default function BillingInvoicesList({
  initialDirection = 'outgoing',
}: {
  initialDirection?: 'outgoing' | 'incoming';
}) {
  const { t } = useLanguage();
  const yearNow = new Date().getFullYear();
  const [items, setItems] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>(initialDirection);
  const [year, setYear] = useState(yearNow);
  const [origin, setOrigin] = useState('all');
  const [payment, setPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pendingDelete, setPendingDelete] = useState<BillingInvoice | null>(null);
  const [busy, setBusy] = useState(false);

  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const qs = new URLSearchParams({
        direction,
        year: String(year),
        origin,
      });
      const data = await clubApiFetch<{ items: BillingInvoice[] }>(`/api/club/billing/invoices?${qs}`);
      if (seq !== requestSeq.current) return;
      setItems(data.items);
      setError('');
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [direction, origin, year]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const years = useMemo(() => {
    const set = new Set<number>([yearNow, year]);
    for (const item of items) set.add(Number(item.invoiceDate.slice(0, 4)));
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [items, year, yearNow]);

  const rows = useMemo(() => {
    let list = [...items];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        `${i.documentNumber} ${i.partyName} ${i.fiscalCode} ${i.productName}`.toLowerCase().includes(q),
      );
    }
    if (from) list = list.filter((i) => i.invoiceDate >= from);
    if (to) list = list.filter((i) => i.invoiceDate <= to);
    if (payment !== 'all') list = list.filter((i) => i.paid === (payment === 'paid'));
    list.sort((a, b) => {
      if (sortBy === 'number') return a.documentNumber.localeCompare(b.documentNumber, undefined, { numeric: true });
      if (sortBy === 'supplier') return a.partyName.localeCompare(b.partyName, undefined, { sensitivity: 'base' });
      return b.invoiceDate.localeCompare(a.invoiceDate);
    });
    return list;
  }, [from, items, payment, search, sortBy, to]);

  const partyHeader = direction === 'incoming' ? 'Supplier' : 'Customer / supplier';

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError('');
    try {
      await clubApiFetch(`/api/club/billing/invoices/${encodeURIComponent(pendingDelete.id)}`, {
        method: 'DELETE',
      });
      setPendingDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Invoices</h1>
          <p className="text-xs text-gray-500"><span>Billing</span> &gt; <span>Invoices</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/club/billing/invoices/new?type=${direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
            className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
          >
            <FilePlus2 className="h-4 w-4" />
            Create new
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-gray-200 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Type
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'outgoing' | 'incoming')}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {BILLING_INVOICE_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Current year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Origin
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
            {BILLING_DOC_ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Payment status
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as 'all' | 'paid' | 'unpaid')}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number, supplier, fiscal code"
            className="mt-1 w-56 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="date">Date</option>
            <option value="number">Number</option>
            <option value="supplier">Supplier</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto border border-t-0 border-gray-300 bg-white">
        {loading ? (
          <p className="px-3 py-8 text-center text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <p className="text-base font-semibold text-gray-800">No invoices entered</p>
            <p className="mt-1 text-sm text-gray-500">Click &apos;Create new&apos; to start</p>
          </div>
        ) : (
          <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
            <thead>
              <tr className="bg-[#efe7b3] text-left text-gray-900">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Number</th>
                <th className="px-3 py-2 font-semibold">{partyHeader}</th>
                <th className="px-3 py-2 font-semibold">Fiscal code</th>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">Net</th>
                <th className="px-3 py-2 font-semibold">VAT</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Origin</th>
                <th className="px-3 py-2 font-semibold">Payment</th>
                <th className="px-3 py-2 font-semibold">Options</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className={i.source === 'shop' ? 'bg-[#f3f0ff]' : 'bg-[#e8f4fc]'}>
                  <td className="whitespace-nowrap px-3 py-2">{formatYmd(i.invoiceDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2" translate="no">
                    {i.documentNumber || '—'}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {i.partyId ? (
                      <Link href={`/club/billing/parties/${i.partyId}`} className="text-blue-700 hover:underline">
                        {i.partyName}
                      </Link>
                    ) : (
                      i.partyName || '—'
                    )}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {i.fiscalCode || '—'}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {i.productName || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" translate="no">
                    {formatEuro(i.netAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" translate="no">
                    {i.source === 'shop' ? '—' : i.vatExempt ? 'Exempt' : `${i.vatRate}%`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold" translate="no">
                    {formatEuro(i.totalAmount)}
                  </td>
                  <td className="px-3 py-2">
                    {i.source === 'shop'
                      ? 'Shop'
                      : i.partyKind === 'supplier'
                        ? 'Supplier'
                        : i.partyKind === 'both'
                          ? 'Customer and supplier'
                          : 'Customer'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        i.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {i.paid ? 'Paid' : 'Not paid'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {i.source === 'shop' ? (
                      <Link href="/ArchiveSeles/product_sale_list" className="text-xs text-blue-700 hover:underline">
                        Open in Shop
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Link href={`/club/billing/invoices/${i.id}`} className="rounded p-1 text-gray-700 hover:bg-white/70" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={() => setPendingDelete(i)} className="rounded p-1 text-red-700 hover:bg-white/70" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PromocodeConfirmModal
        open={pendingDelete !== null}
        title={translateSportLabel(t, 'Delete invoice')}
        message={translateSportLabel(t, 'Delete this invoice?')}
        confirmLabel={translateSportLabel(t, 'Delete')}
        cancelLabel={translateSportLabel(t, 'Cancel')}
        destructive
        loading={busy}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
