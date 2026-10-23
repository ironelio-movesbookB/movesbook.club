import { getLogoUrlFromEntityDescription } from '@/lib/entity/entityLogo';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';

/** Entity logo from profile meta, then the entity image. Never the signed-in user's photo. */
export function resolveManagedEntityDisplayImageUrl(options: {
  description?: string | null;
  imageUrl?: string | null;
}): string | null {
  const fromDescription = getLogoUrlFromEntityDescription(options.description);
  if (fromDescription) return fromDescription;
  return resolvePublicImageUrl(options.imageUrl);
}
