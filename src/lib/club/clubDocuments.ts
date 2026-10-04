import { prisma } from '@/lib/prisma';
import {
  getClubLegalDocuments,
  mergeClubLegalDocumentsForSave,
  type ClubLegalDocuments,
} from '@/lib/club/clubLegalDocuments';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';

export type ClubDocumentsWorkspaceKind = 'club' | 'team';

export const CLUB_DOCUMENT_MAX_LENGTH = 2_000_000;

export const sanitizeClubDocumentHtml = sanitizeRichHtml;

/**
 * Rules / Privacy policy live in the entity `description` JSON (`legalDocuments`),
 * shared with the Documents Editor and the member profile Rules / Privacy policy links.
 */
function entityTable(kind: ClubDocumentsWorkspaceKind): 'clubs_new' | 'teams_new' {
  return kind === 'team' ? 'teams_new' : 'clubs_new';
}

export async function readEntityDescription(
  kind: ClubDocumentsWorkspaceKind,
  entityId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ description: string | null }[]>(
    `SELECT description FROM ${entityTable(kind)} WHERE id = ? LIMIT 1`,
    entityId,
  );
  return rows[0]?.description ?? null;
}

export async function saveEntityLegalDocuments(
  kind: ClubDocumentsWorkspaceKind,
  entityId: string,
  docs: ClubLegalDocuments,
): Promise<ClubLegalDocuments> {
  const current = await readEntityDescription(kind, entityId);
  const description = mergeClubLegalDocumentsForSave(current, {
    rulesHtml: sanitizeClubDocumentHtml(docs.rulesHtml),
    privacyPolicyHtml: sanitizeClubDocumentHtml(docs.privacyPolicyHtml),
  });
  await prisma.$executeRawUnsafe(
    `UPDATE ${entityTable(kind)} SET description = ? WHERE id = ?`,
    description,
    entityId,
  );
  return getClubLegalDocuments(description);
}
