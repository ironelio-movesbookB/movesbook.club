export const TAX_DOCUMENT_TYPE_OPTIONS = ['Simple receipt', 'Tax receipt', 'Invoice'] as const;

export type TaxDocumentTypeOption = (typeof TAX_DOCUMENT_TYPE_OPTIONS)[number];

export type TaxDocumentClubSettings = {
  documentType: string;
  enableHeader: string;
  primaryHeading: string;
  secondaryHeading: string;
  tax: string;
  calTaxStatus: boolean;
  taxReceipt: string;
  invoice: string;
  simpleReceipt: string;
};

export type TaxDocumentDefaults = {
  documentType: string;
  heading: string;
  documentNumber: string;
  vatPercentage: number;
  counterKey: 'taxReceipt' | 'invoice' | 'simpleReceipt';
  counters: {
    taxReceipt: string;
    invoice: string;
    simpleReceipt: string;
  };
};

export function counterKeyForDocumentType(
  documentType: string
): 'taxReceipt' | 'invoice' | 'simpleReceipt' {
  switch (documentType) {
    case 'Invoice':
      return 'invoice';
    case 'Simple receipt':
      return 'simpleReceipt';
    case 'Tax receipt':
    default:
      return 'taxReceipt';
  }
}

export function counterValueForDocumentType(
  settings: TaxDocumentClubSettings,
  documentType: string
): string {
  const key = counterKeyForDocumentType(documentType);
  return String(settings[key] ?? '').trim();
}

/** Displayed number is always stored counter + 1. */
export function nextDocumentNumber(counterValue: string): string {
  const parsed = Number.parseInt(String(counterValue ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return '1';
  return String(parsed + 1);
}

export function headingFromSettings(settings: TaxDocumentClubSettings): string {
  const header = String(settings.enableHeader || 'primary').toLowerCase();
  if (header === 'secondary') {
    return String(settings.secondaryHeading ?? '').trim();
  }
  return String(settings.primaryHeading ?? '').trim();
}

export function parseTaxPercentage(settings: TaxDocumentClubSettings): number {
  const raw = String(settings.tax ?? '').trim();
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function computeVatBreakdown(total: number, vatPercentage: number): {
  vatAmount: number;
  net: number;
} {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const pct = Number.isFinite(vatPercentage) ? Math.max(0, vatPercentage) : 0;
  if (pct <= 0 || safeTotal <= 0) {
    return { vatAmount: 0, net: roundMoney(safeTotal) };
  }
  const net = roundMoney(safeTotal / (1 + pct / 100));
  const vatAmount = roundMoney(safeTotal - net);
  return { vatAmount, net };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMemberDisplayName(originalName: string, aliasName: string): string {
  const original = originalName.trim();
  const alias = aliasName.trim();
  if (!alias || alias === original) return original;
  return `${original}\\${alias}`;
}

export function buildTaxDocumentDefaults(
  settings: TaxDocumentClubSettings,
  documentType?: string
): TaxDocumentDefaults {
  const resolvedType = documentType?.trim() || settings.documentType || 'Tax receipt';
  const counterKey = counterKeyForDocumentType(resolvedType);
  const counterValue = counterValueForDocumentType(settings, resolvedType);

  return {
    documentType: resolvedType,
    heading: headingFromSettings(settings),
    documentNumber: nextDocumentNumber(counterValue),
    vatPercentage: settings.calTaxStatus ? parseTaxPercentage(settings) : 0,
    counterKey,
    counters: {
      taxReceipt: String(settings.taxReceipt ?? ''),
      invoice: String(settings.invoice ?? ''),
      simpleReceipt: String(settings.simpleReceipt ?? ''),
    },
  };
}
