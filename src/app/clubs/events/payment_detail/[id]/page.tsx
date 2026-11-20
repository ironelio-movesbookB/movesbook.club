'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ServicePaymentForm, {
  type ServicePaymentSubmitValues,
} from '@/components/club/services/ServicePaymentForm';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { getProcedureTabs } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type {
  ServiceSaleFormOptions,
  ServiceSalePayment,
  ServiceSalePurchase,
} from '@/lib/club/serviceSaleClient';
import { fetchOtherSettings } from '@/lib/club/otherSettingsClient';

const TYPE = PROCEDURE_TYPE_CODES.EVENT_SUBSCRIPTION;

/** Pay an event subscription deadline at the club (cash, cheque, ...) — same form as the other deadlines. */
export default function EventSubscriptionPaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const client = useMemo(() => createProcedureClient(TYPE), []);

  const [purchase, setPurchase] = useState<ServiceSalePurchase | null>(null);
  const [payments, setPayments] = useState<ServiceSalePayment[]>([]);
  const [options, setOptions] = useState<ServiceSaleFormOptions | null>(null);
  const [operatorPassStatus, setOperatorPassStatus] = useState('Yes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const [res, paymentsRes, formOptions, settings] = await Promise.all([
      client.fetchRecord(id),
      client.fetchPayments({ recordId: id, pageSize: 50 }),
      client.fetchFormOptions<{
        members: { id: string; name: string }[];
        operators: { id: string; name: string }[];
        currentOperatorId: string | null;
      }>(),
      fetchOtherSettings().catch(() => ({ operatorPassStatus: 'Yes' })),
    ]);
    const r = res.record;
    setPurchase({
      id: r.id,
      userId: r.userId,
      memberName: r.memberName,
      memberImage: r.memberImage,
      typology: r.typology,
      sectorName: r.secondaryLabel || '-',
      serviceName: r.primaryLabel,
      recordDate: r.recordDate,
      paydate: r.paydate,
      expireDate: r.expireDate,
      createdAt: r.createdAt ?? null,
      value: r.value,
      pay: r.pay,
      rest: r.rest,
      notes: r.notes,
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      lastPaymentDate: r.lastPaymentDate,
    });
    setPayments(
      paymentsRes.items.map((p) => ({
        id: p.id,
        spId: p.recordId,
        memberName: p.memberName,
        typology: p.typology,
        serviceName: p.primaryLabel,
        paymentDate: p.paymentDate,
        paid: p.paid,
        balance: p.balance,
        originalDebt: p.originalDebt ?? 0,
        residualDebt: p.residualDebt ?? 0,
        description: p.description,
        operatorId: p.operatorId,
        operatorName: p.operatorName,
      })),
    );
    setOptions({
      sectors: [],
      services: [],
      members: formOptions.members ?? [],
      operators: formOptions.operators ?? [],
      currentOperatorId: formOptions.currentOperatorId ?? null,
    });
    setOperatorPassStatus(settings.operatorPassStatus);
  }, [client, id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [load]);

  const tabs = useMemo(
    () => getProcedureTabs(TYPE, 'deadlines', id, purchase?.userId ?? null).filter((t) => t.id === 'deadlines'),
    [id, purchase?.userId],
  );

  async function handleSubmit(values: ServicePaymentSubmitValues) {
    if (!purchase) return;
    setError('');
    setSuccess('');
    if (values.amountPaid > purchase.rest) {
      setError('Payment exceeds remaining balance.');
      return;
    }
    setSaving(true);
    try {
      await client.addPayment(id, {
        amountPaid: values.amountPaid,
        paymentDate: values.paymentDate,
        description: values.description,
        payMode: values.payMode,
        paymentType: values.paymentType,
        taxDoc: values.taxDoc,
        operatorId: values.operatorId,
        operatorPassword: values.operatorPassword,
        debtTotal: values.debtTotal,
        debtExpire: values.debtExpire,
        payWith: values.payWith,
        taxDocument: values.taxDocument,
        createReceipt: values.createReceipt,
        receiptNumber: values.receiptNumber,
        receiptAnnotations: values.description,
        serviceName: purchase.serviceName,
      });
      setSuccess('Payment saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  if ((!purchase || !options) && !error) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="w-full p-2 sm:p-3">
      {purchase && (
        <div className="mb-3 flex min-h-[48px] items-center justify-between gap-3 bg-[#8B0000] px-3 py-2 text-white">
          <span className="truncate text-[15px] font-semibold">{purchase.memberName || 'Subscriber'}</span>
          <span className="text-[15px] font-semibold">{purchase.typology}</span>
        </div>
      )}
      <ProcedureArchiveShell
        title="Payment — Event subscription"
        activeTab="deadlines"
        tabs={tabs}
        error={!purchase ? error : undefined}
      >
        {purchase && options && (
          <ServicePaymentForm
            purchase={purchase}
            extraPurchases={[]}
            payments={payments}
            options={options}
            procedureType={TYPE}
            saving={saving}
            error={error}
            success={success}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/clubs/events/deadlines')}
            operatorPassStatus={operatorPassStatus}
          />
        )}
      </ProcedureArchiveShell>
    </div>
  );
}
