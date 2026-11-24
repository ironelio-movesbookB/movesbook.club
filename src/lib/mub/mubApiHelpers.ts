import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseMubCategory, parseMubScope, parseRoleTemplate } from '@/lib/mub/mubService';
import { sanitizeMubLang } from '@/lib/mub/mubSanitize';
import type { MubPageQuery } from '@/lib/mub/types';

export function getMubTokenUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? String(decoded.userId) : null;
}

export function parseMubPageRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = parseMubScope(searchParams.get('scope'));
  const category = parseMubCategory(searchParams.get('category'));
  const roleTemplate = parseRoleTemplate(searchParams.get('roleTemplate'));
  const ownerId = searchParams.get('ownerId') ?? null;
  const lang = sanitizeMubLang(searchParams.get('lang'));
  return { scope, category, roleTemplate, ownerId, lang };
}

/**
 * Who may edit the shared Movesbook (STAFF) templates. Deliberately a database
 * check rather than a JWT claim or a password prompt: the templates are imported
 * into every user's page, so a forged `scope=STAFF` query param must never be enough.
 */
export async function isMubStaffUser(userId: string): Promise<boolean> {
  const [superAdmin, staff, adminUser] = await Promise.all([
    prisma.superAdmin.findFirst({ where: { id: userId, isActive: true }, select: { id: true } }),
    prisma.staffAccount.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: userId, userType: 'ADMIN' }, select: { id: true } }),
  ]);
  return Boolean(superAdmin || staff || adminUser);
}

/** True when `userId` administers the club that owns a CLUB-scoped MUB page. */
export async function isClubAdminUser(userId: string, clubId: string): Promise<boolean> {
  const club = await prisma.club.findFirst({
    where: { id: clubId, adminId: userId },
    select: { id: true },
  });
  return Boolean(club);
}

export type MubQueryResolution =
  | { ok: true; query: MubPageQuery }
  | { ok: false; status: number; error: string };

/**
 * Turn request params into a MUB page query the caller is actually allowed to touch.
 *
 * - USER  — `ownerId` is always the caller. A client-supplied `ownerId` is ignored,
 *           so one account can never read or edit another account's MUB page.
 * - STAFF — readable by everyone (users import these templates), writable by staff only.
 * - CLUB  — restricted to the admin of that club.
 */
export async function resolveMubPageQuery(
  parsed: ReturnType<typeof parseMubPageRequest>,
  userId: string,
  intent: 'read' | 'write',
): Promise<MubQueryResolution> {
  const { scope, category, roleTemplate } = parsed;

  if (scope === 'USER') {
    return { ok: true, query: { scope, category, roleTemplate: null, ownerId: userId } };
  }

  if (scope === 'STAFF') {
    if (!roleTemplate) {
      return { ok: false, status: 400, error: 'roleTemplate is required for staff templates' };
    }
    if (intent === 'write' && !(await isMubStaffUser(userId))) {
      return { ok: false, status: 403, error: 'Staff templates can only be edited by Movesbook staff' };
    }
    return { ok: true, query: { scope, category, roleTemplate, ownerId: null } };
  }

  // CLUB
  if (!parsed.ownerId) {
    return { ok: false, status: 400, error: 'ownerId is required for club pages' };
  }
  if (!(await isClubAdminUser(userId, parsed.ownerId))) {
    return { ok: false, status: 403, error: 'Not an administrator of this club' };
  }
  return { ok: true, query: { scope, category, roleTemplate: null, ownerId: parsed.ownerId } };
}
