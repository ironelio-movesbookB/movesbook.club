'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { CountryEditSavePayload, CountryExtendedSettings } from './countryEditTypes';
import { CountryPartnersListModal } from './CountryPartnersListModal';
import { CountryRegionsModal } from './CountryRegionsModal';
import {
  loadCountryExtendedSettings,
  saveCountryExtendedSettings,
} from '@/lib/countries/countrySettingsStorage';
import { countryFlagSrc } from '@/lib/countries/countryFlag';
import {
  COUNTRY_SLIDER_MAX,
  COUNTRY_SLIDER_MIN,
  clampSliderPercent,
  computeCountryPrice,
  localAmount,
  sliderForFinalCost,
  type CountryPricingHeader,
  type CountryPricingSettings,
} from '@/lib/countries/countryPriceFormula';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';

export type CountryRow = {
  id: number;
  name: string;
  iso2: string;
  continent: string;
  population: number;
  officialLanguage: string;
  primaryLanguage: string;
  secondaryLanguage: string;
  eurRate: number;
  usdRate: number;
  currencyCode: string;
  regions: number;
  /** Admin “setting completed” flag; used for list filtering */
  settingCompleted?: boolean;
};

const CONTINENTS = [
  'West Asia',
  'West Europe',
  'North Africa',
  'South America',
  'East Europe',
  'Central America',
  'Oceania',
  'East Asia',
  'North America',
  'Caribbean',
  'South Asia',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'French',
  'Spanish',
  'Arabic',
  'German',
  'Russian',
  'Italian',
  'Dutch',
  'Urdu',
  'Bengali',
  'Albanian',
  'Azerbaijani',
  'Portuguese',
  '—',
];

const INCOME_CURRENCIES = ['EUR', 'USD'] as const;

const CURRENCY_NAMES: Record<string, string> = {
  AFN: 'Afghani',
  ALL: 'Lek',
  DZD: 'Dinar',
  ARS: 'Peso',
  AMD: 'Dram',
  AWG: 'Florin',
  AUD: 'Dollar',
  EUR: 'Euro',
  AZN: 'Manat',
  USD: 'Dollar',
  BHD: 'Dinar',
  BDT: 'Taka',
  BBD: 'Dollar',
};

function describeCurrency(code: string) {
  return CURRENCY_NAMES[code] ?? code;
}

function rateText(value: number | null | undefined, digits: number): string {
  return value && value > 0 ? String(Number(value.toFixed(digits))) : '';
}

function inverseText(value: string, digits: number): string {
  const n = Number.parseFloat(value.replace(',', '.'));
  return n > 0 ? String(Number((1 / n).toFixed(digits))) : '';
}

function rowToForm(row: CountryRow, extended: CountryExtendedSettings, pricing: CountryPricingSettings | null) {
  const eurToLocal = pricing?.eurToLocal ?? (row.eurRate > 0 ? row.eurRate : null);
  const usdToLocal = pricing?.usdToLocal ?? (row.usdRate > 0 ? row.usdRate : null);
  const currencyCode = pricing?.currencyCode || row.currencyCode;
  return {
    completed: row.settingCompleted ?? false,
    abbreviation: row.iso2.toUpperCase(),
    population: String(row.population),
    annualIncome: pricing?.annualIncome != null ? String(pricing.annualIncome) : '',
    incomeCurrency: (pricing?.incomeCurrency ?? 'EUR') as (typeof INCOME_CURRENCIES)[number],
    sliderPercent: clampSliderPercent(pricing?.sliderPercent ?? 0),
    continent: row.continent,
    officialLanguage: row.officialLanguage,
    primaryLanguage: row.primaryLanguage,
    secondaryLanguage: row.secondaryLanguage === '—' ? '—' : row.secondaryLanguage,
    currencyCode,
    currencyDescription:
      pricing?.currencyDescription || extended.currencyDescription || describeCurrency(currencyCode),
    exchangeEurPerAfn: eurToLocal ? String(Number((1 / eurToLocal).toFixed(6))) : '',
    exchange1EurAfn: rateText(eurToLocal, 3),
    exchangeUsdPerAfn: usdToLocal ? String(Number((1 / usdToLocal).toFixed(6))) : '',
    exchange1UsdAfn: rateText(usdToLocal, 3),
    flagSrc: countryFlagSrc(row.iso2),
    countryPictureName: extended.countryPictureName,
    countryPictureDataUrl: extended.countryPictureDataUrl ?? '',
    countryPicturePreview: extended.countryPictureDataUrl || null,
  };
}

