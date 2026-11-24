'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ServicePaymentForm, {
  type ServicePaymentSubmitValues,
} from '@/components/club/services/ServicePaymentForm';
import ProcedureArchiveShell from '@/components/procedures/ProcedureArchiveShell';
import { archiveScopeQuery } from '@/lib/club/archives/archiveScope';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { getProcedureDefinition, getProcedureTabs } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type {
  ServiceSaleFormOptions,
  ServiceSalePayment,
  ServiceSalePurchase,
} from '@/lib/club/serviceSaleClient';
import { fetchOtherSettings } from '@/lib/club/otherSettingsClient';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

function MemberDeadlineHeader({
  memberName,
  memberImage,
}: {
  memberName: string;
  memberImage: string | null;
}) {
  const imageUrl = resolvePublicImageUrl(memberImage);
  const [broken, setBroken] = useState(false);

  return (
    <div className="relative mb-3 flex min-h-[56px] items-center gap-3 bg-[#8B0000] px-3 py-2 text-white">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-red-300/60 bg-[#6d0000]">
        {imageUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={memberName}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="px-0.5 text-center text-[8px] font-bold leading-tight text-red-100">
            NO
            <br />
            IMAGE
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 pr-28">
        <div className="truncate text-[15px] font-semibold">{memberName || 'Member'}</div>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-[16px] font-semibold tracking-wide">All Deadlines</span>
      </div>
    </div>
  );
}

function mapPurchase(r: {
  id: string;
  userId: string;
  memberName: string;
  memberImage: string | null;
  typology: string;
  secondaryLabel: string;
  primaryLabel: string;
  paydate: string | null;
  value: number;
  pay: number;
  rest: number;
  notes: string;
  operatorId: string | null;
  operatorName: string;
  lastPaymentDate: string | null;
  recordDate: string;
  expireDate: string | null;
  createdAt: string | null;
}): ServiceSalePurchase {
  return {
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
  };
}

function parseIds(primaryId: string, idsParam: string | null): string[] {
  const fromQuery = (idsParam || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ordered = fromQuery.length > 0 ? fromQuery : [primaryId];
  const unique: string[] = [];
  for (const id of ordered) {
    if (id && !unique.includes(id)) unique.push(id);
  }
  if (!unique.includes(primaryId)) unique.unshift(primaryId);
  return unique;
}

export default function MemberCreditPaymentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = String(params?.id ?? '');

  const client = useMemo(() => createProcedureClient(PROCEDURE_TYPE_CODES.MEMBER_CREDIT), []);
  const recordIds = useMemo(
    () => parseIds(id, searchParams?.get('ids') ?? null),
    [id, searchParams]
  );

  const [purchases, setPurchases] = useState<ServiceSalePurchase[]>([]);
  const [payments, setPayments] = useState<ServiceSalePayment[]>([]);
  const [options, setOptions] = useState<ServiceSaleFormOptions | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otherSettings, setOtherSettings] = useState<{ operatorPassStatus: string } | null>(null);
  const autoPaid = useRef(false);

  const purchase = purchases[0] ?? null;
  const extraPurchases = purchases.slice(1);
  const totalRest = purchases.reduce((sum, p) => sum + Math.max(0, p.rest), 0);

  const load = useCallback(async () => {
    const [records, paymentsRes, formOptions, settings] = await Promise.all([
      Promise.all(recordIds.map((recordId) => client.fetchRecord(recordId))),
      client.fetchPayments({ recordId: id, pageSize: 50 }),
      client.fetchFormOptions<{
        members: { id: string; name: string }[];
        operators: { id: string; name: string }[];
        currentOperatorId: string | null;
      }>(),
      fetchOtherSettings().catch(() => ({
        formPayDeadlineStatus: 'Yes',
        operatorPassStatus: 'Yes',
        calTaxStatus: false,
      })),
    ]);

    const mapped = records.map((res) => mapPurchase(res.record));
    const memberIds = new Set(mapped.map((p) => p.userId));
    if (memberIds.size > 1) {
      throw new Error('Selected deadlines belong to different members.');
    }

    setPurchases(mapped);
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
    setOptions({
      sectors: [],
      services: [],
      members: formOptions.members ?? [],
      operators: formOptions.operators ?? [],
      currentOperatorId: formOptions.currentOperatorId ?? null,
    });

    // Auto-settle logic when deadlines-form is disabled by settings.
    const primary = mapped[0];
    if (
      recordIds.length === 1 &&
      settings.formPayDeadlineStatus === 'No' &&
      primary &&
      primary.rest > 0 &&
      !autoPaid.current
    ) {
      autoPaid.current = true;
      const defaultOperatorId = formOptions.currentOperatorId ?? formOptions.operators?.[0]?.id;
      if (defaultOperatorId) {
        await client.addPayment(id, {
          amountPaid: primary.rest,
          paymentDate: new Date().toISOString().slice(0, 10),
          description: 'Auto-payment (deadline form disabled)',
          payMode: 'cash',
          operatorId: defaultOperatorId,
          createReceipt: false,
        });
        const reloaded = await client.fetchRecord(id);
        setPurchases([{ ...primary, rest: 0, pay: reloaded.record.pay, value: reloaded.record.value }]);
        setSuccess(`Payment fully auto-settled (€${primary.rest.toFixed(2)}). Debt set to €0.`);
      }
    }
  }, [client, id, recordIds]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [load]);

  // Payments must open on this member only — not the whole club list.
  const tabs = useMemo(() => {
    const memberId = purchase?.userId ?? null;
    const paymentsPath = getProcedureDefinition(PROCEDURE_TYPE_CODES.MEMBER_CREDIT)!.routes.payments;
    return getProcedureTabs(PROCEDURE_TYPE_CODES.MEMBER_CREDIT, 'deadlines', id, memberId)
      .filter((t) => t.id === 'deadlines' || t.id === 'payments')
      .map((t) =>
        t.id === 'payments' && memberId
          ? { ...t, href: `${paymentsPath}${archiveScopeQuery(null, memberId)}` }
          : t
      );
  }, [id, purchase?.userId]);

  async function handleAddToRecordTotal(additionalAmount: number): Promise<void> {
    if (!purchase) return;
    const newTotal = purchase.value + additionalAmount;
    await client.updateRecord(id, { totalAmount: newTotal });
    setPurchases((prev) =>
      prev.map((p, i) => (i === 0 ? { ...p, value: newTotal, rest: p.rest + additionalAmount } : p))
    );
  }

  async function handleSubmit(values: ServicePaymentSubmitValues) {
    setError('');
    setSuccess('');
    if (values.amountPaid > totalRest) {
      setError('Payment exceeds remaining balance.');
      return;
    }
    setSaving(true);
    try {
      const distributions =
        values.distributions?.filter((d) => d.amount > 0 && d.installmentId !== 'current') ?? [];

      if (recordIds.length > 1 && distributions.length > 0) {
        for (const dist of distributions) {
          if (!recordIds.includes(dist.installmentId)) continue;
          await client.addPayment(dist.installmentId, {
            amountPaid: dist.amount,
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
            createReceipt: values.createReceipt && dist.installmentId === id,
            receiptNumber: values.receiptNumber,
            receiptAnnotations: values.description,
            serviceName: purchases.find((p) => p.id === dist.installmentId)?.serviceName,
          });
        }
      } else {
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
      }

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
        <MemberDeadlineHeader memberName={purchase.memberName} memberImage={purchase.memberImage} />
      )}
      <ProcedureArchiveShell
        title="All Deadlines"
        activeTab="deadlines"
        tabs={tabs}
        error={!purchase ? error : undefined}
      >
        {purchase && options && (
          <ServicePaymentForm
            purchase={purchase}
            extraPurchases={extraPurchases}
            payments={payments}
            options={options}
            procedureType="member_credit"
            saving={saving}
            error={error}
            success={success}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/clubs/member_credit_dead_line')}
            operatorPassStatus={otherSettings?.operatorPassStatus ?? 'Yes'}
            onAddToRecordTotal={extraPurchases.length > 0 ? undefined : handleAddToRecordTotal}
          />
        )}
      </ProcedureArchiveShell>
    </div>
  );
}

