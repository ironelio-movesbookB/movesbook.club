'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import PaymentForm from '@/components/procedures/PaymentForm';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { fetchOtherSettings } from '@/lib/club/otherSettingsClient';
import { formatDate, formatEuro } from '@/lib/club/servicePurchasesClient';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { getProcedureDefinition, getProcedureTabs } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES, type ProcedureTypeCode } from '@/lib/procedures/types';
import type { ProcedureRecordView } from '@/lib/club/procedureClient';
import type { PaymentFormValues } from '@/components/procedures/types';

type Props = {
  procedureCode: ProcedureTypeCode;
};

function MemberPicture({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-lg font-semibold text-teal-800">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        name.trim().charAt(0).toUpperCase() || '?'
      )}
    </span>
  );
}

export default function ProcedurePaymentDetail({ procedureCode }: Props) {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const def = getProcedureDefinition(procedureCode)!;
  const client = useMemo(() => createProcedureClient(procedureCode), [procedureCode]);

  const [record, setRecord] = useState<ProcedureRecordView | null>(null);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [defaultOperatorId, setDefaultOperatorId] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await client.fetchRecord(id);
      setRecord(res.record);
      if (procedureCode === PROCEDURE_TYPE_CODES.PRODUCT_SALE) {
        const options = await client.fetchFormOptions<{
          operators: { id: string; name: string }[];
          currentOperatorId: string | null;
        }>();
        setOperators(options.operators ?? []);
        setDefaultOperatorId(options.currentOperatorId);
        const settings = await fetchOtherSettings().catch(() => null);
        const status = settings?.operatorPassStatus?.trim().toLowerCase() ?? 'yes';
        setPasswordRequired(['yes', 'y', '1', 'true', 't'].includes(status));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [client, id, procedureCode]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(values: PaymentFormValues) {
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
        payMode: values.payMode,
        operatorId: values.operatorId,
        operatorPassword: values.operatorPassword,
        createReceipt: values.createReceipt,
        receiptDocumentType:
          typeof values.taxDocument?.documentType === 'string' ? values.taxDocument.documentType : 'Invoice',
        receiptNumber: values.receiptNumber || undefined,
        receiptAnnotations: values.notes,
        taxDocument: values.taxDocument,
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
          <div className="mb-4 flex items-center gap-3 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
            {procedureCode === PROCEDURE_TYPE_CODES.PRODUCT_SALE && (
              <MemberPicture name={record.memberName} src={resolvePublicImageUrl(record.memberImage)} />
            )}
            <div>
            <p>
              <strong>{record.memberName}</strong> — {record.primaryLabel}
            </p>
            <p className="mt-1 text-gray-600">
              Total {formatEuro(record.value)} · Paid {formatEuro(record.pay)} · Balance{' '}
              <span className="font-semibold text-red-700">{formatEuro(record.rest)}</span>
            </p>
            <p className="text-gray-500">Record date: {formatDate(record.paydate)}</p>
            </div>
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
            sellingPayment={
              procedureCode === PROCEDURE_TYPE_CODES.PRODUCT_SALE
                ? {
                    memberName: record.memberName,
                    operators,
                    defaultOperatorId,
                    passwordRequired,
                  }
                : undefined
            }
          />
        )}

        {record && record.rest <= 0 && (
          <p className="text-green-700 font-medium">This record is fully paid.</p>
        )}
      </ProcedureArchiveShell>
    </div>
  );
}
