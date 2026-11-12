import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  mergeNetworkSubscriptionHistory,
  readNetworkSubscriptionHistory,
} from '@/lib/admin/networkSubscriptionHistory';
import { addDaysYmd } from '@/lib/subscriptions/specialOffers';
import { PAYMENT_MODES, isPaymentModeCode, roundEuro, splitIntoDeadlines } from '@/lib/subscriptions/paymentModalities';
import type { RegistrationPayment } from '@/lib/registration/registrationPayments';
import {
  MOVESBOOK_TYPOLOGIES,
  isMovesbookTypology,
  type MovesbookDeadlineRow,
  type MovesbookTypology,
} from '@/lib/movesbookDeadlines/movesbookDeadlines.shared';

export {
  DEADLINE_PAY_MODES,
  MOVESBOOK_TYPOLOGIES,
  isMovesbookTypology,
  type MovesbookDeadlineRow,
  type MovesbookTypology,
} from '@/lib/movesbookDeadlines/movesbookDeadlines.shared';

/**
 * Archive of Deadlines of the payments users owe to Movesbook (cloned from the club archive).
 * Every registration creates one or more deadlines; payments update them and the Archive of Payments.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const TABLE = 'movesbook_deadlines';

let ensured = false;

/** DDL commits implicitly in MySQL: call before opening a transaction. */
export async function ensureMovesbookDeadlinesTable(): Promise<void> {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      registration_payment_id VARCHAR(36) NULL,
      period_id VARCHAR(64) NULL,
      typology CHAR(1) NOT NULL DEFAULT 'A',
      detail VARCHAR(255) NOT NULL DEFAULT '',
      version_id INT NULL,
      version_name VARCHAR(255) NOT NULL DEFAULT '',
      payment_modality VARCHAR(2) NULL,
      deadline_no INT NOT NULL DEFAULT 1,
      deadlines_total INT NOT NULL DEFAULT 1,
      amount_eur DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_eur DECIMAL(10,2) NOT NULL DEFAULT 0,
      due_date DATE NOT NULL,
      paid_at DATETIME NULL,
      pay_mode VARCHAR(24) NULL,
      operator VARCHAR(191) NULL,
      notes VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_md_user (user_id),
      KEY idx_md_due (due_date),
      KEY idx_md_payment (registration_payment_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ensured = true;
}

/** Typology of a registration: Subscription Mobile when registered from a phone, otherwise Desk. */
export function registrationTypology(registrationMode: unknown): MovesbookTypology {
  return registrationMode === 'mobile' ? 'B' : 'A';
}

function deadlineDetail(versionName: string, modality: string | null, no: number, total: number): string {
  const mode = modality && isPaymentModeCode(modality) ? ` — ${modality}: ${PAYMENT_MODES[modality].label}` : '';
  const step = total > 1 ? ` (${no}/${total})` : '';
  return `${versionName}${mode}${step}`.slice(0, 255);
}

/**
 * Deadlines of a registration payment (idempotent: nothing happens when they already exist).
 * Modality payments get one deadline per step, `delayDays` apart from the start date;
 * classic payments get a single deadline. The first one is paid when the payment is not pending.
 */
export async function createDeadlinesForPayment(
  db: Db,
  payment: Pick<
    RegistrationPayment,
    | 'id'
    | 'userId'
    | 'status'
    | 'provider'
    | 'versionId'
    | 'versionName'
    | 'amountEur'
    | 'periodId'
    | 'paymentModality'
    | 'modalityTotalEur'
    | 'modalityDeadlines'
  >,
  opts: { dateStart: string; typology: MovesbookTypology },
): Promise<number> {
  if (!payment.userId || payment.userId.startsWith('quick:')) return 0;
  const existing = await db.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM ${TABLE} WHERE registration_payment_id = ?`,
    payment.id,
  );
  if (Number(existing[0]?.n ?? 0) > 0) return 0;

  const modality = payment.paymentModality && isPaymentModeCode(payment.paymentModality) ? payment.paymentModality : null;
  const count = modality ? Math.max(1, payment.modalityDeadlines ?? PAYMENT_MODES[modality].deadlines) : 1;
  const amounts =
    modality && payment.modalityTotalEur != null
      ? splitIntoDeadlines(payment.modalityTotalEur, count)
      : [roundEuro(payment.amountEur)];
  const delay = modality ? PAYMENT_MODES[modality].delayDays : 0;
  const firstPaid = payment.status !== 'pending';

  for (let i = 0; i < amounts.length; i += 1) {
    const paidNow = i === 0 && firstPaid;
    await db.$executeRawUnsafe(
      `INSERT INTO ${TABLE}
         (id, user_id, registration_payment_id, period_id, typology, detail, version_id, version_name,
          payment_modality, deadline_no, deadlines_total, amount_eur, paid_eur, due_date, paid_at, pay_mode, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      payment.userId,
      payment.id,
      payment.periodId,
      opts.typology,
      deadlineDetail(payment.versionName, modality, i + 1, amounts.length),
      payment.versionId,
      payment.versionName.slice(0, 255),
      modality,
      i + 1,
      amounts.length,
      amounts[i],
      paidNow ? amounts[i] : 0,
      addDaysYmd(opts.dateStart, i * delay),
      paidNow ? new Date() : null,
      paidNow ? (payment.status === 'paid' ? payment.provider ?? 'online' : payment.status) : null,
      paidNow ? 'Registration' : null,
    );
  }
  return amounts.length;
}

