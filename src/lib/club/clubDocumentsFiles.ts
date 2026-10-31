import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import { CLUB_DOCUMENTS_UPLOAD_SUBDIR } from '@/lib/club/clubDocumentsFolder';

const UPLOAD_PREFIX = `/uploads/${CLUB_DOCUMENTS_UPLOAD_SUBDIR}/`;

function uploadsDir(): string {
  return join(getServerPublicDir(), 'uploads', CLUB_DOCUMENTS_UPLOAD_SUBDIR);
}

function storedNameFromPublicPath(filePath: string | undefined): string | null {
  if (!filePath?.startsWith(UPLOAD_PREFIX)) return null;
  const name = filePath.slice(UPLOAD_PREFIX.length);
  return /^[A-Za-z0-9_.-]+$/.test(name) ? name : null;
}

export async function writeClubDocumentPdf(
  buffer: Buffer,
  preferredFileName?: string,
): Promise<{ filePath: string; fileName: string }> {
  const dir = uploadsDir();
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const stored = `${randomBytes(16).toString('hex')}.pdf`;
  await writeFile(join(dir, stored), buffer);
  const raw = (preferredFileName || stored).trim() || stored;
  const safe = raw.replace(/[^\w.\-]+/g, '_');
  const fileName = /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
  return {
    filePath: `${UPLOAD_PREFIX}${stored}`,
    fileName,
  };
}

/** Copy an existing club document PDF to a new unique path (for Duplicate). */
export async function copyClubDocumentPdf(
  sourceFilePath: string | undefined,
): Promise<{ filePath: string } | null> {
  const sourceName = storedNameFromPublicPath(sourceFilePath);
  if (!sourceName) return null;
  const sourceAbs = join(uploadsDir(), sourceName);
  if (!existsSync(sourceAbs)) return null;
  const dir = uploadsDir();
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const stored = `${randomBytes(16).toString('hex')}.pdf`;
  await copyFile(sourceAbs, join(dir, stored));
  return { filePath: `${UPLOAD_PREFIX}${stored}` };
}

/** Delete PDF only when `stillReferenced` is false. */
export async function removeClubDocumentPdfIfUnreferenced(
  filePath: string | undefined,
  stillReferenced: boolean,
): Promise<void> {
  if (stillReferenced) return;
  const name = storedNameFromPublicPath(filePath);
  if (!name) return;
  await unlink(join(uploadsDir(), name)).catch(() => {});
}
