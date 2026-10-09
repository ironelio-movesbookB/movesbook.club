'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingPartyProfile from '@/components/club/billing/BillingPartyProfile';

export default function BillingPartyProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <AutoTranslate>
      <BillingPartyProfile partyId={id} />
    </AutoTranslate>
  );
}
