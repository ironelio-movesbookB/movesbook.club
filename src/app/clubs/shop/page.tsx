
'use client';

import { LayoutDashboard } from 'lucide-react';
import { ShopFrame, ShopHeader } from '@/components/our-shop/pageChrome';

export default function DashboardPage() {
  return (
    <ShopFrame>
      <ShopHeader
        title="Dashboard"
        subtitle="Status of the sellings"
      />
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <LayoutDashboard size={28} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Dashboard is disabled</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          It will display the status of the sellings. For now this page is turned off.
        </p>
      </section>
    </ShopFrame>
  );
}
