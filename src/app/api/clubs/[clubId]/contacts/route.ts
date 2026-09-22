import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  mergeClubContactsForSave,
  parseClubContacts,
} from '@/lib/club/clubContacts';
import { emptyTeamContacts } from '@/lib/team/teamProfileDefaults';
import type { TeamContacts } from '@/lib/team/teamProfileTypes';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

async function requireClubAdmin(clubId: string, userId: string) {
  const clubs = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM clubs_new WHERE id = ${clubId} LIMIT 1
  `;
  const club = clubs[0];
  if (!club || club.adminId !== userId) return null;
  return club;
}

function normalizeContactsBody(raw: unknown): TeamContacts {
  const base = emptyTeamContacts();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    website: typeof o.website === 'string' ? o.website : base.website,
    email: typeof o.email === 'string' ? o.email : base.email,
    pec: typeof o.pec === 'string' ? o.pec : base.pec,
    phone1: typeof o.phone1 === 'string' ? o.phone1 : base.phone1,
    phone2: typeof o.phone2 === 'string' ? o.phone2 : base.phone2,
    facebook: typeof o.facebook === 'string' ? o.facebook : base.facebook,
    instagram: typeof o.instagram === 'string' ? o.instagram : base.instagram,
    whatsapp: typeof o.whatsapp === 'string' ? o.whatsapp : base.whatsapp,
    telegram: typeof o.telegram === 'string' ? o.telegram : base.telegram,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const club = await requireClubAdmin(params.clubId, userId);
  if (!club) {
    return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
  }

  return NextResponse.json({
    clubId: club.id,
    clubName: club.name,
    contacts: parseClubContacts(club.description),
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

  const club = await requireClubAdmin(params.clubId, userId);
  if (!club) {
    return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const contacts = normalizeContactsBody(
    body && typeof body === 'object' && 'contacts' in (body as object)
      ? (body as { contacts: unknown }).contacts
      : body,
  );
  const description = mergeClubContactsForSave(club.description, contacts);

  await prisma.$executeRaw`
    UPDATE clubs_new SET description = ${description}, updatedAt = NOW(3) WHERE id = ${params.clubId}
  `;

  return NextResponse.json({
    success: true,
    contacts: parseClubContacts(description),
    message: 'Club info saved successfully.',
  });
}
