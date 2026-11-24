'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ServicePaymentForm, {
  type ServicePaymentSubmitValues,
} from '@/components/club/services/ServicePaymentForm';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { getProcedureDefinition, getProcedureTabs } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { ServiceSaleFormOptions, ServiceSalePayment, ServiceSalePurchase } from '@/lib/club/serviceSaleClient';
import { fetchOtherSettings } from '@/lib/club/otherSettingsClient';

export default function ExpensePaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const client = createProcedureClient(PROCEDURE_TYPE_CODES.EXPENSE);

  const [purchase, setPurchase] = useState<ServiceSalePurchase | null>(null);
  const [payments, setPayments] = useState<ServiceSalePayment[]>([]);
  const [options, setOptions] = useState<ServiceSaleFormOptions | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otherSettings, setOtherSettings] = useState<{ operatorPassStatus: string } | null>(null);
  const autoPaid = useRef(false);

  const load = useCallback(async () => {
    const [purchaseRes, paymentsRes, formOptions, settings] = await Promise.all([
      client.fetchRecord(id),
      client.fetchPayments({ recordId: id, pageSize: 50 }),
      client.fetchFormOptions<ServiceSaleFormOptions>(),
      fetchOtherSettings().catch(() => ({ formPayDeadlineStatus: 'Yes', operatorPassStatus: 'Yes', calTaxStatus: false })),
    ]);
    const r = purchaseRes.record;
    const purchaseData = {
      id: r.id,
      userId: r.userId,
      memberName: r.memberName,
      memberImage: null,
      typology: r.typology,
      sectorName: r.secondaryLabel || '-',
      serviceName: r.primaryLabel,
      recordDate: r.recordDate,
      paydate: r.paydate,
      expireDate: r.expireDate ?? r.paydate,
      createdAt: r.createdAt ?? null,
      value: r.value,
      pay: r.pay,
      rest: r.rest,
      notes: r.notes,
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      lastPaymentDate: r.lastPaymentDate,
    };
    setPurchase(purchaseData);
    setOtherSettings({ operatorPassStatus: settings.operatorPassStatus });
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
      }))
    );
    setOptions(formOptions);

    if (settings.formPayDeadlineStatus === 'No' && purchaseData.rest > 0 && !autoPaid.current) {
      autoPaid.current = true;
      const defaultOperatorId = formOptions.currentOperatorId ?? formOptions.operators[0]?.id;
      if (defaultOperatorId) {
        await client.addPayment(id, {
          amountPaid: purchaseData.rest,
          paymentDate: new Date().toISOString().slice(0, 10),
          description: 'Auto-payment (deadline form disabled)',
          payMode: 'cash',
          operatorId: defaultOperatorId,
          createReceipt: false,
        });
        const reloaded = await client.fetchRecord(id);
        setPurchase({
          ...purchaseData,
          rest: 0,
          pay: reloaded.record.pay,
          value: reloaded.record.value,
        });
        setSuccess(`Payment fully auto-settled (€${purchaseData.rest.toFixed(2)}). Debt set to €0.`);
      }
    }
  }, [client, id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [load]);

  async function handleAddToRecordTotal(additionalAmount: number): Promise<void> {
    if (!purchase) return;
    const newTotal = purchase.value + additionalAmount;
    await client.updateRecord(id, { totalAmount: newTotal });
    setPurchase((prev) =>
      prev ? { ...prev, value: newTotal, rest: prev.rest + additionalAmount } : prev
    );
  }

  async function handleSubmit(values: ServicePaymentSubmitValues) {
    setError('');
    setSuccess('');
    if (purchase && values.amountPaid > purchase.rest) {
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
        serviceName: purchase?.serviceName,
      });
      setSuccess('Payment saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  // Payments must open on this member only — not the whole club list.
  const tabs = useMemo(() => {
    const memberId = purchase?.userId ?? null;
    const paymentsPath = getProcedureDefinition(PROCEDURE_TYPE_CODES.EXPENSE)!.routes.payments;
    return getProcedureTabs(PROCEDURE_TYPE_CODES.EXPENSE, 'deadlines', id, memberId).map((t) =>
      t.id === 'payments' && memberId
        ? { ...t, href: `${paymentsPath}${archiveScopeQuery(null, memberId)}` }
        : t
    );
  }, [id, purchase?.userId]);

  if ((!purchase || !options) && !error) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <ProcedureArchiveShell
        title="Payment — Expense"
        member={
          purchase ? { name: purchase.memberName, image: purchase.memberImage } : undefined
        }
        activeTab="deadlines"
        tabs={tabs}
        error={!purchase ? error : undefined}
      >
        {purchase && options && (
          <ServicePaymentForm
            purchase={purchase}
            payments={payments}
            options={options}
            procedureType="expense"
            saving={saving}
            error={error}
            success={success}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/clubs/expense_dead_line')}
            onAddToRecordTotal={handleAddToRecordTotal}
            operatorPassStatus={otherSettings?.operatorPassStatus ?? 'Yes'}
          />
        )}
      </ProcedureArchiveShell>
    </div>
  );
}
