'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingCreditNoteForm from '@/components/club/billing/BillingCreditNoteForm';

export default function EditBillingCreditNotePage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <AutoTranslate>
      <BillingCreditNoteForm creditNoteId={id} />
    </AutoTranslate>
  );
}
