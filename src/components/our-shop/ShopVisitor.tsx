import Link from 'next/link';
import { ShoppingBag, Store } from 'lucide-react';

export function ShopVisitor({
  signedIn,
  shops,
}: {
  signedIn: boolean;
  shops: { slug: string; name: string }[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-2 py-10 sm:py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
          <Store size={24} />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
          Movesbook shop
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          A shop for every club and team
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Clubs and teams sell their own products here. Members and guests place an order and pay when they collect it. Product lists, orders, clients, and settings are available after you sign in with the club or team account.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {!signedIn && (
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Movesbook
          </Link>
        </div>
      </div>

      {shops.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">Shops you belong to</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open a shop to browse products and place an order.
          </p>
          <div className="mt-5 space-y-3">
            {shops.map((shop) => (
              <Link
                key={shop.slug}
                href={`/our-shop/shop/${encodeURIComponent(shop.slug)}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-purple-200 hover:bg-purple-50"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <ShoppingBag size={18} className="shrink-0 text-purple-600" />
                  <span className="truncate">{shop.name}</span>
                </span>
                <span className="shrink-0 text-purple-700">Open</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
