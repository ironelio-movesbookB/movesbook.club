
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  Store,
  RefreshCw,
  X,
  Eye,
  ArrowRight,
  Package,
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { CartNotice } from '@/components/our-shop/CartNotice';
import { shopFetch } from '@/lib/shop/browser';
import { cartAddBlockReason } from '@/lib/shop/cartRules';

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
  allowMultipleUnits?: boolean;
  allowNonMembers?: boolean;
};

type ShopData = {
  club: {
    id: string;
    slug: string;
    name: string;
    description: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    headerMode?: 'logo' | 'banner';
  };
  shopActive: boolean;
  viewer?: { isMember: boolean };
  alert?: string;
  products: Product[];
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Props = {
  slug: string;
};

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
});

export default function ShopClient({ slug }: Props) {
  const router = useRouter();
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

const [cart, setCart] = useState<CartItem[]>([]);
const [cartReady, setCartReady] = useState(false);
const [cartOpen, setCartOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [cartNotice, setCartNotice] = useState('');

  
  const loadShop = useCallback(async () => {
    setLoading(true);
    setError('');
    setCartReady(false);

    try {
      const response = await shopFetch(
        `/api/public/shop/${encodeURIComponent(slug)}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load the shop.');
      }

      const shopData = data as ShopData;
      const storageKey = `shop-cart:${slug}`;

      // Restore the saved cart only after the shop data is available.
      let savedItems: { productId: string; quantity: number }[] = [];

      try {
        const raw = sessionStorage.getItem(storageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : [];

        if (Array.isArray(parsed)) {
          savedItems = parsed.filter((item: unknown) => {
            if (!item || typeof item !== 'object') return false;

            const candidate = item as Record<string, unknown>;

            return (
              typeof candidate.productId === 'string' &&
              Number.isInteger(candidate.quantity) &&
              (candidate.quantity as number) > 0
            );
          }) as { productId: string; quantity: number }[];
        }
      } catch {
        savedItems = [];
      }

      const restoreNotices: string[] = [];
      const restoredCart: CartItem[] = savedItems.flatMap((saved) => {
        const product = shopData.products.find(
          (item) =>
            item.id === saved.productId &&
            item.isVisible &&
            item.quantity > 0,
        );

        if (!product) return [];

        const member = Boolean(shopData.viewer?.isMember);
        if (product.allowNonMembers === false && !member) {
          restoreNotices.push(`${product.name} is available to members only.`);
          return [];
        }
        const allowedQuantity = product.allowMultipleUnits === false
          ? 1
          : Math.min(saved.quantity, product.quantity);
        if (product.allowMultipleUnits === false && saved.quantity > 1) {
          restoreNotices.push(`${product.name} can only be added once.`);
        }

        return [{
          product,
          quantity: Math.min(allowedQuantity, product.quantity),
        }];
      });

      setShop(shopData);
      setCart(restoredCart);
      if (restoreNotices[0]) setCartNotice(restoreNotices[0]);

      // Write back the validated cart, excluding unavailable products.
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(
            restoredCart.map(({ product, quantity }) => ({
              productId: product.id,
              quantity,
            })),
          ),
        );
      } catch (storageError) {
        console.error('Could not restore the saved cart:', storageError);
      }

      // Enable automatic cart saving only after restoration is complete.
      setCartReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load the shop.',
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);


  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  
  useEffect(() => {
    // Important: don't overwrite the saved cart before restoring it.
    if (!cartReady) return;

    try {
      sessionStorage.setItem(
        `shop-cart:${slug}`,
        JSON.stringify(
          cart.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        ),
      );
    } catch (error) {
      console.error('Could not save the cart for checkout:', error);
    }
  }, [cart, slug, cartReady]);


  const totalItems = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [cart],
  );

  function addToCart(product: Product, quantity = 1) {
    if (product.quantity <= 0 || quantity <= 0) return;

    const alreadyInCart = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
    const blocked = cartAddBlockReason(
      product,
      quantity,
      alreadyInCart,
      Boolean(shop?.viewer?.isMember),
    );
    if (blocked) {
      setCartNotice(blocked);
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id,
      );

      const currentQuantity = existing?.quantity ?? 0;
      const newQuantity = Math.min(
        product.quantity,
        currentQuantity + quantity,
      );

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, product, quantity: newQuantity }
            : item,
        );
      }

      return [
        ...current,
        {
          product,
          quantity: Math.min(quantity, product.quantity),
        },
      ];
    });

    setSelectedProduct(null);
    setCartOpen(true);
  }

  function changeQuantity(productId: string, change: number) {
    if (change > 0) {
      const item = cart.find((entry) => entry.product.id === productId);
      if (item) {
        const blocked = cartAddBlockReason(
          item.product,
          change,
          item.quantity,
          Boolean(shop?.viewer?.isMember),
        );
        if (blocked) {
          setCartNotice(blocked);
          return;
        }
      }
    }

    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id !== productId) return item;

          return {
            ...item,
            quantity: Math.min(
              item.product.quantity,
              item.quantity + change,
            ),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
  }

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelectedQuantity(1);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
        <div className="text-center">
          <RefreshCw
            className="mx-auto animate-spin text-purple-600"
            size={30}
          />
          <p className="mt-3 text-sm text-gray-500">
            Loading shop...
          </p>
        </div>
      </main>
    );
  }

  if (error || !shop) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4">
        <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle
            className="mx-auto text-red-500"
            size={34}
          />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Shop unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {error || 'This shop could not be found.'}
          </p>
          <button
            type="button"
            onClick={() => void loadShop()}
            className="mt-5 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!shop.shopActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Store size={30} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            {shop.club.name}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            Shop temporarily closed
          </h1>
          <p className="mt-4 text-sm leading-7 text-gray-500">
            This online shop is not accepting orders at the moment.
            Please check back later.
          </p>
        </div>
      </main>
    );
  }

  const availableProducts = shop.products.filter(
    (product) => product.isVisible,
  );
  const heroBanner =
    shop.club.headerMode === 'banner' && shop.club.bannerUrl ? shop.club.bannerUrl : '';
  const heroLogo = !heroBanner && shop.club.logoUrl ? shop.club.logoUrl : '';

  return (
    <main className="min-h-screen bg-[#f7f7fb] text-gray-900">
      {/* Black hero section */}
      <section
        className="relative flex justify-content-center min-h-[340px] bg-[#111111] px-5 pb-28 pt-12 text-white sm:min-h-[390px] sm:px-8 sm:pt-16 lg:min-h-[420px]"
        style={
          heroBanner
            ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,.55), rgba(15,23,42,.8)), url(${heroBanner})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-7xl">
          {heroLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroLogo}
              alt=""
              className="absolute left-5 top-5 h-14 w-14 rounded-full bg-white object-contain p-1 shadow-lg sm:left-8 sm:top-8 sm:h-16 sm:w-16"
            />
          ) : null}
          <div className="mt-10 max-w-4xl sm:mt-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-300 sm:text-sm">
              Official merchandise
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              {shop.club.name}
            </h1>
            <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-gray-300 sm:text-base">
              {shop.club.description ||
                'Explore our official collection and find your favourites.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 sm:right-8 sm:top-8"
          >
            <ShoppingCart size={18} />
            Cart
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs">
              {totalItems}
            </span>
          </button>
        </div>
      </section>

      {/* One large panel overlapping the hero */}
      <div className="relative mx-auto -mt-16 max-w-7xl px-4 pb-12 sm:-mt-20 sm:px-8">
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_70px_rgba(20,20,40,0.10)]">
          {shop.alert ? (
            <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900 sm:px-8">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="whitespace-pre-line">{shop.alert}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
                Discover the collection
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Our products
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Find something you love from your club.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-600 ring-1 ring-gray-100">
              <Package size={17} className="text-purple-600" />
              {availableProducts.length}{' '}
              {availableProducts.length === 1 ? 'product' : 'products'}
            </div>
          </div>

          {availableProducts.length === 0 ? (
            <div className="px-5 py-20 text-center sm:px-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
                <ShoppingBag size={30} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">
                No products available
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Please check back later.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-5 lg:grid-cols-4 lg:gap-4 lg:p-6">
              {availableProducts.map((product) => {
                const cartItem = cart.find(
                  (item) => item.product.id === product.id,
                );

                const atLimit =
                  (cartItem?.quantity ?? 0) >= product.quantity;

                return (
                  <article
                    key={product.id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg"
                  >
                    <div className="relative flex aspect-[5/4] items-center justify-center overflow-hidden bg-gray-100">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                        />
                      ) : (
                        <ShoppingBag
                          size={46}
                          className="text-gray-300"
                        />
                      )}

                      {product.quantity <= 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                          <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900">
                            Out of stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="truncate text-sm font-bold text-gray-900">
                        {product.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">
                        {product.description ||
                          'Discover more about this product.'}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-lg font-bold text-gray-900">
                          {euro.format(product.price)}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            product.quantity <= 0
                              ? 'text-red-600'
                              : product.quantity <= 5
                                ? 'text-amber-600'
                                : 'text-gray-400'
                          }`}
                        >
                          {product.quantity <= 0
                            ? 'Out of stock'
                            : `${product.quantity} available`}
                        </span>
                      </div>
                    </div>

                    {/* Buttons sit flush against the card's bottom and sides */}
                    <div className="mt-auto grid grid-cols-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => openProduct(product)}
                        className="flex min-h-10 items-center justify-center gap-1.5 border-r border-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        <Eye size={14} />
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={atLimit || product.quantity <= 0}
                        className="flex min-h-10 items-center justify-center gap-1.5 bg-purple-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <footer className="border-t border-gray-100 px-5 py-5 text-center text-xs text-gray-400 sm:px-8">
            {shop.club.name} · Official online shop
          </footer>
        </section>
      </div>

      {/* Product details modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProduct(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="relative my-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close product details"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              <X size={20} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="flex min-h-[260px] items-center justify-center bg-gray-100 sm:min-h-[360px]">
                {selectedProduct.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-full max-h-[520px] min-h-[260px] w-full object-cover"
                  />
                ) : (
                  <ShoppingBag
                    size={64}
                    className="text-gray-300"
                  />
                )}
              </div>

              <div className="flex flex-col p-6 sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">
                  Product details
                </p>

                <h2
                  id="product-modal-title"
                  className="mt-3 pr-8 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl"
                >
                  {selectedProduct.name}
                </h2>

                <p className="mt-4 text-2xl font-bold text-gray-900">
                  {euro.format(selectedProduct.price)}
                </p>

                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-500">
                  {selectedProduct.description ||
                    'No description is available for this product.'}
                </p>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
                  <span className="text-sm font-semibold text-gray-700">
                    Quantity
                  </span>

                  <div className="inline-flex items-center gap-4 rounded-xl border border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      aria-label="Decrease product quantity"
                      disabled={selectedQuantity <= 1}
                      onClick={() =>
                        setSelectedQuantity((quantity) =>
                          Math.max(1, quantity - 1),
                        )
                      }
                      className="p-1 text-gray-600 transition hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus size={17} />
                    </button>

                    <span className="min-w-5 text-center text-sm font-bold">
                      {selectedQuantity}
                    </span>

                    <button
                      type="button"
                      aria-label="Increase product quantity"
                      disabled={
                        selectedQuantity >= selectedProduct.quantity
                      }
                      onClick={() => {
                        const blocked = cartAddBlockReason(
                          selectedProduct,
                          1,
                          selectedQuantity,
                          Boolean(shop?.viewer?.isMember),
                        );
                        if (blocked) {
                          setCartNotice(blocked);
                          return;
                        }
                        setSelectedQuantity((quantity) =>
                          Math.min(
                            selectedProduct.quantity,
                            quantity + 1,
                          ),
                        );
                      }}
                      className="p-1 text-gray-600 transition hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-right text-sm font-semibold text-red-600">
                  {selectedProduct.quantity <= 0
                    ? 'Out of stock'
                    : `${selectedProduct.quantity} available`}
                </p>

                <div className="mt-auto pt-7">
                  <button
                    type="button"
                    disabled={selectedProduct.quantity <= 0}
                    onClick={() =>
                      addToCart(selectedProduct, selectedQuantity)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <ShoppingCart size={18} />
                    Add to cart ·{' '}
                    {euro.format(
                      selectedProduct.price * selectedQuantity,
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Floating cart panel */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-black/30 transition-opacity"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-gray-100 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ShoppingCart size={21} />
                </div>
                <div>
                  <h2
                    id="cart-title"
                    className="text-lg font-bold text-gray-900"
                  >
                    Your cart
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {totalItems}{' '}
                    {totalItems === 1 ? 'item' : 'items'} selected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={21} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                  <ShoppingBag size={32} />
                </div>
                <h3 className="mt-4 font-bold text-gray-900">
                  Your cart is empty
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">
                  Browse the collection and add products to your cart.
                </p>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="mt-5 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  Browse products
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-4 border-b border-gray-100 pb-5"
                    >
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {item.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <ShoppingBag size={28} />
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-gray-900">
                          {item.product.name}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-gray-700">
                          {euro.format(item.product.price)}
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1">
                            <button
                              type="button"
                              aria-label={`Decrease ${item.product.name} quantity`}
                              onClick={() =>
                                changeQuantity(item.product.id, -1)
                              }
                              className="p-1 text-gray-600 hover:text-purple-700"
                            >
                              <Minus size={13} />
                            </button>

                            <span className="min-w-4 text-center text-xs font-bold">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              aria-label={`Increase ${item.product.name} quantity`}
                              disabled={
                                item.quantity >= item.product.quantity
                              }
                              onClick={() =>
                                changeQuantity(item.product.id, 1)
                              }
                              className="p-1 text-gray-600 hover:text-purple-700 disabled:opacity-30"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(item.product.id)
                            }
                            className="text-xs font-semibold text-red-600 transition hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {euro.format(
                            item.product.price * item.quantity,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 bg-white px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-sm font-semibold text-gray-600">
                      Cart total
                    </span>
                    <span className="rounded-lg bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-700 ring-1 ring-emerald-100">
                      {euro.format(subtotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);

                      if (cart.length === 0) return;

                      router.push(`/our-shop/shop/${encodeURIComponent(slug)}/checkout`);
                    }}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-purple-700"
                  >
                    Proceed with the order
                    <ArrowRight size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                  >
                    Continue shopping
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <CartNotice message={cartNotice} onClose={() => setCartNotice('')} />
    </main>
  );
}
