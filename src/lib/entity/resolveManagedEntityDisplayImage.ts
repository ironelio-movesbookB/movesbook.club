import { getLogoUrlFromEntityDescription } from '@/lib/entity/entityLogo';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

/** Entity logo from profile meta, then explicit imageUrl, then account profile photo. */
export function resolveManagedEntityDisplayImageUrl(options: {
  description?: string | null;
  imageUrl?: string | null;
  userImageUrl?: string | null;
}): string | null {
  const fromDescription = getLogoUrlFromEntityDescription(options.description);
  if (fromDescription) return fromDescription;
  const fromEntity = resolvePublicImageUrl(options.imageUrl);
  if (fromEntity) return fromEntity;
  return resolvePublicImageUrl(options.userImageUrl);
}
