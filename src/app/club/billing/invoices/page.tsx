'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingInvoicesList from '@/components/club/billing/BillingInvoicesList';

function InvoicesInner() {
  const searchParams = useSearchParams();
  return <BillingInvoicesList initialDirection={searchParams?.get('type') === 'incoming' ? 'incoming' : 'outgoing'} />;
}

export default function BillingInvoicesPage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <InvoicesInner />
      </Suspense>
    </AutoTranslate>
  );
}
