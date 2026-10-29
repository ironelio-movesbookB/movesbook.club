import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTeamAccountUserType, canAccessClubWorkspace } from '@/utils/dashboardRouting';

export type ShopWorkspace = {
  userId: string;
  userType: string;
  kind: 'club' | 'team';
  id: string;
  name: string;
  /** Club or team owner. Used as the operator on archive rows. */
  adminId: string;
  canManage: boolean;
};

export type ShopAccess = {
  userId: string;
  userType: string;
  workspace: ShopWorkspace | null;
  memberShops: { slug: string; name: string }[];
};

function displayName(name: string, firstName?: string | null, surname?: string | null) {
  const person = [firstName, surname].filter(Boolean).join(' ').trim();
  return person || name;
}

async function memberShopLinks(userId: string) {
  const [clubs, teams] = await Promise.all([
    prisma.clubMember.findMany({
      where: { memberId: userId },
      select: { club: { select: { id: true, name: true } } },
    }),
    prisma.teamMember.findMany({
      where: { athleteId: userId },
      select: { team: { select: { id: true, name: true } } },
    }),
  ]);

  const keys = [
    ...clubs.map((row) => ({ kind: 'club' as const, id: row.club.id, name: row.club.name })),
    ...teams.map((row) => ({ kind: 'team' as const, id: row.team.id, name: row.team.name })),
  ];
  if (keys.length === 0) return [];

  const settings = await prisma.shopSettings.findMany({
    where: {
      OR: keys.map((key) => ({ workspaceKind: key.kind, workspaceId: key.id })),
    },
    select: { workspaceKind: true, workspaceId: true, slug: true, displayName: true, shopActive: true },
  });

  return settings
    .filter((row) => row.shopActive)
    .map((row) => {
      const org = keys.find((key) => key.kind === row.workspaceKind && key.id === row.workspaceId);
      return { slug: row.slug, name: row.displayName?.trim() || org?.name || 'Shop' };
    });
}

async function resolveManagedWorkspace(
  userId: string,
  userType: string,
): Promise<ShopWorkspace | null> {
  if (isTeamAccountUserType(userType)) {
    const team = await prisma.team.findFirst({
      where: { adminId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, adminId: true },
    });
    if (!team) return null;
    return {
      userId,
      userType,
      kind: 'team',
      id: team.id,
      name: team.name,
      adminId: team.adminId,
      canManage: true,
    };
  }

  if (userType === 'CLUB' || userType === 'CLUB_TRAINER') {
    const club = await prisma.club.findFirst({
      where: { adminId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, adminId: true },
    });
    if (!club) return null;
    return {
      userId,
      userType,
      kind: 'club',
      id: club.id,
      name: club.name,
      adminId: club.adminId,
      canManage: true,
    };
  }

  if (canAccessClubWorkspace(userType)) {
    const staff = await prisma.clubStaff.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { club: { select: { id: true, name: true, adminId: true } } },
    });
    if (!staff) return null;
    return {
      userId,
      userType,
      kind: 'club',
      id: staff.club.id,
      name: staff.club.name,
      adminId: staff.club.adminId,
      canManage: true,
    };
  }

  return null;
}

export async function getShopAccess(request: NextRequest): Promise<
  { access: ShopAccess } | { error: NextResponse }
> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const decoded = verifyToken(token);
  if (!decoded?.userId || !decoded.userType) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const userId = String(decoded.userId);
  const userType = String(decoded.userType);
  const workspace = await resolveManagedWorkspace(userId, userType);
  const memberShops = workspace ? [] : await memberShopLinks(userId);
  return { access: { userId, userType, workspace, memberShops } };
}

export async function requireShopManager(request: NextRequest): Promise<
  { workspace: ShopWorkspace } | { error: NextResponse }
> {
  const result = await getShopAccess(request);
  if ('error' in result) return result;
  if (!result.access.workspace?.canManage) {
    return { error: NextResponse.json({ error: 'Only a club or team can manage the shop.' }, { status: 403 }) };
  }
  return { workspace: result.access.workspace };
}

export function personName(
  user: { name: string; firstName?: string | null; surname?: string | null },
) {
  return displayName(user.name, user.firstName, user.surname);
}
