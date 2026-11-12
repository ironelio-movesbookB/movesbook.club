import { NextRequest } from 'next/server';
import { verifyPassword, verifyToken } from '@/lib/auth';
import { verifyClubCompanyPassword } from '@/lib/club/clubDirectLogin';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { prisma } from '@/lib/prisma';
import { parseMubCategory, parseMubScope, parseRoleTemplate } from '@/lib/mub/mubService';
import { sanitizeMubLang } from '@/lib/mub/mubSanitize';
import type { MubPageQuery } from '@/lib/mub/types';
import { MUB_UNLOCK_REQUIRED, getMubUnlockAccess } from '@/lib/mub/mubUnlock';

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

/**
 * The Movesbook Super Admin password ONLY — answer A of the MUB gear gate, which any
 * account type (ID5–ID9) may type to open the Movesbook MUB settings.
 *
 * Deliberately narrower than `verifySuperAdminPassword`, which also accepts the
 * caller's own account password and the built-in `admin123` / fallback-hash defaults.
 * Those are fine behind "caller is already staff", but here the password alone grants
 * edit access to templates imported by every user.
 */
export async function verifyMubSuperAdminPassword(password: string): Promise<boolean> {
  if (!password.trim()) return false;

  const superAdmins = await prisma.superAdmin.findMany({
    where: { isActive: true },
    select: { password: true },
  });
  for (const sa of superAdmins) {
    if (sa.password && (await verifyPassword(password, sa.password))) return true;
  }

  const settings = await prisma.superAdminSettings.findFirst({ select: { password: true } });
  if (settings?.password && (await verifyPassword(password, settings.password))) return true;

  return false;
}

/**
 * Answer B — the "My Password" of an entity this account administers.
 * Clubs (ID8), teams (ID7), groups (ID9) and coached groups (ID6) all store it the
 * same way in their description meta.
 */
export async function matchMubEntityAdminPassword(
  userId: string,
  password: string,
): Promise<{ kind: 'club' | 'team' | 'group' | 'coach'; id: string } | null> {
  const [clubs, teams, groups, coachingGroups] = await Promise.all([
    prisma.club.findMany({ where: { adminId: userId }, select: { id: true, description: true } }),
    prisma.team.findMany({ where: { adminId: userId }, select: { id: true, description: true } }),
    prisma.group.findMany({ where: { adminId: userId }, select: { id: true, description: true } }),
    prisma.coachingGroup.findMany({
      where: { coachId: userId },
      select: { id: true, description: true },
    }),
  ]);

  const candidates = [
    ...clubs.map((r) => ({ kind: 'club' as const, ...r })),
    ...teams.map((r) => ({ kind: 'team' as const, ...r })),
    ...groups.map((r) => ({ kind: 'group' as const, ...r })),
    ...coachingGroups.map((r) => ({ kind: 'coach' as const, ...r })),
  ];
  for (const row of candidates) {
    const hash = parseClubDescriptionMeta(row.description).clubPasswordHash;
    if (await verifyClubCompanyPassword(password, hash)) return { kind: row.kind, id: row.id };
  }
  return null;
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
  | { ok: false; status: number; error: string; code?: string };

function unlockRequired(): MubQueryResolution {
  return {
    ok: false,
    status: 403,
    error: 'Enter the MUB settings password first',
    code: MUB_UNLOCK_REQUIRED,
  };
}

/**
 * Turn request params into a MUB page query the caller is actually allowed to touch.
 *
 * - USER  — `ownerId` is always the caller. A client-supplied `ownerId` is ignored,
 *           so one account can never read or edit another account's MUB page.
 * - STAFF — readable by everyone (users import these templates), writable by staff only.
 * - CLUB  — restricted to the admin of that club.
 *
 * Writes also require the gear-password unlock token (see `mubUnlock.ts`):
 * any unlock level for USER / CLUB pages, the `staff` level for STAFF templates.
 */
export async function resolveMubPageQuery(
  request: NextRequest,
  parsed: ReturnType<typeof parseMubPageRequest>,
  userId: string,
  intent: 'read' | 'write',
): Promise<MubQueryResolution> {
  const { scope, category, roleTemplate } = parsed;
  const unlock = intent === 'write' ? getMubUnlockAccess(request, userId) : null;

  if (scope === 'USER') {
    if (intent === 'write' && !unlock) return unlockRequired();
    return { ok: true, query: { scope, category, roleTemplate: null, ownerId: userId } };
  }

  if (scope === 'STAFF') {
    if (!roleTemplate) {
      return { ok: false, status: 400, error: 'roleTemplate is required for staff templates' };
    }
    // The `staff` unlock is only issued after the Super Admin password (or a staff
    // account's own credentials) — any account type may hold it (client answer A).
    if (intent === 'write' && unlock !== 'staff') return unlockRequired();
    return { ok: true, query: { scope, category, roleTemplate, ownerId: null } };
  }

  // CLUB
  if (!parsed.ownerId) {
    return { ok: false, status: 400, error: 'ownerId is required for club pages' };
  }
  if (!(await isClubAdminUser(userId, parsed.ownerId))) {
    return { ok: false, status: 403, error: 'Not an administrator of this club' };
  }
  if (intent === 'write' && !unlock) return unlockRequired();
  return { ok: true, query: { scope, category, roleTemplate: null, ownerId: parsed.ownerId } };
}
