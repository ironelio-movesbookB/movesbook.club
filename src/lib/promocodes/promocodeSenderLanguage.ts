import { prisma } from '@/lib/prisma';
import { fetchLegacyUsersByIds } from './legacyDb';
import { legacyLanguageIdFromCode } from './legacyLanguageCode';

/** Movesbook staff (super admin / admin) send mail in the document language. */
export async function isMovesbookLegacyUser(legacyUserId: number): Promise<boolean> {
  if (legacyUserId <= 0) return false;
  const user = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
  return user?.roleId === 1 || user?.roleId === 2;
}

/** Language id (language_values.id) from the sender's account language. */
export async function languageIdForLegacyUser(legacyUserId: number): Promise<string | null> {
  if (legacyUserId <= 0) return null;
  const user = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
  if (!user) return null;
  const or: Array<{ username: string } | { email: string }> = [];
  if (user.username?.trim()) or.push({ username: user.username.trim() });
  if (user.email?.trim()) or.push({ email: user.email.trim() });
  if (or.length === 0) return null;
  const modern = await prisma.user.findFirst({
    where: { OR: or },
    select: { id: true },
  });
  if (!modern) return null;
  const settings = await prisma.userSettings.findUnique({
    where: { userId: modern.id },
    select: { language: true },
  });
  if (!settings?.language?.trim()) return null;
  return legacyLanguageIdFromCode(settings.language);
}
