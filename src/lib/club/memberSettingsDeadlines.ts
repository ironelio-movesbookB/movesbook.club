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

/**
 * Files the member Settings installments in the Archive of the Deadlines (one Membership record).
 * "Create deadlines" files every installment with an amount; the first payment "Paid" tick files
 * that installment and records its payment in the Archive of the Payments.
 * Installments already filed are never rewritten — edits go through the archive payment forms.
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
  const firstPaid =
    football.firstPayment?.status === 'Paid' &&
    paymentMethodIn(PAID_AT_FIRST_DEADLINE_METHODS, football.paymentMethod);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
    ? { ...opts.previous, generated: [...opts.previous.generated] }
    : emptyMemberSettingsDeadlines();

  const wanted = MEMBER_SETTINGS_INSTALLMENT_KEYS.filter(
    (key) => createAll || (key === 'firstPayment' && firstPaid),
  )
    .map((key) => ({
      key,
      amount: parseAmount(football[key]?.amount),
      date: isoDateOrNull(football[key]?.date) ?? today,
    }))
    .filter((row) => row.amount > 0);

  const missing = wanted.filter((row) => !state.generated.includes(row.key));
  const firstFiled =
    state.generated.includes('firstPayment') || missing.some((row) => row.key === 'firstPayment');
  const payFirst = firstPaid && !state.firstPaidRecorded && firstFiled;
  if (missing.length === 0 && !payFirst) return state;

  const procedureType = await procedureService.getProcedureTypeByCode(
    PROCEDURE_TYPE_CODES.MEMBERSHIP,
  );
  if (!procedureType) throw new Error('Membership procedure type is missing');
  if (opts.workspaceKind === 'team') await allowTeamProcedureRecords();
  const payMode = normalizePaymentTypeValue(football.paymentMethod) || null;
  const toBeVerified =
    payFirst &&
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

    if (payFirst) {
      const installment = await tx.procedureInstallment.findFirst({
        where: { procedureRecordId: id, description: INSTALLMENT_LABELS.firstPayment },
        orderBy: { createdAt: 'asc' },
      });
      const amount = installment ? roundMoney(decimalToNumber(installment.balance as never)) : 0;
      if (installment && amount > 0) {
        const record = await tx.procedureRecord.findUniqueOrThrow({
          where: { id },
          select: { balanceAmount: true, paidAmount: true },
        });
        const balanceAfter = roundMoney(decimalToNumber(record.balanceAmount) - amount);
        const payment = await tx.procedurePayment.create({
          data: {
            procedureRecordId: id,
            amount,
            balanceAfter,
            paymentDate: toDateOnly(isoDateOrNull(football.firstPayment?.date) ?? today),
            operatorId: opts.operatorId,
            payMode,
            notes: INSTALLMENT_LABELS.firstPayment,
          },
          select: { id: true },
        });
        if (toBeVerified) await setPaymentToBeVerified(payment.id, true, tx);
        await tx.procedureInstallment.update({
          where: { id: installment.id },
          data: {
            balance: 0,
            paid: roundMoney(decimalToNumber(installment.paid as never) + amount),
          },
        });
        await tx.procedureRecord.update({
          where: { id },
          data: {
            paidAmount: roundMoney(decimalToNumber(record.paidAmount) + amount),
            balanceAmount: balanceAfter,
          },
        });
      }
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

  return {
    recordId,
    generated: MEMBER_SETTINGS_INSTALLMENT_KEYS.filter(
      (key) => state.generated.includes(key) || missing.some((row) => row.key === key),
    ),
    firstPaidRecorded: state.firstPaidRecorded || payFirst,
    generatedAt: state.generatedAt || new Date().toISOString(),
  };
}
