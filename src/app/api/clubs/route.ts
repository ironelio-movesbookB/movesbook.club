import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { defaultClubSubscriptionEndDate } from '@/lib/admin/clubSubscriptionStatus';
import {
  findClubByCompanyUsername,
  hashClubCompanyPassword,
} from '@/lib/club/clubDirectLogin';
import { getClubCreatableCompaniesQuota } from '@/lib/club/creatableCompaniesQuota';

export const dynamic = 'force-dynamic';

function isClubAdminUserType(userType: string): boolean {
  return userType === 'CLUB' || userType === 'CLUB_TRAINER';
}

type CreateClubBody = {
  create?: boolean;
  username?: string;
  officialName?: string;
  category?: string;
  sports?: string[];
  country?: string;
  region?: string;
  province?: string;
  location?: string;
  zipCode?: string;
  address?: string;
  geo?: string;
  mail?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  directAccess?: string;
  directRegistrationCode?: string;
  clubPassword?: string;
};

function isExplicitClubCreate(body: CreateClubBody | null): boolean {
  if (!body || typeof body !== 'object') return false;
  if (body.create === true) return true;
  return Boolean(
    String(body.officialName ?? '').trim() ||
      String(body.username ?? '').trim()
  );
}

function buildClubDescription(body: CreateClubBody, clubPasswordHash?: string): string | null {
  const sports =
    Array.isArray(body.sports) && body.sports.length > 0
      ? body.sports.map(String).filter(Boolean)
      : body.category?.trim()
        ? [body.category.trim()]
        : undefined;
  const meta = {
    createdViaForm: true,
    subscriptionEnd: defaultClubSubscriptionEndDate(),
    username: body.username?.trim() || undefined,
    category: (sports?.[0] || body.category?.trim()) || undefined,
    sports,
    country: body.country?.trim() || undefined,
    region: body.region?.trim() || undefined,
    province: body.province?.trim() || undefined,
    zipCode: body.zipCode?.trim() || undefined,
    address: body.address?.trim() || undefined,
    geo: body.geo?.trim() || undefined,
    mail: body.mail?.trim() || undefined,
    phone: body.phone?.trim() || undefined,
    website: body.website?.trim() || undefined,
    logoUrl: body.logoUrl?.trim() || undefined,
    directAccess: body.directAccess?.trim() || undefined,
    directRegistrationCode: body.directRegistrationCode?.trim() || undefined,
    clubPasswordHash: clubPasswordHash || undefined,
  };
  const hasMeta = Object.values(meta).some(Boolean);
  return hasMeta ? JSON.stringify(meta) : null;
}

/**
 * Create a default club row for the current user when they own none yet
 * (e.g. CLUB account with empty `clubs_new`), or create from the club form payload.
 */
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

    if (!isClubAdminUserType(String(decoded.userType))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = decoded.userId as string;

    let body: CreateClubBody | null = null;
    try {
      body = (await request.json()) as CreateClubBody;
    } catch {
      body = null;
    }

    if (isExplicitClubCreate(body)) {
      const quota = await getClubCreatableCompaniesQuota(userId, String(decoded.userType));
      if (quota && !quota.canCreate) {
        return NextResponse.json(
          {
            error: `You cannot create more companies. Limit: ${quota.limit}, already created: ${quota.created}.`,
          },
          { status: 403 },
        );
      }

      const clubUsername = String(body!.username ?? '').trim();
      if (!clubUsername) {
        return NextResponse.json({ error: 'Club username is required' }, { status: 400 });
      }
      const clubPassword = String(body!.clubPassword ?? '').trim();
      if (!clubPassword) {
        return NextResponse.json({ error: 'My Club password is required' }, { status: 400 });
      }

      const existingClubs = await prisma.$queryRaw<
        { id: string; adminId: string; description: string | null }[]
      >`
        SELECT id, adminId, description
        FROM clubs_new
        WHERE description IS NOT NULL
      `;
      if (findClubByCompanyUsername(existingClubs, clubUsername)) {
        return NextResponse.json(
          { error: 'This club username is already in use' },
          { status: 409 },
        );
      }

      const clubName =
        String(body!.officialName ?? '').trim() ||
        clubUsername ||
        'New Club';
      const location = String(body!.location ?? '').trim() || null;
      const clubPasswordHash = await hashClubCompanyPassword(clubPassword);
      const description = buildClubDescription(body!, clubPasswordHash);
      const id = randomUUID();

      await prisma.$executeRaw`
        INSERT INTO clubs_new (id, adminId, name, description, location, youtubeChannelUrl, createdAt, updatedAt)
        VALUES (${id}, ${userId}, ${clubName}, ${description}, ${location}, NULL, NOW(3), NOW(3))
      `;

      const created = await prisma.$queryRaw<
        {
          id: string;
          name: string;
          description: string | null;
          location: string | null;
          youtubeChannelUrl: string | null;
        }[]
      >`
        SELECT id, name, description, location, youtubeChannelUrl
        FROM clubs_new
        WHERE id = ${id}
        LIMIT 1
      `;
      const row = created[0];
      if (!row) {
        return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
      }

      return NextResponse.json({
        club: {
          id: row.id,
          name: row.name,
          description: row.description,
          location: row.location,
          youtubeChannelUrl: row.youtubeChannelUrl,
        },
        created: true,
      });
    }

    const existing = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        description: string | null;
        location: string | null;
        youtubeChannelUrl: string | null;
      }[]
    >`
      SELECT id, name, description, location, youtubeChannelUrl
      FROM clubs_new
      WHERE adminId = ${userId}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    if (existing[0]) {
      const row = existing[0];
      return NextResponse.json({
        club: {
          id: row.id,
          name: row.name,
          description: row.description,
          location: row.location,
          youtubeChannelUrl: row.youtubeChannelUrl
        },
        created: false
      });
    }

    const nameRows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM users_new WHERE id = ${userId} LIMIT 1
    `;
    const nameBase = (nameRows[0]?.name ?? 'Club').trim() || 'Club';
    const clubName = `${nameBase} club`;
    const id = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO clubs_new (id, adminId, name, description, location, youtubeChannelUrl, createdAt, updatedAt)
      VALUES (${id}, ${userId}, ${clubName}, NULL, NULL, NULL, NOW(3), NOW(3))
    `;

    const created = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        description: string | null;
        location: string | null;
        youtubeChannelUrl: string | null;
      }[]
    >`
      SELECT id, name, description, location, youtubeChannelUrl
      FROM clubs_new
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = created[0];
    if (!row) {
      return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
    }

    return NextResponse.json({
      club: {
        id: row.id,
        name: row.name,
        description: row.description,
        location: row.location,
        youtubeChannelUrl: row.youtubeChannelUrl
      },
      created: true
    });
  } catch (e) {
    console.error('POST /api/clubs:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
