/** Full payment method catalog (member Settings + procedure payment forms). */

export const PAYMENT_TYPE_OPTIONS = [
  { value: 'cash', label: 'Cash', legacyCode: '1' },
  { value: 'credit_card', label: 'Credit card', legacyCode: '3' },
  { value: 'prepaid_card', label: 'Prepaid card', legacyCode: '7' },
  { value: 'debit_card', label: 'Debit card', legacyCode: '8' },
  { value: 'bank_transfer', label: 'Bank transfer', legacyCode: '4' },
  { value: 'sepa', label: 'SEPA **', legacyCode: '9' },
  { value: 'cbill', label: 'CBILL **', legacyCode: '10' },
  { value: 'mav', label: 'MAV payment slip **', legacyCode: '11' },
  { value: 'cheque', label: 'Cheque', legacyCode: '2' },
  { value: 'payment_slip', label: 'Payment slip', legacyCode: '18' },
  { value: 'paypal', label: 'PayPal', legacyCode: '13' },
  { value: 'satispay', label: 'Satispay', legacyCode: '14' },
  { value: 'multisafepay', label: 'MultisafePay', legacyCode: '15' },
  { value: 'apple_pay', label: 'Apple Pay', legacyCode: '16' },
  { value: 'google_pay', label: 'Google Pay', legacyCode: '17' },
] as const;

export type PaymentTypeValue = (typeof PAYMENT_TYPE_OPTIONS)[number]['value'];

/** No longer offered on forms; kept so older payments still show their label. */
const RETIRED_PAYMENT_TYPES = [{ value: 'f24', label: 'F24 form **', legacyCode: '12' }] as const;

/** Methods that can receive the "Send payment module" message. */
export const SEND_PAYMENT_MODULE_METHODS: readonly PaymentTypeValue[] = [
  'credit_card',
  'debit_card',
  'paypal',
  'satispay',
  'multisafepay',
  'apple_pay',
  'google_pay',
  'bank_transfer',
  'sepa',
  'cbill',
  'mav',
];

/** Payments with these methods can be stored as "To be verified" until confirmed. */
export const TO_BE_VERIFIED_METHODS: readonly PaymentTypeValue[] = [
  'cheque',
  'payment_slip',
  'bank_transfer',
];

/** Only these methods allow marking the first deadline as Paid on the member Settings. */
export const PAID_AT_FIRST_DEADLINE_METHODS: readonly PaymentTypeValue[] = [
  'cash',
  'cheque',
  'payment_slip',
  'bank_transfer',
];

export function paymentMethodIn(
  list: readonly PaymentTypeValue[],
  value: string | null | undefined,
): boolean {
  const normalized = normalizePaymentTypeValue(value);
  return normalized !== '' && list.includes(normalized);
}

/** Max methods tagged as defaults on payment forms. */
export const MAX_DEFAULT_PAYMENT_METHODS = 5;

export const OTHERS_PAYMENT_OPTION = '__others__';

/** @deprecated Prefer PAYMENT_TYPE_OPTIONS — kept for existing form imports. */
export const PAY_MODE_OPTIONS = PAYMENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  legacyCode: o.legacyCode,
}));

export type PayModeValue = PaymentTypeValue;

const LEGACY_ALIASES: Record<string, PaymentTypeValue> = {
  cash: 'cash',
  bank_check: 'cheque',
  cheque: 'cheque',
  card: 'credit_card',
  credit_card: 'credit_card',
  transfer: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  voucher: 'cash',
  sepa: 'sepa',
  pos: 'credit_card',
  'Bank transfer': 'bank_transfer',
  Cash: 'cash',
  SEPA: 'sepa',
  'SEPA **': 'sepa',
  POS: 'credit_card',
  'Payment slip': 'payment_slip',
  Cheque: 'cheque',
};

export function payModeLabel(value: string | null | undefined): string {
  if (!value) return '-';
  const found =
    PAYMENT_TYPE_OPTIONS.find((o) => o.value === value) ??
    RETIRED_PAYMENT_TYPES.find((o) => o.value === value);
  if (found) return found.label;
  const aliased = LEGACY_ALIASES[value];
  if (aliased) {
    return PAYMENT_TYPE_OPTIONS.find((o) => o.value === aliased)?.label ?? value;
  }
  return value;
}

export function normalizePaymentTypeValue(
  value: string | null | undefined,
): PaymentTypeValue | '' {
  if (!value) return '';
  if (PAYMENT_TYPE_OPTIONS.some((o) => o.value === value)) {
    return value as PaymentTypeValue;
  }
  if (LEGACY_ALIASES[value]) return LEGACY_ALIASES[value];
  const lower = value.trim().toLowerCase();
  const byLabel = PAYMENT_TYPE_OPTIONS.find((o) => o.label.toLowerCase() === lower);
  return byLabel?.value ?? '';
}

export function legacyPayModeToValue(
  code: string | number | null | undefined,
): PaymentTypeValue | (typeof RETIRED_PAYMENT_TYPES)[number]['value'] {
  const key = String(code ?? '');
  const found =
    PAYMENT_TYPE_OPTIONS.find((o) => o.legacyCode === key) ??
    RETIRED_PAYMENT_TYPES.find((o) => o.legacyCode === key);
  if (found) return found.value;
  // Legacy voucher / unknown → cash
  return 'cash';
}

export function sanitizeDefaultPaymentMethods(
  ids: unknown,
): PaymentTypeValue[] {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(PAYMENT_TYPE_OPTIONS.map((o) => o.value));
  const out: PaymentTypeValue[] = [];
  for (const raw of ids) {
    const normalized = normalizePaymentTypeValue(String(raw ?? ''));
    if (!normalized || !allowed.has(normalized)) continue;
    if (out.includes(normalized)) continue;
    out.push(normalized);
    if (out.length >= MAX_DEFAULT_PAYMENT_METHODS) break;
  }
  return out;
}

export function splitPaymentMethodsForForm(defaultIds: string[] | null | undefined): {
  defaults: typeof PAYMENT_TYPE_OPTIONS[number][];
  others: typeof PAYMENT_TYPE_OPTIONS[number][];
} {
  const defaultsIds = sanitizeDefaultPaymentMethods(defaultIds);
  const defaults = defaultsIds
    .map((id) => PAYMENT_TYPE_OPTIONS.find((o) => o.value === id))
    .filter((o): o is (typeof PAYMENT_TYPE_OPTIONS)[number] => Boolean(o));
  const defaultSet = new Set(defaults.map((d) => d.value));
  const others = PAYMENT_TYPE_OPTIONS.filter((o) => !defaultSet.has(o.value));
  // If no defaults tagged, show full list as "defaults" (no Others needed).
  if (defaults.length === 0) {
    return { defaults: [...PAYMENT_TYPE_OPTIONS], others: [] };
  }
  return { defaults, others };
}

export const PAYMENT_STATUS_OPTIONS = ['Paid', 'Pending', 'Not paid'] as const;
