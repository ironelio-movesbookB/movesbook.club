'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingInvoiceForm from '@/components/club/billing/BillingInvoiceForm';
import type { BillingInvoiceDirection } from '@/lib/club/clubBilling.constants';

function NewInvoiceInner() {
  const searchParams = useSearchParams();
  const type = searchParams?.get('type') === 'incoming' ? 'incoming' : 'outgoing';
  return (
    <BillingInvoiceForm
      key={type}
      direction={type as BillingInvoiceDirection}
      initialPartyId={searchParams?.get('partyId') || ''}
    />
  );
}

export default function NewBillingInvoicePage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <NewInvoiceInner />
      </Suspense>
    </AutoTranslate>
  );
}
