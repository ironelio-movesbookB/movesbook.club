/**
 * Payment modalities of a Movesbook subscription (Super Admin → "Modality of subscription available").
 *
 * D (yearly, 1 step) is the standard of reference: its yearly price is typed in.
 * Every other modality is D ± a percentage (−99 … +99):
 *   total     = D × (1 + variance / 100)
 *   monthly   = total / 12
 *   deadlines = total split in N equal deadlines, `delayDays` apart (first one at subscription).
 * When the renewal discount is on, renewals cost total × (1 − discount / 100).
 */

export const PAYMENT_MODE_CODES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type PaymentModeCode = (typeof PAYMENT_MODE_CODES)[number];

/** Modalities priced as a variance of D. */
export const VARIABLE_MODE_CODES = ['A', 'B', 'C', 'E', 'F'] as const;
export type VariableModeCode = (typeof VARIABLE_MODE_CODES)[number];

/** Always offered at registration (cannot be disabled per version). */
export const ALWAYS_ENABLED_MODES: readonly PaymentModeCode[] = ['A', 'D'];

export const VARIANCE_MIN = -99;
export const VARIANCE_MAX = 99;

export type PaymentModeDefinition = {
  code: PaymentModeCode;
  label: string;
  /** Number of deadlines generated for one subscription year. */
  deadlines: number;
  /** Days between two deadlines (0 = single payment). */
  delayDays: number;
  /** A, B, C: deadlines repeat during the year (recurrent). */
  recurrent: boolean;
};

export const PAYMENT_MODES: Record<PaymentModeCode, PaymentModeDefinition> = {
  A: { code: 'A', label: 'Monthly subscription', deadlines: 12, delayDays: 30, recurrent: true },
  B: { code: 'B', label: 'Quarterly subscription', deadlines: 4, delayDays: 90, recurrent: true },
  C: { code: 'C', label: 'Biannual subscription', deadlines: 2, delayDays: 180, recurrent: true },
  D: { code: 'D', label: 'Yearly subscription in 1 step', deadlines: 1, delayDays: 0, recurrent: false },
  E: { code: 'E', label: 'Yearly subscription in 2 steps', deadlines: 2, delayDays: 60, recurrent: false },
  F: { code: 'F', label: 'Yearly subscription in 3 steps', deadlines: 3, delayDays: 60, recurrent: false },
};

export type PaymentModalitySettings = {
  /** D — yearly price in EUR (standard of reference). */
  yearlyPrice: number;
  /** % variance from D for each other modality (−99 … +99). */
  variance: Record<VariableModeCode, number>;
  renewalDiscountEnabled: boolean;
  /** % discount applied to renewals (0 … 99). */
  renewalDiscountPercent: number;
  /** Per version: modalities offered at registration (A and D are always offered). */
  enabled: Record<PaymentModeCode, boolean>;
};

