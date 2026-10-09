'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingCreditNoteForm from '@/components/club/billing/BillingCreditNoteForm';

function NewCreditNoteInner() {
  const searchParams = useSearchParams();
  const type = searchParams?.get('type') === 'outgoing' ? 'outgoing' : 'incoming';
  return (
    <BillingCreditNoteForm key={type} initialDirection={type} initialPartyId={searchParams?.get('partyId') || ''} />
  );
}

export default function NewBillingCreditNotePage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <NewCreditNoteInner />
      </Suspense>
    </AutoTranslate>
  );
}
