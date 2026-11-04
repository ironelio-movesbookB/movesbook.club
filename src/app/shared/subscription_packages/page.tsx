'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SubscriptionPackagesTable from '@/components/club/settings/subscriptionPackages/SubscriptionPackagesTable';

function SharedSubscriptionPackagesContent() {
  const searchParams = useSearchParams();
  return (
    <div className="min-h-screen bg-gray-100">
      <SubscriptionPackagesTable
        mode="shared"
        shareData={searchParams?.get('data') ?? ''}
        shareToken={searchParams?.get('token') ?? ''}
      />
    </div>
  );
}

export default function SharedSubscriptionPackagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading subscription packages…</div>}>
      <SharedSubscriptionPackagesContent />
    </Suspense>
  );
}
