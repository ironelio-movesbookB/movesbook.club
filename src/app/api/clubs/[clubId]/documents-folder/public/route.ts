import { NextRequest, NextResponse } from 'next/server';
import {
  BUILTIN_PRIVACY_ID,
  BUILTIN_RULES_ID,
  documentPublicHref,
  findFolderDocument,
  getDocumentsFolder,
  listDocumentsFolderItems,
} from '@/lib/club/clubDocumentsFolder';
import { loadEntityDescriptionPublic } from '@/lib/club/clubDocumentsFolderAccess';
import {
  getClubLegalDocuments,
  legalDocHtml,
} from '@/lib/club/clubLegalDocuments';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { clubDocumentFileHref } from '@/lib/club/clubDocumentsFolder';
import { resolveEntityLogoUrl } from '@/lib/entity/entityLogo';

export const dynamic = 'force-dynamic';

/**
 * Public Documents page / single document when shared or opened via Get link.
 * Query: `docId` optional — when omitted, returns the shared page list (visible only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const entity = await loadEntityDescriptionPublic(params.clubId);
  if (!entity?.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const folder = getDocumentsFolder(entity.description);
  const meta = parseClubDescriptionMeta(entity.description);
  const logoUrl = resolveEntityLogoUrl(meta.logoUrl);
  const docId = request.nextUrl.searchParams.get('docId');

  if (!docId) {
    if (!folder.pageShared) {
      return NextResponse.json(
        { error: 'Documents page is not shared' },
        { status: 403 },
      );
    }
    const items = listDocumentsFolderItems(entity.description, { sharedOnly: true });
    return NextResponse.json({
      mode: 'page',
      clubId: params.clubId,
      clubName: entity.entityName,
      logoUrl,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        publicUrl: documentPublicHref(params.clubId, item.id),
        filePath: clubDocumentFileHref(item.filePath) || item.filePath,
      })),
    });
  }

  // Get link always opens the single document (club + Movesbook logos on the view page).
  // "Visible" only filters which docs appear on the shared Documents page list.
  if (docId === BUILTIN_RULES_ID || docId === BUILTIN_PRIVACY_ID) {
    const kind = docId === BUILTIN_RULES_ID ? 'rules' : 'privacy-policy';
    const legal = getClubLegalDocuments(entity.description);
    return NextResponse.json({
      mode: 'document',
      clubId: params.clubId,
      clubName: entity.entityName,
      logoUrl,
      id: docId,
      title: kind === 'rules' ? 'Rules of the Club/Team' : 'Privacy Policy',
      type: kind === 'rules' ? 'builtin-rules' : 'builtin-privacy',
      contentHtml: legalDocHtml(legal, kind),
    });
  }

  const doc = findFolderDocument(folder, docId);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({
    mode: 'document',
    clubId: params.clubId,
    clubName: entity.entityName,
    logoUrl,
    id: doc.id,
    title: doc.title,
    type: doc.type,
    contentHtml: doc.contentHtml || '',
    filePath: clubDocumentFileHref(doc.filePath) || doc.filePath,
    fileName: doc.fileName,
  });
}
