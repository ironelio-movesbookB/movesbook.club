'use client';

import { useEffect, useMemo, useState } from 'react';
import ProcedureArchiveTable from '@/components/procedures/ProcedureArchiveTable';
import { createProcedureClient } from '@/lib/club/procedureClient';
import type { ServiceSalePurchase } from '@/lib/club/serviceSaleClient';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import type { Column, Member } from '@/types/clubTable';

export type PaymentFormArchiveTab = 'records' | 'payments' | 'receipts';

type Props = {
  procedureCode: ProcedureTypeCode;
  tab: PaymentFormArchiveTab;
  records: ServiceSalePurchase[];
};

const recordColumns: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Detail' },
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'expirationDate', header: 'Expiration Date', render: (v) => formatDate(v) },
  { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Rest', render: (v) => formatEuro(v) },
  { key: 'dateEnd', header: 'Last payment', render: (v) => formatDate(v) },
  { key: 'casual', header: 'Notes' },
  { key: 'operator', header: 'Operator' },
];

const paymentColumns: Column[] = [
  { key: 'insertDate', header: 'Payment date', render: (v) => formatDate(v) },
  { key: 'name', header: 'Full Name' },
  { key: 'service', header: 'Detail' },
  { key: 'value', header: 'Original debt', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'rest', header: 'Residual debt', render: (v) => formatEuro(v) },
  { key: 'category', header: 'Pay mode' },
  { key: 'casual', header: 'Description' },
  { key: 'operator', header: 'Operator' },
];

const receiptColumns: Column[] = [
  { key: 'insertDate', header: 'Date', render: (v) => formatDate(v) },
  { key: 'name', header: 'Full Name' },
  { key: 'service', header: 'Detail' },
  { key: 'category', header: 'Document' },
  { key: 'contract', header: 'Number' },
  { key: 'value', header: 'Cost', render: (v) => formatEuro(v) },
  { key: 'paid', header: 'Paid', render: (v) => formatEuro(v) },
  { key: 'casual', header: 'Annotations' },
  { key: 'operator', header: 'Operator' },
];

function newestFirst(a: Member, b: Member) {
  return String(b.insertDate ?? '').localeCompare(String(a.insertDate ?? ''));
}

/** Historical, Payments and Receipts of the records open in the payment form, shown inside it. */
export default function PaymentFormArchiveView({ procedureCode, tab, records }: Props) {
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);
  const recordKey = records.map((record) => record.id).join(',');
  const [payments, setPayments] = useState<Member[]>([]);
  const [receipts, setReceipts] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab === 'records' || !recordKey) return;
    let cancelled = false;
    const ids = recordKey.split(',');
    setLoading(true);
    setError('');
    (async () => {
      try {
        if (tab === 'payments') {
          const pages = await Promise.all(ids.map((recordId) => client.fetchPayments({ recordId, pageSize: 100 })));
          if (cancelled) return;
          setPayments(
            pages
              .flatMap((page) => page.items)
              .filter((payment) => !payment.cancelledAt && !payment.reversalOfId)
              .map((payment) => ({
                id: payment.id,
                insertDate: payment.paymentDate ?? undefined,
                name: payment.memberName,
                service: payment.primaryLabel,
                value: payment.originalDebt,
                paid: payment.paid,
                rest: payment.residualDebt,
                category: payment.payMode ?? '-',
                casual: payment.description,
                operator: payment.operatorName,
              }))
              .sort(newestFirst),
          );
        } else {
          const pages = await Promise.all(ids.map((recordId) => client.fetchReceipts({ recordId, pageSize: 100 })));
          if (cancelled) return;
          setReceipts(
            pages
              .flatMap((page) => page.items)
              .map((receipt) => ({
                id: receipt.id,
                insertDate: receipt.receiptDate ?? undefined,
                name: receipt.memberName,
                service: receipt.primaryLabel,
                category: receipt.documentType,
                contract: receipt.documentNumber,
                value: receipt.cost,
                paid: receipt.paymentIn,
                casual: receipt.annotations,
                operator: receipt.operatorName,
              }))
              .sort(newestFirst),
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tab, recordKey]);

  const recordRows: Member[] = records.map((record) => ({
    id: record.id,
    name: record.memberName,
    typology: record.typology,
    service: record.serviceName,
    insertDate: record.recordDate ?? undefined,
    expirationDate: record.expireDate ?? undefined,
    value: record.value,
    paid: record.pay,
    rest: record.rest,
    dateEnd: record.lastPaymentDate ?? undefined,
    casual: record.notes,
    operator: record.operatorName,
  }));

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {tab === 'records' && (
        <ProcedureArchiveTable columns={recordColumns} rows={recordRows} emptyMessage="No records found." />
      )}
      {tab === 'payments' && (
        <ProcedureArchiveTable
          columns={paymentColumns}
          rows={payments}
          loading={loading}
          emptyMessage="No payments yet for this deadline."
        />
      )}
      {tab === 'receipts' && (
        <ProcedureArchiveTable
          columns={receiptColumns}
          rows={receipts}
          loading={loading}
          emptyMessage="No receipts yet for this deadline."
        />
      )}
    </div>
  );
}
