'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createProcedureClient } from '@/lib/club/procedureClient';
import { getProcedureDefinition } from '@/lib/procedures/registry';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { MemberDebtFormOptions } from '@/lib/procedures/memberDebtFormOptions';
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

export default function DebtMemberForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const presetMemberId =
    (typeof params?.memberId === 'string' ? params.memberId : '') ||
    searchParams.get('memberId') ||
    searchParams.get('userId') ||
    '';
  const def = getProcedureDefinition(PROCEDURE_TYPE_CODES.MEMBER_DEBT)!;
  const client = useMemo(() => createProcedureClient(PROCEDURE_TYPE_CODES.MEMBER_DEBT), []);

  const [options, setOptions] = useState<MemberDebtFormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  // PHP starts empty; user picks a date via the datepicker.
  const [debtDate, setDebtDate] = useState('');
  const [causal, setCausal] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [typologyOfDeadline, setTypologyOfDeadline] = useState('5');
  const [openPaymentAfterSave, setOpenPaymentAfterSave] = useState(false);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    client
      .fetchFormOptions<MemberDebtFormOptions>()
      .then((opts) => {
        setOptions(opts);
        if (presetMemberId && opts.members.some((m) => m.id === presetMemberId)) {
          setMemberId(presetMemberId);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [client, presetMemberId]);

  const selectedMember = options?.members.find((m) => m.id === memberId);
  const selectedCompany = options?.companies.find((c) => c.id === companyId);
  const memberImageUrl = resolvePublicImageUrl(selectedMember?.image);
  const total = Number(amount) || 0;

  useEffect(() => {
    if (!memberId) return;
    setMemberLoading(true);
    const t = window.setTimeout(() => setMemberLoading(false), 250);
    return () => window.clearTimeout(t);
  }, [memberId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!memberId) return setError('Please select a member.');
    if (total <= 0) return setError('Please enter amount.');
    if (!debtDate) return setError('Please enter date.');
    if (!causal.trim()) return setError('Please enter causal.');

    setSaving(true);
    try {
      const result = await client.createRecord({
        memberId,
        totalAmount: total,
        recordDate: debtDate,
        dueDate: debtDate,
        causal: causal.trim(),
        notes: causal.trim(),
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
      {error && (
        <div className="mx-4 mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Member + profile image */}
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 pt-2">
            <span className="w-16 shrink-0 text-right text-[13px] text-gray-800">Member</span>
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
          </div>

          <div className="flex w-[120px] shrink-0 flex-col items-center">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Profile image
            </div>
            <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden border border-gray-400 bg-white">
              {memberImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={memberImageUrl}
                  alt={selectedMember?.name || 'Member'}
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
                  memberImageUrl ? 'hidden' : ''
                }`}
              >
                <span className="text-[9px] font-bold leading-tight text-gray-600">NO IMAGE</span>
                <span className="text-[9px] font-bold leading-tight text-gray-600">AVAILABLE</span>
              </div>
            </div>
          </div>
        </div>

        {memberLoading && (
          <div className="flex justify-center py-2">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Pay a member section */}
      <div className="m-0 border-x-0 border-b border-t-0 border-gray-300 sm:m-0">
        <div className="bg-[#d9d9d9] px-3 py-2 text-[13px] font-semibold text-gray-800">
          Add a debt
        </div>

        <div className="bg-white px-2 py-2">
          <FieldRow label="Amout">
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
              value={debtDate}
              onChange={(e) => setDebtDate(e.target.value)}
            />
          </FieldRow>

          <FieldRow label="Causal">
            <div className="flex max-w-[460px] items-center gap-1">
              <input
                type="text"
                className={`${fieldInputClass} max-w-none flex-1`}
                value={causal}
                onChange={(e) => setCausal(e.target.value)}
              />
             
            </div>
          </FieldRow>

          <FieldRow label="Operator">
            <select
              className={fieldInputClass}
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
            >
              <option value="">Select</option>
              {options?.operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Typology of Deadline">
            <select
              className={fieldInputClass}
              value={typologyOfDeadline}
              onChange={(e) => setTypologyOfDeadline(e.target.value)}
            >
              {options?.typologies.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FieldRow>

          <div className="flex items-start gap-3 py-3 pl-[8%]">
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

        {/* Company accordion */}
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
      </div>

      <div className="flex justify-center gap-3 pb-6 pt-2">
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
