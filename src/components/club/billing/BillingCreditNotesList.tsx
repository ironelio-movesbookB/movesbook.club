'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  BILLING_INVOICE_DIRECTIONS,
  BILLING_REIMBURSEMENT_MODES,
  formatEuro,
  formatYmd,
  type BillingCreditNote,
  type BillingInvoiceDirection,
} from '@/lib/club/clubBilling.constants';

type SortKey = 'date' | 'number' | 'supplier';

export default function BillingCreditNotesList({
  initialDirection = 'outgoing',
}: {
  initialDirection?: BillingInvoiceDirection;
}) {
  const { t } = useLanguage();
  const yearNow = new Date().getFullYear();
  const [items, setItems] = useState<BillingCreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<BillingInvoiceDirection>(initialDirection);
  const [year, setYear] = useState(yearNow);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [mode, setMode] = useState('');
  const [pendingDelete, setPendingDelete] = useState<BillingCreditNote | null>(null);
  const [busy, setBusy] = useState(false);

  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const qs = new URLSearchParams({ direction, year: String(year) });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const data = await clubApiFetch<{ items: BillingCreditNote[] }>(`/api/club/billing/credit-notes?${qs}`);
      if (seq !== requestSeq.current) return;
      setItems(data.items);
      setError('');
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load credit notes');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [direction, from, to, year]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const years = useMemo(() => {
    const set = new Set<number>([yearNow, year]);
    for (const item of items) set.add(Number(item.creditNoteDate.slice(0, 4)));
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [items, year, yearNow]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.partyId, item.partyName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  }, [items]);

  const rows = useMemo(() => {
    let list = [...items];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        `${c.documentNumber} ${c.partyName} ${c.fiscalCode} ${c.invoiceReference} ${c.causal} ${c.budgetCategory}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (supplier) list = list.filter((c) => c.partyId === supplier);
    if (mode) list = list.filter((c) => c.reimbursementMode === mode);
    list.sort((a, b) => {
      if (sortBy === 'number') return a.documentNumber.localeCompare(b.documentNumber, undefined, { numeric: true });
      if (sortBy === 'supplier') return a.partyName.localeCompare(b.partyName, undefined, { sensitivity: 'base' });
      return b.creditNoteDate.localeCompare(a.creditNoteDate);
    });
    return list;
  }, [items, mode, search, sortBy, supplier]);

  const partyHeader = direction === 'incoming' ? 'Supplier' : 'Customer / supplier';

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError('');
    try {
      await clubApiFetch(`/api/club/billing/credit-notes/${encodeURIComponent(pendingDelete.id)}`, {
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
          <h1 className="text-lg font-semibold text-gray-900">Credit notes</h1>
          <p className="text-xs text-gray-500"><span>Billing</span> &gt; <span>Credit notes</span></p>
        </div>
        <Link
          href={`/club/billing/credit-notes/new?type=${direction}`}
          className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <FilePlus2 className="h-4 w-4" />
          Create new
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-gray-200 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Type
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as BillingInvoiceDirection);
              setSupplier('');
            }}
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
          {partyHeader}
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {suppliers.map(([id, name]) => (
              <option key={id} value={id} translate="no">
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Mode of reimbursement
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {BILLING_REIMBURSEMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
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
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="NC, supplier, reference"
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
            <p className="text-base font-semibold text-gray-800">No credit note entered</p>
            <p className="mt-1 text-sm text-gray-500">Click &quot;Create new&quot; to start</p>
          </div>
        ) : (
          <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
            <thead>
              <tr className="bg-[#efe7b3] text-left text-gray-900">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Date registration</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Date note credit</th>
                <th className="px-3 py-2 font-semibold">N. NC</th>
                <th className="px-3 py-2 font-semibold">{partyHeader}</th>
                <th className="px-3 py-2 font-semibold">Fiscal code</th>
                <th className="px-3 py-2 font-semibold">Invoice ref.</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Date invoice</th>
                <th className="px-3 py-2 font-semibold">Causal</th>
                <th className="px-3 py-2 font-semibold">Value</th>
                <th className="px-3 py-2 font-semibold">%</th>
                <th className="px-3 py-2 font-semibold">VAT</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Contability section</th>
                <th className="px-3 py-2 font-semibold">Mode of reimbursement</th>
                <th className="px-3 py-2 font-semibold">Options</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="bg-[#e8f4fc]">
                  <td className="whitespace-nowrap px-3 py-2">{formatYmd(c.registrationDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatYmd(c.creditNoteDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2" translate="no">
                    {c.documentNumber}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    <Link href={`/club/billing/parties/${c.partyId}`} className="text-blue-700 hover:underline">
                      {c.partyName}
                    </Link>
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {c.fiscalCode || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2" translate="no">
                    {c.invoiceReference || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{c.invoiceDate ? formatYmd(c.invoiceDate) : '—'}</td>
                  <td className="px-3 py-2" translate="no">
                    {c.causal || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" translate="no">
                    {formatEuro(c.netAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" translate="no">
                    {c.vatRate}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" translate="no">
                    {formatEuro(c.vatAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold" translate="no">
                    {formatEuro(c.totalAmount)}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {c.budgetCategory || '—'}
                  </td>
                  <td className="px-3 py-2">{c.reimbursementMode || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Link href={`/club/billing/credit-notes/${c.id}`} className="rounded p-1 text-gray-700 hover:bg-white/70" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button type="button" onClick={() => setPendingDelete(c)} className="rounded p-1 text-red-700 hover:bg-white/70" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PromocodeConfirmModal
        open={pendingDelete !== null}
        title={translateSportLabel(t, 'Delete credit note')}
        message={translateSportLabel(t, 'Delete this credit note?')}
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
