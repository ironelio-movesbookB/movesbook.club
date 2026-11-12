'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import AdminRegisteredUsersList from '@/components/admin/AdminRegisteredUsersList';

function Content() {
  return (
    <div className="min-h-full bg-[#ececec]">
      <div className="mx-auto flex max-w-[1800px] justify-end px-4 pt-4 sm:px-6">
        <Link
          href="/admin/deadlines"
          className="rounded bg-teal-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-800"
        >
          Archive of Deadlines
        </Link>
      </div>
      <AdminRegisteredUsersList
        segment="all"
        roleTitle="All payments"
        historicalSubtitle="Recorded payments for subscriptions and products. An offer price is not money received."
        listPurpose="payments"
      />
    </div>
  );
}

export default function ListOfPaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#666]">Loading…</div>}>
      <Content />
    </Suspense>
  );
}
