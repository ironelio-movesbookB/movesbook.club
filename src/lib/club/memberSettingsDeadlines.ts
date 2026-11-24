import { Prisma, ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { procedureService } from '@/lib/procedures';
import { createInstallment } from '@/lib/procedures/installmentService';
import {
  normalizePaymentTypeValue,
  PAID_AT_FIRST_DEADLINE_METHODS,
  paymentMethodIn,
  TO_BE_VERIFIED_METHODS,
} from '@/lib/procedures/payModes';
import {
  ensurePaymentVerificationColumn,
  setPaymentToBeVerified,
} from '@/lib/procedures/paymentVerification';
import { PROCEDURE_TYPE_CODES, decimalToNumber } from '@/lib/procedures/types';
import {
  CREATE_DEADLINES_PAYMENT_STATUS,
  emptyMemberSettingsDeadlines,
  MEMBER_SETTINGS_INSTALLMENT_KEYS,
  type ClubMemberScopedData,
  type MemberSettingsDeadlines,
  type MemberSettingsInstallmentKey,
} from '@/lib/club/memberProfileTypes';
import {
  MEMBER_SETTINGS_INSTALLMENT_LABELS,
  MEMBER_SETTINGS_RECORD_SOURCE,
} from '@/lib/club/memberSettingsDeadlineLinks';

const INSTALLMENT_LABELS = MEMBER_SETTINGS_INSTALLMENT_LABELS;

const SERVICE_NAME = 'Annual membership fee';

type FootballSettings = ClubMemberScopedData['settings']['football'];

function parseAmount(raw: string | undefined): number {
  const n = Number.parseFloat(
    String(raw ?? '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function isoDateOrNull(raw: string | undefined): string | null {
  const v = String(raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

const TEAM_BLOCKING_FKS = [
  ['procedure_records', 'procedure_records_clubId_fkey'],
  ['procedure_receipts', 'procedure_receipts_clubId_fkey'],
] as const;

let teamFkCleanup: Promise<void> | null = null;

/** Older databases still tie procedures to clubs_new; teams store their own id there. */
function allowTeamProcedureRecords(): Promise<void> {
  teamFkCleanup ??= (async () => {
    for (const [table, constraint] of TEAM_BLOCKING_FKS) {
      const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
        `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
        table,
        constraint,
      );
      if (Number(rows[0]?.n ?? 0) > 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraint}\``);
      }
    }
  })().catch((error) => {
    teamFkCleanup = null;
    throw error;
  });
  return teamFkCleanup;
}

function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function paidKeysFromInstallments(
  tx: Prisma.TransactionClient | typeof prisma,
  recordId: string,
): Promise<MemberSettingsInstallmentKey[]> {
  const rows = await tx.procedureInstallment.findMany({
    where: { procedureRecordId: recordId },
    select: { description: true, balance: true },
  });
  const byLabel = new Map(
    rows.map((row) => [String(row.description ?? '').trim(), decimalToNumber(row.balance as never)]),
  );
  return MEMBER_SETTINGS_INSTALLMENT_KEYS.filter((key) => {
    const label = INSTALLMENT_LABELS[key];
    if (!byLabel.has(label)) return false;
    return (byLabel.get(label) ?? 0) <= 0.005;
  });
}

/**
 * Files the member Settings installments in the Archive of the Deadlines (one Membership record).
 * Paying any deadline (or "Create deadlines") copies every installment with an amount into the archive.
 * Each Paid tick records only the pending balance for that installment in the Archive of Payments /
 * Cash movements — partial archive payments are respected.
 */
export async function syncMemberSettingsDeadlines(opts: {
  /** Club id, or the team id in a Team workspace. */
  clubId: string;
  workspaceKind: 'club' | 'team';
  memberUserId: string;
  operatorId: string;
  football: FootballSettings;
  previous: MemberSettingsDeadlines;
}): Promise<MemberSettingsDeadlines> {
  const { football } = opts;
  const createAll = football.paymentStatus === CREATE_DEADLINES_PAYMENT_STATUS;
  const methodOk = paymentMethodIn(PAID_AT_FIRST_DEADLINE_METHODS, football.paymentMethod);
  const today = todayIso();

  const existing = opts.previous.recordId
    ? await prisma.procedureRecord.findFirst({
        where: {
          id: opts.previous.recordId,
          clubId: opts.clubId,
          memberId: opts.memberUserId,
          status: ProcedureRecordStatus.ACTIVE,
        },
        select: { id: true },
      })
    : null;
  // A record deleted from the archive starts over on the next save.
  const state: MemberSettingsDeadlines = existing
    ? {
        ...opts.previous,
        generated: [...opts.previous.generated],
        paidKeys: [...opts.previous.paidKeys],
      }
    : emptyMemberSettingsDeadlines();

  if (existing) {
    state.paidKeys = await paidKeysFromInstallments(prisma, existing.id);
    state.firstPaidRecorded = state.paidKeys.includes('firstPayment');
    for (const key of state.paidKeys) {
      football[key] = { ...football[key], status: 'Paid' };
    }
  }

  const keysMarkedPaid = MEMBER_SETTINGS_INSTALLMENT_KEYS.filter(
    (key) => football[key]?.status === 'Paid' && methodOk && !state.paidKeys.includes(key),
  );
  // First/next Paid tick (or Create deadlines) files every installment that has an amount.
  const fileAll = createAll || keysMarkedPaid.length > 0;

  const wanted = MEMBER_SETTINGS_INSTALLMENT_KEYS.filter((key) => fileAll)
    .map((key) => ({
      key,
      amount: parseAmount(football[key]?.amount),
      date: isoDateOrNull(football[key]?.date) ?? today,
    }))
    .filter((row) => row.amount > 0);

  const missing = wanted.filter((row) => !state.generated.includes(row.key));
  const keysToPay = keysMarkedPaid.filter(
    (key) =>
      state.generated.includes(key) || missing.some((row) => row.key === key),
  );

  if (missing.length === 0 && keysToPay.length === 0) {
    // One-shot Create Deadlines trigger — clear even when everything was already filed.
    if (createAll) football.paymentStatus = 'Pending';
    return {
      ...state,
      firstPaidRecorded: state.paidKeys.includes('firstPayment'),
    };
  }

  const procedureType = await procedureService.getProcedureTypeByCode(
    PROCEDURE_TYPE_CODES.MEMBERSHIP,
  );
  if (!procedureType) throw new Error('Membership procedure type is missing');
  if (opts.workspaceKind === 'team') await allowTeamProcedureRecords();
  const payMode = normalizePaymentTypeValue(football.paymentMethod) || null;
  const toBeVerified =
    keysToPay.length > 0 &&
    Boolean(football.paymentToBeVerified) &&
    paymentMethodIn(TO_BE_VERIFIED_METHODS, payMode);
  if (toBeVerified) await ensurePaymentVerificationColumn();

  const recordId = await prisma.$transaction(async (tx) => {
    let id = existing?.id;
    if (!id) {
      const created = await tx.procedureRecord.create({
        data: {
          procedureTypeId: procedureType.id,
          clubId: opts.clubId,
          memberId: opts.memberUserId,
          operatorId: opts.operatorId,
          totalAmount: 0,
          paidAmount: 0,
          balanceAmount: 0,
          recordDate: toDateOnly(today),
          dueDate: null,
          notes: null,
          metadata: {
            serviceName: SERVICE_NAME,
            membershipName: SERVICE_NAME,
            source: MEMBER_SETTINGS_RECORD_SOURCE,
          } as Prisma.InputJsonValue,
          status: ProcedureRecordStatus.ACTIVE,
        },
      });
      id = created.id;
    }

    const added = roundMoney(missing.reduce((sum, row) => sum + row.amount, 0));
    for (const row of missing) {
      await createInstallment(
        {
          procedureRecordId: id,
          balance: row.amount,
          paymentDate: row.date,
          expireDate: row.date,
          description: INSTALLMENT_LABELS[row.key],
        },
        tx,
      );
    }
    if (added > 0) {
      await tx.procedureRecord.update({
        where: { id },
        data: { totalAmount: { increment: added }, balanceAmount: { increment: added } },
      });
    }

    for (const key of keysToPay) {
      const installment = await tx.procedureInstallment.findFirst({
        where: { procedureRecordId: id, description: INSTALLMENT_LABELS[key] },
        orderBy: { createdAt: 'asc' },
      });
      // Only the pending balance — respects partial payments already made from the archive.
      const pending = installment
        ? roundMoney(decimalToNumber(installment.balance as never))
        : 0;
      if (!installment || pending <= 0) continue;

      const record = await tx.procedureRecord.findUniqueOrThrow({
        where: { id },
        select: { balanceAmount: true, paidAmount: true },
      });
      const balanceAfter = roundMoney(decimalToNumber(record.balanceAmount) - pending);
      const paymentDate =
        isoDateOrNull(football[key]?.date) ?? today;
      const payment = await tx.procedurePayment.create({
        data: {
          procedureRecordId: id,
          amount: pending,
          balanceAfter,
          paymentDate: toDateOnly(paymentDate),
          operatorId: opts.operatorId,
          payMode,
          notes: INSTALLMENT_LABELS[key],
        },
        select: { id: true },
      });
      if (toBeVerified) await setPaymentToBeVerified(payment.id, true, tx);
      await tx.procedureInstallment.update({
        where: { id: installment.id },
        data: {
          balance: 0,
          paid: roundMoney(decimalToNumber(installment.paid as never) + pending),
        },
      });
      await tx.procedureRecord.update({
        where: { id },
        data: {
          paidAmount: roundMoney(decimalToNumber(record.paidAmount) + pending),
          balanceAmount: balanceAfter,
        },
      });
    }

    // Record-level expire date = next open deadline (or the last one once all are paid).
    const installments = await tx.procedureInstallment.findMany({
      where: { procedureRecordId: id },
      orderBy: [{ expireDate: 'asc' }, { createdAt: 'asc' }],
      select: { balance: true, expireDate: true },
    });
    const nextOpen = installments.find((row) => decimalToNumber(row.balance as never) > 0.005);
    const dueDate = (nextOpen ?? installments[installments.length - 1])?.expireDate ?? null;
    await tx.procedureRecord.update({ where: { id }, data: { dueDate } });

    return id;
  });

  const paidKeys = await paidKeysFromInstallments(prisma, recordId);
  for (const key of paidKeys) {
    football[key] = { ...football[key], status: 'Paid' };
  }

  // Dropdown/button trigger is one-shot — restore a normal status after filing.
  if (createAll) {
    football.paymentStatus = 'Pending';
  }

  return {
    recordId,
    generated: MEMBER_SETTINGS_INSTALLMENT_KEYS.filter(
      (key) => state.generated.includes(key) || missing.some((row) => row.key === key),
    ),
    paidKeys,
    firstPaidRecorded: paidKeys.includes('firstPayment'),
    generatedAt: state.generatedAt || new Date().toISOString(),
  };
}
