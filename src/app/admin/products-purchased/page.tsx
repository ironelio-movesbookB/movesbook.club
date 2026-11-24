'use client';

import { Suspense } from 'react';
import AdminRegisteredUsersList from '@/components/admin/AdminRegisteredUsersList';

function Content() {
  return (
    <div className="min-h-full bg-[#ececec]">
      <AdminRegisteredUsersList
        segment="all"
        roleTitle="Products"
        historicalSubtitle="Products purchased on Movesbook. The description is filled from the purchase."
        listPurpose="products"
      />
    </div>
  );
}

export default function ProductsPurchasedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#666]">Loading…</div>}>
      <Content />
    </Suspense>
  );
}
