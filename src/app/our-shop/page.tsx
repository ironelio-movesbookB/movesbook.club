
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

export default function DashboardPage() {
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
  }, []);
  return (
    <ShopFrame>
      <ShopHeader title="Shop overview" subtitle="Manage your products, orders, and customers.">
        <Link
          href="/our-shop/products"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white transition hover:bg-purple-700"
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

        <div className="mt-6 rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center">
          <ShoppingBag
            size={32}
            className="mx-auto text-gray-400"
          />
          <p className="mt-3 font-medium text-gray-700">
            No real orders yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Orders will appear here once customers start purchasing.
          </p>
        </div>
      </section>
    </ShopFrame>
  );
}
