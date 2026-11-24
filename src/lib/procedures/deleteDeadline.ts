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

const EPSILON = 0.005;

export class DeadlineDeleteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type DeleteDeadlineResult = { deleted: 'deadline' | 'record' };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Archive of the Deadlines: delete one deadline. Its amount leaves the record's
 * total and rest; paid deadlines and the record's payments are never touched.
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
  const paidAmount = Number(record.paidAmount ?? 0);
  const deleteWholeRecord = async () => {
    if (paidAmount > EPSILON) {
      throw new DeadlineDeleteError(
        'This deadline has payments. Delete the payment first in the Archive of the Payments.',
        409
      );
    }
    await procedureService.softDeleteRecord(ctx, procedureTypeCode, recordId);
    return { deleted: 'record' as const };
  };

  if (installmentId === `${recordId}-record` || installments.length === 0) {
    return deleteWholeRecord();
  }

  const target = installments.find((i) => i.id === installmentId);
  if (!target) throw new DeadlineDeleteError('Deadline not found', 404);
  if (target.paid > EPSILON) {
    throw new DeadlineDeleteError(
      'This deadline is already paid (fully or in part). Delete its payment first in the Archive of the Payments.',
      409
    );
  }
  if (installments.length === 1) return deleteWholeRecord();

  const amount = target.balance;
  const remaining = installments.filter((i) => i.id !== target.id);
  const nextOpen = remaining.find((i) => i.balance > EPSILON);
  const dueSource = nextOpen ?? remaining[remaining.length - 1];
  const dueDate = dueSource ? dueSource.expireDate ?? dueSource.paymentDate : null;
  const totalAmount = round2(Math.max(0, Number(record.totalAmount ?? 0) - amount));
  const balanceAmount = round2(Math.max(0, Number(record.balanceAmount ?? 0) - amount));

  await prisma.$transaction(async (tx) => {
    await tx.procedureInstallment.delete({ where: { id: target.id } });
    await tx.procedureRecord.update({
      where: { id: recordId },
      data: {
        totalAmount,
        balanceAmount,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : record.dueDate,
      },
    });
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
