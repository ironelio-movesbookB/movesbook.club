import { prisma } from '@/lib/prisma';
import { getLogoUrlFromEntityDescription } from '@/lib/entity/entityLogo';
import type { LegacyUserSnippet } from './types';

const ENTITY_ROLE_IDS = new Set([7, 8, 9]);

/** Team, Club, and Group accounts show their logo. Everyone else shows a profile photo. */
export function isEntityAccount(roleId: number | null | undefined): boolean {
  return roleId != null && ENTITY_ROLE_IDS.has(roleId);
}

/** Fill `logoUrl` on entity accounts (role 7/8/9) from the club, team, or group profile. */
export async function attachEntityLogos(users: Map<number, LegacyUserSnippet>): Promise<void> {
  const targets = Array.from(users.values()).filter(
    (user) => isEntityAccount(user.roleId) && user.username?.trim()
  );
  if (targets.length === 0) return;

  const names = Array.from(new Set(targets.map((user) => user.username!.trim())));
  const modern = await prisma.user.findMany({
    where: { username: { in: names } },
    select: { id: true, username: true },
  });
  if (modern.length === 0) return;

  const ids = modern.map((row) => row.id);
  const [clubs, teams, groups] = await Promise.all([
    prisma.club.findMany({
      where: { adminId: { in: ids } },
      select: { adminId: true, description: true },
    }),
    prisma.team.findMany({
      where: { adminId: { in: ids } },
      select: { adminId: true, description: true },
    }),
    prisma.group.findMany({
      where: { adminId: { in: ids } },
      select: { adminId: true, description: true },
    }),
  ]);

  const logoByAdmin = new Map<string, string>();
  for (const row of [...clubs, ...teams, ...groups]) {
    const logo = getLogoUrlFromEntityDescription(row.description);
    if (logo && !logoByAdmin.has(row.adminId)) logoByAdmin.set(row.adminId, logo);
  }

  const adminByUsername = new Map(modern.map((row) => [row.username.toLowerCase(), row.id]));
  for (const user of targets) {
    const adminId = adminByUsername.get(user.username!.trim().toLowerCase());
    if (!adminId) continue;
    const logo = logoByAdmin.get(adminId);
    if (logo) user.logoUrl = logo;
  }
}
