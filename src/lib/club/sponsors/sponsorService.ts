import { randomBytes, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import { sendIonosEmail } from '@/lib/ionosEmail';
import {
  SPONSOR_IMAGE_EXTENSIONS,
  SPONSOR_MAX_IMAGE_BYTES,
  SPONSOR_MAX_PDF_BYTES,
  SPONSOR_SECTIONS,
  addDaysYmd,
  contractStatusOf,
  isSponsorSectionKey,
  paymentsStatusOf,
  pickCurrentContract,
  todayYmd,
  type Sponsor,
  type SponsorContract,
  type SponsorListItem,
  type SponsorListSummary,
  type SponsorMediaKind,
  type SponsorPayment,
  type SponsorPlacements,
  type SponsorProfile,
  type SponsorSectionKey,
  type SponsorStats,
} from '@/lib/club/sponsors/sponsorConstants';

export type SponsorWorkspace = { kind: 'club' | 'team'; id: string };

export class SponsorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const UPLOAD_SUBDIR = 'club_sponsors';
let tablesReady = false;

export async function ensureSponsorTables(): Promise<void> {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsors (
      id VARCHAR(191) NOT NULL,
      workspace_kind VARCHAR(10) NOT NULL,
      workspace_id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      visible TINYINT(1) NOT NULL DEFAULT 1,
      landing_url VARCHAR(512) NOT NULL DEFAULT '',
      business_name VARCHAR(191) NOT NULL DEFAULT '',
      vat_code VARCHAR(64) NOT NULL DEFAULT '',
      contact_name VARCHAR(191) NOT NULL DEFAULT '',
      email VARCHAR(191) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      address VARCHAR(255) NOT NULL DEFAULT '',
      banner_path VARCHAR(255) NULL,
      logo_path VARCHAR(255) NULL,
      placements_json TEXT NULL,
      report_token VARCHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY org_sponsors_report_token (report_token),
      KEY org_sponsors_workspace_idx (workspace_kind, workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsor_contracts (
      id VARCHAR(191) NOT NULL,
      sponsor_id VARCHAR(191) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      value DECIMAL(12,2) NOT NULL DEFAULT 0,
      reminder_days INT NOT NULL DEFAULT 30,
      notes TEXT NULL,
      pdf_name VARCHAR(191) NULL,
      pdf_path VARCHAR(255) NULL,
      reminder_sent_at DATETIME NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY org_sponsor_contracts_sponsor_idx (sponsor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsor_payments (
      id VARCHAR(191) NOT NULL,
      sponsor_id VARCHAR(191) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      due_date DATE NOT NULL,
      reminder_days INT NOT NULL DEFAULT 7,
      note VARCHAR(255) NOT NULL DEFAULT '',
      paid_at DATE NULL,
      reminder_sent_at DATETIME NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY org_sponsor_payments_sponsor_idx (sponsor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS org_sponsor_events (
      id BIGINT NOT NULL AUTO_INCREMENT,
      sponsor_id VARCHAR(191) NOT NULL,
      event VARCHAR(8) NOT NULL,
      section VARCHAR(40) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY org_sponsor_events_sponsor_idx (sponsor_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tablesReady = true;
}

// ---------- helpers ----------

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function ymd(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** MySQL DATE comes back as UTC midnight. */
function dbYmd(value: Date | string | null): string {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function mediaUrl(path: string | null): string | null {
  return path ? toMediaApiPath(path) : null;
}

function safeUrl(value: unknown): string {
  const url = str(value, 512);
  if (!url) return '';
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    throw new SponsorError('The banner landing URL is not valid', 400);
  }
}

function parsePlacements(raw: string | null): SponsorPlacements {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: SponsorPlacements = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSponsorSectionKey(key) && (value === 'logo' || value === 'banner')) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

async function removeStoredFile(path: string | null) {
  if (!path?.startsWith(`/uploads/${UPLOAD_SUBDIR}/`)) return;
  await unlink(join(getServerPublicDir(), path)).catch(() => undefined);
}

async function storeFile(file: Blob, originalName: string, allowed: readonly string[], maxBytes: number) {
  if (file.size === 0) throw new SponsorError('The file is empty', 400);
  if (file.size > maxBytes) {
    throw new SponsorError(`The file cannot be larger than ${Math.round(maxBytes / 1024 / 1024)}MB`, 400);
  }
  const ext = (originalName.split('.').pop() ?? '').toLowerCase();
  if (!allowed.includes(ext)) throw new SponsorError('File type not allowed', 400);
  const dir = join(getServerPublicDir(), 'uploads', UPLOAD_SUBDIR);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const stored = `${randomBytes(16).toString('hex')}.${ext}`;
  await writeFile(join(dir, stored), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${UPLOAD_SUBDIR}/${stored}`;
}

// ---------- rows ----------

type SponsorRow = {
  id: string;
  workspace_kind: string;
  workspace_id: string;
  name: string;
  visible: number | boolean;
  landing_url: string;
  business_name: string;
  vat_code: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  banner_path: string | null;
  logo_path: string | null;
  placements_json: string | null;
  report_token: string;
  created_at: Date;
  updated_at: Date;
};

type ContractRow = {
  id: string;
  sponsor_id: string;
  start_date: Date | string;
  end_date: Date | string;
  value: unknown;
  reminder_days: number;
  notes: string | null;
  pdf_name: string | null;
  pdf_path: string | null;
  created_at: Date;
};

type PaymentRow = {
  id: string;
  sponsor_id: string;
  amount: unknown;
  due_date: Date | string;
  reminder_days: number;
  note: string;
  paid_at: Date | string | null;
  created_at: Date;
};

function toContract(r: ContractRow): SponsorContract {
  return {
    id: r.id,
    startDate: dbYmd(r.start_date),
    endDate: dbYmd(r.end_date),
    value: Number(r.value) || 0,
    reminderDays: Number(r.reminder_days) || 0,
    notes: r.notes ?? '',
    pdfName: r.pdf_name,
    pdfUrl: mediaUrl(r.pdf_path),
    createdAt: r.created_at.toISOString(),
  };
}

function toPayment(r: PaymentRow): SponsorPayment {
  return {
    id: r.id,
    amount: Number(r.amount) || 0,
    dueDate: dbYmd(r.due_date),
    reminderDays: Number(r.reminder_days) || 0,
    note: r.note,
    paidAt: r.paid_at ? dbYmd(r.paid_at) : null,
    createdAt: r.created_at.toISOString(),
  };
}

function toSponsor(r: SponsorRow, contractRows: ContractRow[], paymentRows: PaymentRow[]): Sponsor {
  const contracts = contractRows
    .map(toContract)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const payments = paymentRows.map(toPayment).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const currentContract = pickCurrentContract(contracts);
  return {
    id: r.id,
    name: r.name,
    visible: Boolean(Number(r.visible)),
    landingUrl: r.landing_url,
    businessName: r.business_name,
    vatCode: r.vat_code,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    bannerUrl: mediaUrl(r.banner_path),
    logoUrl: mediaUrl(r.logo_path),
    placements: parsePlacements(r.placements_json),
    contracts,
    payments,
    currentContract,
    contractStatus: contractStatusOf(currentContract),
    paymentsStatus: paymentsStatusOf(payments),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

async function getSponsorRow(ws: SponsorWorkspace, id: string): Promise<SponsorRow> {
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<SponsorRow[]>(
    `SELECT * FROM org_sponsors WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    id,
    ws.kind,
    ws.id,
  );
  if (!rows[0]) throw new SponsorError('Sponsor not found', 404);
  return rows[0];
}

async function loadChildren(sponsorIds: string[]) {
  if (sponsorIds.length === 0) return { contracts: [] as ContractRow[], payments: [] as PaymentRow[] };
  const marks = sponsorIds.map(() => '?').join(',');
  const [contracts, payments] = await Promise.all([
    prisma.$queryRawUnsafe<ContractRow[]>(
      `SELECT * FROM org_sponsor_contracts WHERE sponsor_id IN (${marks})`,
      ...sponsorIds,
    ),
    prisma.$queryRawUnsafe<PaymentRow[]>(
      `SELECT * FROM org_sponsor_payments WHERE sponsor_id IN (${marks})`,
      ...sponsorIds,
    ),
  ]);
  return { contracts, payments };
}

// ---------- sponsors ----------

export async function getSponsor(ws: SponsorWorkspace, id: string): Promise<Sponsor> {
  const row = await getSponsorRow(ws, id);
  const { contracts, payments } = await loadChildren([id]);
  return toSponsor(row, contracts, payments);
}

export async function listSponsors(
  ws: SponsorWorkspace,
): Promise<{ items: SponsorListItem[]; summary: SponsorListSummary }> {
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<SponsorRow[]>(
    `SELECT * FROM org_sponsors WHERE workspace_kind = ? AND workspace_id = ? ORDER BY name ASC`,
    ws.kind,
    ws.id,
  );
  const { contracts, payments } = await loadChildren(rows.map((r) => r.id));
  const sponsors = rows.map((r) =>
    toSponsor(
      r,
      contracts.filter((c) => c.sponsor_id === r.id),
      payments.filter((p) => p.sponsor_id === r.id),
    ),
  );

  const items: SponsorListItem[] = sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    visible: s.visible,
    logoUrl: s.logoUrl,
    businessName: s.businessName,
    currentContract: s.currentContract,
    contractStatus: s.contractStatus,
    paymentsStatus: s.paymentsStatus,
    activeSections: Object.keys(s.placements) as SponsorSectionKey[],
    paidTotal: s.payments.filter((p) => p.paidAt).reduce((sum, p) => sum + p.amount, 0),
    dueTotal: s.payments.filter((p) => !p.paidAt).reduce((sum, p) => sum + p.amount, 0),
  }));

  const summary: SponsorListSummary = {
    contractsValue: sponsors.reduce(
      (sum, s) => sum + (s.contractStatus === 'active' || s.contractStatus === 'expiring' || s.contractStatus === 'future'
        ? s.currentContract?.value ?? 0
        : 0),
      0,
    ),
    collected: items.reduce((sum, i) => sum + i.paidTotal, 0),
    expiringSoon: sponsors.filter((s) => s.contractStatus === 'expiring').length,
  };
  return { items, summary };
}

function cleanProfile(input: Partial<SponsorProfile>): SponsorProfile {
  const name = str(input.name, 191);
  if (!name) throw new SponsorError('Enter the sponsor name', 400);
  const email = str(input.email, 191);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SponsorError('The email address is not valid', 400);
  }
  return {
    name,
    visible: input.visible !== false,
    landingUrl: safeUrl(input.landingUrl),
    businessName: str(input.businessName, 191),
    vatCode: str(input.vatCode, 64),
    contactName: str(input.contactName, 191),
    email,
    phone: str(input.phone, 64),
    address: str(input.address, 255),
  };
}

export async function createSponsor(ws: SponsorWorkspace, input: Partial<SponsorProfile>): Promise<Sponsor> {
  await ensureSponsorTables();
  const p = cleanProfile(input);
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_sponsors
       (id, workspace_kind, workspace_id, name, visible, landing_url, business_name, vat_code,
        contact_name, email, phone, address, placements_json, report_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
    id,
    ws.kind,
    ws.id,
    p.name,
    p.visible ? 1 : 0,
    p.landingUrl,
    p.businessName,
    p.vatCode,
    p.contactName,
    p.email,
    p.phone,
    p.address,
    randomBytes(24).toString('hex'),
  );
  return getSponsor(ws, id);
}

export async function updateSponsor(
  ws: SponsorWorkspace,
  id: string,
  input: { profile?: Partial<SponsorProfile>; placements?: Record<string, unknown> },
): Promise<Sponsor> {
  await getSponsorRow(ws, id);
  if (input.profile) {
    const p = cleanProfile(input.profile);
    await prisma.$executeRawUnsafe(
      `UPDATE org_sponsors SET name = ?, visible = ?, landing_url = ?, business_name = ?, vat_code = ?,
         contact_name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?`,
      p.name,
      p.visible ? 1 : 0,
      p.landingUrl,
      p.businessName,
      p.vatCode,
      p.contactName,
      p.email,
      p.phone,
      p.address,
      new Date(),
      id,
    );
  }
  if (input.placements) {
    const placements = parsePlacements(JSON.stringify(input.placements));
    await prisma.$executeRawUnsafe(
      `UPDATE org_sponsors SET placements_json = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(placements),
      new Date(),
      id,
    );
  }
  return getSponsor(ws, id);
}

export async function deleteSponsor(ws: SponsorWorkspace, id: string): Promise<void> {
  const row = await getSponsorRow(ws, id);
  const { contracts } = await loadChildren([id]);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsor_payments WHERE sponsor_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsor_contracts WHERE sponsor_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsor_events WHERE sponsor_id = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsors WHERE id = ?`, id);
  await Promise.all([
    removeStoredFile(row.banner_path),
    removeStoredFile(row.logo_path),
    ...contracts.map((c) => removeStoredFile(c.pdf_path)),
  ]);
}

export async function setSponsorImage(
  ws: SponsorWorkspace,
  id: string,
  kind: SponsorMediaKind,
  file: Blob | null,
  originalName = '',
): Promise<Sponsor> {
  const row = await getSponsorRow(ws, id);
  const column = kind === 'logo' ? 'logo_path' : 'banner_path';
  const previous = kind === 'logo' ? row.logo_path : row.banner_path;
  const path = file
    ? await storeFile(file, originalName, SPONSOR_IMAGE_EXTENSIONS, SPONSOR_MAX_IMAGE_BYTES)
    : null;
  await prisma.$executeRawUnsafe(
    `UPDATE org_sponsors SET ${column} = ?, updated_at = ? WHERE id = ?`,
    path,
    new Date(),
    id,
  );
  await removeStoredFile(previous);
  return getSponsor(ws, id);
}

// ---------- contracts ----------

function cleanContract(input: Record<string, unknown>) {
  const startDate = ymd(input.startDate);
  const endDate = ymd(input.endDate);
  if (!startDate || !endDate) throw new SponsorError('Enter the contract start and end dates', 400);
  if (startDate > endDate) throw new SponsorError('The contract must end after it starts', 400);
  return {
    startDate,
    endDate,
    value: money(input.value),
    reminderDays: intIn(input.reminderDays, 0, 365, 30),
    notes: str(input.notes, 2000),
  };
}

async function getContractRow(sponsorId: string, contractId: string): Promise<ContractRow> {
  const rows = await prisma.$queryRawUnsafe<ContractRow[]>(
    `SELECT * FROM org_sponsor_contracts WHERE id = ? AND sponsor_id = ? LIMIT 1`,
    contractId,
    sponsorId,
  );
  if (!rows[0]) throw new SponsorError('Contract not found', 404);
  return rows[0];
}

export async function saveContract(
  ws: SponsorWorkspace,
  sponsorId: string,
  input: Record<string, unknown>,
  contractId?: string,
): Promise<Sponsor> {
  await getSponsorRow(ws, sponsorId);
  const c = cleanContract(input);
  if (contractId) {
    await getContractRow(sponsorId, contractId);
    await prisma.$executeRawUnsafe(
      `UPDATE org_sponsor_contracts SET start_date = ?, end_date = ?, value = ?, reminder_days = ?, notes = ?,
         reminder_sent_at = NULL WHERE id = ?`,
      c.startDate,
      c.endDate,
      c.value,
      c.reminderDays,
      c.notes,
      contractId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO org_sponsor_contracts (id, sponsor_id, start_date, end_date, value, reminder_days, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      sponsorId,
      c.startDate,
      c.endDate,
      c.value,
      c.reminderDays,
      c.notes,
    );
  }
  return getSponsor(ws, sponsorId);
}

export async function deleteContract(ws: SponsorWorkspace, sponsorId: string, contractId: string) {
  await getSponsorRow(ws, sponsorId);
  const row = await getContractRow(sponsorId, contractId);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsor_contracts WHERE id = ?`, contractId);
  await removeStoredFile(row.pdf_path);
  return getSponsor(ws, sponsorId);
}

export async function setContractPdf(
  ws: SponsorWorkspace,
  sponsorId: string,
  contractId: string,
  file: Blob | null,
  originalName = '',
): Promise<Sponsor> {
  await getSponsorRow(ws, sponsorId);
  const row = await getContractRow(sponsorId, contractId);
  const path = file ? await storeFile(file, originalName, ['pdf'], SPONSOR_MAX_PDF_BYTES) : null;
  await prisma.$executeRawUnsafe(
    `UPDATE org_sponsor_contracts SET pdf_name = ?, pdf_path = ? WHERE id = ?`,
    file ? str(originalName, 191) || 'contract.pdf' : null,
    path,
    contractId,
  );
  await removeStoredFile(row.pdf_path);
  return getSponsor(ws, sponsorId);
}

// ---------- payments ----------

async function getPaymentRow(sponsorId: string, paymentId: string): Promise<PaymentRow> {
  const rows = await prisma.$queryRawUnsafe<PaymentRow[]>(
    `SELECT * FROM org_sponsor_payments WHERE id = ? AND sponsor_id = ? LIMIT 1`,
    paymentId,
    sponsorId,
  );
  if (!rows[0]) throw new SponsorError('Payment not found', 404);
  return rows[0];
}

export async function savePayment(
  ws: SponsorWorkspace,
  sponsorId: string,
  input: Record<string, unknown>,
  paymentId?: string,
): Promise<Sponsor> {
  await getSponsorRow(ws, sponsorId);
  const dueDate = ymd(input.dueDate);
  if (!dueDate) throw new SponsorError('Enter the due date of the payment', 400);
  const amount = money(input.amount);
  if (amount <= 0) throw new SponsorError('Enter the amount of the payment', 400);
  const reminderDays = intIn(input.reminderDays, 0, 365, 7);
  const note = str(input.note, 255);
  if (paymentId) {
    await getPaymentRow(sponsorId, paymentId);
    await prisma.$executeRawUnsafe(
      `UPDATE org_sponsor_payments SET amount = ?, due_date = ?, reminder_days = ?, note = ?, reminder_sent_at = NULL
       WHERE id = ?`,
      amount,
      dueDate,
      reminderDays,
      note,
      paymentId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO org_sponsor_payments (id, sponsor_id, amount, due_date, reminder_days, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      sponsorId,
      amount,
      dueDate,
      reminderDays,
      note,
    );
  }
  return getSponsor(ws, sponsorId);
}

export async function setPaymentPaid(
  ws: SponsorWorkspace,
  sponsorId: string,
  paymentId: string,
  paid: boolean,
): Promise<Sponsor> {
  await getSponsorRow(ws, sponsorId);
  await getPaymentRow(sponsorId, paymentId);
  await prisma.$executeRawUnsafe(
    `UPDATE org_sponsor_payments SET paid_at = ? WHERE id = ?`,
    paid ? todayYmd() : null,
    paymentId,
  );
  return getSponsor(ws, sponsorId);
}

export async function deletePayment(ws: SponsorWorkspace, sponsorId: string, paymentId: string) {
  await getSponsorRow(ws, sponsorId);
  await getPaymentRow(sponsorId, paymentId);
  await prisma.$executeRawUnsafe(`DELETE FROM org_sponsor_payments WHERE id = ?`, paymentId);
  return getSponsor(ws, sponsorId);
}

// ---------- statistics ----------

export async function recordSponsorEvent(
  sponsorId: string,
  event: 'view' | 'click',
  section: string,
): Promise<void> {
  await ensureSponsorTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_sponsor_events (sponsor_id, event, section) VALUES (?, ?, ?)`,
    sponsorId,
    event,
    str(section, 40),
  );
}

export async function getSponsorStatsById(sponsorId: string, from: string, to: string): Promise<SponsorStats> {
  await ensureSponsorTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ section: string; event: string; total: bigint | number }>>(
    `SELECT section, event, COUNT(*) AS total FROM org_sponsor_events
     WHERE sponsor_id = ? AND created_at >= ? AND created_at < ?
     GROUP BY section, event`,
    sponsorId,
    `${from} 00:00:00`,
    `${addDaysYmd(to, 1)} 00:00:00`,
  );
  const bySectionMap = new Map<string, { views: number; clicks: number }>();
  for (const r of rows) {
    const entry = bySectionMap.get(r.section) ?? { views: 0, clicks: 0 };
    if (r.event === 'view') entry.views += Number(r.total);
    else entry.clicks += Number(r.total);
    bySectionMap.set(r.section, entry);
  }
  const bySection = Array.from(bySectionMap.entries()).map(([section, v]) => ({ section, ...v }));
  const views = bySection.reduce((s, r) => s + r.views, 0);
  const clicks = bySection.reduce((s, r) => s + r.clicks, 0);
  return {
    from,
    to,
    views,
    clicks,
    ctr: views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0,
    activeSources: bySection.filter((r) => r.views > 0 || r.clicks > 0).length,
    bySection,
  };
}

export async function getSponsorStats(ws: SponsorWorkspace, id: string, from: string, to: string) {
  await getSponsorRow(ws, id);
  return getSponsorStatsById(id, from, to);
}

export async function getSponsorReportToken(ws: SponsorWorkspace, id: string): Promise<string> {
  return (await getSponsorRow(ws, id)).report_token;
}

// ---------- reminders ----------

async function workspaceOwnerEmail(ws: SponsorWorkspace): Promise<{ email: string; name: string } | null> {
  const owner =
    ws.kind === 'club'
      ? await prisma.club.findUnique({
          where: { id: ws.id },
          select: { name: true, admin: { select: { email: true } } },
        })
      : await prisma.team.findUnique({
          where: { id: ws.id },
          select: { name: true, admin: { select: { email: true } } },
        });
  return owner?.admin?.email ? { email: owner.admin.email, name: owner.name } : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Sends the due contract-expiry and payment reminders (once each) to the club/team owner.
 * Runs when the sponsor list opens and from the cron endpoint.
 */
export async function processSponsorReminders(ws?: SponsorWorkspace): Promise<number> {
  await ensureSponsorTables();
  const today = todayYmd();
  const wsFilter = ws ? `AND s.workspace_kind = ? AND s.workspace_id = ?` : '';
  const wsArgs = ws ? [ws.kind, ws.id] : [];

  const contracts = await prisma.$queryRawUnsafe<
    Array<{ id: string; end_date: Date; value: unknown; name: string; workspace_kind: string; workspace_id: string }>
  >(
    `SELECT c.id, c.end_date, c.value, s.name, s.workspace_kind, s.workspace_id
     FROM org_sponsor_contracts c JOIN org_sponsors s ON s.id = c.sponsor_id
     WHERE c.reminder_sent_at IS NULL AND c.reminder_days > 0 AND c.end_date >= ?
       AND DATE_SUB(c.end_date, INTERVAL c.reminder_days DAY) <= ? ${wsFilter}`,
    today,
    today,
    ...wsArgs,
  );
  const payments = await prisma.$queryRawUnsafe<
    Array<{ id: string; due_date: Date; amount: unknown; note: string; name: string; workspace_kind: string; workspace_id: string }>
  >(
    `SELECT p.id, p.due_date, p.amount, p.note, s.name, s.workspace_kind, s.workspace_id
     FROM org_sponsor_payments p JOIN org_sponsors s ON s.id = p.sponsor_id
     WHERE p.reminder_sent_at IS NULL AND p.paid_at IS NULL
       AND DATE_SUB(p.due_date, INTERVAL p.reminder_days DAY) <= ? ${wsFilter}`,
    today,
    ...wsArgs,
  );

  let sent = 0;
  const ownerCache = new Map<string, { email: string; name: string } | null>();
  const ownerOf = async (kind: string, id: string) => {
    const key = `${kind}:${id}`;
    if (!ownerCache.has(key)) {
      ownerCache.set(key, await workspaceOwnerEmail({ kind: kind === 'team' ? 'team' : 'club', id }));
    }
    return ownerCache.get(key) ?? null;
  };

  for (const c of contracts) {
    const owner = await ownerOf(c.workspace_kind, c.workspace_id);
    if (!owner) continue;
    try {
      await sendIonosEmail({
        to: owner.email,
        subject: `Sponsor contract expiring: ${c.name}`,
        html: `<p>The sponsorship contract of <strong>${escapeHtml(c.name)}</strong> (${escapeHtml(owner.name)}) expires on <strong>${dbYmd(c.end_date)}</strong>.</p><p>Contract value: € ${(Number(c.value) || 0).toFixed(2)}</p><p>Open Marketing → Sponsor in Movesbook to renew it.</p>`,
      });
      await prisma.$executeRawUnsafe(`UPDATE org_sponsor_contracts SET reminder_sent_at = NOW() WHERE id = ?`, c.id);
      sent += 1;
    } catch (e) {
      console.error('sponsor contract reminder', e);
    }
  }
  for (const p of payments) {
    const owner = await ownerOf(p.workspace_kind, p.workspace_id);
    if (!owner) continue;
    try {
      await sendIonosEmail({
        to: owner.email,
        subject: `Sponsor payment due: ${p.name}`,
        html: `<p>The payment of <strong>€ ${(Number(p.amount) || 0).toFixed(2)}</strong> from sponsor <strong>${escapeHtml(p.name)}</strong> (${escapeHtml(owner.name)}) is due on <strong>${dbYmd(p.due_date)}</strong>.</p>${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}<p>Mark it as paid in Marketing → Sponsor when you receive it.</p>`,
      });
      await prisma.$executeRawUnsafe(`UPDATE org_sponsor_payments SET reminder_sent_at = NOW() WHERE id = ?`, p.id);
      sent += 1;
    } catch (e) {
      console.error('sponsor payment reminder', e);
    }
  }
  return sent;
}

export { SPONSOR_SECTIONS };
