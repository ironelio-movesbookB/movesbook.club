import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { isClubCreatedFromForm } from '@/lib/club/clubSidebarLabel';
import type { ManagedEntityKind } from '@/lib/entity/entityProfileLabels';

export const dynamic = 'force-dynamic';

type MyCompanyRow = {
  id: string;
  name: string;
  description: string | null;
  kind: ManagedEntityKind;
};

function ownedRows(
  rows: { id: string; name: string; description: string | null }[],
  kind: ManagedEntityKind,
): MyCompanyRow[] {
  return rows.filter(isClubCreatedFromForm).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    kind,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

    const [
      clubs,
      teams,
      groups,
      trained,
      clubMemberships,
      teamMemberships,
      groupMemberships,
      trainedMemberships,
    ] = await Promise.all([
      prisma.club.findMany({
        where: { adminId: userId },
        select: { id: true, name: true, description: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.team.findMany({
        where: { adminId: userId },
        select: { id: true, name: true, description: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.group.findMany({
        where: { adminId: userId },
        select: { id: true, name: true, description: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.coachingGroup.findMany({
        where: { coachId: userId },
        select: { id: true, name: true, description: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubMember.findMany({
        where: { memberId: userId },
        select: { club: { select: { id: true, name: true, description: true } } },
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.teamMember.findMany({
        where: { athleteId: userId },
        select: { team: { select: { id: true, name: true, description: true } } },
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.groupMember.findMany({
        where: { userId },
        select: { group: { select: { id: true, name: true, description: true } } },
        orderBy: { joinedAt: 'desc' },
      }),
      prisma.coachingGroupMember.findMany({
        where: { athleteId: userId },
        select: {
          coachingGroup: { select: { id: true, name: true, description: true } },
        },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);

    const owned: MyCompanyRow[] = [
      ...ownedRows(clubs, 'club'),
      ...ownedRows(teams, 'team'),
      ...ownedRows(groups, 'group'),
      ...ownedRows(trained, 'coaching-group'),
    ];

    const memberships: MyCompanyRow[] = [
      ...clubMemberships.map((row) => ({ ...row.club, kind: 'club' as const })),
      ...teamMemberships.map((row) => ({ ...row.team, kind: 'team' as const })),
      ...groupMemberships.map((row) => ({ ...row.group, kind: 'group' as const })),
      ...trainedMemberships.map((row) => ({
        ...row.coachingGroup,
        kind: 'coaching-group' as const,
      })),
    ];

    return NextResponse.json({ owned, memberships });
  } catch (error) {
    console.error('GET /api/my-companies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
