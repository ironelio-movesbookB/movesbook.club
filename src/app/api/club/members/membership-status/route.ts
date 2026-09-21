import { NextRequest, NextResponse } from 'next/server';
import { getClubAuthContext } from '@/lib/procedures';
import { prisma } from '@/lib/prisma';
import {
  isMemberArchiveStatus,
  roleValueForMemberArchiveStatus,
  type MemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';

export const dynamic = 'force-dynamic';

/**
 * PATCH body: { membershipStatus: 'member' | 'pending' | 'not_member' | 'archived' }
 * Updates ClubMember.role / TeamMember.role for Archive of Users buckets.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const memberId = String(body.memberId ?? '').trim();
    const statusRaw = String(body.membershipStatus ?? '').trim();

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
    }
    if (!isMemberArchiveStatus(statusRaw)) {
      return NextResponse.json(
        {
          error:
            'membershipStatus must be member, pending, not_member, or archived',
        },
        { status: 400 },
      );
    }
    const membershipStatus = statusRaw as MemberArchiveStatus;
    const role = roleValueForMemberArchiveStatus(membershipStatus);
    const workspaceId = auth.ctx.club.id;

    if (auth.ctx.workspaceKind === 'team') {
      const existing = await prisma.teamMember.findFirst({
        where: { teamId: workspaceId, athleteId: memberId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
      }
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { role },
      });
    } else {
      const existing = await prisma.clubMember.findFirst({
        where: { clubId: workspaceId, memberId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Club member not found' }, { status: 404 });
      }
      await prisma.clubMember.update({
        where: { id: existing.id },
        data: { role },
      });
    }

    return NextResponse.json({ ok: true, memberId, membershipStatus });
  } catch (error) {
    console.error('PATCH /api/club/members/membership-status:', error);
    return NextResponse.json({ error: 'Failed to update membership status' }, { status: 500 });
  }
}
