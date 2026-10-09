/** Club / Team / Coach billing: parties, invoices, credit notes. */

export const BILLING_PARTY_KINDS = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'both', label: 'Customer and supplier' },
] as const;

export type BillingPartyKind = (typeof BILLING_PARTY_KINDS)[number]['value'];

export const BILLING_PARTY_TYPES = [
  'Company',
  'Private individual',
  'Member',
  'Public administration',
  'Other',
] as const;

/** Party type of customers created from a member of the workspace. */
export const BILLING_MEMBER_PARTY_TYPE = 'Member';

/** Budget category applied when none is selected. */
export const BILLING_DEFAULT_BUDGET_OUTGOING = 'Sponsor';
export const BILLING_DEFAULT_BUDGET_INCOMING = 'Customers/suppliers';

export type BillingMemberCandidate = {
  userId: string;
  name: string;
  fiscalCode: string;
  email: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  phone: string;
  partyId: string;
};

export type BillingPartyType = (typeof BILLING_PARTY_TYPES)[number] | '';

export const BILLING_INVOICE_DIRECTIONS = [
  { value: 'outgoing', label: 'Issued' },
  { value: 'incoming', label: 'Received' },
] as const;

export type BillingInvoiceDirection = (typeof BILLING_INVOICE_DIRECTIONS)[number]['value'];

export const BILLING_VAT_RATES = [0, 4, 5, 10, 22] as const;

export const BILLING_PAYMENT_METHODS = [
  'Cash',
  'Bank transfer',
  'Card',
  'Cheque',
  'RID / SDD',
  'Other',
] as const;

export const BILLING_REIMBURSEMENT_MODES = [
  'Supplier credit',
  'Customer credit',
  'Bank transfer',
  'Cash',
  'Offset against next invoice',
  'Other',
] as const;

export const BILLING_DOC_ORIGINS = [
  { value: 'all', label: 'All' },
  { value: 'customers', label: 'Customers' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'shop', label: 'Shop' },
] as const;

export type BillingDocOrigin = (typeof BILLING_DOC_ORIGINS)[number]['value'];

export type BillingParty = {
  id: string;
  kind: BillingPartyKind;
  name: string;
  partyType: string;
  vatNumber: string;
  fiscalCode: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  contactPerson: string;
  email: string;
  pec: string;
  phone: string;
  sdiCode: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingPartyInput = Omit<BillingParty, 'id' | 'createdAt' | 'updatedAt'>;

export const EMPTY_BILLING_PARTY: BillingPartyInput = {
  kind: 'supplier',
  name: '',
  partyType: '',
  vatNumber: '',
  fiscalCode: '',
  address: '',
  city: '',
  zip: '',
  province: '',
  contactPerson: '',
  email: '',
  pec: '',
  phone: '',
  sdiCode: '',
  notes: '',
};

export type BillingInvoice = {
  id: string;
  direction: BillingInvoiceDirection;
  partyId: string;
  partyName: string;
  partyKind: BillingPartyKind | '';
  fiscalCode: string;
  documentNumber: string;
  invoiceDate: string;
  paymentDueDate: string;
  paymentMethod: string;
  productName: string;
  description: string;
  netAmount: number;
  vatRate: number;
  vatExempt: boolean;
  totalAmount: number;
  budgetCategory: string;
  forPublicAdmin: boolean;
  paid: boolean;
  paidOn: string;
  createdAt: string;
  updatedAt: string;
  /** Read-only sale from the Shop archive (`product_sale`), listed under the Shop origin. */
  source?: 'shop';
};

export type BillingInvoiceInput = {
  direction: BillingInvoiceDirection;
  partyId: string;
  documentNumber: string;
  invoiceDate: string;
  paymentDueDate: string;
  paymentMethod: string;
  productName: string;
  description: string;
  netAmount: number | string;
  vatRate: number | string;
  vatExempt: boolean;
  budgetCategory: string;
  forPublicAdmin: boolean;
  paid: boolean;
  paidOn: string;
};

export const EMPTY_OUTGOING_INVOICE: BillingInvoiceInput = {
  direction: 'outgoing',
  partyId: '',
  documentNumber: '',
  invoiceDate: '',
  paymentDueDate: '',
  paymentMethod: '',
  productName: '',
  description: '',
  netAmount: '',
  vatRate: 22,
  vatExempt: false,
  budgetCategory: '',
  forPublicAdmin: false,
  paid: false,
  paidOn: '',
};

export const EMPTY_INCOMING_INVOICE: BillingInvoiceInput = {
  ...EMPTY_OUTGOING_INVOICE,
  direction: 'incoming',
  vatRate: '',
};

export type BillingCreditNote = {
  id: string;
  direction: BillingInvoiceDirection;
  partyId: string;
  partyName: string;
  fiscalCode: string;
  registrationDate: string;
  creditNoteDate: string;
  documentNumber: string;
  invoiceReference: string;
  invoiceDate: string;
  causal: string;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  budgetCategory: string;
  reimbursementMode: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingCreditNoteInput = {
  direction: BillingInvoiceDirection;
  partyId: string;
  registrationDate: string;
  creditNoteDate: string;
  documentNumber: string;
  invoiceReference: string;
  invoiceDate: string;
  causal: string;
  netAmount: number | string;
  vatRate: number | string;
  budgetCategory: string;
  reimbursementMode: string;
};

export const EMPTY_CREDIT_NOTE: BillingCreditNoteInput = {
  direction: 'incoming',
  partyId: '',
  registrationDate: '',
  creditNoteDate: '',
  documentNumber: '',
  invoiceReference: '',
  invoiceDate: '',
  causal: '',
  netAmount: '',
  vatRate: 22,
  budgetCategory: '',
  reimbursementMode: 'Supplier credit',
};

export function calcVatAmount(net: number, rate: number, exempt = false): number {
  if (exempt || !Number.isFinite(net) || !Number.isFinite(rate)) return 0;
  return Math.round(net * rate) / 100;
}

export function calcInvoiceTotal(net: number, rate: number, exempt = false): number {
  return Math.round((net + calcVatAmount(net, rate, exempt)) * 100) / 100;
}

export function formatEuro(value: number): string {
  return `${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

/** yyyy-mm-dd → dd/mm/yyyy */
export function formatYmd(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function isBillingPartyKind(value: string): value is BillingPartyKind {
  return BILLING_PARTY_KINDS.some((k) => k.value === value);
}

export function isBillingInvoiceDirection(value: string): value is BillingInvoiceDirection {
  return BILLING_INVOICE_DIRECTIONS.some((d) => d.value === value);
}
