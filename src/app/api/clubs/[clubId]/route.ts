import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { findClubByCompanyUsername, hashClubCompanyPassword } from '@/lib/club/clubDirectLogin';
import {
  mergeClubDescriptionForSave,
  type ClubProfileFormPayload,
} from '@/lib/club/clubProfilePayload';
import {
  isTeamProfilePayload,
  mergeTeamDescriptionForSave,
} from '@/lib/team/teamProfilePayload';
import type { TeamProfileFormPayload } from '@/lib/team/teamProfileTypes';

export const dynamic = 'force-dynamic';

function isClubProfilePatch(body: Record<string, unknown>): boolean {
  return [
    'username',
    'officialName',
    'category',
    'sports',
    'country',
    'region',
    'province',
    'location',
    'zipCode',
    'address',
    'geo',
    'mail',
    'phone',
    'website',
    'logoUrl',
    'directAccess',
    'directRegistrationCode',
    'clubPassword',
    'referencesHtml',
    'referencesLevel',
  ].some((k) => k in body);
}

async function assertClubOwner(clubId: string, userId: string): Promise<boolean> {
  const ownerCheck = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) AS c FROM clubs_new WHERE id = ${clubId} AND adminId = ${userId}
  `;
  return Number(ownerCheck[0]?.c ?? 0) > 0;
}

/**
 * Club admin: update club profile fields or members' dashboard YouTube URL.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clubId: string } },
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

    const userId = decoded.userId as string;
    const clubId = params.clubId;
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await assertClubOwner(clubId, userId))) {
      return NextResponse.json(
        { error: 'Club not found or access denied' },
        { status: 404 },
      );
    }

    if (isTeamProfilePayload(body)) {
      const payload = body as unknown as TeamProfileFormPayload;
      const clubUsername = String(payload.username ?? '').trim();
      const clubDirectAccess = String(payload.directAccess ?? '').trim();
      if (!clubUsername || !clubDirectAccess) {
        return NextResponse.json(
          { error: 'Username and Direct Access are required' },
          { status: 400 },
        );
      }

      const existingClubs = await prisma.$queryRaw<
        { id: string; adminId: string; description: string | null }[]
      >`
        SELECT id, adminId, description
        FROM clubs_new
        WHERE description IS NOT NULL
      `;
      const duplicate = findClubByCompanyUsername(existingClubs, clubUsername);
      if (duplicate && duplicate.clubId !== clubId) {
        return NextResponse.json(
          { error: 'This club/team username is already in use' },
          { status: 409 },
        );
      }

      const currentRows = await prisma.$queryRaw<
        { description: string | null; location: string | null }[]
      >`
        SELECT description, location FROM clubs_new WHERE id = ${clubId} LIMIT 1
      `;
      const current = currentRows[0];
      if (!current) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      let clubPasswordHash: string | undefined;
      const newPassword = String(payload.teamPassword ?? '').trim();
      if (newPassword) {
        clubPasswordHash = await hashClubCompanyPassword(newPassword);
      }

      const clubName =
        String(payload.officialName ?? '').trim() || clubUsername || 'Club';
      const location =
        String(payload.legalSite?.location ?? '').trim() || current.location || null;
      const description = mergeTeamDescriptionForSave(current.description, payload, {
        clubPasswordHash,
      });

      await prisma.$executeRaw`
        UPDATE clubs_new
        SET name = ${clubName},
            description = ${description},
            location = ${location},
            updatedAt = NOW(3)
        WHERE id = ${clubId} AND adminId = ${userId}
      `;
    } else if (isClubProfilePatch(body)) {
      const payload = body as unknown as ClubProfileFormPayload;
      const clubUsername = String(payload.username ?? '').trim();
      const clubDirectAccess = String(payload.directAccess ?? '').trim();
      if (!clubUsername || !clubDirectAccess) {
        return NextResponse.json(
          { error: 'Club username and Direct Access are required' },
          { status: 400 },
        );
      }

      const existingClubs = await prisma.$queryRaw<
        { id: string; adminId: string; description: string | null }[]
      >`
        SELECT id, adminId, description
        FROM clubs_new
        WHERE description IS NOT NULL
      `;
      const duplicate = findClubByCompanyUsername(existingClubs, clubUsername);
      if (duplicate && duplicate.clubId !== clubId) {
        return NextResponse.json(
          { error: 'This club username is already in use' },
          { status: 409 },
        );
      }

      const currentRows = await prisma.$queryRaw<
        { description: string | null; location: string | null }[]
      >`
        SELECT description, location FROM clubs_new WHERE id = ${clubId} LIMIT 1
      `;
      const current = currentRows[0];
      if (!current) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }

      let clubPasswordHash: string | undefined;
      const newPassword = String(payload.clubPassword ?? '').trim();
      if (newPassword) {
        clubPasswordHash = await hashClubCompanyPassword(newPassword);
      }

      const clubName =
        String(payload.officialName ?? '').trim() ||
        clubUsername ||
        'Club';
      const location = String(payload.location ?? '').trim() || null;
      const description = mergeClubDescriptionForSave(current.description, {
        username: clubUsername,
        category: String(payload.category ?? ''),
        sports: Array.isArray(payload.sports)
          ? payload.sports.map((s: unknown) => String(s))
          : String(payload.category ?? '')
            ? [String(payload.category)]
            : [],
        country: String(payload.country ?? ''),
        region: String(payload.region ?? ''),
        province: String(payload.province ?? ''),
        location: String(payload.location ?? ''),
        zipCode: String(payload.zipCode ?? ''),
        address: String(payload.address ?? ''),
        geo: String(payload.geo ?? ''),
        mail: String(payload.mail ?? ''),
        phone: String(payload.phone ?? ''),
        website: String(payload.website ?? ''),
        logoUrl: String(payload.logoUrl ?? ''),
        bannerUrl: String(payload.bannerUrl ?? ''),
        directAccess: clubDirectAccess,
        officialName: clubName,
        directRegistrationCode: String(payload.directRegistrationCode ?? ''),
        clubPassword: newPassword,
        referencesHtml: String(payload.referencesHtml ?? ''),
        referencesLevel: String(payload.referencesLevel ?? '1'),
      }, { clubPasswordHash });

      await prisma.$executeRaw`
        UPDATE clubs_new
        SET name = ${clubName},
            description = ${description},
            location = ${location},
            updatedAt = NOW(3)
        WHERE id = ${clubId} AND adminId = ${userId}
      `;
    } else if ('youtubeChannelUrl' in body) {
      const v = body.youtubeChannelUrl;
      const nextUrl =
        v === null || v === undefined || String(v).trim() === ''
          ? null
          : String(v).trim();

      await prisma.$executeRaw`
        UPDATE clubs_new
        SET youtubeChannelUrl = ${nextUrl},
            updatedAt = NOW(3)
        WHERE id = ${clubId} AND adminId = ${userId}
      `;
    } else {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
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
      WHERE id = ${clubId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json({
      club: {
        id: row.id,
        name: row.name,
        description: row.description,
        location: row.location,
        youtubeChannelUrl: row.youtubeChannelUrl,
      },
    });
  } catch (e) {
    console.error('PATCH /api/clubs/[clubId]:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
