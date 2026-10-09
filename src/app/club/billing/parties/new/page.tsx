'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingPartyForm from '@/components/club/billing/BillingPartyForm';
import type { BillingPartyKind } from '@/lib/club/clubBilling.constants';

function NewPartyInner() {
  const searchParams = useSearchParams();
  const kindParam = searchParams?.get('kind');
  const kind: BillingPartyKind =
    kindParam === 'customer' || kindParam === 'supplier' || kindParam === 'both' ? kindParam : 'supplier';
  return <BillingPartyForm defaultKind={kind} />;
}

export default function NewBillingPartyPage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <NewPartyInner />
      </Suspense>
    </AutoTranslate>
  );
}
