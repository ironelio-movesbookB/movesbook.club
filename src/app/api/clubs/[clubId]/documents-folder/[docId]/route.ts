import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  BUILTIN_PRIVACY_ID,
  BUILTIN_RULES_ID,
  clubDocumentFileHref,
  deleteFolderDocument,
  documentPublicHref,
  duplicateFolderDocument,
  findFolderDocument,
  getDocumentsFolder,
  setBuiltinVisible,
  updateFolderDocument,
} from '@/lib/club/clubDocumentsFolder';
import {
  canAccessDocumentsEntity,
  saveDocumentsFolder,
} from '@/lib/club/clubDocumentsFolderAccess';
import {
  getClubLegalDocuments,
  legalDocHtml,
  type ClubLegalDocKind,
} from '@/lib/club/clubLegalDocuments';
import {
  copyClubDocumentPdf,
  removeClubDocumentPdfIfUnreferenced,
  writeClubDocumentPdf,
} from '@/lib/club/clubDocumentsFiles';
import { buildPdfBufferFromHtmlContent } from '@/lib/club/clubDocumentsGenerate';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token)?.userId ?? null;
}

function builtinKind(docId: string): ClubLegalDocKind | null {
  if (docId === BUILTIN_RULES_ID) return 'rules';
  if (docId === BUILTIN_PRIVACY_ID) return 'privacy-policy';
  return null;
}

function withPublicFile(doc: {
  filePath?: string;
  fileName?: string;
  [key: string]: unknown;
}) {
  return {
    ...doc,
    filePath: clubDocumentFileHref(doc.filePath as string | undefined) || doc.filePath,
  };
}

/** Load one document (admin/member). */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string; docId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
  }

  const folder = getDocumentsFolder(access.description);
  const kind = builtinKind(params.docId);
  if (kind) {
    const legal = getClubLegalDocuments(access.description);
    return NextResponse.json({
      id: params.docId,
      title: kind === 'rules' ? 'Rules of the Club/Team' : 'Privacy Policy',
      type: kind === 'rules' ? 'builtin-rules' : 'builtin-privacy',
      contentHtml: legalDocHtml(legal, kind),
      visible:
        kind === 'rules' ? folder.builtinVisible.rules : folder.builtinVisible.privacyPolicy,
      editable: access.isAdmin,
      publicUrl: documentPublicHref(params.clubId, params.docId),
    });
  }

  const doc = findFolderDocument(folder, params.docId);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...withPublicFile(doc),
    editable: access.isAdmin && doc.type !== 'pdf',
    publicUrl: documentPublicHref(params.clubId, doc.id),
  });
}

/** Update title / HTML / visible; or action=duplicate via query. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clubId: string; docId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok || !access.isAdmin) {
    return NextResponse.json({ error: 'Only the club admin can edit documents' }, { status: 403 });
  }

  const action = request.nextUrl.searchParams.get('action');
  if (action === 'duplicate') {
    const duplicated = duplicateFolderDocument(access.description, params.docId);
    if (!duplicated) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    let doc = duplicated.doc;
    let folder = duplicated.folder;
    if (duplicated.sourceFilePath) {
      const copied = await copyClubDocumentPdf(duplicated.sourceFilePath);
      if (!copied) {
        return NextResponse.json(
          { error: 'Could not copy the PDF file for this document' },
          { status: 500 },
        );
      }
      const withFile = updateFolderDocument(folder, doc.id, {
        filePath: copied.filePath,
        fileName: doc.fileName,
      });
      if (withFile) {
        folder = withFile;
        doc = findFolderDocument(withFile, doc.id) || { ...doc, filePath: copied.filePath };
      }
    }
    await saveDocumentsFolder(access.kind, params.clubId, folder, access.description);
    return NextResponse.json({
      ok: true,
      document: {
        ...withPublicFile(doc),
        publicUrl: documentPublicHref(params.clubId, doc.id),
      },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const patch = (body || {}) as {
    title?: string;
    contentHtml?: string;
    visible?: boolean;
  };

  const folder = getDocumentsFolder(access.description);
  const kind = builtinKind(params.docId);
  if (kind) {
    let visible =
      kind === 'rules' ? folder.builtinVisible.rules : folder.builtinVisible.privacyPolicy;
    if (typeof patch.visible === 'boolean') {
      const next = setBuiltinVisible(
        folder,
        kind === 'rules' ? 'rules' : 'privacyPolicy',
        patch.visible,
      );
      await saveDocumentsFolder(access.kind, params.clubId, next, access.description);
      visible = patch.visible;
    }
    return NextResponse.json({ ok: true, id: params.docId, visible });
  }

  const prev = findFolderDocument(folder, params.docId);
  if (!prev) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let nextPatch: typeof patch & { filePath?: string; fileName?: string } = { ...patch };
  let oldPdfPath: string | undefined;

  // Regenerated docs: when HTML changes, rebuild the PDF snapshot so download stays current.
  if (
    prev.type === 'generated' &&
    typeof patch.contentHtml === 'string' &&
    patch.contentHtml !== prev.contentHtml
  ) {
    const title =
      typeof patch.title === 'string' && patch.title.trim()
        ? patch.title.trim()
        : prev.title;
    const pdfBuffer = await buildPdfBufferFromHtmlContent({
      title,
      entityName: access.entityName,
      html: patch.contentHtml,
    });
    const written = await writeClubDocumentPdf(
      pdfBuffer,
      prev.fileName || `${title}.pdf`,
    );
    oldPdfPath = prev.filePath;
    nextPatch = {
      ...nextPatch,
      filePath: written.filePath,
      fileName: written.fileName,
    };
  }

  const updated = updateFolderDocument(folder, params.docId, nextPatch);
  if (!updated) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  await saveDocumentsFolder(access.kind, params.clubId, updated, access.description);

  if (oldPdfPath) {
    const stillUsed = updated.items.some((item) => item.filePath === oldPdfPath);
    await removeClubDocumentPdfIfUnreferenced(oldPdfPath, stillUsed);
  }

  const doc = findFolderDocument(updated, params.docId);
  return NextResponse.json({
    ok: true,
    document: doc
      ? { ...withPublicFile(doc), publicUrl: documentPublicHref(params.clubId, doc.id) }
      : null,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clubId: string; docId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok || !access.isAdmin) {
    return NextResponse.json({ error: 'Only the club admin can edit documents' }, { status: 403 });
  }

  if (builtinKind(params.docId)) {
    return NextResponse.json(
      { error: 'Built-in Rules and Privacy Policy cannot be deleted' },
      { status: 400 },
    );
  }

  const folder = getDocumentsFolder(access.description);
  const deleted = deleteFolderDocument(folder, params.docId);
  if (!deleted) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  await saveDocumentsFolder(access.kind, params.clubId, deleted.folder, access.description);
  const path = deleted.removed.filePath;
  const stillUsed = deleted.folder.items.some((item) => item.filePath === path);
  await removeClubDocumentPdfIfUnreferenced(path, stillUsed);
  return NextResponse.json({ ok: true });
}