function parseAmount(value: string): number | null {
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formToPricing(countryName: string, form: FormState): CountryPricingSettings {
  return {
    countryName,
    annualIncome: parseAmount(form.annualIncome),
    incomeCurrency: form.incomeCurrency,
    sliderPercent: form.sliderPercent,
    currencyCode: form.currencyCode,
    currencyDescription: form.currencyDescription,
    eurToLocal: parseAmount(form.exchange1EurAfn),
    usdToLocal: parseAmount(form.exchange1UsdAfn),
  };
}

function formToSavePayload(form: FormState, extended: CountryExtendedSettings): CountryEditSavePayload {
  const eurRate = parseAmount(form.exchange1EurAfn) ?? 0;
  const usdRate = parseAmount(form.exchange1UsdAfn) ?? 0;

  return {
    settingCompleted: form.completed,
    iso2: form.abbreviation.toLowerCase(),
    population: Number.parseInt(form.population, 10) || 0,
    continent: form.continent,
    officialLanguage: form.officialLanguage,
    primaryLanguage: form.primaryLanguage,
    secondaryLanguage: form.secondaryLanguage,
    currencyCode: form.currencyCode,
    eurRate,
    usdRate,
    regions: extended.regions.length,
    extended: {
      ...extended,
      annualIncome: form.annualIncome,
      incomeCurrency: form.incomeCurrency,
      percentageOr: form.sliderPercent,
      currencyDescription: form.currencyDescription,
      exchangeEurPerUnit: form.exchangeEurPerAfn,
      exchange1Eur: form.exchange1EurAfn,
      exchangeUsdPerUnit: form.exchangeUsdPerAfn,
      exchange1Usd: form.exchange1UsdAfn,
      countryPictureName: form.countryPictureName,
      countryPictureDataUrl: form.countryPictureDataUrl || undefined,
    },
  };
}

type FormState = ReturnType<typeof rowToForm>;

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(140px,38%)_1fr] gap-x-3 gap-y-1 items-center py-2 border-b border-gray-200 text-sm">
      <label className="font-semibold text-gray-800">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type Props = {
  row: CountryRow | null;
  /** Header values of the Countries page (our income, reference cost, USD-€). */
  header: CountryPricingHeader;
  pricing: CountryPricingSettings | null;
  onClose: () => void;
  onSave: (countryId: number, payload: CountryEditSavePayload, pricing: CountryPricingSettings) => void;
  onRegionsCountChange?: (countryId: number, regionsCount: number) => void;
};

function formatMoney(value: number | null): string {
  return value == null ? '—' : `€ ${value.toFixed(2)}`;
}

type SubModal = 'regions' | 'distributors' | 'dealers' | null;

