import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLegacyUsersTable } from '@/lib/promocodes/legacyDb';

export type DeleteAccountResult = { userId: string; ok: true } | { userId: string; ok: false; error: string };

function legacyIdOf(userId: string): number | null {
  const match = /^legacy_(\d+)$/.exec(userId);
  return match ? Number(match[1]) : null;
}

/** Permanently removes a Movesbook user (and its legacy promocode row when it came from quick register). */
export async function deleteRegisteredUserAccount(userId: string): Promise<DeleteAccountResult> {
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return {
        userId,
        ok: false,
        error: 'The user is still linked to club procedures; remove those first.',
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { userId, ok: false, error: 'User not found' };
    }
    throw e;
  }

  await prisma
    .$executeRawUnsafe(`DELETE FROM user_account_activations WHERE user_id = ?`, userId)
    .catch(() => undefined);

  const legacyId = legacyIdOf(userId);
  if (legacyId) {
    const usersTable = await getLegacyUsersTable();
    if (usersTable) {
      await prisma
        .$executeRawUnsafe(`DELETE FROM \`${usersTable}\` WHERE id = ?`, legacyId)
        .catch(() => undefined);
    }
  }

  return { userId, ok: true };
}
