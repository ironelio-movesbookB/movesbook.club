'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  DollarSign,
  ExternalLink,
  Folder,
  ListOrdered,
  Receipt,
  BarChart3,
  Settings,
  Shirt,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { shopFetch } from '@/lib/shop/browser';

type ShopItem = {
  label: string;
  href: string;
  icon: typeof ShoppingCart;
};

const shopItems: ShopItem[] = [
  { label: 'Products', href: '/our-shop/products', icon: Shirt },
  { label: 'Orders', href: '/our-shop/orders', icon: ListOrdered },
  { label: 'Clients', href: '/our-shop/clients', icon: Users },
  { label: 'Settings', href: '/our-shop/settings', icon: Settings },
];

const placeholderSections = [
  { label: 'Payments', icon: DollarSign },
  { label: 'Billing', icon: Receipt },
  { label: 'Accounting', icon: BarChart3 },
  { label: 'Administration', icon: Folder },
  { label: 'Event management', icon: CalendarDays },
];

function CrownBadge() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 shadow-sm">
      <Crown size={10} strokeWidth={2.2} className="fill-white text-white" />
    </span>
  );
}

export default function Sidebar({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname() ?? '';
  const [shopExpanded, setShopExpanded] = useState(true);
  const [publicPath, setPublicPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    shopFetch('/api/club/shop/context')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const path = data?.workspace?.publicPath;
        setPublicPath(typeof path === 'string' ? path : null);
      })
      .catch(() => {
        if (!cancelled) setPublicPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/our-shop') && !pathname.startsWith('/our-shop/shop/')) {
      setShopExpanded(true);
    }
  }, [pathname]);

  function isItemActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const shopActive =
    pathname === '/our-shop' ||
    shopItems.some((item) => isItemActive(item.href));

  if (!isOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-gray-200 bg-white py-4">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-2 transition-colors hover:bg-gray-100"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-[76px] items-center justify-between gap-3 border-b border-slate-100 px-8">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">MovesBook</h1>
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 transition-colors hover:bg-gray-100"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Workspace
        </p>

        <div className="space-y-1.5">
          {placeholderSections.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <CrownBadge />
              <Icon size={18} strokeWidth={1.8} className="shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-left text-[15px] font-bold">{label}</span>
              <ChevronRight size={15} className="shrink-0 text-slate-400" />
            </button>
          ))}

          <div className="pt-1">
            <div
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                shopActive || shopExpanded ? 'bg-indigo-50/70 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CrownBadge />
              <ShoppingCart size={19} strokeWidth={2} className="shrink-0" />
              <Link href="/our-shop" className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-bold">Shop</span>
                <span className="mt-0.5 block text-[10px] font-medium text-slate-500">E-commerce</span>
              </Link>
              <button
                type="button"
                onClick={() => setShopExpanded((expanded) => !expanded)}
                aria-expanded={shopExpanded}
                aria-label={shopExpanded ? 'Collapse shop' : 'Expand shop'}
                className="rounded p-1"
              >
                {shopExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            {shopExpanded && (
              <div className="ml-[26px] mt-2 space-y-1 border-l border-slate-200 pl-3">
                <Link
                  href={publicPath || '/our-shop'}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                    pathname.startsWith('/our-shop/shop/')
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <ExternalLink size={15} className="shrink-0" />
                  <span className="min-w-0 flex-1 text-xs font-semibold">Public shop</span>
                </Link>

                {shopItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                        active
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                      <span className="min-w-0 flex-1 text-xs font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>
    </aside>
  );
}