export function CountryEditModal({ row, header, pricing, onClose, onSave, onRegionsCountChange }: Props) {
  const titleId = useId();
  const flagInputId = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [extended, setExtended] = useState<CountryExtendedSettings | null>(null);
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [finalCostDraft, setFinalCostDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      const loaded = loadCountryExtendedSettings(row.id, row.name);
      setExtended(loaded);
      setForm(rowToForm(row, loaded, pricing));
      setSubModal(null);
    } else {
      setExtended(null);
      setForm(null);
      setSubModal(null);
    }
    setFinalCostDraft(null);
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another country opens
  }, [row]);

  const breakdown = useMemo(
    () =>
      form
        ? computeCountryPrice(header, {
            annualIncome: parseAmount(form.annualIncome),
            incomeCurrency: form.incomeCurrency,
            sliderPercent: form.sliderPercent,
          })
        : null,
    [form, header],
  );

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [row, onClose]);

  const updateExtended = (next: CountryExtendedSettings) => {
    setExtended(next);
    if (row) saveCountryExtendedSettings(row.id, next);
  };

  const handleSave = async () => {
    if (!row || !form || !extended) return;
    const payload = formToSavePayload(form, extended);
    const token = getAdminBearerToken();
    if (!token) {
      setSaveError('Not authenticated');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/admin/country-pricing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: formToPricing(row.name, form) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      saveCountryExtendedSettings(row.id, payload.extended);
      onSave(row.id, payload, data.country as CountryPricingSettings);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setSlider = (value: number) => {
    setFinalCostDraft(null);
    setForm((f) => (f ? { ...f, sliderPercent: clampSliderPercent(value) } : f));
  };

  const setFinalCost = (text: string) => {
    setFinalCostDraft(text);
    const final = parseAmount(text);
    if (final != null && breakdown?.suggestedCost) {
      const slider = sliderForFinalCost(breakdown.suggestedCost, final);
      setForm((f) => (f ? { ...f, sliderPercent: slider } : f));
    }
  };

  const setExchangePair = (
    key: 'exchange1EurAfn' | 'exchangeEurPerAfn' | 'exchange1UsdAfn' | 'exchangeUsdPerAfn',
    value: string,
  ) => {
    const partner = {
      exchange1EurAfn: 'exchangeEurPerAfn',
      exchangeEurPerAfn: 'exchange1EurAfn',
      exchange1UsdAfn: 'exchangeUsdPerAfn',
      exchangeUsdPerAfn: 'exchange1UsdAfn',
    } as const;
    const digits = key === 'exchange1EurAfn' || key === 'exchange1UsdAfn' ? 6 : 3;
    setForm((f) => (f ? { ...f, [key]: value, [partner[key]]: inverseText(value, digits) } : f));
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const persistExtended = (next: CountryExtendedSettings) => {
    updateExtended(next);
    if (row) onRegionsCountChange?.(row.id, next.regions.length);
  };

  const onFlagFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    const url = URL.createObjectURL(file);
    if (form.flagSrc.startsWith('blob:')) URL.revokeObjectURL(form.flagSrc);
    update('flagSrc', url);
  };

  const clearFlag = () => {
    if (!form || !row) return;
    if (form.flagSrc.startsWith('blob:')) URL.revokeObjectURL(form.flagSrc);
    update('flagSrc', countryFlagSrc(row.iso2));
  };

  const onCountryPicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setForm({
        ...form,
        countryPictureName: file.name,
        countryPictureDataUrl: dataUrl,
        countryPicturePreview: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  const clearCountryPicture = () => {
    if (!form) return;
    setForm({
      ...form,
      countryPictureName: '',
      countryPictureDataUrl: '',
      countryPicturePreview: null,
    });
  };

  const continentOptions = useMemo(() => {
    if (!row) return CONTINENTS;
    const set = new Set(CONTINENTS);
    if (!set.has(row.continent)) return [row.continent, ...CONTINENTS];
    return CONTINENTS;
  }, [row]);

  const primaryLangOptions = useMemo(() => {
    if (!form) return LANGUAGE_OPTIONS;
    const s = new Set(LANGUAGE_OPTIONS);
    if (!s.has(form.primaryLanguage)) return [form.primaryLanguage, ...LANGUAGE_OPTIONS];
    return LANGUAGE_OPTIONS;
  }, [form]);

  const secondaryLangOptions = useMemo(() => {
    if (!form) return LANGUAGE_OPTIONS;
    const s = new Set(LANGUAGE_OPTIONS);
    if (!s.has(form.secondaryLanguage)) return [form.secondaryLanguage, ...LANGUAGE_OPTIONS];
    return LANGUAGE_OPTIONS;
  }, [form]);

  if (!row || !form || !extended) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-gray-300 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col rounded-sm">
        <div className="flex items-center justify-between bg-[#2563eb] text-white px-3 py-2 shrink-0">
          <h2 id={titleId} className="text-sm font-bold">
            Country — {row.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#4b5563] hover:bg-[#374151] text-white w-7 h-7 flex items-center justify-center text-sm leading-none"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 flex gap-2 shrink-0 border-b border-gray-200">
          {(
            [
              ['regions', 'Regions'],
              ['distributors', 'Distributors'],
              ['dealers', 'Dealers'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-sm hover:bg-gray-900"
              onClick={() => setSubModal(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-3 pb-4">
          <FormRow label="Completed">
            <input
              type="checkbox"
              checked={form.completed}
              onChange={(e) => update('completed', e.target.checked)}
              className="align-middle"
            />
          </FormRow>

          <FormRow label="Country abbreviation">
            <input
              type="text"
              value={form.abbreviation}
              onChange={(e) => update('abbreviation', e.target.value.toUpperCase())}
              className="w-full max-w-[200px] border border-gray-300 px-2 py-1 text-sm"
            />
          </FormRow>

          <FormRow label="Flag">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={clearFlag}
                className="self-start rounded-full bg-gray-400 hover:bg-gray-500 text-white w-5 h-5 text-xs leading-none mb-0.5"
                aria-label="Reset flag"
              >
                ×
              </button>
              <div className="flex items-center gap-2 max-w-[280px]">
                <div className="flex-1 flex items-center border border-gray-300 px-2 py-1 bg-white gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.flagSrc} alt="" width={28} height={21} className="border border-gray-200" />
                  <input type="file" accept="image/*" className="hidden" id={flagInputId} onChange={onFlagFile} />
                  <label
                    htmlFor={flagInputId}
                    className="ml-auto border border-gray-400 bg-gray-100 px-2 py-0.5 text-xs cursor-pointer hover:bg-gray-200"
                  >
                    …
                  </label>
                </div>
              </div>
            </div>
          </FormRow>

          <FormRow label="Country picture">
            <div className="space-y-2">
              <input type="file" accept="image/*" onChange={onCountryPicture} className="text-xs max-w-full" />
              <div className="border border-gray-300 bg-gray-50 h-28 flex items-center justify-center text-gray-400 text-xs overflow-hidden">
                {form.countryPicturePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.countryPicturePreview} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span>No preview</span>
                )}
              </div>
              {form.countryPictureName ? (
                <button type="button" onClick={clearCountryPicture} className="text-xs text-red-600 underline">
                  Clear picture
                </button>
              ) : null}
            </div>
          </FormRow>

          <FormRow label="Population">
            <input
              type="text"
              value={form.population}
              onChange={(e) => update('population', e.target.value.replace(/\D/g, ''))}
              className="w-full max-w-[200px] border border-gray-300 px-2 py-1 text-sm"
            />
          </FormRow>

          <FormRow label="Annual income">
            <input
              type="text"
              value={form.annualIncome}
              onChange={(e) => update('annualIncome', e.target.value)}
              className="w-full max-w-[200px] border border-gray-300 px-2 py-1 text-sm"
            />
          </FormRow>

          <FormRow label="Currency">
            <select
              value={form.incomeCurrency}
              onChange={(e) => update('incomeCurrency', e.target.value as FormState['incomeCurrency'])}
              className="border border-gray-300 px-2 py-1 text-sm max-w-[200px]"
            >
              {INCOME_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Ratio with us">
            <span className="text-sm tabular-nums text-gray-900">
              {breakdown?.ratio != null ? breakdown.ratio.toFixed(2) : '—'}
              <span className="ml-2 text-xs text-gray-500">
                (our income € {header.ourAnnualIncomeEur || 0} : income of {row.name})
              </span>
            </span>
          </FormRow>

          <FormRow label="Suggested cost">
            <span className="text-sm tabular-nums text-gray-900">
              {formatMoney(breakdown?.suggestedCost ?? null)}
              <span className="ml-2 text-xs text-gray-500">
                (virtual product € {header.costVirtualProduct || 0} : ratio)
              </span>
            </span>
          </FormRow>

          <FormRow label="Adjust cost">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="border border-gray-400 w-7 h-7 text-sm font-bold bg-white hover:bg-gray-100"
                onClick={() => setSlider(form.sliderPercent - 1)}
              >
                −
              </button>
              <div className="flex-1 min-w-[120px] max-w-[220px] flex items-center gap-2">
                <span className="text-xs text-gray-500">{COUNTRY_SLIDER_MIN}%</span>
                <input
                  type="range"
                  min={COUNTRY_SLIDER_MIN}
                  max={COUNTRY_SLIDER_MAX}
                  step={1}
                  value={form.sliderPercent}
                  onChange={(e) => setSlider(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap">+{COUNTRY_SLIDER_MAX}%</span>
              </div>
              <button
                type="button"
                className="border border-gray-400 w-7 h-7 text-sm font-bold bg-white hover:bg-gray-100"
                onClick={() => setSlider(form.sliderPercent + 1)}
              >
                +
              </button>
              <span className="w-12 text-right text-sm font-semibold tabular-nums">
                {form.sliderPercent > 0 ? '+' : ''}
                {form.sliderPercent}%
              </span>
            </div>
          </FormRow>

          <FormRow label="Virtual cost (final)">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">€</span>
              <input
                type="text"
                value={
                  finalCostDraft ??
                  (breakdown?.finalCost != null ? breakdown.finalCost.toFixed(2) : '')
                }
                disabled={!breakdown?.suggestedCost}
                onChange={(e) => setFinalCost(e.target.value)}
                onBlur={() => setFinalCostDraft(null)}
                className="w-28 border border-gray-300 px-2 py-1 text-sm font-semibold disabled:bg-gray-100"
              />
              {breakdown?.finalCost != null && header.costVirtualProduct > 0 ? (
                <span className="text-xs text-gray-500">
                  {(() => {
                    const local = localAmount(
                      breakdown.finalCost,
                      parseAmount(form.exchange1EurAfn),
                    );
                    return local != null && form.currencyCode && form.currencyCode !== 'EUR'
                      ? `= ${local.toLocaleString('en-US')} ${form.currencyCode} · `
                      : '';
                  })()}
                  prices × {breakdown.factor.toFixed(3)}
                </span>
              ) : null}
            </div>
            {!breakdown?.suggestedCost ? (
              <p className="mt-1 text-xs text-amber-700">
                Set “Our annual income EUR” and “Cost virtual product” at the top of the page, and the annual
                income of this country, to calculate the cost.
              </p>
            ) : null}
          </FormRow>

          <FormRow label="Continent">
            <select
              value={form.continent}
              onChange={(e) => update('continent', e.target.value)}
              className="border border-gray-300 px-2 py-1 text-sm max-w-[240px] w-full"
            >
              {continentOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Official Language">
            <input
              type="text"
              value={form.officialLanguage}
              onChange={(e) => update('officialLanguage', e.target.value)}
              className="w-full border border-gray-300 px-2 py-1 text-sm"
            />
          </FormRow>

          <FormRow label="Primary Language">
            <select
              value={form.primaryLanguage}
              onChange={(e) => update('primaryLanguage', e.target.value)}
              className="border border-gray-300 px-2 py-1 text-sm w-full max-w-[240px]"
            >
              {primaryLangOptions
                .filter((l) => l !== '—')
                .map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
            </select>
          </FormRow>

          <FormRow label="Secondary Language">
            <select
              value={form.secondaryLanguage}
              onChange={(e) => update('secondaryLanguage', e.target.value)}
              className="border border-gray-300 px-2 py-1 text-sm w-full max-w-[240px]"
            >
              {secondaryLangOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Currency">
            <input
              type="text"
              value={form.currencyCode}
              onChange={(e) => update('currencyCode', e.target.value.toUpperCase())}
              className="w-full max-w-[120px] border border-gray-300 px-2 py-1 text-sm font-medium"
            />
          </FormRow>

          <FormRow label="Description">
            <input
              type="text"
              value={form.currencyDescription}
              onChange={(e) => update('currencyDescription', e.target.value)}
              className="w-full border border-gray-300 px-2 py-1 text-sm"
            />
          </FormRow>

          <div className="mt-4 space-y-3">
            <div className="border border-gray-400 p-3 space-y-2">
              <div className="text-xs font-bold text-gray-800">Exchange EUR</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="text"
                  value={form.exchangeEurPerAfn}
                  onChange={(e) => setExchangePair('exchangeEurPerAfn', e.target.value)}
                  className="w-24 border border-gray-300 px-2 py-1 tabular-nums"
                />
                <span className="text-gray-600">For 1 {form.currencyCode}</span>
              </div>
              <div className="text-xs font-bold text-gray-800">Exchange 1 EUR</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="text"
                  value={form.exchange1EurAfn}
                  onChange={(e) => setExchangePair('exchange1EurAfn', e.target.value)}
                  className="w-24 border border-gray-300 px-2 py-1 tabular-nums"
                />
                <span className="text-red-600 font-semibold">{form.currencyCode}</span>
              </div>
            </div>

            <div className="border border-gray-400 p-3 space-y-2">
              <div className="text-xs font-bold text-gray-800">Exchange USD</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="text"
                  value={form.exchangeUsdPerAfn}
                  onChange={(e) => setExchangePair('exchangeUsdPerAfn', e.target.value)}
                  className="w-24 border border-gray-300 px-2 py-1 tabular-nums"
                />
                <span className="text-gray-600">For 1 {form.currencyCode}</span>
              </div>
              <div className="text-xs font-bold text-gray-800">Exchange 1 USD</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="text"
                  value={form.exchange1UsdAfn}
                  onChange={(e) => setExchangePair('exchange1UsdAfn', e.target.value)}
                  className="w-24 border border-gray-300 px-2 py-1 tabular-nums"
                />
                <span className="text-red-600 font-semibold">{form.currencyCode}</span>
              </div>
            </div>
          </div>

          {saveError ? <p className="mt-4 text-sm text-red-700">{saveError}</p> : null}
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              disabled={saving}
              className="bg-gradient-to-b from-[#444] to-[#222] text-white px-6 py-2 text-sm font-bold rounded-sm border border-black hover:from-[#555] hover:to-[#333] disabled:opacity-50"
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="bg-gradient-to-b from-[#444] to-[#222] text-white px-6 py-2 text-sm font-bold rounded-sm border border-black hover:from-[#555] hover:to-[#333]"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {subModal === 'regions' ? (
        <CountryRegionsModal
          countryName={row.name}
          regions={extended.regions}
          onChange={(regions) => persistExtended({ ...extended, regions })}
          onClose={() => setSubModal(null)}
        />
      ) : null}

      {subModal === 'distributors' ? (
        <CountryPartnersListModal
          countryName={row.name}
          titlePrefix="Distributor"
          records={extended.distributors}
          onChange={(distributors) => persistExtended({ ...extended, distributors })}
          onClose={() => setSubModal(null)}
        />
      ) : null}

      {subModal === 'dealers' ? (
        <CountryPartnersListModal
          countryName={row.name}
          titlePrefix="Dealer"
          records={extended.dealers}
          onChange={(dealers) => persistExtended({ ...extended, dealers })}
          onClose={() => setSubModal(null)}
        />
      ) : null}
    </div>
  );
}
