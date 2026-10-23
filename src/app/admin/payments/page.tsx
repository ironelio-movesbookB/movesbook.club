'use client';

import { Suspense } from 'react';
import AdminRegisteredUsersList from '@/components/admin/AdminRegisteredUsersList';

function Content() {
  return (
    <div className="min-h-full bg-[#ececec]">
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
