/**
 * Country price scaling (Countries page → registration → payment).
 *
 *   ratio          = our annual income (EUR) : country annual income (EUR)
 *   suggested cost = cost of the reference virtual product : ratio
 *   final cost     = suggested cost adjusted by the slider (−20% … +100%)
 *   country price  = subscription price (EUR) × final cost : reference cost
 *   local price    = country price (EUR) × exchange (1 EUR = X local currency)
 */

export const COUNTRY_SLIDER_MIN = -20;
export const COUNTRY_SLIDER_MAX = 100;

export type CountryPricingHeader = {
  /** "Our annual income EUR" (e.g. 30000). */
  ourAnnualIncomeEur: number;
  /** "Cost virtual product" — reference product price in EUR (e.g. 100). */
  costVirtualProduct: number;
  /** "USD-€": 1 USD = X EUR (e.g. 0.89). */
  usdToEur: number;
};

export type CountryPricingSettings = {
  countryName: string;
  annualIncome: number | null;
  incomeCurrency: 'EUR' | 'USD';
  sliderPercent: number;
  currencyCode: string;
  currencyDescription: string;
  /** 1 EUR = X local currency. */
  eurToLocal: number | null;
  /** 1 USD = X local currency. */
  usdToLocal: number | null;
};

export type CountryPriceBreakdown = {
  ratio: number | null;
  suggestedCost: number | null;
  finalCost: number | null;
  /** Multiplier applied to subscription prices (1 = unchanged). */
  factor: number;
};

/** Public pricing info for one country (registration form, payment page). */
export type CountryPriceInfo = {
  country: string;
  factor: number;
  currencyCode: string;
  currencyDescription: string;
  eurToLocal: number | null;
};

export function clampSliderPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(COUNTRY_SLIDER_MAX, Math.max(COUNTRY_SLIDER_MIN, Math.round(value)));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function annualIncomeInEur(
  header: CountryPricingHeader,
  settings: Pick<CountryPricingSettings, 'annualIncome' | 'incomeCurrency'>,
): number | null {
  const income = settings.annualIncome;
  if (income == null || !Number.isFinite(income) || income <= 0) return null;
  if (settings.incomeCurrency === 'USD') {
    return header.usdToEur > 0 ? income * header.usdToEur : null;
  }
  return income;
}

export function computeCountryPrice(
  header: CountryPricingHeader,
  settings: Pick<CountryPricingSettings, 'annualIncome' | 'incomeCurrency' | 'sliderPercent'>,
): CountryPriceBreakdown {
  const incomeEur = annualIncomeInEur(header, settings);
  if (!incomeEur || !(header.ourAnnualIncomeEur > 0)) {
    return { ratio: null, suggestedCost: null, finalCost: null, factor: 1 };
  }
  const ratio = header.ourAnnualIncomeEur / incomeEur;
  const adjust = 1 + clampSliderPercent(settings.sliderPercent) / 100;
  const factor = adjust / ratio;
  const cost = header.costVirtualProduct > 0 ? header.costVirtualProduct : null;
  return {
    ratio,
    suggestedCost: cost != null ? cost / ratio : null,
    finalCost: cost != null ? (cost / ratio) * adjust : null,
    factor,
  };
}

/** Slider position that produces the given final cost (for typing the final cost directly). */
export function sliderForFinalCost(suggestedCost: number, finalCost: number): number {
  if (!(suggestedCost > 0) || !Number.isFinite(finalCost)) return 0;
  return clampSliderPercent((finalCost / suggestedCost - 1) * 100);
}

export function priceForCountry(priceEur: number, factor: number): number {
  if (!Number.isFinite(priceEur) || priceEur <= 0) return 0;
  return roundMoney(priceEur * (factor > 0 ? factor : 1));
}

export function localAmount(priceEur: number, eurToLocal: number | null | undefined): number | null {
  if (!eurToLocal || !(eurToLocal > 0) || !Number.isFinite(priceEur)) return null;
  const value = priceEur * eurToLocal;
  return value >= 100 ? Math.round(value) : roundMoney(value);
}

export function formatEuroAmount(value: number): string {
  if (value === 0) return 'Free';
  return `€ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function formatLocalAmount(value: number, currencyCode: string): string {
  const text = Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} ${currencyCode}`;
}

/** "€ 42 (3,818 ALL)" — local part only when the country has its own currency and rate. */
export function formatCountryPrice(priceEur: number, info: CountryPriceInfo | null | undefined): string {
  const eur = formatEuroAmount(priceEur);
  if (!info || priceEur <= 0 || !info.currencyCode || info.currencyCode === 'EUR') return eur;
  const local = localAmount(priceEur, info.eurToLocal);
  return local == null ? eur : `${eur} (${formatLocalAmount(local, info.currencyCode)})`;
}
