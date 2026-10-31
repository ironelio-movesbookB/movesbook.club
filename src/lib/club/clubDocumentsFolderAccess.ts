import { prisma } from '@/lib/prisma';
import type { ClubDocumentsWorkspaceKind } from '@/lib/club/clubDocuments';
import {
  getDocumentsFolder,
  mergeDocumentsFolderForSave,
  type ClubDocumentsFolderState,
} from '@/lib/club/clubDocumentsFolder';

export type DocumentsFolderEntityAccess = {
  ok: boolean;
  isAdmin: boolean;
  kind: ClubDocumentsWorkspaceKind;
  entityName: string;
  adminId: string;
  description: string | null;
};

const DENIED: DocumentsFolderEntityAccess = {
  ok: false,
  isAdmin: false,
  kind: 'club',
  entityName: '',
  adminId: '',
  description: null,
};

/** `entityId` may be a club id or a team id. */
export async function canAccessDocumentsEntity(
  entityId: string,
  userId: string,
): Promise<DocumentsFolderEntityAccess> {
  const clubs = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM clubs_new WHERE id = ${entityId} LIMIT 1
  `;
  const club = clubs[0];
  if (club) {
    const base = {
      kind: 'club' as const,
      entityName: club.name,
      adminId: club.adminId,
      description: club.description,
    };
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
  const base = {
    kind: 'team' as const,
    entityName: team.name,
    adminId: team.adminId,
    description: team.description,
  };
  if (team.adminId === userId) return { ok: true, isAdmin: true, ...base };
  const member = await prisma.teamMember.findFirst({
    where: { teamId: entityId, athleteId: userId },
    select: { id: true },
  });
  return member ? { ok: true, isAdmin: false, ...base } : DENIED;
}

export async function saveDocumentsFolder(
  kind: ClubDocumentsWorkspaceKind,
  entityId: string,
  folder: ClubDocumentsFolderState,
  currentDescription: string | null,
): Promise<ClubDocumentsFolderState> {
  const description = mergeDocumentsFolderForSave(currentDescription, folder);
  const table = kind === 'team' ? 'teams_new' : 'clubs_new';
  await prisma.$executeRawUnsafe(
    `UPDATE ${table} SET description = ? WHERE id = ?`,
    description,
    entityId,
  );
  return getDocumentsFolder(description);
}

/** Public read when the Documents page is shared (or a single visible doc link). */
export async function loadEntityDescriptionPublic(
  entityId: string,
): Promise<{
  ok: boolean;
  kind: ClubDocumentsWorkspaceKind;
  entityName: string;
  description: string | null;
  adminId: string;
} | null> {
  const clubs = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM clubs_new WHERE id = ${entityId} LIMIT 1
  `;
  if (clubs[0]) {
    return {
      ok: true,
      kind: 'club',
      entityName: clubs[0].name,
      description: clubs[0].description,
      adminId: clubs[0].adminId,
    };
  }
  const teams = await prisma.$queryRaw<
    { id: string; name: string; adminId: string; description: string | null }[]
  >`
    SELECT id, name, adminId, description FROM teams_new WHERE id = ${entityId} LIMIT 1
  `;
  if (!teams[0]) return null;
  return {
    ok: true,
    kind: 'team',
    entityName: teams[0].name,
    description: teams[0].description,
    adminId: teams[0].adminId,
  };
}
