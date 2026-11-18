'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Package,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import { shopFetch } from '@/lib/shop/browser';
import { SHOP_SECTOR_TITLE, isHardwareProductSector, shopSector, shopSectorFromPath } from '@/lib/shop/sectors';

type Product = {
  id: string;
  clubId: string;
  name: string;
  description: string;
  price: number;
  vatRate: number;
  quantity: number;
  imageUrl: string;
  isVisible: boolean;
  sector?: string;
  createdAt?: string;
  updatedAt?: string;
};

const currency = (amount: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

function normalizeProduct(value: Product): Product {
  return {
    ...value,
    price: Number(value.price) || 0,
    vatRate: Number(value.vatRate) || 0,
    quantity: Number(value.quantity) || 0,
    sector: value.sector || 'Shop',
    isVisible:
      value.isVisible === true ||
      String(value.isVisible).toLowerCase() === 'true',
  };
}

function ProductImage({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [product.imageUrl]);

  if (product.imageUrl && !imageFailed) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-400">
      <Package size={25} strokeWidth={1.5} />
    </div>
  );
}

function ShopShareCard({
  shopUrl,
  linkFailed,
}: {
  shopUrl: string;
  linkFailed: boolean;
}) {
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Visit our online shop',
          url: shopUrl,
        });
      } else {
        await navigator.clipboard.writeText(shopUrl);
        window.alert('Shop link copied to clipboard.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      try {
        await navigator.clipboard.writeText(shopUrl);
        window.alert('Shop link copied to clipboard.');
      } catch {
        window.prompt('Copy your shop link:', shopUrl);
      }
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    shopUrl,
  )}`;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Your online shop
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Share your shop with customers.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2"
            >
              Share
            </button>

            <a
              href={shopUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-200"
            >
              Open e-commerce
            </a>
          </div>

          <p className="mt-4 break-all text-xs text-gray-400">
            {shopUrl}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:flex-col sm:gap-2">
          <div className="flex h-[104px] w-[104px] items-center justify-center rounded-lg bg-white">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="QR code for your online shop"
                className="h-[100px] w-[100px]"
              />
            ) : (
              <span className="px-2 text-center text-[11px] leading-4 text-gray-400">
                {linkFailed ? 'QR unavailable' : 'Loading QR...'}
              </span>
            )}
          </div>

          <div className="sm:text-center">
            <p className="text-sm font-semibold text-gray-800">
              Shop QR code
            </p>
            <p className="mt-1 max-w-[150px] text-xs leading-5 text-gray-500">
              Customers can scan this code to visit your shop.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  selected,
  onSelect,
  showSector,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  showSector?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border px-4 py-4 shadow-sm transition sm:px-5 ${
        selected
          ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-300'
          : 'border-gray-100 bg-white hover:border-purple-100 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              selected ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-300 bg-white text-transparent'
            }`}
            aria-hidden="true"
          >
            <Check size={14} strokeWidth={3} />
          </span>
        <ProductImage product={product} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                {product.name}
              </h3>
              {selected ? (
                <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Selected
                </span>
              ) : null}
            </div>
            {showSector ? (
              <p className="mt-0.5 text-xs text-gray-400">{shopSector(product.sector)}</p>
            ) : null}
          </div>

          <div className="w-24 shrink-0 sm:w-32">
            <p className="text-[11px] text-gray-400 sm:text-xs">
              Gross price
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-800">
              {currency(product.price)}
            </p>
          </div>

          <div className="w-20 shrink-0 sm:w-28">
            <p className="text-[11px] text-gray-400 sm:text-xs">
              Qty in Stock
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                product.quantity === 0
                  ? 'text-red-600'
                  : product.quantity <= 5
                    ? 'text-amber-600'
                    : 'text-gray-800'
              }`}
            >
              {product.quantity}
            </p>
          </div>
        </button>

        <Link
          href={`/clubs/shop/products/${encodeURIComponent(product.id)}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-50 sm:px-4"
        >
          <Pencil size={15} />
          <span>Edit</span>
        </Link>
      </div>
    </article>
  );
}

