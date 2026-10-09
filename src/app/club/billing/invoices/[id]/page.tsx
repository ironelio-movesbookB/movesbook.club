'use client';

import AutoTranslate from '@/components/i18n/AutoTranslate';
import BillingInvoiceForm from '@/components/club/billing/BillingInvoiceForm';

export default function EditBillingInvoicePage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <AutoTranslate>
      <BillingInvoiceForm invoiceId={id} />
    </AutoTranslate>
  );
}
