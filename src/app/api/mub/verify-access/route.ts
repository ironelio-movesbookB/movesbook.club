import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  verifyOptionsFromRequest,
  verifySuperAdminPassword,
} from '@/lib/messages/verifySuperAdminPassword';
import {
  isMubStaffUser,
  matchMubEntityAdminPassword,
  verifyMubSuperAdminPassword,
} from '@/lib/mub/mubApiHelpers';
import { resolveImportRoleTemplate } from '@/lib/mub/mubService';
import { issueMubUnlock } from '@/lib/mub/mubUnlock';

export const dynamic = 'force-dynamic';

/**
 * Throttle password attempts per account. Without this the endpoint is an oracle:
 * it tests a submitted password against staff and club credentials and reports
 * which one matched.
 */
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
/**
 * Per-process: resets on restart and is not shared between instances. Good enough
 * to stop online guessing from one session; a shared store would be needed to
 * enforce it across a multi-instance deployment.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_TRACKED_ACCOUNTS = 10_000;

function pruneExpired(now: number) {
  for (const [key, entry] of attempts) {
    if (now >= entry.resetAt) attempts.delete(key);
  }
}

function registerAttempt(userId: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (attempts.size >= MAX_TRACKED_ACCOUNTS) pruneExpired(now);
  const entry = attempts.get(userId);

  if (!entry || now >= entry.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function clearAttempts(userId: string) {
  attempts.delete(userId);
}

/**
 * Gear password gate — works for every account type (ID5 single user, ID6 coach,
 * ID7 team, ID8 club, ID9 group):
 *
 * A) Super Admin password → Movesbook MUB settings (staff template for the caller's
 *    user type). Any account may type it; only the real Super Admin passwords count
 *    (`verifyMubSuperAdminPassword`). Staff accounts additionally keep their old
 *    route through `verifySuperAdminPassword`, which also accepts their own login.
 * B) Admin "My Password" of a club / team / group / coached group the caller
 *    administers → the caller's own MUB settings.
 *    Personal account password → the same (single users have no entity password).
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = String(decoded.userId);

    const body = (await request.json()) as { password?: string; adminSession?: boolean };

    // Admin panel (/admin/mub): the Super Admin already logged in there with his
    // username + password, and that login's token names his SuperAdmin row. No second
    // password prompt — but only an active Super Admin row qualifies.
    if (body.adminSession) {
      const superAdmin = await prisma.superAdmin.findFirst({
        where: { id: userId, isActive: true },
        select: { id: true },
      });
      if (!superAdmin) {
        return NextResponse.json(
          { error: 'Only the Super Admin can edit the Movesbook MUB from the admin panel' },
          { status: 403 },
        );
      }
      return NextResponse.json({ access: 'staff', ...issueMubUnlock(request, userId, 'staff') });
    }

    const password = body.password?.trim() ?? '';
    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const throttle = registerAttempt(userId);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSec) } },
      );
    }

    const staffAccess =
      (await verifyMubSuperAdminPassword(password)) ||
      ((await isMubStaffUser(userId)) &&
        (await verifySuperAdminPassword(password, verifyOptionsFromRequest(request))));
    if (staffAccess) {
      clearAttempts(userId);
      // Which Movesbook template opens is decided by the stored account type.
      const roleTemplate = await resolveImportRoleTemplate(userId);
      return NextResponse.json({
        access: 'staff',
        roleTemplate,
        ...issueMubUnlock(request, userId, 'staff'),
      });
    }

    const entity = await matchMubEntityAdminPassword(userId, password);
    if (entity) {
      clearAttempts(userId);
      return NextResponse.json({
        access: 'club',
        entityKind: entity.kind,
        entityId: entity.id,
        ...(entity.kind === 'club' ? { clubId: entity.id } : {}),
        ...issueMubUnlock(request, userId, 'club'),
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (user?.password && (await verifyPassword(password, user.password))) {
      clearAttempts(userId);
      return NextResponse.json({ access: 'user', ...issueMubUnlock(request, userId, 'user') });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
  } catch (error) {
    console.error('POST /api/mub/verify-access failed:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
