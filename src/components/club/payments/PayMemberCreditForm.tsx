'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { MemberCreditFormOptions } from '@/lib/procedures/memberCreditFormOptions';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

const fieldInputClass =
  'h-[30px] w-full max-w-[420px] border border-gray-400 bg-white px-2 text-[13px] text-gray-900 outline-none focus:border-gray-600';

function FieldRow({
  label,
  children,
  labelExtra,
}: {
  label: string;
  children: ReactNode;
  labelExtra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex w-[220px] shrink-0 items-center justify-end gap-2 text-right text-[13px] text-gray-800 sm:w-[280px] md:w-[36%]">
        {labelExtra}
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type PayTarget = 'member' | 'employee';

export default function PayMemberCreditForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const presetMemberId =
    (typeof params?.memberId === 'string' ? params.memberId : '') ||
    searchParams.get('memberId') ||
    searchParams.get('userId') ||
    '';

  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.MEMBER_CREDIT)!;
  const client = useMemo(() => createProcedureClient(PROCEDURE_TYPE_CODES.MEMBER_CREDIT), []);

  const [options, setOptions] = useState<MemberCreditFormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [personLoading, setPersonLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);

  const [payTarget, setPayTarget] = useState<PayTarget>('member');
  const [memberId, setMemberId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  // PHP starts empty; user picks a date.
  const [creditDate, setCreditDate] = useState('');
  const [causal, setCausal] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [openPaymentAfterSave, setOpenPaymentAfterSave] = useState(false);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    client
      .fetchFormOptions<MemberCreditFormOptions>()
      .then((opts) => {
        setOptions(opts);
        if (opts.currentOperatorId) setOperatorId(opts.currentOperatorId);
        else if (opts.operators[0]?.id) setOperatorId(opts.operators[0].id);
        if (opts.companies[0]?.id) setCompanyId(opts.companies[0].id);
        if (presetMemberId && opts.members.some((m) => m.id === presetMemberId)) {
          setPayTarget('member');
          setMemberId(presetMemberId);
        } else if (presetMemberId && opts.operators.some((o) => o.id === presetMemberId)) {
          setPayTarget('employee');
          setEmployeeId(presetMemberId);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [client, presetMemberId]);

  const selectedMember = options?.members.find((m) => m.id === memberId);
  const selectedEmployee = options?.operators.find((o) => o.id === employeeId);
  const selectedCompany = options?.companies.find((c) => c.id === companyId);
  const selectedPerson = payTarget === 'member' ? selectedMember : selectedEmployee;
  const personImageUrl = resolvePublicImageUrl(selectedPerson?.image);
  const total = Number(amount) || 0;
  const typologyOfDeadline = payTarget === 'employee' ? '7' : '6';
  const payForLabel = payTarget === 'employee' ? 'Payment Employee' : 'Member Credit';

  useEffect(() => {
    const id = payTarget === 'member' ? memberId : employeeId;
    if (!id) return;
    setPersonLoading(true);
    const t = window.setTimeout(() => setPersonLoading(false), 250);
    return () => window.clearTimeout(t);
  }, [payTarget, memberId, employeeId]);

  function switchTarget(next: PayTarget) {
    setPayTarget(next);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const recipientId = payTarget === 'member' ? memberId : employeeId;
    if (!recipientId) {
      return setError(payTarget === 'member' ? 'Please select a member.' : 'Please select an employee.');
    }
    if (total <= 0) return setError('Please enter amount.');
    if (!creditDate) return setError('Please enter date.');
    if (!causal.trim()) return setError('Please enter causal.');

    setSaving(true);
    try {
      const result = await client.createRecord({
        memberId: recipientId,
        payTarget,
        totalAmount: total,
        recordDate: creditDate,
        dueDate: creditDate,
        causal: causal.trim(),
        operatorId: operatorId || null,
        typologyOfDeadline,
        companyId: companyId || null,
        companyName: selectedCompany?.name ?? null,
        openPaymentAfterSave,
      });

      if (openPaymentAfterSave && result.recordId) {
        router.push(def.routes.paymentDetail(result.recordId));
      } else {
        router.push(def.routes.deadlines);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="procedure-form p-8 text-center text-[13px] text-gray-800">Loading form...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="procedure-form text-gray-900">
      <div className="flex border-b border-gray-300 bg-[#f0f0f0] px-2 pt-2 text-[14px] font-bold">
        <button
          type="button"
          onClick={() => switchTarget('member')}
          className={`mr-1 px-4 py-2 ${
            payTarget === 'member' ? 'bg-black text-white' : 'bg-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Member
        </button>
        <button
          type="button"
          onClick={() => switchTarget('employee')}
          className={`px-4 py-2 ${
            payTarget === 'employee' ? 'bg-black text-white' : 'bg-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Employee
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 pt-2">
            <span className="w-36 shrink-0 text-right text-[13px] text-gray-800">
              {payTarget === 'member' ? 'Select a Member' : 'Select an Employee'}
            </span>
            {payTarget === 'member' ? (
              <select
                className={`${fieldInputClass} max-w-[420px]`}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Select</option>
                {options?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className={`${fieldInputClass} max-w-[420px]`}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select</option>
                {options?.operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex w-[120px] shrink-0 flex-col items-center">
            <div className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden border border-gray-400 bg-white">
              {personLoading && (
                <span className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                </span>
              )}
              {personImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={personImageUrl}
                  alt={selectedPerson?.name || 'Person'}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`flex h-full w-full flex-col items-center justify-center bg-gray-100 px-1 text-center ${
                  personImageUrl ? 'hidden' : ''
                }`}
              >
                <span className="text-[9px] font-bold leading-tight text-gray-600">NO IMAGE</span>
                <span className="text-[9px] font-bold leading-tight text-gray-600">AVAILABLE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="m-0 border-x-0 border-b border-t-0 border-gray-300">
        <div className="bg-[#d9d9d9] px-3 py-2 text-[13px] font-semibold text-gray-800">{payForLabel}</div>
        <div className="bg-white px-2 py-4">
          <FieldRow label="Amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={fieldInputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FieldRow>

          <FieldRow label="Date" labelExtra={<span className="text-xl">📅</span>}>
            <input
              type="date"
              className={fieldInputClass}
              value={creditDate}
              onChange={(e) => setCreditDate(e.target.value)}
            />
          </FieldRow>

          <FieldRow label="Causal">
            <input
              type="text"
              className={fieldInputClass}
              value={causal}
              onChange={(e) => setCausal(e.target.value)}
            />
          </FieldRow>

          <div className="flex items-start gap-3 py-3 pl-[8%] sm:pl-[36%]">
            <input
              id="open-payment-after-save"
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={openPaymentAfterSave}
              onChange={(e) => setOpenPaymentAfterSave(e.target.checked)}
            />
            <label htmlFor="open-payment-after-save" className="text-[13px] leading-snug text-gray-800">
              Open form of &quot;payment of deadlines&quot; after saving this debt.
            </label>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCompanyOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-[#a349a4] px-3 py-2 text-left text-[13px] font-semibold text-white"
      >
        <span>Company</span>
        <span className="text-[12px]">{companyOpen ? '▲' : '▼'}</span>
      </button>
      {companyOpen && (
        <div className="space-y-3 border-t border-purple-300 bg-white px-4 py-4">
          <p className="text-center text-[12px] text-gray-700">
            if activated multicompany option you can select the company for this payment
          </p>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-right text-[13px] text-gray-800">Company</span>
            <select
              className={fieldInputClass}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Default = main company</option>
              {options?.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="bg-[#d9d9d9] px-3 py-2 text-[13px] font-semibold text-gray-800">
            Put this expense as item of this center revenue
          </div>
          <FieldRow label="select the type of center revenue in which to put this expenses 1">
            <select className={fieldInputClass} disabled>
              <option>See the setting company Default= main company</option>
            </select>
          </FieldRow>
          <FieldRow label="select the type of center revenue in which to put this expenses 1">
            <select className={fieldInputClass} disabled>
              <option>See the setting company Default= main company</option>
            </select>
          </FieldRow>
        </div>
      )}

      <div className="flex justify-center gap-3 pb-6 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="min-w-[88px] rounded-sm bg-[#c62828] px-5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#b71c1c] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'save'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="min-w-[88px] rounded-sm bg-[#424242] px-5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#303030]"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
