import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clearSpecialUpgradeCheck } from '@/lib/subscriptions/specialUpgrades';

export const dynamic = 'force-dynamic';

/** Double-click Check on Special Upgrade: Super Admin password clears the blocking deadline. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || '');
    const upgradeId = Number(body.upgradeId);
    const password = String(body.password || '');
    if (!userId || !Number.isFinite(upgradeId) || !password) {
      return NextResponse.json({ error: 'userId, upgradeId and password are required' }, { status: 400 });
    }

    const admin = await prisma.user.findFirst({
      where: { id: auth.userId },
      select: { password: true, userType: true },
    });
    // Super Admin may be in user table or separate store; prefer password on the authenticated admin.
    const hash = admin?.password;
    if (!hash || !(await verifyPassword(password, hash))) {
      // Fallback: allow if verifySuperAdminPassword style settings password matches via requireAdmin already.
      return NextResponse.json({ error: 'Invalid Super Admin password' }, { status: 403 });
    }

    const ok = await clearSpecialUpgradeCheck(userId, upgradeId);
    if (!ok) return NextResponse.json({ error: 'Check deadline not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('clear-upgrade-check', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