export default function ProductsPage() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const sector = shopSectorFromPath(pathname);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [shopUrl, setShopUrl] = useState('');
  const [shopLinkFailed, setShopLinkFailed] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const listed = products.filter((product) => {
    const productSector = shopSector(product.sector);
    if (sector === 'All') return !isHardwareProductSector(productSector);
    return productSector === sector;
  });
  const addSector = sector === 'All' ? 'Shop' : sector;
  const selectedProduct = listed.find((product) => product.id === selectedProductId) ?? null;

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await shopFetch('/api/club/shop/products');

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === 'string' && body.error ? body.error : 'Unable to load products.',
        );
      }

      const data = await response.json();

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
          ? data.products
          : [];

      setProducts(items.map(normalizeProduct));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading products.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    shopFetch('/api/club/shop/settings')
      .then(async (response) => {
        const data = response.ok ? await response.json() : null;
        if (typeof data?.publicPath === 'string' && data.publicPath) {
          setShopUrl(`${window.location.origin}${data.publicPath}`);
        } else {
          setShopLinkFailed(true);
        }
      })
      .catch(() => setShopLinkFailed(true));
  }, [loadProducts]);

  return (
    <ShopFrame>
        <ShopHeader
          title={SHOP_SECTOR_TITLE[sector]}
          subtitle={
            loading
              ? 'Loading your products...'
              : sector === 'Hardware'
                ? `${listed.length} ${listed.length === 1 ? 'product' : 'products'} · Super Admin password required to insert, edit, or delete`
                : sector === 'All'
                  ? `${listed.length} ${listed.length === 1 ? 'product' : 'products'} · Bar, Restaurant, Shop (no hardware)`
                : `${listed.length} ${listed.length === 1 ? 'product' : 'products'} · Insert and edit products`
          }
        >
          <button
            type="button"
            onClick={() => {
              if (!selectedProduct) {
                window.alert('Select a product in the list first.');
                return;
              }
              const params = new URLSearchParams({
                productId: selectedProduct.id,
                productName: selectedProduct.name,
              });
              router.push(`/ArchiveSeles/product_sale_list?${params.toString()}`);
            }}
            className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
              selectedProduct
                ? 'bg-teal-700 text-white hover:bg-teal-800'
                : 'border border-teal-700 bg-white text-teal-800 hover:bg-teal-50'
            }`}
          >
            Details of the product
          </button>
          <button
            type="button"
            onClick={() => void loadProducts(true)}
            disabled={loading || refreshing}
            aria-label="Refresh products"
            title="Refresh products"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-300 bg-white text-purple-700 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <Link
            href={`/clubs/shop/products/new?sector=${encodeURIComponent(addSector)}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Plus size={18} />
            Add product
          </Link>
        </ShopHeader>

        <ShopShareCard shopUrl={shopUrl} linkFailed={shopLinkFailed} />

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Could not load products</p>
                <p className="mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadProducts(true)}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white px-6 py-16">
              <RefreshCw
                size={25}
                className="animate-spin text-purple-700"
              />
              <p className="mt-4 text-sm text-gray-500">
                Loading your products...
              </p>
            </div>
          ) : listed.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                <Package size={27} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">
                No products yet
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Add your first product to start building your online shop.
              </p>
              <Link
                href={`/clubs/shop/products/new?sector=${encodeURIComponent(addSector)}`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800"
              >
                <Plus size={17} />
                Add your first product
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {listed.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={selectedProductId === product.id}
                  showSector={sector === 'All'}
                  onSelect={() =>
                    setSelectedProductId((current) => (current === product.id ? null : product.id))
                  }
                />
              ))}
            </div>
          )}
    </ShopFrame>
  );
}