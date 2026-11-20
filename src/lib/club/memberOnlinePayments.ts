import { prisma } from '@/lib/prisma';
import { findPublicOrg, publicOrgCard } from '@/lib/club/publicOrg';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import type { ActivePaypalCredentials, ActiveStripeCredentials } from '@/lib/payments/paymentSettings';
import { loadStoredMemberPaymentMethods } from '@/lib/club/memberPaymentMethodsStore';
import {
  memberGatewayReady,
  paypalKeysForMode,
  stripeKeysForMode,
} from '@/lib/club/memberPaymentMethods';
import { getMemberPaymentMode } from '@/lib/payments/paymentSettings';
import { procedureService } from '@/lib/procedures';
import { payLinkProviderForMethod, payModeLabel } from '@/lib/procedures/payModes';
import { formatClubMoney } from '@/lib/club/clubCurrency';

export type MemberOnlineProvider = 'stripe' | 'paypal';

export type MemberOnlinePayment = {
  id: string;
  entityId: string;
  entityName: string;
  memberUserId: string;
  memberName: string;
  createdByUserId: string;
  provider: MemberOnlineProvider;
  amountEur: number;
  /** ISO currency of amountEur (EUR unless the club uses another currency). */
  currency: string;
  description: string;
  /** `cancelled` links were replaced by a newer link for the same deadlines. */
  status: 'pending' | 'paid' | 'cancelled';
  providerMode: string | null;
  providerRef: string | null;
};

type Row = {
  id: string;
  entity_id: string;
  entity_name: string;
  member_user_id: string;
  member_name: string;
  created_by_user_id: string;
  provider: string;
  amount_eur: number | string;
  currency?: string | null;
  description: string;
  status: string;
  provider_mode: string | null;
  provider_ref: string | null;
};

const TABLE = 'club_member_online_payments';
let settlementReady = false;

