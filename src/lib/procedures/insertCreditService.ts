import { prisma } from '@/lib/prisma';
import { findExistingTable } from '@/lib/club/legacyTableLookup';

const CREDIT_TABLES = ['insert_credits', 'insert_credit'];
const CREDIT_DETAIL_TABLES = ['insert_credit_details', 'insert_credit_detail'];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * PHP __savePaymentCreditRecord — when pay_mode is credit card (3), deduct from member credit pool.
 */
export async function applyCardCreditPayment(
  clubId: string,
  memberId: string,
  amount: number,
  operatorId?: string | null
): Promise<void> {
  if (amount <= 0) return;

  const creditTable = await findExistingTable(CREDIT_TABLES);
  const detailTable = await findExistingTable(CREDIT_DETAIL_TABLES);
  if (!creditTable) return;

  const rows = await prisma.$queryRawUnsafe<
    { id: bigint | number; last_annotations: string | number | null; credit_available: string | number | null }[]
  >(
    `SELECT id, last_annotations, credit_available FROM \`${creditTable}\`
     WHERE club_id = ? AND user_id = ? LIMIT 1`,
    clubId,
    memberId
  );

  const row = rows[0];
  if (!row) return;

  const lastAvailable = num(row.last_annotations ?? row.credit_available);
  const remaining = Math.max(0, lastAvailable - amount);

  await prisma.$executeRawUnsafe(
    `UPDATE \`${creditTable}\`
     SET last_annotations = ?, credit_available = ?, pay = ?, operator_id = ?, modified = NOW()
     WHERE id = ?`,
    remaining,
    remaining,
    amount,
    operatorId ?? null,
    row.id
  );

  if (detailTable) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${detailTable}\` (credit_id, last_current_available, total_current_available, created, modified)
       VALUES (?, ?, ?, NOW(), NOW())`,
      row.id,
      lastAvailable,
      remaining
    );
  }
}
