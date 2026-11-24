import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { findEntityByCompanyUsername } from '@/lib/entity/findEntityByUsername';
import {
  buildEntityDescriptionFromBody,
  isExplicitEntityCreate,
  type CreateEntityBody,
} from '@/lib/entity/createEntityFromFormBody';
import type { EntityProfileFormPayload } from '@/lib/entity/entityForm';
import {
  companyLimitReachedMessage,
  getCreatableCompaniesQuota,
} from '@/lib/club/creatableCompaniesQuota';

export const dynamic = 'force-dynamic';

function isGroupAdminUserType(userType: string): boolean {
  return userType === 'GROUP' || userType === 'GROUP_ADMIN';
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

    if (!isGroupAdminUserType(String(decoded.userType))) {
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
        { error: 'Use create: true with group profile fields' },
        { status: 400 },
      );
    }

    const quota = await getCreatableCompaniesQuota(userId, String(decoded.userType));
    if (quota && !quota.canCreate) {
      return NextResponse.json({ error: companyLimitReachedMessage(quota) }, { status: 403 });
    }

    const payload = body as EntityProfileFormPayload;
    const groupUsername = String(payload.username ?? '').trim();
    if (!groupUsername) {
      return NextResponse.json({ error: 'Group username is required' }, { status: 400 });
    }
    const groupPassword = String(payload.clubPassword ?? '').trim();
    if (!groupPassword) {
      return NextResponse.json({ error: 'Group password is required' }, { status: 400 });
    }

    const existing = await prisma.group.findMany({
      where: { description: { not: null } },
      select: { description: true },
    });
    if (findEntityByCompanyUsername(existing, groupUsername)) {
      return NextResponse.json(
        { error: 'This group username is already in use' },
        { status: 409 },
      );
    }

    const name =
      String(payload.officialName ?? '').trim() || groupUsername || 'New Group';
    const description = await buildEntityDescriptionFromBody(payload);
    const groupType = String(payload.category ?? '').trim() || null;

    const created = await prisma.group.create({
      data: {
        adminId: userId,
        name,
        description,
        groupType,
      },
      select: {
        id: true,
        name: true,
        description: true,
        groupType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      group: created,
      created: true,
    });
  } catch (e) {
    console.error('POST /api/groups:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