/** Example values from the specification (D 420 €; A 720, B 600, C 540, E/F 480). */
export function createDefaultPaymentModalities(): PaymentModalitySettings {
  return {
    yearlyPrice: 420,
    variance: { A: 71, B: 43, C: 29, E: 14, F: 14 },
    renewalDiscountEnabled: false,
    renewalDiscountPercent: 0,
    enabled: { A: true, B: true, C: true, D: true, E: true, F: true },
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampVariance(value: unknown): number {
  return Math.min(VARIANCE_MAX, Math.max(VARIANCE_MIN, Math.round(finiteNumber(value, 0))));
}

export function clampDiscount(value: unknown): number {
  return Math.min(99, Math.max(0, Math.round(finiteNumber(value, 0))));
}

export function roundEuro(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coerce stored/posted JSON into valid settings (unknown fields dropped, ranges enforced). */
export function normalizePaymentModalities(raw: unknown): PaymentModalitySettings {
  const base = createDefaultPaymentModalities();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<PaymentModalitySettings>;
  const variance = { ...base.variance };
  for (const code of VARIABLE_MODE_CODES) {
    if (input.variance && code in input.variance) variance[code] = clampVariance(input.variance[code]);
  }
  const enabled = { ...base.enabled };
  for (const code of PAYMENT_MODE_CODES) {
    if (input.enabled && code in input.enabled) enabled[code] = Boolean(input.enabled[code]);
    if (ALWAYS_ENABLED_MODES.includes(code)) enabled[code] = true;
  }
  return {
    yearlyPrice: Math.max(0, roundEuro(finiteNumber(input.yearlyPrice, base.yearlyPrice))),
    variance,
    renewalDiscountEnabled: Boolean(input.renewalDiscountEnabled),
    renewalDiscountPercent: clampDiscount(input.renewalDiscountPercent),
    enabled,
  };
}

export type PaymentModeQuote = {
  code: PaymentModeCode;
  definition: PaymentModeDefinition;
  variance: number;
  /** Price of one subscription year in EUR. */
  total: number;
  monthly: number;
  deadlines: number;
  /** Amount of each deadline (the last one absorbs rounding, see {@link splitIntoDeadlines}). */
  deadlineAmount: number;
  delayDays: number;
};

export function quotePaymentMode(
  settings: PaymentModalitySettings,
  code: PaymentModeCode,
  opts?: { renewal?: boolean },
): PaymentModeQuote {
  const definition = PAYMENT_MODES[code];
  const variance = code === 'D' ? 0 : settings.variance[code as VariableModeCode] ?? 0;
  let total = settings.yearlyPrice * (1 + variance / 100);
  if (opts?.renewal && settings.renewalDiscountEnabled) {
    total *= 1 - settings.renewalDiscountPercent / 100;
  }
  total = roundEuro(total);
  return {
    code,
    definition,
    variance,
    total,
    monthly: roundEuro(total / 12),
    deadlines: definition.deadlines,
    deadlineAmount: roundEuro(total / definition.deadlines),
    delayDays: definition.delayDays,
  };
}

/** Renewal price of the "1th subscription" price: first price minus the renewal % when that discount is on. */
export function renewalPriceFor(firstPrice: number, settings: Pick<PaymentModalitySettings, 'renewalDiscountEnabled' | 'renewalDiscountPercent'>): number {
  const base = Number.isFinite(firstPrice) ? firstPrice : 0;
  return settings.renewalDiscountEnabled ? roundEuro(base * (1 - settings.renewalDiscountPercent / 100)) : roundEuro(base);
}

/** Deadline amounts summing exactly to `total` (rounding difference on the last one). */
export function splitIntoDeadlines(total: number, count: number): number[] {
  const each = roundEuro(total / count);
  const amounts = Array.from({ length: count }, () => each);
  amounts[count - 1] = roundEuro(total - each * (count - 1));
  return amounts;
}

/** Modalities offered at registration for a version (A and D always), in A–F order. */
export function enabledModes(settings: PaymentModalitySettings): PaymentModeCode[] {
  return PAYMENT_MODE_CODES.filter((code) => settings.enabled[code] || ALWAYS_ENABLED_MODES.includes(code));
}

export function isPaymentModeCode(value: unknown): value is PaymentModeCode {
  return typeof value === 'string' && (PAYMENT_MODE_CODES as readonly string[]).includes(value);
}

/** Subscription length of a modality purchase (every modality covers one year). */
export const MODALITY_SUBSCRIPTION_DAYS = 365;

export type RegistrationModalityChoice = {
  code: PaymentModeCode;
  quote: PaymentModeQuote;
  /** Deadline amounts (sum = quote.total). The first one is paid at registration. */
  deadlineAmounts: number[];
};

/**
 * Modality used for a registration on a version. Null when the version has no modalities set up
 * (classic single price). Throws when the requested modality is not offered for the version.
 */
export function resolveRegistrationModality(
  raw: PaymentModalitySettings | undefined | null,
  requested: unknown,
): RegistrationModalityChoice | null {
  if (!raw) return null;
  const settings = normalizePaymentModalities(raw);
  const code: PaymentModeCode = requested == null || requested === '' ? 'A' : (requested as PaymentModeCode);
  if (!isPaymentModeCode(code) || !enabledModes(settings).includes(code)) {
    throw new Error('This payment modality is not available for the selected version');
  }
  const quote = quotePaymentMode(settings, code);
  return { code, quote, deadlineAmounts: splitIntoDeadlines(quote.total, quote.deadlines) };
}

/**
 * Prices shown for another country.
 *   currency: same EUR price converted (1 EUR = eurToLocal).
 *   income:   EUR price × country income : our income (e.g. 40000 : 20000 → 50 %).
 */
export function incomeWeightedPrice(priceEur: number, ourIncomeEur: number, countryIncomeEur: number | null): number | null {
  if (!(ourIncomeEur > 0) || !countryIncomeEur || !(countryIncomeEur > 0)) return null;
  return roundEuro(priceEur * (countryIncomeEur / ourIncomeEur));
}
