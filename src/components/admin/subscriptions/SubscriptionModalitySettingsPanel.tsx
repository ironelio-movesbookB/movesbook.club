'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import ModalityVarianceControl from './ModalityVarianceControl';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import {
  COUNTRIES_DASHBOARD_ROWS,
  builtInCountryCurrency,
} from '@/constants/countriesDashboard.constants';
import {
  annualIncomeInEur,
  type CountryPricingSettings,
} from '@/lib/countries/countryPriceFormula';
import {
  PAYMENT_MODES,
  PAYMENT_MODE_CODES,
  clampDiscount,
  clampVariance,
  createDefaultPaymentModalities,
  incomeWeightedPrice,
  quotePaymentMode,
  roundEuro,
  type PaymentModalitySettings,
  type VariableModeCode,
} from '@/lib/subscriptions/paymentModalities';

type VersionOption = {
  id: number;
  name: string;
  code: string;
  userTypeLabel: string;
  editHref: string;
};

type ApiData = {
  preset: PaymentModalitySettings;
  versions: VersionOption[];
  ourAnnualIncomeEur: number;
  usdToEur: number;
  countries: Record<string, CountryPricingSettings>;
};

type SimCountry = {
  name: string;
  currencyCode: string;
  eurToLocal: number | null;
  incomeEur: number | null;
};

const API = '/api/admin/subscriptions/modality-preset';
const COUNTRY_KEY = 'movesbook:modality-sim-country';

