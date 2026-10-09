'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingCreditNotesList from '@/components/club/billing/BillingCreditNotesList';

function CreditNotesInner() {
  const searchParams = useSearchParams();
  return (
    <BillingCreditNotesList initialDirection={searchParams?.get('type') === 'incoming' ? 'incoming' : 'outgoing'} />
  );
}

export default function BillingCreditNotesPage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <CreditNotesInner />
      </Suspense>
    </AutoTranslate>
  );
}
