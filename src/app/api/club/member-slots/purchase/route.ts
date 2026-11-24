import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures';
import { purchaseAvailableMemberSlots } from '@/lib/club/clubMemberRenameQuota.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/club/member-slots/purchase
 * Body: { slots: number }
 * Adds slots to Total available slots and increases rename allowance A by floor(10% × slots).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const slots = Number((body as { slots?: unknown })?.slots);
    const isTeam = auth.ctx.workspaceKind === 'team';
    const result = await purchaseAvailableMemberSlots(prisma, {
      kind: isTeam ? 'team' : 'club',
      id: auth.ctx.club.id,
      slots,
      viewerUserId: auth.ctx.userId,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      clubId: auth.ctx.club.id,
      ...result,
    });
  } catch (error) {
    console.error('POST /api/club/member-slots/purchase:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
