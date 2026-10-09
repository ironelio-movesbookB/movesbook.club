import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { ClubAuthContext } from '@/lib/procedures';
import { normalizeMemberArchiveStatus } from '@/lib/club/memberArchiveStatus';
import { listUnifiedProductSales } from '@/lib/club/archives/clubArchiveService';
import {
  BILLING_DEFAULT_BUDGET_INCOMING,
  BILLING_DEFAULT_BUDGET_OUTGOING,
  BILLING_MEMBER_PARTY_TYPE,
  BILLING_PAYMENT_METHODS,
  BILLING_REIMBURSEMENT_MODES,
  BILLING_VAT_RATES,
  calcInvoiceTotal,
  calcVatAmount,
  isBillingInvoiceDirection,
  isBillingPartyKind,
  type BillingCreditNote,
  type BillingCreditNoteInput,
  type BillingInvoice,
  type BillingInvoiceInput,
  type BillingMemberCandidate,
  type BillingParty,
  type BillingPartyInput,
  type BillingPartyKind,
} from '@/lib/club/clubBilling.constants';

const PARTIES = 'club_billing_parties';
const INVOICES = 'club_billing_invoices';
const CREDIT_NOTES = 'club_billing_credit_notes';

export type BillingWorkspace = { kind: 'club' | 'team' | 'coach'; id: string; name: string };

export class ClubBillingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Club, Team or Coach workspace may manage suppliers and invoices. */
export function billingWorkspace(ctx: ClubAuthContext): BillingWorkspace {
  if (ctx.workspaceKind !== 'club' && ctx.workspaceKind !== 'team' && ctx.workspaceKind !== 'coach') {
    throw new ClubBillingError('Billing is managed from a Club, Team or Coach', 403);
  }
  return { kind: ctx.workspaceKind, id: ctx.club.id, name: ctx.club.name };
}

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${PARTIES}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      kind VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      party_type VARCHAR(80) NOT NULL DEFAULT '',
      vat_number VARCHAR(40) NOT NULL DEFAULT '',
      fiscal_code VARCHAR(40) NOT NULL DEFAULT '',
      address VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(120) NOT NULL DEFAULT '',
      zip VARCHAR(20) NOT NULL DEFAULT '',
      province VARCHAR(60) NOT NULL DEFAULT '',
      contact_person VARCHAR(191) NOT NULL DEFAULT '',
      email VARCHAR(191) NOT NULL DEFAULT '',
      pec VARCHAR(191) NOT NULL DEFAULT '',
      phone VARCHAR(60) NOT NULL DEFAULT '',
      sdi_code VARCHAR(20) NOT NULL DEFAULT '',
      notes TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_billing_parties_ws_idx (workspace_kind, workspace_id, kind),
      KEY club_billing_parties_name_idx (workspace_kind, workspace_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${INVOICES}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      direction VARCHAR(20) NOT NULL,
      party_id VARCHAR(191) NOT NULL,
      document_number VARCHAR(80) NOT NULL DEFAULT '',
      invoice_date DATE NOT NULL,
      payment_due_date DATE NULL,
      payment_method VARCHAR(80) NOT NULL DEFAULT '',
      product_name VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NULL,
      net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      vat_exempt TINYINT(1) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      budget_category VARCHAR(191) NOT NULL DEFAULT '',
      for_public_admin TINYINT(1) NOT NULL DEFAULT 0,
      paid TINYINT(1) NOT NULL DEFAULT 0,
      paid_on DATE NULL,
      author_id VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_billing_invoices_ws_idx (workspace_kind, workspace_id, invoice_date),
      KEY club_billing_invoices_party_idx (party_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${CREDIT_NOTES}\` (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      direction VARCHAR(20) NOT NULL DEFAULT 'incoming',
      party_id VARCHAR(191) NOT NULL,
      registration_date DATE NOT NULL,
      credit_note_date DATE NOT NULL,
      document_number VARCHAR(80) NOT NULL DEFAULT '',
      invoice_reference VARCHAR(80) NOT NULL DEFAULT '',
      invoice_date DATE NULL,
      causal VARCHAR(500) NOT NULL DEFAULT '',
      net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      budget_category VARCHAR(191) NOT NULL DEFAULT '',
      reimbursement_mode VARCHAR(80) NOT NULL DEFAULT '',
      author_id VARCHAR(191) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY club_billing_cn_ws_idx (workspace_kind, workspace_id, credit_note_date),
      KEY club_billing_cn_party_idx (party_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const directionColumn = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'direction'`,
    CREDIT_NOTES,
  );
  if (Number(directionColumn[0]?.c ?? 0) === 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${CREDIT_NOTES}\` ADD COLUMN direction VARCHAR(20) NOT NULL DEFAULT 'incoming' AFTER workspace_id`,
    );
  }
  tablesReady = true;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const ymd = (v: unknown) => {
  const s = str(v, 10);
  return YMD.test(s) ? s : '';
};
const money = (v: unknown) => {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(n)) throw new ClubBillingError('Enter a valid amount', 400);
  return n;
};

