import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  CLUB_DOCUMENT_PDF_MAX_BYTES,
  DOCUMENT_GENERATE_SOURCES,
  clubDocumentFileHref,
  createGeneratedDocument,
  createHtmlDocument,
  createPdfDocument,
  documentPublicHref,
  documentsPagePublicHref,
  getDocumentsFolder,
  listDocumentsFolderItems,
  type DocumentSourceKey,
} from '@/lib/club/clubDocumentsFolder';
import { generateDocumentsBundle } from '@/lib/club/clubDocumentsGenerate';
import {
  canAccessDocumentsEntity,
  saveDocumentsFolder,
} from '@/lib/club/clubDocumentsFolderAccess';
import { writeClubDocumentPdf } from '@/lib/club/clubDocumentsFiles';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { resolveEntityLogoUrl } from '@/lib/entity/entityLogo';

export const dynamic = 'force-dynamic';

function getUserId(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token)?.userId ?? null;
}

function isSourceKey(value: string): value is DocumentSourceKey {
  return DOCUMENT_GENERATE_SOURCES.some((s) => s.key === value);
}

/** List documents folder (+ page share flag, generate source catalog). */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok) {
    return NextResponse.json({ error: 'Club not found or access denied' }, { status: 404 });
  }

  const search = request.nextUrl.searchParams.get('search') || '';
  const folder = getDocumentsFolder(access.description);
  const items = listDocumentsFolderItems(access.description, { search });
  const meta = parseClubDescriptionMeta(access.description);

  return NextResponse.json({
    clubId: params.clubId,
    clubName: access.entityName,
    workspaceKind: access.kind,
    canEdit: access.isAdmin,
    pageShared: folder.pageShared,
    sharedPageUrl: documentsPagePublicHref(params.clubId),
    logoUrl: resolveEntityLogoUrl(meta.logoUrl),
    generateSources: DOCUMENT_GENERATE_SOURCES,
    items: items.map((item) => ({
      ...item,
      publicUrl: documentPublicHref(params.clubId, item.id),
    })),
  });
}

/**
 * Create a document:
 * - JSON `{ mode: 'html', title, contentHtml? }`
 * - JSON `{ mode: 'generate', sourceKeys: string[], title? }`
 * - multipart: `mode=pdf`, `file`, optional `title`
 *
 * Or PATCH-like via JSON `{ pageShared: boolean }` on this same route with method PATCH below.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok || !access.isAdmin) {
    return NextResponse.json({ error: 'Only the club admin can edit documents' }, { status: 403 });
  }

  const folder = getDocumentsFolder(access.description);
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const mode = String(form.get('mode') || 'pdf');
      if (mode !== 'pdf') {
        return NextResponse.json({ error: 'Unsupported multipart mode' }, { status: 400 });
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: 'The file is empty' }, { status: 400 });
      }
      if (file.size > CLUB_DOCUMENT_PDF_MAX_BYTES) {
        return NextResponse.json({ error: 'PDF cannot be larger than 15MB' }, { status: 400 });
      }
      const originalName = file.name || 'document.pdf';
      const ext = (originalName.split('.').pop() || '').toLowerCase();
      if (ext !== 'pdf' && file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
      }
      const written = await writeClubDocumentPdf(
        Buffer.from(await file.arrayBuffer()),
        originalName,
      );
      const title = String(form.get('title') || '').trim();
      const created = createPdfDocument(
        folder,
        title,
        written.filePath,
        originalName,
      );
      await saveDocumentsFolder(access.kind, params.clubId, created.folder, access.description);
      return NextResponse.json({
        ok: true,
        document: {
          ...created.doc,
          filePath: clubDocumentFileHref(created.doc.filePath) || created.doc.filePath,
          publicUrl: documentPublicHref(params.clubId, created.doc.id),
        },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const payload = (body || {}) as {
      mode?: string;
      title?: string;
      contentHtml?: string;
      sourceKeys?: string[];
    };
    const mode = payload.mode || 'html';

    if (mode === 'html') {
      const created = createHtmlDocument(
        folder,
        String(payload.title || '').trim() || 'Untitled document',
        typeof payload.contentHtml === 'string' ? payload.contentHtml : '',
      );
      await saveDocumentsFolder(access.kind, params.clubId, created.folder, access.description);
      return NextResponse.json({
        ok: true,
        document: {
          ...created.doc,
          publicUrl: documentPublicHref(params.clubId, created.doc.id),
        },
      });
    }

    if (mode === 'generate') {
      const sourceKeys = (payload.sourceKeys || []).filter(isSourceKey);
      if (sourceKeys.length === 0) {
        return NextResponse.json(
          { error: 'Select at least one section to generate' },
          { status: 400 },
        );
      }
      const generated = await generateDocumentsBundle({
        sourceKeys,
        adminUserId: access.adminId,
        entityId: params.clubId,
        entityName: access.entityName,
        kind: access.kind,
        description: access.description,
      });
      const title = String(payload.title || '').trim() || generated.title;
      const written = await writeClubDocumentPdf(generated.pdfBuffer, generated.fileName);

      const created = createGeneratedDocument(
        folder,
        title,
        generated.html,
        sourceKeys,
        { filePath: written.filePath, fileName: written.fileName },
      );
      await saveDocumentsFolder(access.kind, params.clubId, created.folder, access.description);
      return NextResponse.json({
        ok: true,
        document: {
          ...created.doc,
          filePath: clubDocumentFileHref(created.doc.filePath) || created.doc.filePath,
          publicUrl: documentPublicHref(params.clubId, created.doc.id),
        },
      });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/clubs/[clubId]/documents-folder:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

/** Update Documents page share flag. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { clubId: string } },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await canAccessDocumentsEntity(params.clubId, userId);
  if (!access.ok || !access.isAdmin) {
    return NextResponse.json({ error: 'Only the club admin can edit documents' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const pageShared = Boolean((body as { pageShared?: boolean })?.pageShared);
  const folder = { ...getDocumentsFolder(access.description), pageShared };
  await saveDocumentsFolder(access.kind, params.clubId, folder, access.description);

  return NextResponse.json({
    ok: true,
    pageShared,
    sharedPageUrl: documentsPagePublicHref(params.clubId),
  });
}
