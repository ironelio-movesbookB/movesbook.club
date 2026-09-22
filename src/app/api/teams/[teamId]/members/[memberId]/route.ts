import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/teams/[teamId]/members/[memberId]
 * Removes an athlete from the team (does not delete their Movesbook account).
 * `memberId` is the athlete user id.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string; memberId: string } },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const teamId = params.teamId;
    const athleteId = params.memberId;
    const team = await prisma.team.findFirst({
      where: { id: teamId, adminId: decoded.userId as string },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.json({ error: 'Team not found or access denied' }, { status: 404 });
    }

    const existing = await prisma.teamMember.findFirst({
      where: { teamId, athleteId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Member not found on this team' }, { status: 404 });
    }

    await prisma.teamMember.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/teams/[teamId]/members/[memberId]:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
