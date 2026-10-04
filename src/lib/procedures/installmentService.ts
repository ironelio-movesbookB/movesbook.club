import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { decimalToNumber } from './types';

export type InstallmentDto = {
  id: string;
  procedureRecordId: string;
  paid: number;
  balance: number;
  paymentDate: string;
  expireDate: string | null;
  /** ISO timestamp — used to order same-day deadlines (oldest first). */
  createdAt: string;
  description: string | null;
};

function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function mapRow(row: {
  id: string;
  procedureRecordId: string;
  paid: unknown;
  balance: unknown;
  paymentDate: Date;
  expireDate: Date | null;
  createdAt: Date;
  description: string | null;
}): InstallmentDto {
  return {
    id: row.id,
    procedureRecordId: row.procedureRecordId,
    paid: decimalToNumber(row.paid as never),
    balance: decimalToNumber(row.balance as never),
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    expireDate: row.expireDate ? row.expireDate.toISOString().slice(0, 10) : null,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
  };
}

export async function listInstallments(recordId: string): Promise<InstallmentDto[]> {
  // Heal stale installment rests left by older payment paths.
  await reconcileInstallmentsWithRecord(recordId);

  const rows = await prisma.procedureInstallment.findMany({
    where: { procedureRecordId: recordId },
    // Oldest expire first; same day → oldest createdAt first.
    orderBy: [{ expireDate: 'asc' }, { paymentDate: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(mapRow);
}

/** Installments of many records in one query — list views cannot afford a round trip per record. */
export async function listInstallmentsForRecords(
  recordIds: string[]
): Promise<Map<string, InstallmentDto[]>> {
  const byRecord = new Map<string, InstallmentDto[]>();
  if (recordIds.length === 0) return byRecord;

  const rows = await prisma.procedureInstallment.findMany({
    where: { procedureRecordId: { in: recordIds } },
    orderBy: [{ expireDate: 'asc' }, { paymentDate: 'asc' }, { createdAt: 'asc' }],
  });

  for (const row of rows) {
    const dto = mapRow(row);
    const list = byRecord.get(dto.procedureRecordId);
    if (list) list.push(dto);
    else byRecord.set(dto.procedureRecordId, [dto]);
  }
  return byRecord;
}

/**
 * Read-only twin of `reconcileInstallmentsWithRecord`: settles stale rests oldest-first against the
 * parent balance so a list never shows a rest the record no longer owes, without writing on a GET.
 */
export function projectInstallmentsOnBalance(
  installments: InstallmentDto[],
  recordBalance: number
): InstallmentDto[] {
  const rows = installments.map((row) => ({ ...row }));
  if (rows.length === 0) return rows;

  const balance = roundMoney(recordBalance);
  if (balance <= 0.005) {
    return rows.map((row) => ({ ...row, paid: roundMoney(row.paid + row.balance), balance: 0 }));
  }

  let excess = roundMoney(rows.reduce((sum, row) => sum + row.balance, 0) - balance);
  if (excess <= 0.005) return rows;

  for (const row of rows) {
    if (excess <= 0) break;
    const apply = Math.min(row.balance, excess);
    if (apply <= 0) continue;
    row.balance = roundMoney(row.balance - apply);
    row.paid = roundMoney(row.paid + apply);
    excess = roundMoney(excess - apply);
  }
  return rows;
}

export async function createInstallment(
  input: {
    procedureRecordId: string;
    balance: number;
    paid?: number;
    paymentDate: string;
    expireDate?: string | null;
    description?: string | null;
  },
  tx?: Prisma.TransactionClient
): Promise<InstallmentDto> {
  const client = tx ?? prisma;
  const row = await client.procedureInstallment.create({
    data: {
      procedureRecordId: input.procedureRecordId,
      balance: input.balance,
      paid: input.paid ?? 0,
      paymentDate: toDateOnly(input.paymentDate),
      expireDate: input.expireDate ? toDateOnly(input.expireDate) : null,
      description: input.description ?? null,
    },
  });
  return mapRow(row);
}

export async function updateInstallment(
  id: string,
  recordId: string,
  input: Partial<{
    balance: number;
    paid: number;
    paymentDate: string;
    expireDate: string | null;
    description: string | null;
  }>
): Promise<InstallmentDto | null> {
  const existing = await prisma.procedureInstallment.findFirst({
    where: { id, procedureRecordId: recordId },
  });
  if (!existing) return null;

  const row = await prisma.procedureInstallment.update({
    where: { id },
    data: {
      ...(input.balance != null ? { balance: input.balance } : {}),
      ...(input.paid != null ? { paid: input.paid } : {}),
      ...(input.paymentDate ? { paymentDate: toDateOnly(input.paymentDate) } : {}),
      ...(input.expireDate !== undefined
        ? { expireDate: input.expireDate ? toDateOnly(input.expireDate) : null }
        : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
  return mapRow(row);
}

export async function deleteInstallment(id: string, recordId: string): Promise<boolean> {
  const result = await prisma.procedureInstallment.deleteMany({
    where: { id, procedureRecordId: recordId },
  });
  return result.count > 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Apply a payment amount oldest-first across open installments (expire → createdAt).
 */
export async function applyPaymentToInstallments(
  recordId: string,
  amount: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  let remaining = roundMoney(amount);
  if (remaining <= 0) return;

  const rows = await client.procedureInstallment.findMany({
    where: { procedureRecordId: recordId, balance: { gt: 0 } },
    orderBy: [{ expireDate: 'asc' }, { paymentDate: 'asc' }, { createdAt: 'asc' }],
  });

  for (const row of rows) {
    if (remaining <= 0) break;
    const bal = decimalToNumber(row.balance as never);
    const paid = decimalToNumber(row.paid as never);
    const apply = Math.min(bal, remaining);
    if (apply <= 0) continue;
    await client.procedureInstallment.update({
      where: { id: row.id },
      data: {
        balance: roundMoney(bal - apply),
        paid: roundMoney(paid + apply),
      },
    });
    remaining = roundMoney(remaining - apply);
  }
}

/** Undo `applyPaymentToInstallments` for a deleted payment: the latest paid installments reopen first. */
export async function reversePaymentOnInstallments(
  recordId: string,
  amount: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  let remaining = roundMoney(amount);
  if (remaining <= 0) return;

  const rows = await client.procedureInstallment.findMany({
    where: { procedureRecordId: recordId, paid: { gt: 0 } },
    orderBy: [{ expireDate: 'desc' }, { paymentDate: 'desc' }, { createdAt: 'desc' }],
  });

  for (const row of rows) {
    if (remaining <= 0) break;
    const bal = decimalToNumber(row.balance as never);
    const paid = decimalToNumber(row.paid as never);
    const undo = Math.min(paid, remaining);
    if (undo <= 0) continue;
    await client.procedureInstallment.update({
      where: { id: row.id },
      data: {
        balance: roundMoney(bal + undo),
        paid: roundMoney(paid - undo),
      },
    });
    remaining = roundMoney(remaining - undo);
  }
}

/**
 * If installment rests drifted from the parent record (e.g. older payments),
 * bring them in line so a fully paid service never shows Rest > 0 on deadlines.
 */
export async function reconcileInstallmentsWithRecord(
  recordId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  const record = await client.procedureRecord.findUnique({
    where: { id: recordId },
    select: { balanceAmount: true },
  });
  if (!record) return;

  const recordBalance = roundMoney(decimalToNumber(record.balanceAmount as never));
  const rows = await client.procedureInstallment.findMany({
    where: { procedureRecordId: recordId },
    orderBy: [{ expireDate: 'asc' }, { paymentDate: 'asc' }, { createdAt: 'asc' }],
  });
  if (rows.length === 0) return;

  const sumBalance = roundMoney(
    rows.reduce((s, r) => s + decimalToNumber(r.balance as never), 0)
  );
  const excess = roundMoney(sumBalance - recordBalance);
  if (excess > 0.005) {
    await applyPaymentToInstallments(recordId, excess, client);
    return;
  }

  if (recordBalance <= 0.005) {
    for (const row of rows) {
      const bal = decimalToNumber(row.balance as never);
      const paid = decimalToNumber(row.paid as never);
      if (bal > 0.005) {
        await client.procedureInstallment.update({
          where: { id: row.id },
          data: { balance: 0, paid: roundMoney(paid + bal) },
        });
      }
    }
  }
}

/** Ensure at least one installment exists for a record (mirrors PHP ServicePurchasesDetail on create). */
export async function ensureDefaultInstallment(
  recordId: string,
  total: number,
  paid: number,
  paymentDate: string,
  expireDate?: string | null,
  description?: string | null,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  const count = await client.procedureInstallment.count({ where: { procedureRecordId: recordId } });
  if (count > 0) return;
  await createInstallment({
    procedureRecordId: recordId,
    balance: Math.max(0, total - paid),
    paid,
    paymentDate,
    expireDate: expireDate ?? paymentDate,
    description,
  }, tx);
}
