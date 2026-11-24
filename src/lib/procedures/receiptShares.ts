import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

const TABLE = 'club_receipt_shares';
let ready = false;

async function ensureTable(): Promise<void> {
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      token VARCHAR(64) NOT NULL PRIMARY KEY,
      receipt_id VARCHAR(191) NOT NULL,
      club_id VARCHAR(191) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY club_receipt_shares_receipt (receipt_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ready = true;
}

export function receiptSharePath(token: string): string {
  return `/club-receipts/${token}`;
}

/** Public read-only link of a receipt of this club / team (one stable token per receipt). */
export async function getOrCreateReceiptShareToken(receiptId: string, clubId: string): Promise<string | null> {
  const receipt = await prisma.procedureReceipt.findFirst({
    where: { id: receiptId, clubId },
    select: { id: true },
  });
  if (!receipt) return null;
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ token: string }>>(
    `SELECT token FROM \`${TABLE}\` WHERE receipt_id = ? LIMIT 1`,
    receiptId,
  );
  if (rows[0]?.token) return rows[0].token;
  const token = randomBytes(24).toString('hex');
  await prisma.$executeRawUnsafe(
    `INSERT IGNORE INTO \`${TABLE}\` (token, receipt_id, club_id, created_at) VALUES (?,?,?,?)`,
    token,
    receiptId,
    clubId,
    new Date(),
  );
  const again = await prisma.$queryRawUnsafe<Array<{ token: string }>>(
    `SELECT token FROM \`${TABLE}\` WHERE receipt_id = ? LIMIT 1`,
    receiptId,
  );
  return again[0]?.token ?? null;
}

export async function receiptForShareToken(token: string): Promise<{ receiptId: string; clubId: string } | null> {
  if (!/^[a-f0-9]{32,64}$/i.test(token)) return null;
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ receipt_id: string; club_id: string }>>(
    `SELECT receipt_id, club_id FROM \`${TABLE}\` WHERE token = ? LIMIT 1`,
    token,
  );
  return rows[0] ? { receiptId: rows[0].receipt_id, clubId: rows[0].club_id } : null;
}
