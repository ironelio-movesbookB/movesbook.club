import { ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { procedureService } from '@/lib/procedures/ProcedureService';
import type { ClubAuthContext } from '@/lib/procedures/types';
import {
  listInstallments,
  projectInstallmentsOnBalance,
} from '@/lib/procedures/installmentService';
import {
  forgetMemberSettingsDeadlines,
  MEMBER_SETTINGS_RECORD_SOURCE,
  memberSettingsKeyForLabel,
} from '@/lib/club/memberSettingsDeadlineLinks';
import { restoreCardCreditPayment } from './insertCreditService';

const EPSILON = 0.005;

export class DeadlineDeleteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type DeleteDeadlineResult = { deleted: 'deadline' | 'record' };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Archive of the Deadlines: delete one deadline. Payments belonging to a deleted
 * record are removed with it. For a multi-deadline record, removing one installment
 * removes that record's payment history and reopens the remaining installments.
 */
export async function deleteSingleDeadline(
  ctx: ClubAuthContext,
  procedureTypeCode: string,
  recordId: string,
  installmentId: string
): Promise<DeleteDeadlineResult> {
  const record = await prisma.procedureRecord.findFirst({
    where: {
      id: recordId,
      clubId: ctx.club.id,
      status: ProcedureRecordStatus.ACTIVE,
      procedureType: { code: procedureTypeCode },
    },
  });
  if (!record) throw new DeadlineDeleteError('Record not found', 404);

  const installments = projectInstallmentsOnBalance(
    await listInstallments(recordId),
    Number(record.balanceAmount ?? 0)
  );
  const deleteWholeRecord = async () => {
    await procedureService.softDeleteRecord(ctx, procedureTypeCode, recordId);
    return { deleted: 'record' as const };
  };

  if (installmentId === `${recordId}-record` || installments.length === 0) {
    return deleteWholeRecord();
  }

  const target = installments.find((i) => i.id === installmentId);
  if (!target) throw new DeadlineDeleteError('Deadline not found', 404);
  if (installments.length === 1) return deleteWholeRecord();
  const payments = await prisma.procedurePayment.findMany({
    where: { procedureRecordId: recordId },
    select: { amount: true, payMode: true, cancelledAt: true, reversalOfId: true },
  });
  const cardPaidAmount = round2(
    payments
      .filter((payment) => !payment.cancelledAt && !payment.reversalOfId && payment.payMode === 'card')
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  );
  const rawInstallments = await prisma.procedureInstallment.findMany({
    where: { procedureRecordId: recordId },
    orderBy: [{ expireDate: 'asc' }, { paymentDate: 'asc' }, { createdAt: 'asc' }],
  });
  const rawTarget = rawInstallments.find((i) => i.id === target.id);
  if (!rawTarget) throw new DeadlineDeleteError('Deadline not found', 404);
  const deletedAmount = round2(Number(rawTarget.paid) + Number(rawTarget.balance));
  const remaining = rawInstallments.filter((i) => i.id !== target.id);
  const nextOpen = remaining.find((i) => Number(i.balance) + Number(i.paid) > EPSILON);
  const dueSource = nextOpen ?? remaining[remaining.length - 1];
  const dueDate = dueSource?.expireDate ?? dueSource?.paymentDate ?? null;
  const totalAmount = round2(Math.max(0, Number(record.totalAmount ?? 0) - deletedAmount));
  const balanceAmount = totalAmount;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.procedureRecord.updateMany({
      where: {
        id: recordId,
        clubId: ctx.club.id,
        status: ProcedureRecordStatus.ACTIVE,
        totalAmount: record.totalAmount,
        paidAmount: record.paidAmount,
        balanceAmount: record.balanceAmount,
      },
      data: {
        totalAmount,
        paidAmount: 0,
        balanceAmount,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : record.dueDate,
      },
    });
    if (updated.count !== 1) {
      throw new DeadlineDeleteError('Record changed. Refresh the archive and try again.', 409);
    }

    await tx.procedurePayment.deleteMany({ where: { procedureRecordId: recordId } });
    await tx.procedureInstallment.delete({ where: { id: target.id } });
    for (const installment of remaining) {
      await tx.procedureInstallment.update({
        where: { id: installment.id },
        data: {
          paid: 0,
          balance: round2(Number(installment.paid) + Number(installment.balance)),
        },
      });
    }

    if (cardPaidAmount > 0) {
      await restoreCardCreditPayment(ctx.club.id, record.memberId, cardPaidAmount, ctx.userId, tx);
    }
  });

  const source = (record.metadata as Record<string, unknown> | null)?.source;
  const key = memberSettingsKeyForLabel(target.description);
  if (source === MEMBER_SETTINGS_RECORD_SOURCE && key) {
    try {
      await forgetMemberSettingsDeadlines({
        clubId: ctx.club.id,
        memberUserId: record.memberId,
        recordId,
        key,
      });
    } catch (error) {
      console.error('deleteSingleDeadline: member Settings link not reset', error);
    }
  }

  return { deleted: 'deadline' };
}
