export const PAYMENT_LABEL_MAX = 30;
export const PAYMENT_LIST_MAX = 40;
export const PAYMENT_VAT_RULE_MAX = 20;

export type PaymentLabelItem = {
  id: string;
  name: string;
};

export type PaymentVatRule = {
  id: string;
  percent: number;
};

/** Frequent objects and causals a club offers when recording a payment. */
export type PaymentFrequentSettings = {
  progressiveNumber: number;
  objects: PaymentLabelItem[];
  causals: PaymentLabelItem[];
  defaultObjectId: string | null;
  defaultCausalId: string | null;
  vatRules: PaymentVatRule[];
};

export function factoryPaymentFrequentSettings(): PaymentFrequentSettings {
  return {
    progressiveNumber: 1,
    objects: [],
    causals: [],
    defaultObjectId: null,
    defaultCausalId: null,
    vatRules: [],
  };
}

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function safeId(value: unknown): string {
  const raw = text(value).slice(0, 64);
  if (/^[A-Za-z0-9_-]+$/.test(raw)) return raw;
  return crypto.randomUUID();
}

function normalizeLabels(value: unknown): PaymentLabelItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: PaymentLabelItem[] = [];
  for (const entry of value) {
    if (items.length >= PAYMENT_LIST_MAX) break;
    if (!entry || typeof entry !== 'object') continue;
    const name = text((entry as PaymentLabelItem).name).slice(0, PAYMENT_LABEL_MAX);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: safeId((entry as PaymentLabelItem).id), name });
  }
  return items;
}

function normalizeDefaultId(value: unknown, items: PaymentLabelItem[]): string | null {
  const id = text(value);
  if (id && items.some((item) => item.id === id)) return id;
  return items[0]?.id ?? null;
}

function normalizeVatRules(value: unknown): PaymentVatRule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rules: PaymentVatRule[] = [];
  for (const entry of value) {
    if (rules.length >= PAYMENT_VAT_RULE_MAX) break;
    if (!entry || typeof entry !== 'object') continue;
    const percent = Number((entry as PaymentVatRule).percent);
    if (!Number.isFinite(percent)) continue;
    const rounded = Math.round(percent * 100) / 100;
    if (rounded < 0 || rounded > 100) continue;
    const key = rounded.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push({ id: safeId((entry as PaymentVatRule).id), percent: rounded });
  }
  return rules;
}

export function normalizePaymentFrequentSettings(raw: unknown): PaymentFrequentSettings {
  const source = raw && typeof raw === 'object' ? (raw as Partial<PaymentFrequentSettings>) : {};
  const progressive = Number(source.progressiveNumber);
  const objects = normalizeLabels(source.objects);
  const causals = normalizeLabels(source.causals);
  return {
    progressiveNumber: Number.isFinite(progressive)
      ? Math.min(999_999_999, Math.max(0, Math.round(progressive)))
      : 1,
    objects,
    causals,
    defaultObjectId: normalizeDefaultId(source.defaultObjectId, objects),
    defaultCausalId: normalizeDefaultId(source.defaultCausalId, causals),
    vatRules: normalizeVatRules(source.vatRules),
  };
}
