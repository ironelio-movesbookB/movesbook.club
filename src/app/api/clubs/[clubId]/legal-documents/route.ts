import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  getClubLegalDocuments,
  type ClubLegalDocuments,
} from '@/lib/club/clubLegalDocuments';
import {
  CLUB_DOCUMENT_MAX_LENGTH,
  saveEntityLegalDocuments,
  type ClubDocumentsWorkspaceKind,
} from '@/lib/club/clubDocuments';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

type EntityAccess = {
  ok: boolean;
  isAdmin: boolean;
  kind: ClubDocumentsWorkspaceKind;
  clubName: string;
  description: string | null;
};

const DENIED: EntityAccess = { ok: false, isAdmin: false, kind: 'club', clubName: '', description: null };

/** `clubId` may be a club id or a team id (team member profiles pass the team id). */
async function canAccessEntity(entityId: string, userId: string): Promise<EntityAccess> {
  const clubs = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM clubs_new WHERE id = ${entityId} LIMIT 1
  `;
  const club = clubs[0];
  if (club) {
    const base = { kind: 'club' as const, clubName: club.name, description: club.description };
    if (club.adminId === userId) return { ok: true, isAdmin: true, ...base };
    const member = await prisma.clubMember.findFirst({
      where: { clubId: entityId, memberId: userId },
      select: { id: true },
    });
    return member ? { ok: true, isAdmin: false, ...base } : DENIED;
  }

  const teams = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM teams_new WHERE id = ${entityId} LIMIT 1
  `;
  const team = teams[0];
  if (!team) return DENIED;
  const base = { kind: 'team' as const, clubName: team.name, description: team.description };
  if (team.adminId === userId) return { ok: true, isAdmin: true, ...base };
  const member = await prisma.teamMember.findFirst({
    where: { teamId: entityId, athleteId: userId },
    select: { id: true },
  });
  return member ? { ok: true, isAdmin: false, ...base } : DENIED;
}

/** Club / team admin or member: read Rules / Private policy HTML. */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessEntity(params.clubId, userId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
  }

  const documents = getClubLegalDocuments(access.description);
  return NextResponse.json({
    clubId: params.clubId,
    clubName: access.clubName,
    workspaceKind: access.kind,
    canEdit: access.isAdmin,
    documents,
  });
}

/** Club / team admin: save Rules / Private policy HTML (Documents Editor). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessEntity(params.clubId, userId);
  if (!access.ok || !access.isAdmin) {
    return NextResponse.json({ error: 'Only the club admin can edit documents' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const incoming = (body || {}) as { documents?: Partial<ClubLegalDocuments> };
  const current = getClubLegalDocuments(access.description);
  const next: ClubLegalDocuments = {
    rulesHtml:
      typeof incoming.documents?.rulesHtml === 'string'
        ? incoming.documents.rulesHtml
        : current.rulesHtml,
    privacyPolicyHtml:
      typeof incoming.documents?.privacyPolicyHtml === 'string'
        ? incoming.documents.privacyPolicyHtml
        : current.privacyPolicyHtml,
  };
  if (next.rulesHtml.length > CLUB_DOCUMENT_MAX_LENGTH || next.privacyPolicyHtml.length > CLUB_DOCUMENT_MAX_LENGTH) {
    return NextResponse.json({ error: 'Document is too long' }, { status: 400 });
  }

  const documents = await saveEntityLegalDocuments(access.kind, params.clubId, next);
  return NextResponse.json({ success: true, documents });
}
