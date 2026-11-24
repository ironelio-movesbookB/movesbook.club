import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const TELEGRAM_ACCOUNT_TAKEN_MESSAGE =
  'This Telegram username is already registered to another account.';

/**
 * Rejects when another user already owns the same Telegram username
 * (case-insensitive via LOWER, so legacy mixed-case rows are covered).
 *
 * If `excludeUserId` already has this same username, the check is skipped so
 * legacy duplicate holders can still save an unchanged profile.
 */
export async function assertTelegramAccountAvailable(
  telegramAccount: string | null | undefined,
  excludeUserId?: string,
): Promise<void> {
  if (!telegramAccount) return;

  if (excludeUserId) {
    const self = await prisma.user.findUnique({
      where: { id: excludeUserId },
      select: { telegramAccount: true },
    });
    if (
      self?.telegramAccount &&
      self.telegramAccount.toLowerCase() === telegramAccount.toLowerCase()
    ) {
      return;
    }
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users_new
    WHERE telegramAccount IS NOT NULL
      AND LOWER(telegramAccount) = LOWER(${telegramAccount})
      ${excludeUserId ? Prisma.sql`AND id <> ${excludeUserId}` : Prisma.empty}
    LIMIT 1
  `;

  if (rows.length > 0) {
    throw new Error(TELEGRAM_ACCOUNT_TAKEN_MESSAGE);
  }
}

export function isTelegramAccountTakenError(error: unknown): boolean {
  return error instanceof Error && error.message === TELEGRAM_ACCOUNT_TAKEN_MESSAGE;
}
