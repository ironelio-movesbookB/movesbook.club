import {
  managedEntityKindToLogoKind,
} from '@/lib/entity/entityLogo';
import type { ManagedEntityKind } from '@/lib/entity/entityProfileLabels';
import {
  removeEntityLogo,
  uploadEntityLogo,
} from '@/lib/entity/uploadEntityLogoClient';
import type { ClubProfileSavePayload } from '@/lib/club/clubProfilePayload';

type EntityLogoSaveFields = {
  logoFile?: File | null;
  removeLogo?: boolean;
};

/**
 * Upload or remove entity logo.
 * @returns New public logo path, `null` when removed, `undefined` when unchanged.
 */
export async function applyEntityLogoOnSave(
  kind: ManagedEntityKind,
  entityId: string,
  payload: EntityLogoSaveFields | ClubProfileSavePayload,
): Promise<string | null | undefined> {
  const logoKind = managedEntityKindToLogoKind(kind);
  if (payload.removeLogo) {
    await removeEntityLogo(logoKind, entityId, 'logo');
    return null;
  }
  if (payload.logoFile) {
    return uploadEntityLogo(logoKind, entityId, payload.logoFile, 'logo');
  }
  return undefined;
}

/**
 * Upload or remove club banner (stored as `bannerUrl` in description JSON).
 */
export async function applyEntityBannerOnSave(
  kind: ManagedEntityKind,
  entityId: string,
  payload: ClubProfileSavePayload,
): Promise<string | null | undefined> {
  const logoKind = managedEntityKindToLogoKind(kind);
  if (payload.removeBanner) {
    await removeEntityLogo(logoKind, entityId, 'banner');
    return null;
  }
  if (payload.bannerFile) {
    return uploadEntityLogo(logoKind, entityId, payload.bannerFile, 'banner');
  }
  return undefined;
}

export type EntityImageSaveResult = {
  logoUrl: string;
  bannerUrl: string;
};

/**
 * Apply logo and/or banner changes in sequence, then return URLs to send on PATCH.
 * Removals first, then logo upload, then banner upload so description keeps both.
 */
export async function applyEntityImagesOnSave(
  kind: ManagedEntityKind,
  entityId: string,
  payload: ClubProfileSavePayload,
): Promise<EntityImageSaveResult> {
  let logoUrl = String(payload.logoUrl ?? '').trim();
  let bannerUrl = String(payload.bannerUrl ?? '').trim();

  if (payload.removeLogo) {
    await applyEntityLogoOnSave(kind, entityId, {
      ...payload,
      logoFile: null,
      removeLogo: true,
    });
    logoUrl = '';
  }
  if (payload.removeBanner) {
    await applyEntityBannerOnSave(kind, entityId, {
      ...payload,
      bannerFile: null,
      removeBanner: true,
    });
    bannerUrl = '';
  }

  if (payload.logoFile && !payload.removeLogo) {
    const uploaded = await applyEntityLogoOnSave(kind, entityId, {
      ...payload,
      removeLogo: false,
    });
    if (uploaded) logoUrl = uploaded;
  }

  if (payload.bannerFile && !payload.removeBanner) {
    const uploaded = await applyEntityBannerOnSave(kind, entityId, {
      ...payload,
      removeBanner: false,
    });
    if (uploaded) bannerUrl = uploaded;
  }

  return { logoUrl, bannerUrl };
}
