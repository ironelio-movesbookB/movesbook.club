import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { findEntityIdByCompanyUsername } from '@/lib/entity/patchEntityProfile';
import {
  buildEntityDescriptionFromBody,
  buildTeamDescriptionFromBody,
  isExplicitEntityCreate,
  type CreateEntityBody,
} from '@/lib/entity/createEntityFromFormBody';
import type { EntityProfileFormPayload } from '@/lib/entity/entityForm';
import { isTeamProfilePayload } from '@/lib/team/teamProfilePayload';
import type { TeamProfileFormPayload } from '@/lib/team/teamProfileTypes';
import {
  companyLimitReachedMessage,
  getCreatableCompaniesQuota,
} from '@/lib/club/creatableCompaniesQuota';

export const dynamic = 'force-dynamic';

function isTeamAdminUserType(userType: string): boolean {
  return userType === 'TEAM' || userType === 'TEAM_MANAGER';
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId || !decoded.userType) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!isTeamAdminUserType(String(decoded.userType))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = decoded.userId as string;

    let body: CreateEntityBody | null = null;
    try {
      body = (await request.json()) as CreateEntityBody;
    } catch {
      body = null;
    }

    if (!isExplicitEntityCreate(body)) {
      return NextResponse.json(
        { error: 'Use create: true with team profile fields' },
        { status: 400 },
      );
    }

    const quota = await getCreatableCompaniesQuota(userId, String(decoded.userType));
    if (quota && !quota.canCreate) {
      return NextResponse.json({ error: companyLimitReachedMessage(quota) }, { status: 403 });
    }

    const existing = await prisma.team.findMany({
      where: { description: { not: null } },
      select: { id: true, description: true },
    });

    if (isTeamProfilePayload(body as Record<string, unknown>)) {
      const payload = body as TeamProfileFormPayload;
      const teamUsername = String(payload.username ?? '').trim();
      if (!teamUsername) {
        return NextResponse.json({ error: 'Team username is required' }, { status: 400 });
      }
      const teamPassword = String(payload.teamPassword ?? '').trim();
      if (!teamPassword) {
        return NextResponse.json({ error: 'Team password is required' }, { status: 400 });
      }

      if (findEntityIdByCompanyUsername(existing, teamUsername)) {
        return NextResponse.json(
          { error: 'This team username is already in use' },
          { status: 409 },
        );
      }

      const name =
        String(payload.officialName ?? '').trim() || teamUsername || 'New Team';
      const description = await buildTeamDescriptionFromBody(payload);
      const sport = String(payload.sport ?? '').trim() || null;

      const created = await prisma.team.create({
        data: {
          adminId: userId,
          name,
          description,
          sport,
        },
        select: {
          id: true,
          name: true,
          description: true,
          sport: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        team: created,
        created: true,
      });
    }

    const payload = body as EntityProfileFormPayload;
    const teamUsername = String(payload.username ?? '').trim();
    if (!teamUsername) {
      return NextResponse.json({ error: 'Team username is required' }, { status: 400 });
    }
    const teamPassword = String(payload.clubPassword ?? '').trim();
    if (!teamPassword) {
      return NextResponse.json({ error: 'Team password is required' }, { status: 400 });
    }

    if (findEntityIdByCompanyUsername(existing, teamUsername)) {
      return NextResponse.json(
        { error: 'This team username is already in use' },
        { status: 409 },
      );
    }

    const name =
      String(payload.officialName ?? '').trim() || teamUsername || 'New Team';
    const description = await buildEntityDescriptionFromBody(payload);
    const sport = String(payload.category ?? '').trim() || null;

    const created = await prisma.team.create({
      data: {
        adminId: userId,
        name,
        description,
        sport,
      },
      select: {
        id: true,
        name: true,
        description: true,
        sport: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      team: created,
      created: true,
    });
  } catch (e) {
    console.error('POST /api/teams:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
