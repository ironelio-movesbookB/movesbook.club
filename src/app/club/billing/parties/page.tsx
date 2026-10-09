'use client';

import { Suspense } from 'react';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingPartiesList from '@/components/club/billing/BillingPartiesList';

export default function BillingPartiesPage() {
  return (
    <AutoTranslate>
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
        <BillingPartiesList />
      </Suspense>
    </AutoTranslate>
  );
}
