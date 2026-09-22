import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { parseEntityDescriptionMeta } from '@/lib/entity/entityForm';
import type { ManagedEntityKind } from '@/lib/entity/entityProfileLabels';

export type ManagedEntityLogoKind = 'club' | 'team' | 'group' | 'coach';

export function managedEntityKindToLogoKind(
  kind: ManagedEntityKind,
): ManagedEntityLogoKind {
  return kind === 'coaching-group' ? 'coach' : kind;
}

/** Public path prefix for uploaded entity logos. */
export const ENTITY_LOGO_UPLOAD_DIR = 'entity_logos';

export function resolveEntityLogoUrl(
  logoUrl: string | null | undefined,
): string | null {
  const raw = logoUrl?.trim();
  if (!raw) return null;
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^\/+/, '')}`;
}

export function getLogoUrlFromEntityDescription(
  description: string | null | undefined,
): string | null {
  const meta = parseEntityDescriptionMeta(description);
  return resolveEntityLogoUrl(meta.logoUrl);
}

export function mergeLogoUrlIntoDescription(
  existingDescription: string | null | undefined,
  logoUrl: string | null | undefined,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta = {
    ...prev,
    createdViaForm: prev.createdViaForm ?? true,
    logoUrl: logoUrl?.trim() ? logoUrl.trim() : undefined,
  };
  if (!meta.logoUrl) {
    delete (meta as { logoUrl?: string }).logoUrl;
  }
  return JSON.stringify(meta);
}

export function getBannerUrlFromEntityDescription(
  description: string | null | undefined,
): string | null {
  const meta = parseClubDescriptionMeta(description);
  return resolveEntityLogoUrl(meta.bannerUrl);
}

export function mergeBannerUrlIntoDescription(
  existingDescription: string | null | undefined,
  bannerUrl: string | null | undefined,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta = {
    ...prev,
    createdViaForm: prev.createdViaForm ?? true,
    bannerUrl: bannerUrl?.trim() ? bannerUrl.trim() : undefined,
  };
  if (!meta.bannerUrl) {
    delete (meta as { bannerUrl?: string }).bannerUrl;
  }
  return JSON.stringify(meta);
}
