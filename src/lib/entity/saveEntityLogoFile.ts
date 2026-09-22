import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { getServerPublicDir } from '@/lib/serverPublicDir';
import {
  ENTITY_LOGO_UPLOAD_DIR,
  getBannerUrlFromEntityDescription,
  getLogoUrlFromEntityDescription,
  mergeBannerUrlIntoDescription,
  mergeLogoUrlIntoDescription,
  type ManagedEntityLogoKind,
} from '@/lib/entity/entityLogo';
import { prisma } from '@/lib/prisma';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

type EntityRow = { id: string; description: string | null };
type EntityImageAsset = 'logo' | 'banner';

async function loadClub(clubId: string, adminId: string): Promise<EntityRow | null> {
  const rows = await prisma.$queryRaw<EntityRow[]>`
    SELECT id, description FROM clubs_new WHERE id = ${clubId} AND adminId = ${adminId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function loadTeam(teamId: string, adminId: string): Promise<EntityRow | null> {
  const row = await prisma.team.findFirst({
    where: { id: teamId, adminId },
    select: { id: true, description: true },
  });
  return row;
}

async function loadGroup(groupId: string, adminId: string): Promise<EntityRow | null> {
  const row = await prisma.group.findFirst({
    where: { id: groupId, adminId },
    select: { id: true, description: true },
  });
  return row;
}

async function loadCoachingGroup(
  groupId: string,
  coachId: string,
): Promise<EntityRow | null> {
  const row = await prisma.coachingGroup.findFirst({
    where: { id: groupId, coachId },
    select: { id: true, description: true },
  });
  return row;
}

async function persistDescription(
  kind: ManagedEntityLogoKind,
  entityId: string,
  adminId: string,
  description: string,
): Promise<void> {
  switch (kind) {
    case 'club':
      await prisma.$executeRaw`
        UPDATE clubs_new SET description = ${description}, updatedAt = NOW(3)
        WHERE id = ${entityId} AND adminId = ${adminId}
      `;
      break;
    case 'team':
      await prisma.team.update({
        where: { id: entityId },
        data: { description },
      });
      break;
    case 'group':
      await prisma.group.update({
        where: { id: entityId },
        data: { description },
      });
      break;
    case 'coach':
      await prisma.coachingGroup.update({
        where: { id: entityId },
        data: { description },
      });
      break;
  }
}

async function loadEntity(
  kind: ManagedEntityLogoKind,
  entityId: string,
  adminId: string,
): Promise<EntityRow | null> {
  switch (kind) {
    case 'club':
      return loadClub(entityId, adminId);
    case 'team':
      return loadTeam(entityId, adminId);
    case 'group':
      return loadGroup(entityId, adminId);
    case 'coach':
      return loadCoachingGroup(entityId, adminId);
  }
}

function extensionForFile(file: File, extFromName: string | undefined): string {
  let ext =
    extFromName && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extFromName)
      ? extFromName === 'jpeg'
        ? 'jpg'
        : extFromName
      : 'jpg';
  if (file.type === 'image/png') ext = 'png';
  else if (file.type === 'image/gif') ext = 'gif';
  else if (file.type === 'image/webp') ext = 'webp';
  return ext;
}

async function deletePublicLogoFile(publicPath: string | null | undefined): Promise<void> {
  const raw = publicPath?.trim();
  if (!raw?.startsWith(`/uploads/${ENTITY_LOGO_UPLOAD_DIR}/`)) return;
  const rel = raw.replace(/^\//, '');
  const abs = join(getServerPublicDir(), rel);
  try {
    await unlink(abs);
  } catch {
    /* ignore missing file */
  }
}

export async function saveEntityLogoForOwner(
  kind: ManagedEntityLogoKind,
  entityId: string,
  adminId: string,
  file: File,
  asset: EntityImageAsset = 'logo',
): Promise<{ logoUrl: string; bannerUrl?: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error('File size exceeds 5MB limit');
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Invalid file type. Only images are allowed');
  }

  const entity = await loadEntity(kind, entityId, adminId);
  if (!entity) {
    throw new Error('Entity not found or access denied');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const extFromName = file.name.split('.').pop()?.toLowerCase();
  const ext = extensionForFile(file, extFromName);

  const idPrefix = entityId.slice(0, 8);
  const assetPrefix = asset === 'banner' ? 'banner' : kind;
  const fileName = `${assetPrefix}_${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const uploadDir = join(getServerPublicDir(), 'uploads', ENTITY_LOGO_UPLOAD_DIR);
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }
  await writeFile(join(uploadDir, fileName), buffer);

  const publicPath = `/uploads/${ENTITY_LOGO_UPLOAD_DIR}/${fileName}`;
  if (asset === 'banner') {
    const oldBanner = getBannerUrlFromEntityDescription(entity.description);
    await deletePublicLogoFile(oldBanner);
    const description = mergeBannerUrlIntoDescription(entity.description, publicPath);
    await persistDescription(kind, entityId, adminId, description);
    return {
      logoUrl: getLogoUrlFromEntityDescription(description) ?? '',
      bannerUrl: publicPath,
    };
  }

  const oldLogo = getLogoUrlFromEntityDescription(entity.description);
  await deletePublicLogoFile(oldLogo);

  const description = mergeLogoUrlIntoDescription(entity.description, publicPath);
  await persistDescription(kind, entityId, adminId, description);

  return {
    logoUrl: publicPath,
    bannerUrl: getBannerUrlFromEntityDescription(description) ?? undefined,
  };
}

export async function removeEntityLogoForOwner(
  kind: ManagedEntityLogoKind,
  entityId: string,
  adminId: string,
  asset: EntityImageAsset = 'logo',
): Promise<void> {
  const entity = await loadEntity(kind, entityId, adminId);
  if (!entity) {
    throw new Error('Entity not found or access denied');
  }
  if (asset === 'banner') {
    const oldBanner = getBannerUrlFromEntityDescription(entity.description);
    await deletePublicLogoFile(oldBanner);
    const description = mergeBannerUrlIntoDescription(entity.description, null);
    await persistDescription(kind, entityId, adminId, description);
    return;
  }
  const oldLogo = getLogoUrlFromEntityDescription(entity.description);
  await deletePublicLogoFile(oldLogo);
  const description = mergeLogoUrlIntoDescription(entity.description, null);
  await persistDescription(kind, entityId, adminId, description);
}