function eur(value: number): string {
  return `€ ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function local(valueEur: number, country: SimCountry | null): string {
  if (!country || country.currencyCode === 'EUR' || !country.eurToLocal) return '';
  const amount = valueEur * country.eurToLocal;
  return ` (${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${country.currencyCode})`;
}

async function authFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminBearerToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
}

/** Super Admin → Global settings → Versions → "Modality of subscription available". */
export default function SubscriptionModalitySettingsPanel() {
  const [data, setData] = useState<ApiData | null>(null);
  const [settings, setSettings] = useState<PaymentModalitySettings>(createDefaultPaymentModalities);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRenewal, setShowRenewal] = useState(false);
  const [countryName, setCountryName] = useState('');
  const [versionId, setVersionId] = useState('');
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; href?: string } | null>(null);

  useEffect(() => {
    authFetch<ApiData>(API)
      .then((res) => {
        setData(res);
        setSettings(res.preset);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Unable to load.'));
    try {
      setCountryName(localStorage.getItem(COUNTRY_KEY) || '');
    } catch {
      /* no saved country */
    }
  }, []);

  const simCountries = useMemo<SimCountry[]>(() => {
    if (!data) return [];
    const header = { ourAnnualIncomeEur: data.ourAnnualIncomeEur, costVirtualProduct: 0, usdToEur: data.usdToEur };
    return COUNTRIES_DASHBOARD_ROWS.filter((row) => row.name.toLowerCase() !== 'italy').map((row) => {
      const saved = data.countries[row.name.toLowerCase()];
      const builtIn = builtInCountryCurrency(row.name);
      const currencyCode = saved?.currencyCode || builtIn?.currencyCode || 'EUR';
      return {
        name: row.name,
        currencyCode,
        eurToLocal: currencyCode === 'EUR' ? 1 : saved?.eurToLocal ?? builtIn?.eurToLocal ?? null,
        incomeEur: saved ? annualIncomeInEur(header, saved) : null,
      };
    });
  }, [data]);

  const country = simCountries.find((c) => c.name === countryName) ?? null;
  const quotes = PAYMENT_MODE_CODES.map((code) => quotePaymentMode(settings, code, { renewal: showRenewal }));
  const selectedVersion = data?.versions.find((v) => String(v.id) === versionId) ?? null;

  const versionGroups = useMemo(() => {
    const groups = new Map<string, VersionOption[]>();
    for (const v of data?.versions ?? []) {
      groups.set(v.userTypeLabel, [...(groups.get(v.userTypeLabel) ?? []), v]);
    }
    return [...groups.entries()];
  }, [data]);

  const setVariance = (code: VariableModeCode, value: unknown) =>
    setSettings((s) => ({ ...s, variance: { ...s.variance, [code]: clampVariance(value) } }));

  const savePreset = async () => {
    setBusy('save');
    setMessage(null);
    try {
      const res = await authFetch<{ preset: PaymentModalitySettings }>(API, {
        method: 'PUT',
        body: JSON.stringify({ preset: settings }),
      });
      setSettings(res.preset);
      setMessage({ tone: 'ok', text: 'Settings saved.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(null);
    }
  };

  const applyToVersion = async () => {
    if (!selectedVersion) return;
    setBusy('apply');
    setMessage(null);
    try {
      const res = await authFetch<{ versionName: string; paymentModalities: PaymentModalitySettings }>(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'apply', versionId: selectedVersion.id, preset: settings }),
      });
      setConfirmApply(false);
      setMessage({
        tone: 'ok',
        text: `Prices applied to "${res.versionName}".`,
        href: selectedVersion.editHref,
      });
    } catch (e) {
      setConfirmApply(false);
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Apply failed' });
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return <div className="p-6 text-red-600">{loadError}</div>;
  }
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const incomeHint = !(data.ourAnnualIncomeEur > 0)
    ? 'Set "Our annual income EUR" at the top of the Countries page.'
    : country && !country.incomeEur
      ? `Set the annual income of ${country.name} in its country profile (Countries page).`
      : null;

  return (
    <div className="min-h-full bg-white p-4 text-gray-900 lg:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Modality of subscription available</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Type the yearly price of <strong>D</strong> (standard of reference). Every other modality is a ± % of D.
            When the prices are ready, choose a version in <strong>Save for version</strong> and press APPLY.
          </p>
        </div>
        <Link
          href="/admin/global-settings"
          className="inline-flex items-center gap-2 rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> Versions
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 border border-gray-300 bg-[#fafafa] p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.renewalDiscountEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, renewalDiscountEnabled: e.target.checked }))}
            className="h-4 w-4"
          />
          Apply a discount % in the Renewals of
          <input
            type="number"
            min={0}
            max={99}
            value={settings.renewalDiscountPercent}
            onChange={(e) => setSettings((s) => ({ ...s, renewalDiscountPercent: clampDiscount(e.target.value) }))}
            disabled={!settings.renewalDiscountEnabled}
            className="h-8 w-16 rounded border border-gray-300 px-2 text-right disabled:bg-gray-100 disabled:text-gray-400"
          />
          %
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRenewal}
            onChange={(e) => setShowRenewal(e.target.checked)}
            className="h-4 w-4"
          />
          Display prices of a RENEWAL (with the renewal discount)
        </label>
        <label className="flex items-center gap-2">
          Country for the simulations
          <select
            value={countryName}
            onChange={(e) => {
              setCountryName(e.target.value);
              try {
                localStorage.setItem(COUNTRY_KEY, e.target.value);
              } catch {
                /* not remembered */
              }
            }}
            className="h-8 rounded border border-gray-300 px-2"
          >
            <option value="">Select a country</option>
            {simCountries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showRenewal && !settings.renewalDiscountEnabled && (
        <p className="mb-3 text-sm text-amber-700">The renewal discount is off, so renewal prices equal the first subscription.</p>
      )}

      <div className="overflow-x-auto border border-gray-300">
        <table className="w-full min-w-[1150px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#4a8f96] text-left text-white">
              <th className="border-r border-[#3d7a80] px-3 py-2">Modality</th>
              <th className="border-r border-[#3d7a80] px-3 py-2">Price / % variance from D</th>
              <th className="border-r border-[#3d7a80] px-3 py-2 text-right">Total price</th>
              <th className="border-r border-[#3d7a80] px-3 py-2 text-right">Monthly cost</th>
              <th className="border-r border-[#3d7a80] px-3 py-2 text-center">Delay deadlines</th>
              <th className="border-r border-[#3d7a80] px-3 py-2 text-center">Nr. of deadlines</th>
              <th className="border-r border-[#3d7a80] px-3 py-2">Deadlines calculated</th>
              <th className="border-r border-[#3d7a80] bg-[#3d7a80] px-3 py-2">
                I — Same prices{country ? ` in ${country.currencyCode}` : ''}
              </th>
              <th className="bg-[#356e73] px-3 py-2">
                II — Weighted by annual income{country ? ` (${country.name})` : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, index) => {
              const isD = q.code === 'D';
              const weightedTotal = country
                ? incomeWeightedPrice(q.total, data.ourAnnualIncomeEur, country.incomeEur)
                : null;
              return (
                <tr key={q.code} className={`${isD ? 'bg-amber-50' : index % 2 ? 'bg-[#f6f6f6]' : 'bg-white'} align-top`}>
                  <td className="border-t border-gray-300 px-3 py-3">
                    <div className="font-bold">
                      {q.code} — {PAYMENT_MODES[q.code].label}
                    </div>
                    {isD && <div className="text-xs font-semibold text-amber-700">Standard of reference</div>}
                    {PAYMENT_MODES[q.code].recurrent && (
                      <div className="text-xs text-gray-500">Recurrent deadlines</div>
                    )}
                  </td>
                  <td className="border-t border-gray-300 px-3 py-3">
                    {isD ? (
                      <label className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Total price INPUT</span>
                        <span>€</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={settings.yearlyPrice}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, yearlyPrice: Math.max(0, roundEuro(Number(e.target.value) || 0)) }))
                          }
                          className="h-9 w-28 rounded border border-amber-400 bg-white px-2 text-right font-semibold"
                        />
                      </label>
                    ) : (
                      <ModalityVarianceControl
                        code={q.code as VariableModeCode}
                        value={settings.variance[q.code as VariableModeCode]}
                        onChange={setVariance}
                      />
                    )}
                  </td>
                  <td className="border-t border-gray-300 px-3 py-3 text-right font-semibold whitespace-nowrap">{eur(q.total)}</td>
                  <td className="border-t border-gray-300 px-3 py-3 text-right whitespace-nowrap">{eur(q.monthly)}/month</td>
                  <td className="border-t border-gray-300 px-3 py-3 text-center">{q.delayDays}</td>
                  <td className="border-t border-gray-300 px-3 py-3 text-center">
                    {q.deadlines}
                    {PAYMENT_MODES[q.code].recurrent ? '*' : ''}
                  </td>
                  <td className="border-t border-gray-300 px-3 py-3 whitespace-nowrap">
                    {eur(q.deadlineAmount)} × {q.deadlines}
                  </td>
                  <td className="border-t border-gray-300 bg-[#eef5f6] px-3 py-3">
                    {country ? (
                      <>
                        <div>{eur(q.total)}{local(q.total, country)}</div>
                        <div className="text-xs text-gray-600">
                          {eur(q.monthly)}{local(q.monthly, country)}/month
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="border-t border-gray-300 bg-[#e6f0f1] px-3 py-3">
                    {weightedTotal != null ? (
                      <>
                        <div>{eur(weightedTotal)}{local(weightedTotal, country)}</div>
                        <div className="text-xs text-gray-600">
                          {eur(roundEuro(weightedTotal / 12))}{local(roundEuro(weightedTotal / 12), country)}/month
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        * Recurrent: one deadline every {PAYMENT_MODES.A.delayDays}/{PAYMENT_MODES.B.delayDays}/{PAYMENT_MODES.C.delayDays} days during the year.
        Column II = price × annual income of the country : our annual income
        {data.ourAnnualIncomeEur > 0 ? ` (${eur(data.ourAnnualIncomeEur)})` : ''}.
        {incomeHint ? <span className="ml-1 font-semibold text-amber-700">{incomeHint}</span> : null}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-300 pt-4">
        <button
          type="button"
          onClick={savePreset}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded border border-gray-500 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-60"
        >
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </button>
        <label className="ml-auto flex flex-col gap-1 text-sm font-semibold">
          Save for version
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="h-10 min-w-[18rem] rounded border border-gray-400 px-2 font-normal"
          >
            <option value="">Select a version</option>
            {versionGroups.map(([label, versions]) => (
              <optgroup key={label} label={label}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code ? `${v.code} — ` : ''}
                    {v.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setConfirmApply(true)}
          disabled={!selectedVersion || busy !== null}
          className="h-10 rounded bg-[#d9534f] px-6 text-sm font-bold text-white hover:bg-[#c9302c] disabled:opacity-50"
        >
          APPLY
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm font-semibold ${message.tone === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
          {message.href && (
            <Link href={message.href} className="ml-2 text-blue-700 underline">
              Open the version
            </Link>
          )}
        </p>
      )}

      <PromocodeConfirmModal
        open={confirmApply && Boolean(selectedVersion)}
        title="Apply to version"
        message={`Apply these prices (D ${eur(settings.yearlyPrice)}/year and modalities A–F) to "${selectedVersion?.name ?? ''}"? The current prices of that version will be replaced.`}
        confirmLabel="APPLY"
        loading={busy === 'apply'}
        onClose={() => setConfirmApply(false)}
        onConfirm={applyToVersion}
      />
    </div>
  );
}
