import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * "To be verified" flag on procedure_payments (Cheque / Payment slip / Bank transfer).
 * The column is added on first use, like other late additions to legacy tables;
 * it is not in the Prisma schema, so it is read and written with raw SQL.
 */
let columnReady: Promise<void> | null = null;

export function ensurePaymentVerificationColumn(): Promise<void> {
  columnReady ??= (async () => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'procedure_payments' AND COLUMN_NAME = 'toBeVerified'`,
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE `procedure_payments` ADD COLUMN `toBeVerified` TINYINT(1) NOT NULL DEFAULT 0',
      );
    }
  })().catch((error) => {
    columnReady = null;
    throw error;
  });
  return columnReady;
}

/** Call ensurePaymentVerificationColumn() before the transaction (ALTER TABLE commits implicitly). */
export async function setPaymentToBeVerified(
  paymentId: string,
  value: boolean,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.$executeRawUnsafe(
    'UPDATE `procedure_payments` SET `toBeVerified` = ? WHERE `id` = ?',
    value ? 1 : 0,
    paymentId,
  );
}

export async function loadToBeVerifiedPaymentIds(paymentIds: string[]): Promise<Set<string>> {
  if (paymentIds.length === 0) return new Set();
  await ensurePaymentVerificationColumn();
  const placeholders = paymentIds.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM procedure_payments WHERE toBeVerified = 1 AND id IN (${placeholders})`,
    ...paymentIds,
  );
  return new Set(rows.map((r) => r.id));
}
