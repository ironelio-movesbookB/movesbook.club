'use client';
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import ProcedureFormSection, {
  ProcedureFormCell,
  ProcedureFormGrid,
  procedureHighlightInputClass,
  procedureInputClass,
  procedureReadonlyInputClass,
} from '@/components/procedures/ProcedureFormLayout';
import TaxDocumentModal, { type TaxDocumentFormValues } from '@/components/procedures/TaxDocumentModal';
import PaymentModeSelect from '@/components/club/PaymentModeSelect';
import { useClubDefaultPaymentMethods } from '@/hooks/useClubDefaultPaymentMethods';
import {
  createPurchase,
  fetchFormOptions,
  fetchMemberDiscount,
  fetchServiceCost,
  type ServiceSaleFormOptions,
} from '@/lib/club/serviceSaleClient';
import { fetchCompanies } from '@/lib/club/archives/clubArchiveClient';
import { fetchOtherSettings } from '@/lib/club/otherSettingsClient';

type Props = {
  initialMemberId?: string;
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function applyDiscount(cost: number, discountPct: number, enabled: boolean): number {
  if (!enabled || discountPct <= 0) return cost;
  return Math.round(cost * (1 - discountPct / 100) * 100) / 100;
}

async function resolveInitialMemberId(
  options: ServiceSaleFormOptions,
  initialMemberId: string
): Promise<string> {
  const direct = options.members.find((m) => m.id === initialMemberId);
  if (direct) return direct.id;

  const legacyNumeric = initialMemberId.match(/^\d+$/) ? initialMemberId : null;
  if (legacyNumeric) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const clubId = typeof window !== 'undefined' ? localStorage.getItem('selectedClub') : null;
    const qs = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';
    try {
      const res = await fetch(`/api/club/members/resolve-legacy/${legacyNumeric}${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.memberId) return String(data.memberId);
    } catch {
      /* fall through */
    }
  }

  return '';
}

export default function ServicePurchaseForm({ initialMemberId }: Props) {
  const router = useRouter();
  const [options, setOptions] = useState<ServiceSaleFormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [baseCost, setBaseCost] = useState(0);
  const [value, setValue] = useState('');
  const [pay, setPay] = useState('');
  const [movementDate, setMovementDate] = useState(todayDate);
  const [movementTime, setMovementTime] = useState(nowTime);
  const [expireDate, setExpireDate] = useState('');
  const [causal, setCausal] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const defaultPaymentMethods = useClubDefaultPaymentMethods();
  const [taxDoc, setTaxDoc] = useState(true);
  const [taxDocument, setTaxDocument] = useState<TaxDocumentFormValues | null>(null);
  const [discountEnabled, setDiscountEnabled] = useState(true);
  const [discountPct, setDiscountPct] = useState('0');
  const [loadingDiscount, setLoadingDiscount] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [operatorPassStatus, setOperatorPassStatus] = useState('No');
  const isPasswordEnabled = (() => {
    const v = operatorPassStatus.trim().toLowerCase();
    return v === 'yes' || v === 'y' || v === '1' || v === 'true' || v === 't';
  })();
  const [formPayDeadlineStatus, setFormPayDeadlineStatus] = useState('Yes');
  const [notEnterCustData, setNotEnterCustData] = useState(false);

  useEffect(() => {
    fetchFormOptions()
      .then(async (data) => {
        setOptions(data);
        const co = await fetchCompanies().catch(() => []);
        setCompanies(co);
        if (co[0]?.id) setCompanyId(co[0].id);
        if (initialMemberId) {
          const resolved = await resolveInitialMemberId(data, initialMemberId);
          if (resolved) setMemberId(resolved);
        }
        if (data.currentOperatorId) setOperatorId(data.currentOperatorId);
        else if (data.operators[0]?.id) setOperatorId(data.operators[0].id);
        const settings = await fetchOtherSettings().catch((e) => {
          console.error('[ServicePurchaseForm] fetchOtherSettings failed:', e);
          return null;
        });
        console.log('[ServicePurchaseForm] settings:', settings);
        if (settings) {
          console.log('[ServicePurchaseForm] settings loaded:', settings);
          setOperatorPassStatus(settings.operatorPassStatus);
          setFormPayDeadlineStatus(settings.formPayDeadlineStatus);
          setNotEnterCustData(settings.notEnterCustData);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [initialMemberId]);

  const filteredServices = useMemo(() => {
    if (!options) return [];
    if (!sectorId) return options.services;
    return options.services.filter((s) => s.sectorId === sectorId);
  }, [options, sectorId]);

  const selectedMember = options?.members.find((m) => m.id === memberId);
  const selectedService = options?.services.find((s) => s.id === serviceId);
  const total = Number(value) || 0;
  const paid = pay === '' ? 0 : Number(pay);
  const rest = Math.max(0, total - paid);

  useEffect(() => {
    if (!memberId) {
      setDiscountPct('0');
      return;
    }
    setLoadingDiscount(true);
    fetchMemberDiscount(memberId)
      .then((discount) => {
        setDiscountPct(String(discount));
      })
      .catch(() => setDiscountPct('0'))
      .finally(() => setLoadingDiscount(false));
  }, [memberId]);

  useEffect(() => {
    if (baseCost <= 0) return;
    const pct = Number(discountPct) || 0;
    const discounted = applyDiscount(baseCost, pct, discountEnabled);
    setValue(String(discounted));
  }, [baseCost, discountPct, discountEnabled]);

  async function loadCostFromApi(id: string) {
    try {
      const cost = await fetchServiceCost(id);
      if (cost != null) {
        setBaseCost(cost);
        const pct = Number(discountPct) || 0;
        setValue(String(applyDiscount(cost, pct, discountEnabled)));
      }
    } catch {
      const svc = options?.services.find((s) => s.id === id);
      if (svc) {
        setBaseCost(svc.cost);
        const pct = Number(discountPct) || 0;
        setValue(String(applyDiscount(svc.cost, pct, discountEnabled)));
      }
    }
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    if (id) {
      const svc = options?.services.find((s) => s.id === id);
      if (svc && sectorId !== svc.sectorId) setSectorId(svc.sectorId);
      loadCostFromApi(id);
    } else {
      setBaseCost(0);
      setValue('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!memberId) return setError('Please select a user.');
    if (!serviceId) return setError('Please select a service.');
    if (!value || Number(value) < 0) return setError('Please enter a valid cost.');
    if (paid > total) return setError('Payment cannot exceed total cost.');
    if (!expireDate) return setError('Please enter the expiration date of the service.');
    if (expireDate < movementDate)
      return setError('The expiration date cannot be earlier than the date of the movement.');
    if (!operatorId) return setError('Please select an operator.');
    if (isPasswordEnabled && !operatorPassword.trim()) return setError('Operator password is required.');

    const selectedSector = options?.sectors.find((s) => s.id === sectorId);

    setSaving(true);
    try {
      const result = await createPurchase({
        userId: memberId,
        sectorId,
        serviceId,
        sectorName: selectedSector?.name,
        serviceName: selectedService?.name,
        value: total,
        pay: paid,
        recordDate: movementDate,
        movementTime,
        expireDate,
        causal,
        payMode,
        operatorId,
        operatorPassword,
        discount: Number(discountPct) || 0,
        discountApplied: discountEnabled,
        taxDoc,
        taxDocument: taxDocument ?? undefined,
        companyId: companyId || undefined,
        companyName: companies.find((c) => c.id === companyId)?.name,
        createReceipt: Boolean(taxDoc && taxDocument && paid > 0),
        receiptDocumentType: taxDocument?.documentType ?? 'Invoice',
        receiptNumber: taxDocument?.documentNumber || undefined,
        receiptAnnotations: taxDocument?.causal || undefined,
      });

      router.push(`/clubs/archive_service_list?created=${result.purchaseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-600">Loading form...</div>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-6">
        <ProcedureFormSection title="Movement data">
          <ProcedureFormGrid>
            <ProcedureFormCell label="User Selected">
              <select
                className={procedureInputClass}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Select user</option>
                {options?.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Discount">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={(e) => setDiscountEnabled(e.target.checked)}
                />
                <input
                  type="text"
                  className={procedureInputClass}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="%"
                />
                {loadingDiscount && <span className="text-xs text-gray-500">Loading…</span>}
              </div>
            </ProcedureFormCell>
            <ProcedureFormCell label="Date">
              <input
                type="date"
                className={procedureInputClass}
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Hour">
              <input
                type="time"
                className={procedureInputClass}
                value={movementTime}
                onChange={(e) => setMovementTime(e.target.value)}
              />
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Payment">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Sector">
              <select
                className={procedureInputClass}
                value={sectorId}
                onChange={(e) => {
                  setSectorId(e.target.value);
                  setServiceId('');
                  setBaseCost(0);
                  setValue('');
                }}
              >
                <option value="">All</option>
                {options?.sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Service">
              <div className="flex items-center gap-2">
                <select
                  className={procedureInputClass + ' flex-1'}
                  value={serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  <option value="">Select service</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {selectedService?.imageUrl && (
                  <Image
                    src={selectedService.imageUrl}
                    alt=""
                    className="h-10 w-14 flex-shrink-0 rounded border border-gray-200 bg-gray-50 object-cover"
                    width={56}
                    height={40}
                    unoptimized
                  />
                )}
              </div>
            </ProcedureFormCell>
            <ProcedureFormCell label="Value">
              <input
                type="number"
                min="0"
                step="0.01"
                className={procedureInputClass}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Pay">
              <input
                type="number"
                min="0"
                step="0.01"
                className={procedureHighlightInputClass}
                style={{ backgroundColor: '#fff984' }}
                value={pay}
                onChange={(e) => setPay(e.target.value)}
                placeholder="0"
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Expiration Date *">
              <input
                type="date"
                required
                min={movementDate}
                className={procedureHighlightInputClass}
                style={{ backgroundColor: '#d3f07b' }}
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Causal">
              <input
                type="text"
                className={procedureInputClass}
                value={causal}
                onChange={(e) => setCausal(e.target.value)}
              />
            </ProcedureFormCell>
          </ProcedureFormGrid>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded">
            <div>Total: <strong>€{total.toFixed(2)}</strong></div>
            <div>Paid: <strong>€{paid.toFixed(2)}</strong></div>
            <div>Rest: <strong className="text-red-600">€{rest.toFixed(2)}</strong></div>
          </div>
        </ProcedureFormSection>

        <ProcedureFormSection title="Type of payment">
          <ProcedureFormGrid>
            <ProcedureFormCell label="Payment method">
              <PaymentModeSelect
                className={procedureInputClass}
                value={payMode}
                onChange={setPayMode}
                defaultPaymentMethods={defaultPaymentMethods}
                allowEmpty={false}
              />
            </ProcedureFormCell>
            <ProcedureFormCell label="Tax document">
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="checkbox"
                  checked={taxDoc}
                  onChange={(e) => setTaxDoc(e.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => setTaxModalOpen(true)}
                  disabled={!taxDoc}
                  className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Open form
                </button>
              </div>
            </ProcedureFormCell>
            <ProcedureFormCell label="Operator">
              <select
                className={procedureInputClass}
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value="">Select operator</option>
                {options?.operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            {isPasswordEnabled && (
              <ProcedureFormCell label="Password">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={procedureInputClass}
                    value={operatorPassword}
                    onChange={(e) => setOperatorPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </ProcedureFormCell>
            )}
          </ProcedureFormGrid>
        </ProcedureFormSection>

        <ProcedureFormSection title="Company" titleClassName="text-green-800">
          <p className="text-center text-sm text-gray-600 mb-4">
            If activated multi company option you can select the company for the payment
          </p>
          <ProcedureFormGrid>
            <ProcedureFormCell label="Company">
              <select
                className={procedureInputClass}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Select type of center revenue in which to put this expense 1">
              <select className={procedureInputClass} disabled>
                <option>Cash</option>
              </select>
            </ProcedureFormCell>
            <ProcedureFormCell label="Select the type of center revenue in which to put this expense 2">
              <select className={procedureInputClass} disabled>
                <option>Cash</option>
              </select>
            </ProcedureFormCell>
          </ProcedureFormGrid>
        </ProcedureFormSection>

        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/clubs/archive_service_list')}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>

      <TaxDocumentModal
        open={taxModalOpen}
        memberName={selectedMember?.name ?? ''}
        defaultCausal={causal}
        defaultTotal={total}
        defaultResidual={rest}
        initial={taxDocument ?? undefined}
        hideMemberName={notEnterCustData}
        onClose={() => setTaxModalOpen(false)}
        onSave={(values) => {
          setTaxDocument(values);
          setTaxDoc(true);
        }}
      />
    </>
  );
}
