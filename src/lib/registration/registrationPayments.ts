import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export type RegistrationPaymentStatus = 'pending' | 'paid' | 'test' | 'free';
export type RegistrationPaymentProvider = 'stripe' | 'paypal';
export type AccountActivationStatus = 'pending_payment' | 'pending_activation' | 'active';

export type RegistrationPayment = {
  id: string;
  userId: string;
  status: RegistrationPaymentStatus;
  provider: RegistrationPaymentProvider | null;
  providerMode: string | null;
  providerRef: string | null;
  providerTxn: string | null;
  versionId: number | null;
  versionName: string;
  specialOffer: boolean;
  basePriceEur: number;
  amountEur: number;
  country: string;
  currencyCode: string;
  eurToLocal: number | null;
  amountLocal: number | null;
  language: string;
  periodId: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

export type NewRegistrationPayment = Omit<
  RegistrationPayment,
  'id' | 'provider' | 'providerMode' | 'providerRef' | 'providerTxn' | 'createdAt' | 'paidAt'
>;

let tablesEnsured = false;

/** DDL commits implicitly in MySQL: call before opening a transaction. */
export async function ensureRegistrationPaymentTables(): Promise<void> {
  if (tablesEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS registration_payments (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      status VARCHAR(16) NOT NULL,
      provider VARCHAR(16) NULL,
      provider_mode VARCHAR(16) NULL,
      provider_ref VARCHAR(255) NULL,
      provider_txn VARCHAR(255) NULL,
      version_id INT NULL,
      version_name VARCHAR(255) NOT NULL DEFAULT '',
      special_offer TINYINT(1) NOT NULL DEFAULT 0,
      base_price_eur DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount_eur DECIMAL(10,2) NOT NULL DEFAULT 0,
      country VARCHAR(100) NOT NULL DEFAULT '',
      currency_code VARCHAR(10) NOT NULL DEFAULT 'EUR',
      eur_to_local DECIMAL(18,6) NULL,
      amount_local DECIMAL(18,2) NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      period_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME NULL,
      KEY idx_rp_user (user_id)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_account_activations (
      user_id VARCHAR(191) NOT NULL PRIMARY KEY,
      status VARCHAR(24) NOT NULL,
      token_hash VARCHAR(64) NULL,
      token_expires DATETIME NULL,
      email_sent_at DATETIME NULL,
      activated_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_uaa_token (token_hash)
    )
  `);
  tablesEnsured = true;
}

type PaymentRow = {
  id: string;
  user_id: string;
  status: string;
  provider: string | null;
  provider_mode: string | null;
  provider_ref: string | null;
  provider_txn: string | null;
  version_id: number | null;
  version_name: string;
  special_offer: number | boolean;
  base_price_eur: Prisma.Decimal | number | string;
  amount_eur: Prisma.Decimal | number | string;
  country: string;
  currency_code: string;
  eur_to_local: Prisma.Decimal | number | string | null;
  amount_local: Prisma.Decimal | number | string | null;
  language: string;
  period_id: string | null;
  created_at: Date;
  paid_at: Date | null;
};

function num(value: Prisma.Decimal | number | string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: PaymentRow): RegistrationPayment {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as RegistrationPaymentStatus,
    provider: (row.provider as RegistrationPaymentProvider | null) ?? null,
    providerMode: row.provider_mode,
    providerRef: row.provider_ref,
    providerTxn: row.provider_txn,
    versionId: row.version_id,
    versionName: row.version_name,
    specialOffer: Boolean(Number(row.special_offer)),
    basePriceEur: num(row.base_price_eur) ?? 0,
    amountEur: num(row.amount_eur) ?? 0,
    country: row.country,
    currencyCode: row.currency_code,
    eurToLocal: num(row.eur_to_local),
    amountLocal: num(row.amount_local),
    language: row.language,
    periodId: row.period_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export async function createRegistrationPayment(
  db: Db,
  data: NewRegistrationPayment,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO registration_payments
       (id, user_id, status, version_id, version_name, special_offer, base_price_eur, amount_eur,
        country, currency_code, eur_to_local, amount_local, language, period_id, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.userId,
    data.status,
    data.versionId,
    data.versionName.slice(0, 255),
    data.specialOffer ? 1 : 0,
    data.basePriceEur,
    data.amountEur,
    data.country.slice(0, 100),
    data.currencyCode.slice(0, 10),
    data.eurToLocal,
    data.amountLocal,
    data.language.slice(0, 10),
    data.periodId,
    data.status === 'pending' ? null : new Date(),
  );
  return id;
}

export async function getRegistrationPayment(id: string): Promise<RegistrationPayment | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await ensureRegistrationPaymentTables();
  const rows = await prisma.$queryRawUnsafe<PaymentRow[]>(
    `SELECT * FROM registration_payments WHERE id = ? LIMIT 1`,
    id,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findPendingRegistrationPayment(
  userId: string,
): Promise<RegistrationPayment | null> {
  await ensureRegistrationPaymentTables();
  const rows = await prisma.$queryRawUnsafe<PaymentRow[]>(
    `SELECT * FROM registration_payments WHERE user_id = ? AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    userId,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function setRegistrationPaymentCheckout(
  id: string,
  checkout: { provider: RegistrationPaymentProvider; mode: string; ref: string },
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE registration_payments SET provider = ?, provider_mode = ?, provider_ref = ?
     WHERE id = ? AND status = 'pending'`,
    checkout.provider,
    checkout.mode,
    checkout.ref.slice(0, 255),
    id,
  );
}

/** Moves a pending payment to paid exactly once; false when another request already did it. */
export async function markRegistrationPaymentPaid(id: string, txn: string): Promise<boolean> {
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE registration_payments SET status = 'paid', provider_txn = ?, paid_at = NOW()
     WHERE id = ? AND status = 'pending'`,
    txn.slice(0, 255),
    id,
  );
  return Number(affected) > 0;
}

// ---------------------------------------------------------------------------
// Account activation
// ---------------------------------------------------------------------------

const ACTIVATION_TOKEN_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function setAccountActivationStatus(
  db: Db,
  userId: string,
  status: AccountActivationStatus,
): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO user_account_activations (user_id, status) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    userId,
    status,
  );
}

/** Null for accounts created before activation existed (they are always allowed in). */
export async function getAccountActivationStatus(
  userId: string,
): Promise<{ status: AccountActivationStatus; emailSentAt: Date | null } | null> {
  await ensureRegistrationPaymentTables();
  const rows = await prisma.$queryRawUnsafe<{ status: string; email_sent_at: Date | null }[]>(
    `SELECT status, email_sent_at FROM user_account_activations WHERE user_id = ? LIMIT 1`,
    userId,
  );
  const row = rows[0];
  return row
    ? { status: row.status as AccountActivationStatus, emailSentAt: row.email_sent_at }
    : null;
}

/** New single-use token; the previous one stops working. */
export async function issueActivationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + ACTIVATION_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$executeRawUnsafe(
    `UPDATE user_account_activations SET token_hash = ?, token_expires = ?, email_sent_at = NOW()
     WHERE user_id = ?`,
    hashToken(token),
    expires,
    userId,
  );
  return token;
}

export type ActivationResult =
  | { ok: true; userId: string; alreadyActive: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'unpaid' };

export async function activateAccountByToken(token: string): Promise<ActivationResult> {
  if (!/^[0-9a-f]{64}$/i.test(token)) return { ok: false, reason: 'invalid' };
  await ensureRegistrationPaymentTables();
  const rows = await prisma.$queryRawUnsafe<
    { user_id: string; status: string; token_expires: Date | null }[]
  >(
    `SELECT user_id, status, token_expires FROM user_account_activations WHERE token_hash = ? LIMIT 1`,
    hashToken(token),
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.status === 'active') return { ok: true, userId: row.user_id, alreadyActive: true };
  if (row.status !== 'pending_activation') return { ok: false, reason: 'unpaid' };
  if (row.token_expires && new Date(row.token_expires).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  await prisma.$executeRawUnsafe(
    `UPDATE user_account_activations SET status = 'active', activated_at = NOW() WHERE user_id = ?`,
    row.user_id,
  );
  return { ok: true, userId: row.user_id, alreadyActive: false };
}
