
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingBag,
  Users,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';
import { shopFetch } from '@/lib/shop/browser';

type RecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  orderDate: string;
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [stats, setStats] = useState([
    { label: 'Total products', value: '—', icon: Package, description: 'Products in your shop' },
    { label: 'Total orders', value: '—', icon: ShoppingBag, description: 'Orders received' },
    { label: 'Customers', value: '—', icon: Users, description: 'Customers who are not members' },
    { label: 'Revenue', value: '—', icon: CreditCard, description: 'Paid orders' },
  ]);

  useEffect(() => {
    shopFetch('/api/club/shop/summary')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        const revenue = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
          Number(data.revenue) || 0,
        );
        setStats([
          { label: 'Total products', value: String(data.products ?? 0), icon: Package, description: 'Products in your shop' },
          { label: 'Total orders', value: String(data.orders ?? 0), icon: ShoppingBag, description: 'Orders received' },
          { label: 'Customers', value: String(data.customers ?? 0), icon: Users, description: 'Customers who are not members' },
          { label: 'Revenue', value: revenue, icon: CreditCard, description: 'Paid orders' },
        ]);
      })
      .catch(() => undefined);
    shopFetch('/api/club/shop/orders')
      .then(async (response) => {
        if (!response.ok) {
          setOrders([]);
          return;
        }
        const data = await response.json();
        setOrders(Array.isArray(data.orders) ? data.orders.slice(0, 8) : []);
      })
      .catch(() => setOrders([]));
  }, []);
  return (
    <ShopFrame>
      <ShopHeader title="Shop overview" subtitle="Manage your products, orders, and customers.">
        <Link
          href="/clubs/shop/sell"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
        >
          Sell products
        </Link>
        <Link
          href="/clubs/shop/products/shop"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-purple-300 bg-white px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
        >
          Manage products
        </Link>
      </ShopHeader>

      <section className="grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <Icon size={21} className="text-indigo-600" />
              </div>

              <p className="mt-4 text-3xl font-bold text-gray-900">
                {stat.value}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                {stat.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Recent orders
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your latest shop activity
            </p>
          </div>

          <Link
            href="/our-shop/orders"
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            View all <ArrowUpRight size={16} />
          </Link>
        </div>

        {orders === null ? (
          <p className="mt-6 text-sm text-gray-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center">
            <ShoppingBag size={32} className="mx-auto text-gray-400" />
            <p className="mt-3 font-medium text-gray-700">No orders for this club yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Orders appear here for the club that is open. Sell a product, or switch to the club that made the sale.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-gray-100">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/clubs/shop/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-gray-900">#{order.orderNumber}</span>
                    <span className="ml-2 text-gray-600">{order.customerName}</span>
                  </span>
                  <span className="shrink-0 text-right text-gray-700">
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(order.total) || 0)}
                    <span className="ml-3 text-xs uppercase tracking-wide text-gray-500">{order.status}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ShopFrame>
  );
}
