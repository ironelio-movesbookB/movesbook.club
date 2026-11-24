'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import PaymentForm from '@/components/procedures/PaymentForm';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import { getProcedureDefinition, getProcedureTabs } from '@/lib/procedures/registry';
import type { ProcedureTypeCode } from '@/lib/procedures/types';
import type { ProcedureRecordView } from '@/lib/club/procedureClient';

type Props = {
  procedureCode: ProcedureTypeCode;
};

export default function ProcedurePaymentDetail({ procedureCode }: Props) {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);

  const [record, setRecord] = useState<ProcedureRecordView | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await client.fetchRecord(id);
      setRecord(res.record);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [client, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(values: {
    amountPaid: number;
    paymentDate: string;
    notes: string;
    createReceipt: boolean;
    receiptNumber: string;
  }) {
    setError('');
    setSuccess('');

    if (record && values.amountPaid > record.rest) {
      setError('Payment exceeds remaining balance.');
      return;
    }

    setSaving(true);
    try {
      await client.addPayment(id, {
        amountPaid: values.amountPaid,
        paymentDate: values.paymentDate,
        notes: values.notes,
        createReceipt: values.createReceipt,
        receiptDocumentType: 'Invoice',
        receiptNumber: values.receiptNumber || undefined,
        receiptAnnotations: values.notes,
        serviceName: record?.primaryLabel,
      });
      setSuccess('Payment saved successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  if (!record && !error) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <ProcedureArchiveShell
        title={def.archiveTitles.paymentForm}
        activeTab="deadlines"
        tabs={getProcedureTabs(procedureCode, 'deadlines', id)}
        error={!record ? error : undefined}
      >
        {record && (
          <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
            <p>
              <strong>{record.memberName}</strong> — {record.primaryLabel}
            </p>
            <p className="mt-1 text-gray-600">
              Total {formatEuro(record.value)} · Paid {formatEuro(record.pay)} · Balance{' '}
              <span className="font-semibold text-red-700">{formatEuro(record.rest)}</span>
            </p>
            <p className="text-gray-500">Record date: {formatDate(record.paydate)}</p>
          </div>
        )}

        {record && record.rest > 0 && (
          <PaymentForm
            maxAmount={record.rest}
            saving={saving}
            error={error}
            success={success}
            onSubmit={handleSubmit}
            onCancel={() => router.push(def.routes.deadlines)}
          />
        )}

        {record && record.rest <= 0 && (
          <p className="text-green-700 font-medium">This record is fully paid.</p>
        )}
      </ProcedureArchiveShell>
    </div>
  );
}
