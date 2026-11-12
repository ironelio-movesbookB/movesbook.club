'use client';

import Link from 'next/link';
import type { SubscriptionGeneralSettings, SubscriptionListRow } from '@/types/adminSubscriptionSettings';
import SubscriptionPricingPresentation from './SubscriptionPricingPresentation';
import ModalityVarianceControl from './ModalityVarianceControl';
import {
  ALWAYS_ENABLED_MODES,
  PAYMENT_MODES,
  PAYMENT_MODE_CODES,
  clampDiscount,
  clampVariance,
  normalizePaymentModalities,
  quotePaymentMode,
  renewalPriceFor,
  roundEuro,
  type PaymentModalitySettings,
  type VariableModeCode,
} from '@/lib/subscriptions/paymentModalities';

type Props = {
  general: SubscriptionGeneralSettings;
  row: SubscriptionListRow;
  onChange: (general: SubscriptionGeneralSettings) => void;
};

function FieldInput({
  label,
  value,
  onChange,
  highlight = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-700 whitespace-nowrap">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`border px-2 py-1 text-sm w-24 focus:outline-none focus:border-gray-400 ${
          highlight ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-[#fffacd]'
        }`}
      />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-300">
      <div className="bg-[#5bc0de] text-white px-3 py-1.5 text-xs font-bold">{title}</div>
      <p className="border-b border-gray-200 bg-[#f9fcfe] px-3 py-1.5 text-xs text-gray-600">{hint}</p>
      <div className="p-3 flex flex-wrap items-center gap-6">{children}</div>
    </div>
  );
}

function eur(value: number): string {
  return `€ ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "Price list" tab of a version: 1th subscription, renewal (now a % discount), triple subscription
 * and the payment modalities A–F with their "enabled at registration" checkboxes.
 */
export default function SubscriptionPriceListForm({ general, row, onChange }: Props) {
  const modalitiesSaved = Boolean(general.paymentModalities);
  const modalities = normalizePaymentModalities(general.paymentModalities);

  const update = (patch: Partial<SubscriptionGeneralSettings>) => onChange({ ...general, ...patch });

  /** Modalities change → keep the derived renewal price of the 1th subscription in sync. */
  const updateModalities = (patch: Partial<PaymentModalitySettings>, opts?: { syncRenewal?: boolean }) => {
    const next = normalizePaymentModalities({ ...modalities, ...patch });
    onChange({
      ...general,
      paymentModalities: next,
      ...(opts?.syncRenewal ? { renewalPrice: renewalPriceFor(general.firstSubscriptionPrice, next) } : {}),
    });
  };

  const updateFirstPrice = (value: string) => {
    const firstSubscriptionPrice = Number(value) || 0;
    onChange({
      ...general,
      firstSubscriptionPrice,
      ...(modalitiesSaved ? { renewalPrice: renewalPriceFor(firstSubscriptionPrice, modalities) } : {}),
    });
  };

  return (
    <div className="space-y-4 bg-white p-4 shadow-sm">
      <Section
        title={`1th subscription ${row.name}`}
        hint="Shown during registration when the user subscribes for the first time"
      >
        <FieldInput
          label="Days durations :"
          value={general.firstSubscriptionDays}
          onChange={(v) => update({ firstSubscriptionDays: Number(v) || 0 })}
          highlight
        />
        <FieldInput label="Price 1th subscription :" value={general.firstSubscriptionPrice} onChange={updateFirstPrice} highlight />
        <FieldInput
          label="Discount with promocode:"
          value={general.firstSubscriptionPromoDiscount}
          onChange={(v) => update({ firstSubscriptionPromoDiscount: Number(v) || 0 })}
        />
      </Section>

      <Section
        title="Standard or renewal"
        hint="Shown when the user renews an already existing subscription. The renewal price is the 1th subscription price minus the renewal discount (also applied to modalities A–F)."
      >
        <FieldInput
          label="Days durations :"
          value={general.renewalDays}
          onChange={(v) => update({ renewalDays: Number(v) || 0 })}
          highlight
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={modalities.renewalDiscountEnabled}
            onChange={(e) => updateModalities({ renewalDiscountEnabled: e.target.checked }, { syncRenewal: true })}
            className="h-4 w-4"
          />
          % Discount for renewal
          <input
            type="number"
            min={0}
            max={99}
            value={modalities.renewalDiscountPercent}
            onChange={(e) => updateModalities({ renewalDiscountPercent: clampDiscount(e.target.value) }, { syncRenewal: true })}
            disabled={!modalities.renewalDiscountEnabled}
            className="w-16 border border-red-400 bg-red-50 px-2 py-1 text-right text-sm disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
          />
          %
        </label>
        <span className="text-sm text-gray-700">
          Renewal price: <strong>{eur(general.renewalPrice)}</strong>
        </span>
        <FieldInput
          label="Discount with promocode:"
          value={general.renewalPromoDiscount}
          onChange={(v) => update({ renewalPromoDiscount: Number(v) || 0 })}
        />
      </Section>

      <Section
        title="Triple subscription"
        hint="Optional extra discount — displayed under the standard cost during registration (duration is 3× the active scenario)"
      >
        <FieldInput
          label="Discount Triple Duration %"
          value={general.tripleDurationDiscount}
          onChange={(v) => update({ tripleDurationDiscount: Number(v) || 0 })}
          highlight
        />
        <FieldInput
          label="Price :"
          value={general.tripleDurationPrice}
          onChange={(v) => update({ tripleDurationPrice: Number(v) || 0 })}
          highlight
        />
      </Section>

      <SubscriptionPricingPresentation general={general} />

      <div className="border border-gray-300">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#337ab7] px-3 py-1.5 text-xs font-bold text-white">
          <span>Modalities of subscription A–F</span>
          <Link href="/admin/global-settings/subscription-modalities" className="font-normal underline">
            Modality of subscription available (presets)
          </Link>
        </div>
        <p className="border-b border-gray-200 bg-[#f9fcfe] px-3 py-1.5 text-xs text-gray-600">
          D is the yearly price of reference; the others are a ± % of D. Tick <strong>Enabled</strong> to offer a modality at
          registration — A and D are always offered.
          {!modalitiesSaved && (
            <span className="ml-1 font-semibold text-amber-700">
              Not set for this version yet: example values are shown. Change them here and Save, or APPLY a preset.
            </span>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f0f0f0] text-left text-xs text-gray-700">
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Modality</th>
                <th className="px-3 py-2">Price / % variance from D</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Monthly</th>
                <th className="px-3 py-2">Deadlines</th>
                <th className="px-3 py-2 text-right">Renewal total</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_MODE_CODES.map((code) => {
                const q = quotePaymentMode(modalities, code);
                const renewal = quotePaymentMode(modalities, code, { renewal: true });
                const locked = ALWAYS_ENABLED_MODES.includes(code);
                return (
                  <tr key={code} className={`border-t border-gray-200 ${code === 'D' ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={modalities.enabled[code]}
                        disabled={locked}
                        onChange={(e) => updateModalities({ enabled: { ...modalities.enabled, [code]: e.target.checked } })}
                        className="h-4 w-4"
                        aria-label={`Enable modality ${code}`}
                        title={locked ? 'Always offered at registration' : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {code} — {PAYMENT_MODES[code].label}
                    </td>
                    <td className="px-3 py-2">
                      {code === 'D' ? (
                        <label className="flex items-center gap-1">
                          €
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={modalities.yearlyPrice}
                            onChange={(e) => updateModalities({ yearlyPrice: Math.max(0, roundEuro(Number(e.target.value) || 0)) })}
                            className="h-8 w-28 rounded border border-amber-400 px-2 text-right font-semibold"
                            aria-label="Yearly price of D"
                          />
                        </label>
                      ) : (
                        <ModalityVarianceControl
                          code={code as VariableModeCode}
                          value={modalities.variance[code as VariableModeCode]}
                          onChange={(c, v) => updateModalities({ variance: { ...modalities.variance, [c]: clampVariance(v) } })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{eur(q.total)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{eur(q.monthly)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {eur(q.deadlineAmount)} × {q.deadlines}
                      {q.delayDays ? `, every ${q.delayDays} days` : ''}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                      {modalities.renewalDiscountEnabled ? eur(renewal.total) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