/** Online registration payment completed → its first deadline is paid. */
export async function markFirstDeadlinePaid(paymentId: string, provider: string | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE ${TABLE}
     SET paid_eur = amount_eur, paid_at = NOW(), pay_mode = ?, operator = 'Online'
     WHERE registration_payment_id = ? AND deadline_no = 1 AND paid_eur < amount_eur`,
    (provider ?? 'online').slice(0, 24),
    paymentId,
  );
}


type RawRow = {
  id: string;
  user_id: string;
  typology: string;
  detail: string;
  version_name: string;
  payment_modality: string | null;
  deadline_no: number;
  deadlines_total: number;
  amount_eur: unknown;
  paid_eur: unknown;
  due_date: Date | string;
  created_at: Date | string;
  paid_at: Date | string | null;
  pay_mode: string | null;
  operator: string | null;
  notes: string;
  first_name: string | null;
  surname: string | null;
  name: string | null;
  username: string | null;
  user_type: string | null;
};

function ymd(value: Date | string | null): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapRow(r: RawRow): MovesbookDeadlineRow {
  const amount = roundEuro(Number(r.amount_eur) || 0);
  const paid = roundEuro(Number(r.paid_eur) || 0);
  const rest = roundEuro(Math.max(0, amount - paid));
  const due = ymd(r.due_date);
  const typology = isMovesbookTypology(r.typology) ? r.typology : 'A';
  const fullName = [r.first_name, r.surname].filter(Boolean).join(' ').trim() || r.name || r.username || '—';
  return {
    id: r.id,
    userId: r.user_id,
    fullName,
    username: r.username ?? '',
    userType: r.user_type ?? '',
    typology,
    typologyLabel: `${typology} - ${MOVESBOOK_TYPOLOGIES[typology]}`,
    detail: r.detail,
    versionName: r.version_name,
    paymentModality: r.payment_modality,
    deadlineNo: Number(r.deadline_no),
    deadlinesTotal: Number(r.deadlines_total),
    amountEur: amount,
    paidEur: paid,
    restEur: rest,
    dueDate: due,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    paidAt: r.paid_at ? (r.paid_at instanceof Date ? r.paid_at.toISOString() : String(r.paid_at)) : null,
    payMode: r.pay_mode,
    operator: r.operator,
    notes: r.notes,
    overdue: rest > 0 && due < new Date().toISOString().slice(0, 10),
  };
}

const ORDER_SQL: Record<string, string> = {
  due_asc: 'd.due_date ASC, d.deadline_no ASC',
  due_desc: 'd.due_date DESC, d.deadline_no DESC',
  recent: 'd.created_at DESC, d.deadline_no ASC',
  name: 'u.surname ASC, u.firstName ASC, d.due_date ASC',
};

export type DeadlineListFilters = {
  search?: string;
  typology?: string;
  fromDate?: string;
  toDate?: string;
  includePaid?: boolean;
  userId?: string;
  order?: string;
  page?: number;
  pageSize?: number;
};

export async function listMovesbookDeadlines(filters: DeadlineListFilters) {
  await ensureMovesbookDeadlinesTable();
  const where: string[] = ['1 = 1'];
  const params: unknown[] = [];
  if (!filters.includePaid) where.push('d.paid_eur < d.amount_eur');
  if (filters.typology && isMovesbookTypology(filters.typology)) {
    where.push('d.typology = ?');
    params.push(filters.typology);
  }
  if (filters.userId) {
    where.push('d.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate)) {
    where.push('d.due_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.toDate)) {
    where.push('d.due_date <= ?');
    params.push(filters.toDate);
  }
  const search = (filters.search ?? '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push(
      `(u.firstName LIKE ? OR u.surname LIKE ? OR u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?
        OR d.detail LIKE ? OR d.notes LIKE ? OR d.version_name LIKE ?)`,
    );
    params.push(like, like, like, like, like, like, like, like);
  }
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const page = Math.max(1, filters.page ?? 1);
  const from = `FROM ${TABLE} d LEFT JOIN users_new u ON u.id = d.user_id WHERE ${where.join(' AND ')}`;

  const totals = await prisma.$queryRawUnsafe<{ n: bigint | number; amount: unknown; paid: unknown }[]>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(d.amount_eur), 0) AS amount, COALESCE(SUM(d.paid_eur), 0) AS paid ${from}`,
    ...params,
  );
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT d.*, u.firstName AS first_name, u.surname, u.name, u.username, u.userType AS user_type
     ${from}
     ORDER BY ${ORDER_SQL[filters.order ?? ''] ?? ORDER_SQL.due_asc}
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ...params,
  );
  const amount = roundEuro(Number(totals[0]?.amount) || 0);
  const paid = roundEuro(Number(totals[0]?.paid) || 0);
  return {
    total: Number(totals[0]?.n ?? 0),
    page,
    pageSize,
    totals: { amountEur: amount, paidEur: paid, restEur: roundEuro(amount - paid) },
    items: rows.map(mapRow),
  };
}

