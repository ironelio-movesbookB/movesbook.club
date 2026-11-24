import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  verifyOptionsFromRequest,
  verifySuperAdminPassword,
} from '@/lib/messages/verifySuperAdminPassword';
import { verifyClubCompanyPassword } from '@/lib/club/clubDirectLogin';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { isMubStaffUser } from '@/lib/mub/mubApiHelpers';

export const dynamic = 'force-dynamic';

/**
 * Throttle password attempts per account. Without this the endpoint is an oracle:
 * it tests a submitted password against staff and club credentials and reports
 * which one matched.
 */
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function registerAttempt(userId: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
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
 * Gear password gate:
 * - Movesbook staff account + Super Admin password → staff templates
 * - Club Admin (club entity "My Password") for a club this user admins → unlock user MUB settings
 * - Personal account password (fallback) → unlock user MUB settings
 *
 * The staff branch requires the caller to already BE staff. Checking only the
 * password would let any account in via the shared super-admin fallback credential.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = String(decoded.userId);

    const body = (await request.json()) as { password?: string };
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

    if (
      (await isMubStaffUser(userId)) &&
      (await verifySuperAdminPassword(password, verifyOptionsFromRequest(request)))
    ) {
      clearAttempts(userId);
      return NextResponse.json({ access: 'staff' });
    }

    const clubs = await prisma.club.findMany({
      where: { adminId: userId },
      select: { id: true, description: true },
    });
    for (const club of clubs) {
      const hash = parseClubDescriptionMeta(club.description).clubPasswordHash;
      if (await verifyClubCompanyPassword(password, hash)) {
        clearAttempts(userId);
        return NextResponse.json({ access: 'club', clubId: club.id });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (user?.password && (await verifyPassword(password, user.password))) {
      clearAttempts(userId);
      return NextResponse.json({ access: 'user' });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
  } catch (error) {
    console.error('POST /api/mub/verify-access failed:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
