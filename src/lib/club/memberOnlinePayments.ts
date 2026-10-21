import { prisma } from '@/lib/prisma';
import type { ActivePaypalCredentials, ActiveStripeCredentials } from '@/lib/payments/paymentSettings';
import { loadStoredMemberPaymentMethods } from '@/lib/club/memberPaymentMethodsStore';
import {
  memberGatewayReady,
  paypalKeysForMode,
  stripeKeysForMode,
} from '@/lib/club/memberPaymentMethods';
import { getMemberPaymentMode } from '@/lib/payments/paymentSettings';

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
  description: string;
  status: 'pending' | 'paid';
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
  description: string;
  status: string;
  provider_mode: string | null;
  provider_ref: string | null;
};

const TABLE = 'club_member_online_payments';

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

/** Card methods are collected on the club's Stripe account. PayPal uses the club's PayPal account. */
export function onlineProviderForMethod(method: string): MemberOnlineProvider | null {
  if (method === 'paypal') return 'paypal';
  if (method === 'credit_card' || method === 'debit_card') return 'stripe';
  return null;
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
    description: row.description,
    status: row.status === 'paid' ? 'paid' : 'pending',
    providerMode: row.provider_mode,
    providerRef: row.provider_ref,
  };
}

export async function getMemberOnlinePayment(id: string): Promise<MemberOnlinePayment | null> {
  await ensureTable();
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, entity_id, entity_name, member_user_id, member_name, created_by_user_id,
           provider, amount_eur, description, status, provider_mode, provider_ref
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
}): Promise<MemberOnlinePayment> {
  await ensureTable();
  const id = crypto.randomUUID();
  const description = input.description.slice(0, 255);
  await prisma.$executeRaw`
    INSERT INTO club_member_online_payments (
      id, entity_id, entity_name, member_user_id, member_name, created_by_user_id,
      provider, amount_eur, description, status
    ) VALUES (
      ${id}, ${input.entityId}, ${input.entityName.slice(0, 255)}, ${input.memberUserId},
      ${input.memberName.slice(0, 255)}, ${input.createdByUserId}, ${input.provider},
      ${input.amountEur}, ${description}, 'pending'
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

export async function markMemberOnlinePaymentPaid(id: string, ref: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE club_member_online_payments
    SET status = 'paid', paid_at = NOW(), provider_ref = ${ref.slice(0, 255)}
    WHERE id = ${id} AND status = 'pending'
  `;
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