export function parseMemberEuroAmount(raw: string): number {
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    s = parts.length === 2 && parts[1]!.length !== 3 ? parts.join('.') : parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** One deadline this online payment should settle once the member pays. */
export type OnlineSettlementLine = {
  procedureType: string;
  recordId: string;
  amount: number;
  payMode: string;
  operatorId: string;
  paymentDate: string;
  description: string;
};

/** Tax document chosen at Confirm; the receipt is written when the member pays. */
export type OnlineReceiptIntent = {
  documentType?: string;
  documentNumber?: string;
  annotations?: string;
  serviceName?: string;
};

type StoredSettlement = { lines?: OnlineSettlementLine[]; receipt?: OnlineReceiptIntent | null };

/** Card methods and wallets are collected on the club's Stripe account. PayPal uses the club's PayPal account. */
export function onlineProviderForMethod(method: string): MemberOnlineProvider | null {
  return payLinkProviderForMethod(method);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      entity_id VARCHAR(191) NOT NULL,
      entity_name VARCHAR(255) NOT NULL,
      member_user_id VARCHAR(191) NOT NULL,
      member_name VARCHAR(255) NOT NULL,
      created_by_user_id VARCHAR(191) NOT NULL,
      provider VARCHAR(16) NOT NULL,
      amount_eur DECIMAL(10,2) NOT NULL,
      description VARCHAR(255) NOT NULL,
      status VARCHAR(16) NOT NULL,
      provider_mode VARCHAR(16) NULL,
      provider_ref VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME NULL,
      INDEX idx_club_member_online_entity (entity_id),
      INDEX idx_club_member_online_member (member_user_id)
    )
  `);
  if (settlementReady) return;
  for (const [column, ddl] of [
    ['settlement_json', 'settlement_json LONGTEXT NULL'],
    ['currency', "currency VARCHAR(10) NOT NULL DEFAULT 'EUR'"],
  ] as const) {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      TABLE,
      column,
    );
    if (Number(rows[0]?.c ?? 0) > 0) continue;
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${TABLE}\` ADD COLUMN ${ddl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!/duplicate|exists/i.test(message)) throw error;
    }
  }
  settlementReady = true;
}

function mapRow(row: Row): MemberOnlinePayment {
  const provider: MemberOnlineProvider = row.provider === 'paypal' ? 'paypal' : 'stripe';
  return {
    id: row.id,
    entityId: row.entity_id,
    entityName: row.entity_name,
    memberUserId: row.member_user_id,
    memberName: row.member_name,
    createdByUserId: row.created_by_user_id,
    provider,
    amountEur: Number(row.amount_eur) || 0,
    currency: (row.currency || 'EUR').toUpperCase(),
    description: row.description,
    status: row.status === 'paid' ? 'paid' : row.status === 'cancelled' ? 'cancelled' : 'pending',
    providerMode: row.provider_mode,
    providerRef: row.provider_ref,
  };
}

export async function getMemberOnlinePayment(id: string): Promise<MemberOnlinePayment | null> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, entity_id, entity_name, member_user_id, member_name, created_by_user_id,
           provider, amount_eur, currency, description, status, provider_mode, provider_ref
    FROM club_member_online_payments
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createMemberOnlinePayment(input: {
  entityId: string;
  entityName: string;
  memberUserId: string;
  memberName: string;
  createdByUserId: string;
  provider: MemberOnlineProvider;
  amountEur: number;
  description: string;
  settlement?: OnlineSettlementLine[];
  receipt?: OnlineReceiptIntent | null;
  currency?: string;
}): Promise<MemberOnlinePayment> {
  await ensureTable();
  const id = crypto.randomUUID();
  const currency = (input.currency || 'EUR').toUpperCase().slice(0, 10);
  const description = input.description.slice(0, 255);
  const settlement =
    input.settlement && input.settlement.length > 0
      ? JSON.stringify({ lines: input.settlement, receipt: input.receipt ?? null } satisfies StoredSettlement)
      : null;
  await prisma.$executeRaw`
    INSERT INTO club_member_online_payments (
      id, entity_id, entity_name, member_user_id, member_name, created_by_user_id,
      provider, amount_eur, description, status, settlement_json, currency
    ) VALUES (
      ${id}, ${input.entityId}, ${input.entityName.slice(0, 255)}, ${input.memberUserId},
      ${input.memberName.slice(0, 255)}, ${input.createdByUserId}, ${input.provider},
      ${input.amountEur}, ${description}, 'pending', ${settlement}, ${currency}
    )
  `;
  const created = await getMemberOnlinePayment(id);
  if (!created) throw new Error('Could not create the payment');
  return created;
}

export async function setMemberOnlineCheckout(
  id: string,
  checkout: { mode: string; ref: string },
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE club_member_online_payments
    SET provider_mode = ${checkout.mode.slice(0, 16)}, provider_ref = ${checkout.ref.slice(0, 255)}
    WHERE id = ${id} AND status = 'pending'
  `;
}

/**
 * Claims the payment as paid. Returns false when another request already did it, so the
 * deadlines are settled only once. A replaced (cancelled) link that was still paid counts too.
 */
export async function markMemberOnlinePaymentPaid(id: string, ref: string): Promise<boolean> {
  const changed = await prisma.$executeRaw`
    UPDATE club_member_online_payments
    SET status = 'paid', paid_at = NOW(), provider_ref = ${ref.slice(0, 255)}
    WHERE id = ${id} AND status IN ('pending', 'cancelled')
  `;
  return Number(changed) > 0;
}

function parseSettlement(raw: string | null | undefined): StoredSettlement | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSettlement;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Older unpaid links for the same deadlines stop working, so only the latest amount can be paid. */
export async function cancelPendingLinksForRecords(entityId: string, recordIds: string[]): Promise<number> {
  await ensureTable();
  const wanted = new Set(recordIds.filter(Boolean));
  if (wanted.size === 0) return 0;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; settlement_json: string | null }>>(
    `SELECT id, settlement_json FROM \`${TABLE}\` WHERE entity_id = ? AND status = 'pending' AND settlement_json IS NOT NULL`,
    entityId,
  );
  let cancelled = 0;
  for (const row of rows) {
    const lines = parseSettlement(row.settlement_json)?.lines ?? [];
    if (!lines.some((line) => wanted.has(line.recordId))) continue;
    await prisma.$executeRaw`
      UPDATE club_member_online_payments SET status = 'cancelled'
      WHERE id = ${row.id} AND status = 'pending'
    `;
    cancelled += 1;
  }
  return cancelled;
}

