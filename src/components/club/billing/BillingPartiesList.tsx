'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import type { BillingParty, BillingPartyKind } from '@/lib/club/clubBilling.constants';

export default function BillingPartiesList() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const kindParam = searchParams?.get('kind');
  const initialKind: 'all' | BillingPartyKind =
    kindParam === 'customer' || kindParam === 'supplier' || kindParam === 'both' ? kindParam : 'all';
  const [items, setItems] = useState<BillingParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | BillingPartyKind>(initialKind);
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('name');
  const [pendingDelete, setPendingDelete] = useState<BillingParty | null>(null);
  const [busy, setBusy] = useState(false);

  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const data = await clubApiFetch<{ items: BillingParty[] }>(
        `/api/club/billing/parties?kind=${encodeURIComponent(kind)}`,
      );
      if (seq !== requestSeq.current) return;
      setItems(data.items);
      setError('');
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter((p) =>
          `${p.name} ${p.vatNumber} ${p.fiscalCode} ${p.email} ${p.city}`.toLowerCase().includes(q),
        )
      : [...items];
    if (sortBy === 'recent') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return list;
  }, [items, search, sortBy]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError('');
    try {
      await clubApiFetch(`/api/club/billing/parties/${encodeURIComponent(pendingDelete.id)}`, {
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
          <h1 className="text-lg font-semibold text-gray-900">Customers and suppliers</h1>
          <p className="text-xs text-gray-500"><span>Billing</span> &gt; <span>Customers and suppliers</span></p>
        </div>
        <Link
          href="/club/billing/parties/new"
          className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <FilePlus2 className="h-4 w-4" />
          Add customer/supplier
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-gray-200 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, VAT, fiscal code"
            className="mt-1 w-64 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="customer">Customers</option>
            <option value="supplier">Suppliers</option>
            <option value="both">Customer and supplier</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'recent')}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="name">Name</option>
            <option value="recent">Date added</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto border border-t-0 border-gray-300 bg-white">
        <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
          <thead>
            <tr className="bg-[#efe7b3] text-left text-gray-900">
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">VAT number</th>
              <th className="px-3 py-2 font-semibold">Fiscal code</th>
              <th className="px-3 py-2 font-semibold">City</th>
              <th className="px-3 py-2 font-semibold">Options</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No customers or suppliers yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="bg-[#e8f4fc]">
                  <td className="px-3 py-2" translate="no">
                    <Link href={`/club/billing/parties/${p.id}`} className="font-medium text-violet-800 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.kind === 'both' ? 'Customer and supplier' : p.kind === 'customer' ? 'Customer' : 'Supplier'}</td>
                  <td className="px-3 py-2" translate="no">
                    {p.vatNumber || '—'}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {p.fiscalCode || '—'}
                  </td>
                  <td className="px-3 py-2" translate="no">
                    {p.city || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/club/billing/parties/${p.id}`}
                        className="rounded p-1 text-gray-700 hover:bg-white/70"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(p)}
                        className="rounded p-1 text-red-700 hover:bg-white/70"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PromocodeConfirmModal
        open={pendingDelete !== null}
        title={translateSportLabel(t, 'Delete customer/supplier')}
        message={translateSportLabel(t, 'Delete this customer or supplier?')}
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
