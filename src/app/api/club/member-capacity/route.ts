import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures';
import { computeClubMemberCapacityFromClub } from '@/lib/club/clubMemberCapacity';
import { getMemberRegistrationInfoForUser } from '@/lib/registration/memberRegistrationInfoService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const isTeam = auth.ctx.workspaceKind === 'team';
    const select = { id: true, description: true, createdAt: true } as const;
    const club = isTeam
      ? await prisma.team.findUnique({ where: { id: auth.ctx.club.id }, select })
      : await prisma.club.findUnique({ where: { id: auth.ctx.club.id }, select });

    if (!club) {
      return NextResponse.json({ error: isTeam ? 'Team not found' : 'Club not found' }, { status: 404 });
    }

    const membersAdded = isTeam
      ? await prisma.teamMember.count({ where: { teamId: auth.ctx.club.id } })
      : await prisma.clubMember.count({ where: { clubId: auth.ctx.club.id } });
    const registrationInfo = await getMemberRegistrationInfoForUser(auth.ctx.userId);

    const capacity = computeClubMemberCapacityFromClub({
      description: club.description,
      createdAt: club.createdAt,
      membersAdded,
      subscriptionSettingId: registrationInfo?.subscriptionSettingId ?? null,
    });

    return NextResponse.json({
      clubId: club.id,
      subscriptionSettingId: registrationInfo?.subscriptionSettingId ?? null,
      capacity,
    });
  } catch (error) {
    console.error('GET /api/club/member-capacity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
