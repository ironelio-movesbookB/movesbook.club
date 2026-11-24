'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SubscriptionPackagesTable from '@/components/club/settings/subscriptionPackages/SubscriptionPackagesTable';

function SubscriptionPackagesContent() {
  const searchParams = useSearchParams();
  const fromPricelist = searchParams?.get('from_pricelist') ?? null;
  return (
    <SubscriptionPackagesTable
      mode="club"
      fromPricelistId={fromPricelist && /^\d+$/.test(fromPricelist) ? fromPricelist : null}
    />
  );
}

export default function SubscriptionPackagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading subscription packages…</div>}>
      <SubscriptionPackagesContent />
    </Suspense>
  );
}