type PartyRow = {
  id: string;
  kind: string;
  name: string;
  party_type: string;
  vat_number: string;
  fiscal_code: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  contact_person: string;
  email: string;
  pec: string;
  phone: string;
  sdi_code: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

function toParty(r: PartyRow): BillingParty {
  return {
    id: r.id,
    kind: r.kind as BillingPartyKind,
    name: r.name,
    partyType: r.party_type,
    vatNumber: r.vat_number,
    fiscalCode: r.fiscal_code,
    address: r.address,
    city: r.city,
    zip: r.zip,
    province: r.province,
    contactPerson: r.contact_person,
    email: r.email,
    pec: r.pec,
    phone: r.phone,
    sdiCode: r.sdi_code,
    notes: r.notes ?? '',
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function parsePartyInput(body: Record<string, unknown>): BillingPartyInput {
  const kind = str(body.kind, 20);
  if (!isBillingPartyKind(kind)) throw new ClubBillingError('Select customer or supplier', 400);
  const name = str(body.name, 255);
  if (!name) throw new ClubBillingError('The company name or name is required.', 400);
  const vatNumber = str(body.vatNumber, 40);
  const fiscalCode = str(body.fiscalCode, 40);
  if (!vatNumber && !fiscalCode) {
    throw new ClubBillingError('Enter a VAT number or a fiscal code.', 400);
  }
  return {
    kind,
    name,
    partyType: str(body.partyType, 80),
    vatNumber,
    fiscalCode,
    address: str(body.address, 255),
    city: str(body.city, 120),
    zip: str(body.zip, 20),
    province: str(body.province, 60),
    contactPerson: str(body.contactPerson, 191),
    email: str(body.email, 191),
    pec: str(body.pec, 191),
    phone: str(body.phone, 60),
    sdiCode: str(body.sdiCode, 20),
    notes: str(body.notes, 2000),
  };
}

export async function listParties(
  ws: BillingWorkspace,
  opts?: { kind?: BillingPartyKind | 'all'; q?: string },
): Promise<BillingParty[]> {
  await ensureTables();
  const kind = opts?.kind && opts.kind !== 'all' ? opts.kind : null;
  const q = str(opts?.q, 120).toLowerCase();
  const rows = await prisma.$queryRawUnsafe<PartyRow[]>(
    `SELECT * FROM \`${PARTIES}\`
     WHERE workspace_kind = ? AND workspace_id = ?
     ${kind ? 'AND (kind = ? OR kind = \'both\')' : ''}
     ORDER BY name ASC`,
    ws.kind,
    ws.id,
    ...(kind ? [kind] : []),
  );
  let items = rows.map(toParty);
  if (q) {
    items = items.filter((p) =>
      `${p.name} ${p.vatNumber} ${p.fiscalCode} ${p.email} ${p.city}`.toLowerCase().includes(q),
    );
  }
  return items;
}

export async function getParty(ws: BillingWorkspace, id: string): Promise<BillingParty> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<PartyRow[]>(
    `SELECT * FROM \`${PARTIES}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubBillingError('Party not found', 404);
  return toParty(rows[0]);
}

export async function createParty(ws: BillingWorkspace, input: BillingPartyInput): Promise<BillingParty> {
  await ensureTables();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${PARTIES}\`
      (id, workspace_kind, workspace_id, kind, name, party_type, vat_number, fiscal_code,
       address, city, zip, province, contact_person, email, pec, phone, sdi_code, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    ws.kind,
    ws.id,
    input.kind,
    input.name,
    input.partyType,
    input.vatNumber,
    input.fiscalCode,
    input.address,
    input.city,
    input.zip,
    input.province,
    input.contactPerson,
    input.email,
    input.pec,
    input.phone,
    input.sdiCode,
    input.notes || null,
  );
  return getParty(ws, id);
}

export async function updateParty(
  ws: BillingWorkspace,
  id: string,
  input: BillingPartyInput,
): Promise<BillingParty> {
  await getParty(ws, id);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${PARTIES}\` SET kind=?, name=?, party_type=?, vat_number=?, fiscal_code=?,
      address=?, city=?, zip=?, province=?, contact_person=?, email=?, pec=?, phone=?, sdi_code=?,
      notes=?, updated_at=CURRENT_TIMESTAMP(3)
     WHERE id=? AND workspace_kind=? AND workspace_id=?`,
    input.kind,
    input.name,
    input.partyType,
    input.vatNumber,
    input.fiscalCode,
    input.address,
    input.city,
    input.zip,
    input.province,
    input.contactPerson,
    input.email,
    input.pec,
    input.phone,
    input.sdiCode,
    input.notes || null,
    id,
    ws.kind,
    ws.id,
  );
  return getParty(ws, id);
}

export async function deleteParty(ws: BillingWorkspace, id: string): Promise<void> {
  await getParty(ws, id);
  const [{ c: inv } = { c: BigInt(0) }] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*) AS c FROM \`${INVOICES}\` WHERE party_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
  const [{ c: cn } = { c: BigInt(0) }] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*) AS c FROM \`${CREDIT_NOTES}\` WHERE party_id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
  if (Number(inv) > 0 || Number(cn) > 0) {
    throw new ClubBillingError('This party still has invoices or credit notes.', 400);
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`${PARTIES}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
}

type InvoiceRow = {
  id: string;
  direction: string;
  party_id: string;
  party_name: string | null;
  party_kind: string | null;
  fiscal_code: string | null;
  document_number: string;
  invoice_date: Date;
  payment_due_date: Date | null;
  payment_method: string;
  product_name: string;
  description: string | null;
  net_amount: unknown;
  vat_rate: unknown;
  vat_exempt: number | boolean;
  total_amount: unknown;
  budget_category: string;
  for_public_admin: number | boolean;
  paid: number | boolean;
  paid_on: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toInvoice(r: InvoiceRow): BillingInvoice {
  return {
    id: r.id,
    direction: r.direction as BillingInvoice['direction'],
    partyId: r.party_id,
    partyName: r.party_name ?? '',
    partyKind: (r.party_kind as BillingPartyKind) || '',
    fiscalCode: r.fiscal_code ?? '',
    documentNumber: r.document_number,
    invoiceDate: new Date(r.invoice_date).toISOString().slice(0, 10),
    paymentDueDate: r.payment_due_date ? new Date(r.payment_due_date).toISOString().slice(0, 10) : '',
    paymentMethod: r.payment_method,
    productName: r.product_name,
    description: r.description ?? '',
    netAmount: Number(r.net_amount),
    vatRate: Number(r.vat_rate),
    vatExempt: Boolean(r.vat_exempt),
    totalAmount: Number(r.total_amount),
    budgetCategory: r.budget_category,
    forPublicAdmin: Boolean(r.for_public_admin),
    paid: Boolean(r.paid),
    paidOn: r.paid_on ? new Date(r.paid_on).toISOString().slice(0, 10) : '',
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function parseInvoiceInput(body: Record<string, unknown>): BillingInvoiceInput {
  const direction = str(body.direction, 20);
  if (!isBillingInvoiceDirection(direction)) throw new ClubBillingError('Select issued or received', 400);
  const partyId = str(body.partyId, 191);
  if (!partyId) throw new ClubBillingError('Select a customer or supplier', 400);
  const invoiceDate = ymd(body.invoiceDate);
  if (!invoiceDate) throw new ClubBillingError('The invoice date is required.', 400);
  const productName = str(body.productName, 255);
  if (!productName) throw new ClubBillingError('The product name is required.', 400);
  const description = str(body.description, 4000);
  if (!description) throw new ClubBillingError('The description is required.', 400);
  const documentNumber = str(body.documentNumber, 80);
  if (direction === 'outgoing' && !documentNumber) {
    throw new ClubBillingError('The invoice number is required.', 400);
  }
  const paymentDueDate = ymd(body.paymentDueDate);
  if (direction === 'outgoing' && !paymentDueDate) {
    throw new ClubBillingError('The payment deadline is required.', 400);
  }
  const vatExempt = Boolean(body.vatExempt);
  const netAmount = money(body.netAmount);
  const vatRate = vatExempt ? 0 : Number(body.vatRate);
  if (!vatExempt && !(BILLING_VAT_RATES as readonly number[]).includes(vatRate)) {
    throw new ClubBillingError('Select a VAT rate', 400);
  }
  const paymentMethod = str(body.paymentMethod, 80);
  if (paymentMethod && !(BILLING_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    throw new ClubBillingError('Select a payment method', 400);
  }
  if (!paymentMethod) throw new ClubBillingError('The payment method is required.', 400);
  return {
    direction,
    partyId,
    documentNumber,
    invoiceDate,
    paymentDueDate,
    paymentMethod,
    productName,
    description,
    netAmount,
    vatRate,
    vatExempt,
    budgetCategory:
      str(body.budgetCategory, 191) ||
      (direction === 'outgoing' ? BILLING_DEFAULT_BUDGET_OUTGOING : BILLING_DEFAULT_BUDGET_INCOMING),
    forPublicAdmin: Boolean(body.forPublicAdmin),
    paid: Boolean(body.paid),
    paidOn: ymd(body.paidOn),
  };
}

async function assertPartyForInvoice(ws: BillingWorkspace, partyId: string, direction: string) {
  const party = await getParty(ws, partyId);
  if (!party.vatNumber && !party.fiscalCode) {
    throw new ClubBillingError('The selected party has no VAT number or fiscal code.', 400);
  }
  if (direction === 'incoming' && party.kind === 'customer') {
    throw new ClubBillingError('Select a supplier for a received invoice.', 400);
  }
  return party;
}

/** Sales registered in the Shop archive, shown read-only as issued documents of origin "Shop". */
async function listShopSales(ctx: ClubAuthContext, year: number | null): Promise<BillingInvoice[]> {
  if (ctx.workspaceKind === 'coach') return [];
  const result = await listUnifiedProductSales(ctx, { page: 1, pageSize: 1000 }).catch(() => null);
  if (!result) return [];
  return result.items
    .map((row): BillingInvoice => {
      const value = Number(row.value) || 0;
      const raw = row.insertDate instanceof Date ? row.insertDate.toISOString() : String(row.insertDate ?? '');
      const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
      return {
        id: `shop-${String(row.id)}`,
        direction: 'outgoing',
        partyId: '',
        partyName: String(row.name ?? '') === '-' ? '' : String(row.name ?? ''),
        partyKind: '',
        fiscalCode: '',
        documentNumber: '',
        invoiceDate: date,
        paymentDueDate: '',
        paymentMethod: '',
        productName: String(row.casual ?? '') === '-' ? '' : String(row.casual ?? ''),
        description: '',
        netAmount: value,
        vatRate: 0,
        vatExempt: false,
        totalAmount: value,
        budgetCategory: 'Shop',
        forPublicAdmin: false,
        paid: row.status === 'Paid',
        paidOn: '',
        createdAt: '',
        updatedAt: '',
        source: 'shop',
      };
    })
    .filter((i) => i.invoiceDate && (!year || i.invoiceDate.startsWith(String(year))));
}

export async function listInvoices(
  ws: BillingWorkspace,
  opts?: { direction?: string; year?: number; origin?: string; q?: string; shopCtx?: ClubAuthContext },
): Promise<BillingInvoice[]> {
  await ensureTables();
  const direction =
    opts?.direction === 'outgoing' || opts?.direction === 'incoming' ? opts.direction : null;
  const year = opts?.year && Number.isFinite(opts.year) ? opts.year : null;
  const rows = await prisma.$queryRawUnsafe<InvoiceRow[]>(
    `SELECT i.*, p.name AS party_name, p.kind AS party_kind, COALESCE(NULLIF(p.fiscal_code, ''), p.vat_number) AS fiscal_code
     FROM \`${INVOICES}\` i
     LEFT JOIN \`${PARTIES}\` p ON p.id = i.party_id
     WHERE i.workspace_kind = ? AND i.workspace_id = ?
     ${direction ? 'AND i.direction = ?' : ''}
     ${year ? 'AND YEAR(i.invoice_date) = ?' : ''}
     ORDER BY i.invoice_date DESC, i.created_at DESC`,
    ws.kind,
    ws.id,
    ...(direction ? [direction] : []),
    ...(year ? [year] : []),
  );
  let items = rows.map(toInvoice);
  const origin = opts?.origin || 'all';
  if (origin === 'customers') items = items.filter((i) => i.partyKind === 'customer' || i.partyKind === 'both');
  if (origin === 'suppliers') items = items.filter((i) => i.partyKind === 'supplier' || i.partyKind === 'both');
  if (origin === 'shop') items = [];
  if ((origin === 'shop' || origin === 'all') && direction !== 'incoming' && opts?.shopCtx) {
    items = [...items, ...(await listShopSales(opts.shopCtx, year))];
    items.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }
  const q = str(opts?.q, 120).toLowerCase();
  if (q) {
    items = items.filter((i) =>
      `${i.documentNumber} ${i.partyName} ${i.fiscalCode} ${i.productName} ${i.description}`
        .toLowerCase()
        .includes(q),
    );
  }
  return items;
}

export async function getInvoice(ws: BillingWorkspace, id: string): Promise<BillingInvoice> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<InvoiceRow[]>(
    `SELECT i.*, p.name AS party_name, p.kind AS party_kind, COALESCE(NULLIF(p.fiscal_code, ''), p.vat_number) AS fiscal_code
     FROM \`${INVOICES}\` i
     LEFT JOIN \`${PARTIES}\` p ON p.id = i.party_id
     WHERE i.id = ? AND i.workspace_kind = ? AND i.workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubBillingError('Invoice not found', 404);
  return toInvoice(rows[0]);
}

export async function createInvoice(
  ws: BillingWorkspace,
  input: BillingInvoiceInput,
  authorId?: string,
): Promise<BillingInvoice> {
  await ensureTables();
  await assertPartyForInvoice(ws, input.partyId, input.direction);
  const net = Number(input.netAmount);
  const rate = Number(input.vatRate);
  const total = calcInvoiceTotal(net, rate, input.vatExempt);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${INVOICES}\`
      (id, workspace_kind, workspace_id, direction, party_id, document_number, invoice_date,
       payment_due_date, payment_method, product_name, description, net_amount, vat_rate,
       vat_exempt, total_amount, budget_category, for_public_admin, paid, paid_on, author_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    ws.kind,
    ws.id,
    input.direction,
    input.partyId,
    input.documentNumber,
    input.invoiceDate,
    input.paymentDueDate || null,
    input.paymentMethod,
    input.productName,
    input.description || null,
    net,
    rate,
    input.vatExempt ? 1 : 0,
    total,
    input.budgetCategory,
    input.forPublicAdmin ? 1 : 0,
    input.paid ? 1 : 0,
    input.paidOn || null,
    authorId || null,
  );
  return getInvoice(ws, id);
}

export async function updateInvoice(
  ws: BillingWorkspace,
  id: string,
  input: BillingInvoiceInput,
): Promise<BillingInvoice> {
  await getInvoice(ws, id);
  await assertPartyForInvoice(ws, input.partyId, input.direction);
  const net = Number(input.netAmount);
  const rate = Number(input.vatRate);
  const total = calcInvoiceTotal(net, rate, input.vatExempt);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${INVOICES}\` SET direction=?, party_id=?, document_number=?, invoice_date=?,
      payment_due_date=?, payment_method=?, product_name=?, description=?, net_amount=?, vat_rate=?,
      vat_exempt=?, total_amount=?, budget_category=?, for_public_admin=?, paid=?, paid_on=?,
      updated_at=CURRENT_TIMESTAMP(3)
     WHERE id=? AND workspace_kind=? AND workspace_id=?`,
    input.direction,
    input.partyId,
    input.documentNumber,
    input.invoiceDate,
    input.paymentDueDate || null,
    input.paymentMethod,
    input.productName,
    input.description || null,
    net,
    rate,
    input.vatExempt ? 1 : 0,
    total,
    input.budgetCategory,
    input.forPublicAdmin ? 1 : 0,
    input.paid ? 1 : 0,
    input.paidOn || null,
    id,
    ws.kind,
    ws.id,
  );
  return getInvoice(ws, id);
}

export async function deleteInvoice(ws: BillingWorkspace, id: string): Promise<void> {
  await getInvoice(ws, id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`${INVOICES}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
}

export async function nextInvoiceNumber(ws: BillingWorkspace, direction: string): Promise<string> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<{ n: number | null }[]>(
    `SELECT MAX(CAST(document_number AS UNSIGNED)) AS n FROM \`${INVOICES}\`
     WHERE workspace_kind = ? AND workspace_id = ? AND direction = ?
       AND document_number REGEXP '^[0-9]+$'`,
    ws.kind,
    ws.id,
    direction,
  );
  return String((Number(rows[0]?.n) || 0) + 1);
}

type CreditRow = {
  id: string;
  direction: string;
  party_id: string;
  party_name: string | null;
  fiscal_code: string | null;
  registration_date: Date;
  credit_note_date: Date;
  document_number: string;
  invoice_reference: string;
  invoice_date: Date | null;
  causal: string;
  net_amount: unknown;
  vat_rate: unknown;
  vat_amount: unknown;
  total_amount: unknown;
  budget_category: string;
  reimbursement_mode: string;
  created_at: Date;
  updated_at: Date;
};

function toCredit(r: CreditRow): BillingCreditNote {
  return {
    id: r.id,
    direction: r.direction === 'outgoing' ? 'outgoing' : 'incoming',
    partyId: r.party_id,
    partyName: r.party_name ?? '',
    fiscalCode: r.fiscal_code ?? '',
    registrationDate: new Date(r.registration_date).toISOString().slice(0, 10),
    creditNoteDate: new Date(r.credit_note_date).toISOString().slice(0, 10),
    documentNumber: r.document_number,
    invoiceReference: r.invoice_reference,
    invoiceDate: r.invoice_date ? new Date(r.invoice_date).toISOString().slice(0, 10) : '',
    causal: r.causal,
    netAmount: Number(r.net_amount),
    vatRate: Number(r.vat_rate),
    vatAmount: Number(r.vat_amount),
    totalAmount: Number(r.total_amount),
    budgetCategory: r.budget_category,
    reimbursementMode: r.reimbursement_mode,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export function parseCreditNoteInput(body: Record<string, unknown>): BillingCreditNoteInput {
  const rawDirection = str(body.direction, 20);
  if (rawDirection && !isBillingInvoiceDirection(rawDirection)) {
    throw new ClubBillingError('Select issued or received', 400);
  }
  const direction = rawDirection === 'outgoing' ? 'outgoing' : 'incoming';
  const partyId = str(body.partyId, 191);
  if (!partyId) {
    throw new ClubBillingError(direction === 'outgoing' ? 'Select a customer' : 'Select a supplier', 400);
  }
  const creditNoteDate = ymd(body.creditNoteDate);
  if (!creditNoteDate) throw new ClubBillingError('The credit note date is required.', 400);
  const registrationDate = ymd(body.registrationDate) || creditNoteDate;
  const documentNumber = str(body.documentNumber, 80);
  if (!documentNumber) throw new ClubBillingError('The credit note number is required.', 400);
  const netAmount = money(body.netAmount);
  const vatRate = Number(body.vatRate);
  if (!(BILLING_VAT_RATES as readonly number[]).includes(vatRate)) {
    throw new ClubBillingError('Select a VAT rate', 400);
  }
  const reimbursementMode = str(body.reimbursementMode, 80);
  if (reimbursementMode && !(BILLING_REIMBURSEMENT_MODES as readonly string[]).includes(reimbursementMode)) {
    throw new ClubBillingError('Select a reimbursement mode', 400);
  }
  return {
    direction,
    partyId,
    registrationDate,
    creditNoteDate,
    documentNumber,
    invoiceReference: str(body.invoiceReference, 80),
    invoiceDate: ymd(body.invoiceDate),
    causal: str(body.causal, 500),
    netAmount,
    vatRate,
    budgetCategory: str(body.budgetCategory, 191),
    reimbursementMode: reimbursementMode || (direction === 'outgoing' ? 'Customer credit' : 'Supplier credit'),
  };
}

export async function listCreditNotes(
  ws: BillingWorkspace,
  opts?: { direction?: string; year?: number; q?: string; from?: string; to?: string },
): Promise<BillingCreditNote[]> {
  await ensureTables();
  const direction =
    opts?.direction === 'outgoing' || opts?.direction === 'incoming' ? opts.direction : null;
  const year = opts?.year && Number.isFinite(opts.year) ? opts.year : null;
  const from = ymd(opts?.from);
  const to = ymd(opts?.to);
  const rows = await prisma.$queryRawUnsafe<CreditRow[]>(
    `SELECT c.*, p.name AS party_name, COALESCE(NULLIF(p.fiscal_code, ''), p.vat_number) AS fiscal_code
     FROM \`${CREDIT_NOTES}\` c
     LEFT JOIN \`${PARTIES}\` p ON p.id = c.party_id
     WHERE c.workspace_kind = ? AND c.workspace_id = ?
     ${direction ? 'AND c.direction = ?' : ''}
     ${year ? 'AND YEAR(c.credit_note_date) = ?' : ''}
     ${from ? 'AND c.credit_note_date >= ?' : ''}
     ${to ? 'AND c.credit_note_date <= ?' : ''}
     ORDER BY c.credit_note_date DESC, c.created_at DESC`,
    ws.kind,
    ws.id,
    ...(direction ? [direction] : []),
    ...(year ? [year] : []),
    ...(from ? [from] : []),
    ...(to ? [to] : []),
  );
  let items = rows.map(toCredit);
  const q = str(opts?.q, 120).toLowerCase();
  if (q) {
    items = items.filter((c) =>
      `${c.documentNumber} ${c.partyName} ${c.fiscalCode} ${c.invoiceReference} ${c.causal}`
        .toLowerCase()
        .includes(q),
    );
  }
  return items;
}

export async function getCreditNote(ws: BillingWorkspace, id: string): Promise<BillingCreditNote> {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe<CreditRow[]>(
    `SELECT c.*, p.name AS party_name, COALESCE(NULLIF(p.fiscal_code, ''), p.vat_number) AS fiscal_code
     FROM \`${CREDIT_NOTES}\` c
     LEFT JOIN \`${PARTIES}\` p ON p.id = c.party_id
     WHERE c.id = ? AND c.workspace_kind = ? AND c.workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new ClubBillingError('Credit note not found', 404);
  return toCredit(rows[0]);
}

async function assertPartyForCreditNote(ws: BillingWorkspace, partyId: string, direction: string) {
  const party = await getParty(ws, partyId);
  if (direction === 'incoming' && party.kind === 'customer') {
    throw new ClubBillingError('Select a supplier for the credit note.', 400);
  }
  return party;
}

export async function createCreditNote(
  ws: BillingWorkspace,
  input: BillingCreditNoteInput,
  authorId?: string,
): Promise<BillingCreditNote> {
  await ensureTables();
  await assertPartyForCreditNote(ws, input.partyId, input.direction);
  const net = Number(input.netAmount);
  const rate = Number(input.vatRate);
  const vatAmount = calcVatAmount(net, rate);
  const total = calcInvoiceTotal(net, rate);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${CREDIT_NOTES}\`
      (id, workspace_kind, workspace_id, direction, party_id, registration_date, credit_note_date,
       document_number, invoice_reference, invoice_date, causal, net_amount, vat_rate,
       vat_amount, total_amount, budget_category, reimbursement_mode, author_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    ws.kind,
    ws.id,
    input.direction,
    input.partyId,
    input.registrationDate,
    input.creditNoteDate,
    input.documentNumber,
    input.invoiceReference,
    input.invoiceDate || null,
    input.causal,
    net,
    rate,
    vatAmount,
    total,
    input.budgetCategory,
    input.reimbursementMode,
    authorId || null,
  );
  return getCreditNote(ws, id);
}

export async function updateCreditNote(
  ws: BillingWorkspace,
  id: string,
  input: BillingCreditNoteInput,
): Promise<BillingCreditNote> {
  await getCreditNote(ws, id);
  await assertPartyForCreditNote(ws, input.partyId, input.direction);
  const net = Number(input.netAmount);
  const rate = Number(input.vatRate);
  const vatAmount = calcVatAmount(net, rate);
  const total = calcInvoiceTotal(net, rate);
  await prisma.$executeRawUnsafe(
    `UPDATE \`${CREDIT_NOTES}\` SET direction=?, party_id=?, registration_date=?, credit_note_date=?,
      document_number=?, invoice_reference=?, invoice_date=?, causal=?, net_amount=?, vat_rate=?,
      vat_amount=?, total_amount=?, budget_category=?, reimbursement_mode=?,
      updated_at=CURRENT_TIMESTAMP(3)
     WHERE id=? AND workspace_kind=? AND workspace_id=?`,
    input.direction,
    input.partyId,
    input.registrationDate,
    input.creditNoteDate,
    input.documentNumber,
    input.invoiceReference,
    input.invoiceDate || null,
    input.causal,
    net,
    rate,
    vatAmount,
    total,
    input.budgetCategory,
    input.reimbursementMode,
    id,
    ws.kind,
    ws.id,
  );
  return getCreditNote(ws, id);
}

export async function deleteCreditNote(ws: BillingWorkspace, id: string): Promise<void> {
  await getCreditNote(ws, id);
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`${CREDIT_NOTES}\` WHERE id = ? AND workspace_kind = ? AND workspace_id = ?`,
    id,
    ws.kind,
    ws.id,
  );
}

export async function listPartyDocuments(ws: BillingWorkspace, partyId: string) {
  await getParty(ws, partyId);
  const [invoices, creditNotes] = await Promise.all([
    listInvoices(ws).then((items) => items.filter((i) => i.partyId === partyId)),
    listCreditNotes(ws).then((items) => items.filter((c) => c.partyId === partyId)),
  ]);
  return { invoices, creditNotes };
}

function parseJsonObject(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type MemberUser = { id: string; firstName: string | null; surname: string | null; name: string; email: string | null };

async function activeMemberUsers(ws: BillingWorkspace): Promise<MemberUser[]> {
  const userSelect = { id: true, firstName: true, surname: true, name: true, email: true };
  if (ws.kind === 'team') {
    const rows = await prisma.teamMember.findMany({
      where: { teamId: ws.id },
      select: { role: true, athlete: { select: userSelect } },
    });
    return rows.filter((r) => normalizeMemberArchiveStatus(r.role) !== 'archived').map((r) => r.athlete);
  }
  if (ws.kind === 'club') {
    const rows = await prisma.clubMember.findMany({
      where: { clubId: ws.id },
      select: { role: true, member: { select: userSelect } },
    });
    return rows.filter((r) => normalizeMemberArchiveStatus(r.role) !== 'archived').map((r) => r.member);
  }
  return [];
}

/** Members of the workspace that can receive an invoice, with their billing data from the owner profile. */
export async function listMemberCandidates(ws: BillingWorkspace): Promise<BillingMemberCandidate[]> {
  await ensureTables();
  const users = await activeMemberUsers(ws);
  if (!users.length) return [];
  const [extras, parties] = await Promise.all([
    prisma.userProfileExtras
      .findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, ownerJson: true } })
      .catch(() => []),
    listParties(ws),
  ]);
  const owners = new Map(extras.map((e) => [e.userId, parseJsonObject(e.ownerJson)]));
  const memberParties = new Map(
    parties
      .filter((p) => p.partyType === BILLING_MEMBER_PARTY_TYPE && p.fiscalCode)
      .map((p) => [p.fiscalCode.toUpperCase(), p.id]),
  );
  return users
    .map((u) => {
      const owner = owners.get(u.id) ?? {};
      const address = owner.address ?? {};
      const fiscalCode = str(owner.administrative?.fiscalCode, 40).toUpperCase();
      const fullName = [str(u.firstName, 100), str(u.surname, 100)].filter(Boolean).join(' ') || str(u.name, 255);
      return {
        userId: u.id,
        name: fullName,
        fiscalCode,
        email: str(u.email, 191),
        address: str(address.address, 255),
        city: str(address.city, 120),
        zip: str(address.zipCode, 20),
        province: str(address.province, 60),
        phone: str(address.mobile1 || address.phone, 60),
        partyId: (fiscalCode && memberParties.get(fiscalCode)) || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Customer party for a member: reuses the one with the same fiscal code, otherwise creates it. */
export async function partyForMember(ws: BillingWorkspace, userId: string): Promise<BillingParty> {
  const member = (await listMemberCandidates(ws)).find((m) => m.userId === userId);
  if (!member) throw new ClubBillingError('Member not found', 404);
  if (!member.fiscalCode) {
    throw new ClubBillingError('This member has no fiscal code. Add it to the member profile first.', 400);
  }
  if (member.partyId) return getParty(ws, member.partyId);
  return createParty(ws, {
    kind: 'customer',
    name: member.name,
    partyType: BILLING_MEMBER_PARTY_TYPE,
    vatNumber: '',
    fiscalCode: member.fiscalCode,
    address: member.address,
    city: member.city,
    zip: member.zip,
    province: member.province,
    contactPerson: '',
    email: member.email,
    pec: '',
    phone: member.phone,
    sdiCode: '',
    notes: '',
  });
}
