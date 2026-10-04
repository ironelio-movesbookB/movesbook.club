import { createHash } from 'crypto';
import { prisma, prismaConnect } from '@/lib/prisma';

const TABLE_NAME = 'member_note_popup_dismissals';
export const DISMISS_KEY_MAX_LENGTH = 191;

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await prismaConnect();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
          user_id VARCHAR(191) NOT NULL,
          dismiss_key VARCHAR(191) NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (user_id, dismiss_key)
        )
      `);
    })().catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  return tableReady;
}

/**
 * Key for "don't display again": the popup id plus a fingerprint of its content and
 * validity window, so an edited or rescheduled message is shown again.
 */
export function memberNotePopupDismissKey(item: {
  id: string;
  body: string;
  enableFrom: string;
  enableTo: string;
  imageUrls?: string[];
}): string {
  // Pictures only join the fingerprint when present, so keys of picture-less messages stay stable.
  const images = item.imageUrls?.length ? `\u0000${item.imageUrls.join('\u0001')}` : '';
  const hash = createHash('sha1')
    .update(`${item.body}\u0000${item.enableFrom}\u0000${item.enableTo}${images}`)
    .digest('hex')
    .slice(0, 16);
  return `${item.id.slice(0, DISMISS_KEY_MAX_LENGTH - 17)}:${hash}`;
}

export async function listDismissedPopupKeys(userId: string): Promise<Set<string>> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ dismiss_key: string }[]>(
    `SELECT dismiss_key FROM \`${TABLE_NAME}\` WHERE user_id = ?`,
    userId,
  );
  return new Set(rows.map((r) => String(r.dismiss_key)));
}

export async function setPopupDismissed(
  userId: string,
  dismissKey: string,
  dismissed: boolean,
): Promise<void> {
  await ensureTable();
  if (dismissed) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`${TABLE_NAME}\` (user_id, dismiss_key) VALUES (?, ?)`,
      userId,
      dismissKey,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${TABLE_NAME}\` WHERE user_id = ? AND dismiss_key = ?`,
      userId,
      dismissKey,
    );
  }
}
