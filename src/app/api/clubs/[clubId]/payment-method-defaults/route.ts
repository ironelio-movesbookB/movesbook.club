import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  getClubDefaultPaymentMethods,
  mergeClubDefaultPaymentMethodsForSave,
} from '@/lib/club/clubPaymentMethodDefaults';
import { sanitizeDefaultPaymentMethods } from '@/lib/procedures/payModes';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

type Owner = { id: string; name: string; adminId: string; description: string | null };

/** The [clubId] segment may also carry a team id; teams keep the same description meta. */
async function loadClub(clubId: string): Promise<(Owner & { kind: 'club' | 'team' }) | null> {
  const clubs = await prisma.$queryRaw<Owner[]>`
    SELECT id, name, adminId, description FROM clubs_new WHERE id = ${clubId} LIMIT 1
  `;
  if (clubs[0]) return { ...clubs[0], kind: 'club' };
  const teams = await prisma.$queryRaw<Owner[]>`
    SELECT id, name, adminId, description FROM teams_new WHERE id = ${clubId} LIMIT 1
  `;
  return teams[0] ? { ...teams[0], kind: 'team' } : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const club = await loadClub(params.clubId);
  if (!club) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 });
  }

  const isAdmin = club.adminId === userId;
  const isMember = Boolean(
    club.kind === 'team'
      ? await prisma.teamMember.findFirst({
          where: { teamId: params.clubId, athleteId: userId },
          select: { id: true },
        })
      : await prisma.clubMember.findFirst({
          where: { clubId: params.clubId, memberId: userId },
          select: { id: true },
        }),
  );
  if (!isAdmin && !isMember) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({
    clubId: params.clubId,
    canEdit: isAdmin,
    defaultPaymentMethods: getClubDefaultPaymentMethods(club.description),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const club = await loadClub(params.clubId);
  if (!club || club.adminId !== userId) {
    return NextResponse.json(
      { error: 'Only the club/team admin can edit default payment methods' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const methods = sanitizeDefaultPaymentMethods(
    (body as { defaultPaymentMethods?: unknown })?.defaultPaymentMethods,
  );
  const description = mergeClubDefaultPaymentMethodsForSave(club.description, methods);
  if (club.kind === 'team') {
    await prisma.$executeRaw`
      UPDATE teams_new SET description = ${description} WHERE id = ${params.clubId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE clubs_new SET description = ${description} WHERE id = ${params.clubId}
    `;
  }

  return NextResponse.json({ success: true, defaultPaymentMethods: methods });
}
