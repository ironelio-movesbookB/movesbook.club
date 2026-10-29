'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { shopFetch } from '@/lib/shop/browser';
import { ShopHeader } from '@/components/our-shop/pageChrome';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Line = { id: string; name: string; unitPrice: number; quantity: number };

type Buyer = {
  id: string;
  name: string;
  email: string;
  taxCode: string;
  kind: 'member' | 'customer';
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(price);
}

export default function CreateOrderForm() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [paid, setPaid] = useState(false);
  const [multi, setMulti] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    shopFetch('/api/club/shop/products')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) setCatalog(data);
      })
      .catch(() => undefined);
    shopFetch('/api/club/shop/buyers')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setBuyers([...(data.members ?? []), ...(data.customers ?? [])]);
      })
      .catch(() => undefined);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 8);
    return catalog.filter((product) => product.name.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, query]);

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function addProduct(product: CatalogProduct) {
    setLines((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { id: product.id, name: product.name, unitPrice: product.price, quantity: 1 }];
    });
    setQuery('');
  }

  async function submit() {
    setError('');
    if (lines.length === 0) {
      setError('Add at least one product.');
      return;
    }
    const items = lines.map((line) => ({ productId: line.id, quantity: line.quantity }));
    const chosen = buyers.filter((buyer) => selectedCustomers[buyer.id]);
    if (multi && chosen.length === 0) {
      setError('Select at least one customer.');
      return;
    }
    if (!multi && !selectedBuyer) {
      setError('Select the customer for this order.');
      return;
    }

    setSaving(true);
    try {
      const response = await shopFetch('/api/club/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          multi
            ? {
                items,
                buyers: chosen.map((buyer) => ({
                  ...(buyer.kind === 'member' ? { memberUserId: buyer.id } : { customerId: buyer.id }),
                  paid: Boolean(selectedCustomers[`${buyer.id}:paid`]),
                })),
              }
            : {
                items,
                paid,
                buyer: buyers.find((buyer) => buyer.id === selectedBuyer)?.kind === 'member'
                  ? { memberUserId: selectedBuyer }
                  : { customerId: selectedBuyer },
              },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the order.');
      router.push('/our-shop/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the order.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4 md:space-y-6">
      <ShopHeader title="Order creation" subtitle="Created by club or team staff. One order is saved for each selected customer.">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            <Plus size={17} />
            {saving ? 'Saving...' : 'Create order'}
          </button>
      </ShopHeader>

      <Link href="/our-shop/orders" className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700">
        <ArrowLeft size={16} />
        Return to the list
      </Link>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-semibold text-gray-800">Products</h2>
        <div className="relative mt-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." className={`${inputClass} pl-10`} />
        </div>
        {query && (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
            {matches.map((product) => (
              <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
                <span>{product.name}</span>
                <span className="text-gray-500">{formatPrice(product.price)} · stock {product.quantity}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.id === line.id ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item,
                    ),
                  )
                }
                className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-gray-500">{formatPrice(line.unitPrice)} per unit</p>
              </div>
              <p className="text-sm font-semibold">{formatPrice(line.unitPrice * line.quantity)}</p>
              <button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-2xl font-bold">{formatPrice(total)}</p>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-semibold text-gray-800">Ordering user</h2>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={multi} onChange={(event) => setMulti(event.target.checked)} />
          Assign these products to more than one customer
        </label>

        {!multi ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <select value={selectedBuyer} onChange={(event) => setSelectedBuyer(event.target.value)} className={inputClass}>
                <option value="">Select a member or customer</option>
                {buyers.map((buyer) => (
                  <option key={`${buyer.kind}-${buyer.id}`} value={buyer.id}>
                    {buyer.name} {buyer.kind === 'member' ? '(member)' : '(customer)'}
                  </option>
                ))}
              </select>
            </Field>
            <label className="mt-8 flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />
              Paid
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {buyers.map((buyer) => (
              <label key={`${buyer.kind}-${buyer.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCustomers[buyer.id])}
                    onChange={(event) =>
                      setSelectedCustomers((current) => ({ ...current, [buyer.id]: event.target.checked }))
                    }
                  />
                  {buyer.name}
                  <span className="text-xs text-gray-400">{buyer.kind === 'member' ? 'Member' : 'Customer'}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCustomers[`${buyer.id}:paid`])}
                    onChange={(event) =>
                      setSelectedCustomers((current) => ({ ...current, [`${buyer.id}:paid`]: event.target.checked }))
                    }
                  />
                  Paid
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-500">
          Each customer gets their own order. Every order is written to Archive of Deadlines. A payment is written to Archive of Payments only when Paid is selected.
        </p>
      </section>
    </main>
  );
}