export async function getMovesbookDeadline(id: string): Promise<MovesbookDeadlineRow | null> {
  await ensureMovesbookDeadlinesTable();
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT d.*, u.firstName AS first_name, u.surname, u.name, u.username, u.userType AS user_type
     FROM ${TABLE} d LEFT JOIN users_new u ON u.id = d.user_id WHERE d.id = ? LIMIT 1`,
    id,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Adds a paid amount to the membership period, so the Archive of Payments total follows the deadlines. */
export async function addPaymentToPeriod(userId: string, periodId: string | null, amountEur: number, payMode: string) {
  if (!periodId) return;
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { adminSettings: true } });
  if (!settings) return;
  const history = readNetworkSubscriptionHistory(settings.adminSettings);
  if (!history.some((p) => p.id === periodId)) return;
  const next = history.map((p) =>
    p.id === periodId
      ? {
          ...p,
          amountPaid: String(roundEuro((Number(p.amountPaid) || 0) + amountEur)),
          paymentMethod: payMode,
        }
      : p,
  );
  await prisma.userSettings.update({
    where: { userId },
    data: { adminSettings: mergeNetworkSubscriptionHistory(settings.adminSettings, next) },
  });
}

export class DeadlinePaymentError extends Error {}

/** Super Admin registers a payment (full or partial) on a deadline. */
export async function recordDeadlinePayment(
  id: string,
  input: { amountEur: number; paidOn: string; payMode: string; notes: string; operator: string },
): Promise<MovesbookDeadlineRow> {
  const deadline = await getMovesbookDeadline(id);
  if (!deadline) throw new DeadlinePaymentError('Deadline not found');
  const amount = roundEuro(Number(input.amountEur));
  if (!(amount > 0)) throw new DeadlinePaymentError('Enter the amount paid');
  if (amount > deadline.restEur + 0.001) {
    throw new DeadlinePaymentError(`The amount is higher than the rest to pay (€ ${deadline.restEur.toFixed(2)})`);
  }
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) ? input.paidOn : new Date().toISOString().slice(0, 10);
  const payMode = (input.payMode || 'other').slice(0, 24);
  const periodRows = await prisma.$queryRawUnsafe<{ period_id: string | null }[]>(
    `SELECT period_id FROM ${TABLE} WHERE id = ? LIMIT 1`,
    id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE ${TABLE}
     SET paid_eur = paid_eur + ?, paid_at = ?, pay_mode = ?, operator = ?,
         notes = TRIM(BOTH ' | ' FROM CONCAT(notes, IF(? = '', '', CONCAT(' | ', ?))))
     WHERE id = ?`,
    amount,
    `${paidOn} 12:00:00`,
    payMode,
    input.operator.slice(0, 191),
    input.notes.trim().slice(0, 200),
    input.notes.trim().slice(0, 200),
    id,
  );
  await addPaymentToPeriod(deadline.userId, periodRows[0]?.period_id ?? null, amount, payMode);
  return (await getMovesbookDeadline(id)) as MovesbookDeadlineRow;
}
