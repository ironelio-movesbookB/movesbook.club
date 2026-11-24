import { prisma } from '@/lib/prisma';
import { formatSellingNumber, sellingSequenceOf } from './sellingNumber';

/** Next number of the year for this club's sellings: one more than the highest used this year. */
export async function nextSellingNumber(clubId: string, procedureTypeId: string | null | undefined) {
  const now = new Date();
  if (!procedureTypeId) return formatSellingNumber(1, now);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const rows = await prisma.procedureRecord.findMany({
    where: { procedureTypeId, clubId, createdAt: { gte: yearStart } },
    select: { metadata: true },
  });
  let highest = 0;
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    highest = Math.max(highest, sellingSequenceOf(meta.sellingNumber));
  }
  return formatSellingNumber(Math.max(highest, rows.length) + 1, now);
}