/** Member email (account) and phone (profile Address: mobile 1, else phone). */
export async function memberPayLinkContact(memberUserId: string): Promise<{ email: string; phone: string }> {
  const user = await prisma.user.findUnique({ where: { id: memberUserId }, select: { email: true } });
  let phone = '';
  try {
    const extras = await prisma.userProfileExtras.findUnique({
      where: { userId: memberUserId },
      select: { ownerJson: true },
    });
    const owner = extras?.ownerJson ? (JSON.parse(String(extras.ownerJson)) as Record<string, unknown>) : {};
    const address = (owner.address ?? {}) as Record<string, unknown>;
    phone = String(address.mobile1 || address.phone || '').trim();
  } catch {
    /* No profile extras yet. */
  }
  return { email: user?.email?.trim() ?? '', phone };
}

/** The club or team account that should receive this payment, or null when it is not connected. */
export async function credentialsForMemberPayment(
  payment: MemberOnlinePayment,
): Promise<ActiveStripeCredentials | ActivePaypalCredentials | null> {
  const stored = await loadStoredMemberPaymentMethods(payment.entityId);
  const siteMode = await getMemberPaymentMode();
  if (payment.provider === 'stripe') {
    const keys = stripeKeysForMode(stored, siteMode);
    if (!stored.stripeEnabled || !keys) return null;
    return {
      mode: siteMode,
      publishableKey: keys.publishableKey,
      secretKey: keys.secret,
    };
  }
  const keys = paypalKeysForMode(stored, siteMode);
  if (!memberGatewayReady(stored, 'paypal', siteMode) || !keys) return null;
  return {
    mode: siteMode === 'live' ? 'live' : 'sandbox',
    clientId: keys.clientId,
    secret: keys.secret,
  };
}

/** Online providers the club / team can collect with right now (keys saved for the site mode). */
export async function readyMemberProviders(entityId: string): Promise<MemberOnlineProvider[]> {
  const stored = await loadStoredMemberPaymentMethods(entityId);
  const siteMode = await getMemberPaymentMode();
  return (['stripe', 'paypal'] as const).filter((p) => memberGatewayReady(stored, p, siteMode));
}

function cashPayModeLabel(payMode: string, provider: MemberOnlineProvider): string {
  if (payMode) return payModeLabel(payMode);
  return provider === 'paypal' ? 'PayPal' : 'Credit card';
}

/**
 * Writes the deadline payment after the member pays a link, plus the receipt when Tax doc was
 * ticked at Confirm (the receipt PDF is then mailed to the member by the procedure service).
 */
export async function settleMemberOnlinePayment(payment: MemberOnlinePayment): Promise<void> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ settlement_json: string | null }>>(
    `SELECT settlement_json FROM \`${TABLE}\` WHERE id = ? LIMIT 1`,
    payment.id,
  );
  const settlement = parseSettlement(rows[0]?.settlement_json);
  if (!settlement) return;
  const lines = Array.isArray(settlement.lines) ? settlement.lines : [];
  const receipt = settlement.receipt ?? null;
  const ctx = {
    userId: payment.createdByUserId,
    club: { id: payment.entityId, name: payment.entityName },
  };
  let receiptNumberUsed = false;
  for (const line of lines) {
    if (!line.recordId || !(Number(line.amount) > 0) || !line.procedureType) continue;
    if (line.procedureType === 'expense') continue;
    try {
      await procedureService.addPayment(ctx, line.procedureType, line.recordId, {
        amount: Number(line.amount),
        paymentDate: line.paymentDate || new Date().toISOString().slice(0, 10),
        notes: line.description || payment.description,
        operatorId: line.operatorId || payment.createdByUserId,
        payMode: cashPayModeLabel(line.payMode, payment.provider),
        skipOperatorPassword: true,
        ...(receipt
          ? {
              createReceipt: true,
              taxDoc: true,
              receiptDocumentType: receipt.documentType || undefined,
              receiptNumber: receiptNumberUsed ? undefined : receipt.documentNumber || undefined,
              receiptAnnotations: receipt.annotations || undefined,
              serviceName: receipt.serviceName || undefined,
            }
          : {}),
      });
      if (receipt?.documentNumber) receiptNumberUsed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('exceeds remaining balance') || message.includes('Record not found')) continue;
      throw error;
    }
  }
}

