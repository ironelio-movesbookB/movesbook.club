'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ServicePaymentForm, {
  type ServicePaymentSubmitValues,
} from '@/components/club/services/ServicePaymentForm';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import { createProcedureClient } from '@/lib/club/procedureClient';
import {
  fetchExpenseInvoicePreview,
  removeExpenseInvoice,
  uploadExpenseInvoice,
} from '@/lib/club/expenseInvoiceClient';
import {
  getProcedureDefinition,
  getProcedureTabs,
} from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type {
  ServiceSaleFormOptions,
  ServiceSalePayment,
  ServiceSalePurchase,
} from '@/lib/club/serviceSaleClient';
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
  const [otherSettings, setOtherSettings] = useState<{
    operatorPassStatus: string;
  } | null>(null);
  const autoPaid = useRef(false);
  const invoicePreviewUrl = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [purchaseRes, paymentsRes, formOptions, settings] = await Promise.all(
      [
        client.fetchRecord(id),
        client.fetchPayments({ recordId: id, pageSize: 50 }),
        client.fetchFormOptions<ServiceSaleFormOptions>(),
        fetchOtherSettings().catch(() => ({
          formPayDeadlineStatus: 'Yes',
          operatorPassStatus: 'Yes',
          calTaxStatus: false,
        })),
      ],
    );
    const r = purchaseRes.record;
    let expenseInvoice = r.expenseInvoice ?? null;
    if (expenseInvoice) {
      try {
        const previewUrl = await fetchExpenseInvoicePreview(id);
        if (invoicePreviewUrl.current)
          URL.revokeObjectURL(invoicePreviewUrl.current);
        invoicePreviewUrl.current = previewUrl;
        expenseInvoice = { ...expenseInvoice, url: previewUrl };
      } catch (previewError) {
        setError(
          previewError instanceof Error
            ? `Invoice preview could not be loaded: ${previewError.message}`
            : 'Invoice preview could not be loaded.',
        );
        expenseInvoice = null;
      }
    }
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
      expenseInvoice,
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
      })),
    );
    setOptions(formOptions);

    if (
      settings.formPayDeadlineStatus === 'No' &&
      purchaseData.rest > 0 &&
      !autoPaid.current
    ) {
      autoPaid.current = true;
      const defaultOperatorId =
        formOptions.currentOperatorId ?? formOptions.operators[0]?.id;
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
        setSuccess(
          `Payment fully auto-settled (€${purchaseData.rest.toFixed(2)}). Debt set to €0.`,
        );
      }
    }
  }, [client, id]);

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof Error ? e.message : 'Failed to load'),
    );
  }, [load]);

  useEffect(
    () => () => {
      if (invoicePreviewUrl.current)
        URL.revokeObjectURL(invoicePreviewUrl.current);
    },
    [],
  );

  async function handleUploadInvoice(file: File) {
    const result = await uploadExpenseInvoice(id, file);
    const previewUrl = await fetchExpenseInvoicePreview(id);
    if (invoicePreviewUrl.current)
      URL.revokeObjectURL(invoicePreviewUrl.current);
    invoicePreviewUrl.current = previewUrl;
    setPurchase((current) =>
      current && result.invoice
        ? { ...current, expenseInvoice: { ...result.invoice, url: previewUrl } }
        : current,
    );
  }

  async function handleRemoveInvoice() {
    const result = await removeExpenseInvoice(id);
    if (invoicePreviewUrl.current)
      URL.revokeObjectURL(invoicePreviewUrl.current);
    invoicePreviewUrl.current = null;
    setPurchase((current) =>
      current ? { ...current, expenseInvoice: result.invoice } : current,
    );
  }

  async function handleAddToRecordTotal(
    additionalAmount: number,
    adminPassword: string,
  ): Promise<void> {
    if (!purchase) return;
    const newTotal = purchase.value + additionalAmount;
    await client.updateRecord(id, { totalAmount: newTotal, adminPassword });
    setPurchase((prev) =>
      prev
        ? { ...prev, value: newTotal, rest: prev.rest + additionalAmount }
        : prev,
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
    let paymentsSaved = 0;
    try {
      const distributions = values.distributions.filter(
        (distribution) => distribution.amount > 0,
      );
      for (const distribution of distributions) {
        await client.addPayment(id, {
          amountPaid: distribution.amount,
          installmentId:
            distribution.installmentId === "current"
              ? undefined
              : distribution.installmentId,
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
        paymentsSaved += 1;
      }
      setSuccess(
        `${paymentsSaved} ${paymentsSaved === 1 ? "payment" : 'payments'} saved.`,
      );
      await load();
    } catch (err) {
      if (paymentsSaved > 0) await load().catch(() => undefined);
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(
        paymentsSaved > 0
          ? `${paymentsSaved} of the selected payments were saved. ${message}`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  // Payments must open on this member only — not the whole club list.
  const tabs = useMemo(() => {
    const memberId = purchase?.userId ?? null;
    const paymentsPath = getProcedureDefinition(PROCEDURE_TYPE_CODES.EXPENSE)!
      .routes.payments;
    return getProcedureTabs(
      PROCEDURE_TYPE_CODES.EXPENSE,
      'deadlines',
      id,
      memberId,
    ).map((t) =>
      t.id === 'payments' && memberId
        ? { ...t, href: `${paymentsPath}${archiveScopeQuery(null, memberId)}` }
        : t,
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
          purchase
            ? { name: purchase.memberName, image: purchase.memberImage }
            : undefined
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
            onUploadExpenseInvoice={handleUploadInvoice}
            onRemoveExpenseInvoice={handleRemoveInvoice}
            operatorPassStatus={otherSettings?.operatorPassStatus ?? 'Yes'}
          />
        )}
      </ProcedureArchiveShell>
    </div>
  );
}
