import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ClubAuthContext } from './types';
import { isTeamAccountUserType } from '@/utils/dashboardRouting';

function isClubUserType(userType: string): boolean {
  return userType === 'CLUB' || userType === 'CLUB_TRAINER';
}

async function getOwnedClub(userId: string, requestedClubId: string | null) {
  if (requestedClubId) {
    const selected = await prisma.club.findFirst({
      where: { id: requestedClubId, adminId: userId },
      select: { id: true, name: true },
    });
    if (selected) return selected;
  }
  return prisma.club.findFirst({
    where: { adminId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  });
}

async function getOwnedTeam(userId: string, requestedTeamId: string | null) {
  if (requestedTeamId) {
    const selected = await prisma.team.findFirst({
      where: { id: requestedTeamId, adminId: userId },
      select: { id: true, name: true },
    });
    if (selected) return selected;
  }
  return prisma.team.findFirst({
    where: { adminId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  });
}

/**
 * Auth for club procedure/archive APIs.
 * Club admins resolve via `clubId`; Team admins resolve via `teamId` (Archive of Users).
 */
export async function getClubAuthContext(
  request: NextRequest
): Promise<{ ctx: ClubAuthContext } | { error: NextResponse }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId || !decoded.userType) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const userId = String(decoded.userId);
  const userType = String(decoded.userType);
  const sp = request.nextUrl.searchParams;
  const requestedClubId = sp.get('clubId');
  // Team workspace reuses `selectedClub` / `clubId` in clients; also accept `teamId`.
  const requestedTeamId = sp.get('teamId') || (isTeamAccountUserType(userType) ? requestedClubId : null);

  if (isTeamAccountUserType(userType)) {
    const team = await getOwnedTeam(userId, requestedTeamId);
    if (!team) {
      return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
    }
    return {
      ctx: {
        userId,
        club: { id: team.id, name: team.name },
        workspaceKind: 'team',
      },
    };
  }

  if (!isClubUserType(userType)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const club = await getOwnedClub(userId, requestedClubId);

  if (!club) {
    return { error: NextResponse.json({ error: 'Club not found' }, { status: 404 }) };
  }

  return { ctx: { userId, club, workspaceKind: 'club' } };
}
