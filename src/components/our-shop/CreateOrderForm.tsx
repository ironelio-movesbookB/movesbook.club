'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Plus, Search, Trash2 } from 'lucide-react';
import { shopFetch } from '@/lib/shop/browser';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import {
  SELLING_SECTORS,
  isHardwareProductSector,
  productInSector,
  productSectorLabel,
} from '@/lib/shop/sectors';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100';

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sector?: string;
  imageUrl?: string;
};

type Line = { id: string; name: string; unitPrice: number; quantity: number; imageUrl?: string };

function ProductThumb({ src, size = 'h-9 w-9' }: { src?: string; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Package size={16} className="text-gray-400" />
      )}
    </span>
  );
}

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
  const [sectorFilter, setSectorFilter] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [multi, setMulti] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, boolean>>({});
  const [memberQuery, setMemberQuery] = useState('');
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
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Could not load members.');
          return;
        }
        setBuyers([...(data.members ?? []), ...(data.customers ?? [])]);
      })
      .catch(() => setError('Could not load members.'));
  }, []);

  const sellable = useMemo(
    () => catalog.filter((product) => !isHardwareProductSector(product.sector)),
    [catalog],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sellable.filter((product) => {
      if (sectorFilter && !productInSector(product.sector, sectorFilter)) return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q);
    });
  }, [sellable, query, sectorFilter]);

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (buyer) =>
        buyer.name.toLowerCase().includes(q) ||
        buyer.email.toLowerCase().includes(q) ||
        buyer.taxCode.toLowerCase().includes(q),
    );
  }, [buyers, memberQuery]);

  const chosenBuyers = useMemo(() => {
    const ticked = buyers.filter((buyer) => selectedCustomers[buyer.id]);
    if (ticked.length > 0) return ticked;
    if (selectedBuyer) {
      const fromDropdown = buyers.find((buyer) => buyer.id === selectedBuyer);
      if (fromDropdown) return [fromDropdown];
    }
    return [];
  }, [buyers, selectedCustomers, selectedBuyer]);

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function addProduct(product: CatalogProduct) {
    setLines((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        { id: product.id, name: product.name, unitPrice: product.price, quantity: 1, imageUrl: product.imageUrl },
      ];
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
    const chosen = multi ? chosenBuyers : [];
    if (multi && chosen.length === 0) {
      setError('Tick at least one member below. Each ticked person gets their own selling.');
      document.getElementById('shop-ordering-user')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                })),
              }
            : {
                items,
                buyer:
                  buyers.find((buyer) => buyer.id === selectedBuyer)?.kind === 'member'
                    ? { memberUserId: selectedBuyer }
                    : { customerId: selectedBuyer },
              },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create the order.');
      const created = Array.isArray(data.orders) ? data.orders : [];
      const recordId = created.length === 1 ? created[0]?.procedureRecordId : '';
      const saleClubId = created.length === 1 ? created[0]?.clubId : '';
      if (recordId) {
        const clubQuery = saleClubId ? `&clubId=${encodeURIComponent(saleClubId)}` : '';
        router.push(`/clubs/payment_detail/${encodeURIComponent(recordId)}?type=product_sale${clubQuery}`);
        return;
      }
      router.push('/clubs/shop/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the order.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ShopFrame>
      <ShopHeader
        title="Panel of sellings"
        subtitle="Select products, close the selling, then the standard payment form opens."
      >
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          <Plus size={17} />
          {saving ? 'Saving...' : 'Close the selling'}
        </button>
      </ShopHeader>

      <Link href="/clubs/shop/orders" className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700">
        <ArrowLeft size={16} />
        Return to the list
      </Link>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-semibold text-gray-800">Products</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Sector">
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              className={inputClass}
            >
              <option value="">All</option>
              {SELLING_SECTORS.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </Field>
          <div className="relative mt-7">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products..."
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-200">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">No products in this sector.</p>
          ) : (
            matches.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb src={product.imageUrl} />
                  <span className="min-w-0 truncate">{product.name}</span>
                </span>
                <span className="shrink-0 text-gray-500">
                  {productSectorLabel(product.sector)} · {formatPrice(product.price)} · stock {product.quantity}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
              <ProductThumb src={line.imageUrl} size="h-11 w-11" />
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.id === line.id
                        ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : item,
                    ),
                  )
                }
                className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm"
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{line.name}</p>
              <div className="w-24 shrink-0 text-right">
                <p className="text-xs text-gray-500">Unit price</p>
                <p className="text-sm tabular-nums text-gray-700">{formatPrice(line.unitPrice)}</p>
              </div>
              <div className="w-24 shrink-0 text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-semibold tabular-nums">{formatPrice(line.unitPrice * line.quantity)}</p>
              </div>
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                className="text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-right text-2xl font-bold">{formatPrice(total)}</p>
      </section>

      <section id="shop-ordering-user" className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-semibold text-gray-800">Ordering user</h2>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={multi}
            onChange={(event) => {
              const on = event.target.checked;
              setMulti(on);
              if (on && selectedBuyer) {
                setSelectedCustomers((current) => ({ ...current, [selectedBuyer]: true }));
              }
            }}
          />
          Assign these products to more than one customer
        </label>

        {!multi ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Member">
              <select
                value={selectedBuyer}
                onChange={(event) => setSelectedBuyer(event.target.value)}
                className={inputClass}
              >
                <option value="">Select a member</option>
                {buyers.map((buyer) => (
                  <option key={`${buyer.kind}-${buyer.id}`} value={buyer.id}>
                    {buyer.name} {buyer.kind === 'member' ? '(member)' : '(customer)'}
                  </option>
                ))}
              </select>
            </Field>
            <p className="mt-8 text-sm text-gray-600">
              Closing the selling opens the payment form. Pay now, or send the member a PayPal or Stripe link from that form.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">
              Tick every member who should get this selling. {chosenBuyers.length} selected.
            </p>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Search members..."
                className={`${inputClass} pl-10`}
              />
            </div>
            {buyers.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No members found for this club. Add them from the club member list, then try again.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {memberMatches.map((buyer) => (
                  <label
                    key={`${buyer.kind}-${buyer.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedCustomers[buyer.id])}
                        onChange={(event) =>
                          setSelectedCustomers((current) => ({ ...current, [buyer.id]: event.target.checked }))
                        }
                      />
                      {buyer.name}
                      <span className="text-xs text-gray-400">
                        {buyer.kind === 'member' ? 'Member' : 'Customer'}
                      </span>
                    </span>
                  </label>
                ))}
                {memberMatches.length === 0 ? (
                  <p className="text-sm text-gray-500">No member matches that search.</p>
                ) : null}
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-gray-500">
          Each customer gets their own selling and their own deadline. Payment is done afterwards in the standard payment form.
        </p>
      </section>
    </ShopFrame>
  );
}
