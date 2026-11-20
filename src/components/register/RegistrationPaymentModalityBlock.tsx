'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  formatCountryPrice,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';
import {
  PAYMENT_MODES,
  enabledModes,
  normalizePaymentModalities,
  quotePaymentMode,
  roundEuro,
  splitIntoDeadlines,
  type PaymentModalitySettings,
  type PaymentModeCode,
} from '@/lib/subscriptions/paymentModalities';

type Props = {
  settings: PaymentModalitySettings;
  selected: PaymentModeCode;
  onSelect: (code: PaymentModeCode) => void;
  countryPrice?: CountryPriceInfo | null;
};

/**
 * Registration: modality A (monthly) is presented; "See more options" lists the other modalities
 * enabled for the version, which are generally cheaper than A.
 */
export default function RegistrationPaymentModalityBlock({ settings: raw, selected, onSelect, countryPrice = null }: Props) {
  const settings = normalizePaymentModalities(raw);
  const modes = enabledModes(settings);
  const [showAll, setShowAll] = useState(selected !== 'A');
  const factor = countryPrice?.factor ?? 1;
  const money = (eur: number) => formatCountryPrice(eur, countryPrice);

  const quoteFor = (code: PaymentModeCode) => {
    const q = quotePaymentMode(settings, code);
    const total = priceForCountry(q.total, factor);
    const amounts = splitIntoDeadlines(total, q.deadlines);
    return { ...q, total, monthly: roundEuro(total / 12), firstDeadline: amounts[0] };
  };

  const a = quoteFor('A');
  const current = quoteFor(selected);

  return (
    <div className="rounded-md border border-[#7a1f2e]/30 bg-white p-3 space-y-3">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-[#7a1f2e]">Subscription</div>
        <label className="mt-2 flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1">
          <input
            type="radio"
            name="payment-modality"
            checked={selected === 'A'}
            onChange={() => onSelect('A')}
            className="accent-[#7a1f2e]"
          />
          <span className="text-xl font-bold text-gray-900">{money(a.monthly)}/month</span>
          <span className="text-sm text-gray-700">
            ({money(a.total)} = 12 × {money(a.monthly)}) — A — {PAYMENT_MODES.A.label}
          </span>
        </label>
      </div>

      {modes.length > 1 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-[#337ab7] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#286090]"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? '' : '-rotate-90'}`} />
          See more options — other types of payment with discount
        </button>
      ) : null}

      {showAll ? (
        <div className="space-y-1 border-t border-gray-200 pt-2">
          {modes
            .filter((code) => code !== 'A')
            .map((code) => {
              const q = quoteFor(code);
              const saving = roundEuro(a.total - q.total);
              return (
                <label
                  key={code}
                  className={`flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 rounded px-2 py-1.5 ${
                    selected === code ? 'bg-[#7a1f2e]/5 ring-1 ring-[#7a1f2e]/30' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-modality"
                    checked={selected === code}
                    onChange={() => onSelect(code)}
                    className="accent-[#7a1f2e]"
                  />
                  <span className="min-w-[13rem] text-sm font-semibold text-gray-900">
                    {code} — {PAYMENT_MODES[code].label}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{money(q.total)}</span>
                  <span className="text-xs text-gray-600">{money(q.monthly)}/month</span>
                  <span className="text-xs text-gray-600">
                    {q.deadlines > 1 ? `${q.deadlines} payments of ${money(q.firstDeadline)}` : 'single payment'}
                  </span>
                  {saving > 0 ? <span className="text-xs font-semibold text-green-700">save {money(saving)}</span> : null}
                </label>
              );
            })}
        </div>
      ) : null}

      <p className="border-t border-gray-200 pt-2 text-xs text-gray-600">
        Subscription for 1 year. You pay <strong>{money(current.firstDeadline)}</strong> now
        {current.deadlines === 2
          ? `; the second payment of ${money(roundEuro(current.total - current.firstDeadline))} is due ${current.delayDays} days later.`
          : current.deadlines > 2
            ? `; the other ${current.deadlines - 1} payments of ${money(
                roundEuro((current.total - current.firstDeadline) / (current.deadlines - 1)),
              )} are due every ${current.delayDays} days.`
            : '.'}
      </p>
    </div>
  );
}