/** False once a linked deadline was paid another way or deleted: collecting the link would overcharge. */
export async function memberOnlinePaymentStillDue(paymentId: string): Promise<boolean> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ settlement_json: string | null }>>(
    `SELECT settlement_json FROM \`${TABLE}\` WHERE id = ? LIMIT 1`,
    paymentId,
  );
  const lines = parseSettlement(rows[0]?.settlement_json)?.lines ?? [];
  const owed = new Map<string, number>();
  for (const line of lines) {
    if (!line.recordId || !(Number(line.amount) > 0) || line.procedureType === 'expense') continue;
    owed.set(line.recordId, (owed.get(line.recordId) ?? 0) + Number(line.amount));
  }
  if (owed.size === 0) return true;
  const records = await prisma.procedureRecord.findMany({
    where: { id: { in: [...owed.keys()] }, status: 'ACTIVE' },
    select: { id: true, balanceAmount: true },
  });
  const balanceById = new Map(records.map((row) => [row.id, Number(row.balanceAmount)]));
  return [...owed.entries()].every(([id, amount]) => (balanceById.get(id) ?? 0) + 0.001 >= amount);
}

/** Emails the pay link to the member's account address. Returns false when there is no email. */
export async function emailMemberPayLink(input: {
  memberUserId: string;
  entityName: string;
  amountEur: number;
  payUrl: string;
  description: string;
  /** Address typed by the operator; defaults to the member account email. */
  to?: string;
  currency?: string;
}): Promise<boolean> {
  let to = input.to?.trim() ?? '';
  if (!to) {
    const user = await prisma.user.findUnique({
      where: { id: input.memberUserId },
      select: { email: true },
    });
    to = user?.email?.trim() ?? '';
  }
  if (!to) return false;
  const amount = formatClubMoney(input.amountEur, input.currency);
  const entity = input.entityName.trim() || 'the club';
  const description = input.description.trim();
  await sendIonosEmail({
    to,
    subject: `Payment of ${amount} to ${entity}`,
    text: `${entity} asks you to pay ${amount}.\n${description}\n\nPay here: ${input.payUrl}`,
    html: `<p>${escapeHtml(entity)} asks you to pay <strong>${escapeHtml(amount)}</strong>.</p>${
      description ? `<p>${escapeHtml(description)}</p>` : ''
    }<p><a href="${escapeHtml(input.payUrl)}">Pay now</a></p><p>${escapeHtml(input.payUrl)}</p>`,
  });
  return true;
}

/** Banner and logo used on the public club site, for the pay page. */
export async function memberPaymentBranding(entityId: string): Promise<{
  logoUrl: string | null;
  bannerUrl: string | null;
}> {
  const org = await findPublicOrg(entityId);
  if (!org) return { logoUrl: null, bannerUrl: null };
  const card = publicOrgCard(org);
  let bannerUrl = card.bannerUrl;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ cover_path: string | null }>>(
      `SELECT cover_path FROM org_websites WHERE workspace_id = ? LIMIT 1`,
      entityId,
    );
    const cover = rows[0]?.cover_path?.trim();
    if (cover) bannerUrl = toMediaApiPath(cover);
  } catch {
    /* The website table is created when a club opens its site settings. */
  }
  return { logoUrl: card.logoUrl, bannerUrl };
}
