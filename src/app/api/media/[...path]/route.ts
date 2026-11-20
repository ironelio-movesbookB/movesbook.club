import { readFile, stat } from 'fs/promises';
import { join, normalize, sep } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getPublicDirCandidates } from '@/lib/serverPublicDir';
import { verifyToken } from '@/lib/auth';
import { canViewMemberMedical, MEMBER_MEDICAL_FOLDER } from '@/lib/club/memberMedicalAccess';
import {
  MEDIA_SIBLING_FALLBACK_PARAM,
  requestBareHost,
  siblingMediaFallbackUrl,
  siblingMediaOrigins,
} from '@/lib/mediaSiblingOrigin';

export const dynamic = 'force-dynamic';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.rtf': 'application/rtf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function contentTypeForPath(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

const ALLOWED_ROOTS = ['uploads', 'img'] as const;

async function resolveExistingFilePath(segments: string[]): Promise<string | null> {
  if (!segments.length) return null;
  if (segments.some((part) => part === '..' || part === '.' || !part)) return null;
  if (!ALLOWED_ROOTS.includes(segments[0] as never)) return null;

  for (const publicRoot of getPublicDirCandidates()) {
    const absolute = normalize(join(publicRoot, ...segments));
    const rootDir = normalize(join(publicRoot, segments[0]));

    if (!absolute.startsWith(`${rootDir}${sep}`) && absolute !== rootDir) {
      continue;
    }

    try {
      const info = await stat(absolute);
      if (info.isFile() && info.size > 0) return absolute;
    } catch {
      // try next public root
    }
  }

  return null;
}

function isMemberMedicalPath(segments: string[]): boolean {
  return segments[0] === 'uploads' && segments[1] === MEMBER_MEDICAL_FOLDER;
}

async function memberMedicalAccessError(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  const decoded = token ? verifyToken(token) : null;
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const allowed = await canViewMemberMedical({
    viewerUserId: String(decoded.userId),
    viewerUserType: decoded.userType ? String(decoded.userType) : null,
    memberUserId: segments[2] ?? '',
  });
  return allowed ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/** Prefer local disk; if missing, redirect once to a sibling Movesbook domain that may have the file. */
async function redirectToSiblingIfPresent(
  request: NextRequest,
  segments: string[],
): Promise<NextResponse | null> {
  // Private medical files must never cross domains.
  if (isMemberMedicalPath(segments)) return null;
  // One hop only — sibling serves locally or 404s.
  if (request.nextUrl.searchParams.get(MEDIA_SIBLING_FALLBACK_PARAM) === '1') return null;

  const siblings = siblingMediaOrigins(requestBareHost(request));
  if (!siblings.length) return null;

  for (const origin of siblings) {
    const target = siblingMediaFallbackUrl(origin, segments);
    try {
      const res = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        headers: { Range: 'bytes=0-0' },
        signal: AbortSignal.timeout(4000),
      });
      // 200 / 206 = file exists on sibling; do not follow further redirects.
      if (res.ok || res.status === 206) {
        await res.body?.cancel().catch(() => undefined);
        return NextResponse.redirect(target, 302);
      }
      await res.body?.cancel().catch(() => undefined);
    } catch {
      // try next sibling
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    const isPrivate = isMemberMedicalPath(segments);
    if (isPrivate) {
      const denied = await memberMedicalAccessError(request, segments);
      if (denied) return denied;
    }

    const filePath = await resolveExistingFilePath(segments);
    if (!filePath) {
      const redirected = await redirectToSiblingIfPresent(request, segments);
      if (redirected) return redirected;
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await readFile(filePath);
    const contentType = contentTypeForPath(filePath);
    const fileName = segments[segments.length - 1] || 'file';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.length),
        // Open PDFs in the browser tab instead of forcing a download.
        'Content-Disposition': contentType === 'application/pdf' ? `inline; filename="${fileName}"` : 'inline',
        'Cache-Control': isPrivate ? 'private, no-store' : 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
