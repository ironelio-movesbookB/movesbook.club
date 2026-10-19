import PromocodeAssetImage from './PromocodeAssetImage';
import {
  PROMOCODE_NO_FLAG_IMAGE,
  PROMOCODE_NO_PROFILE_IMAGE,
  promocodeFlagImageUrl,
  promocodeProfileImageUrl,
} from './promocodeImageUrls';

const ENTITY_ROLES = new Set([7, 8, 9]);

export function PromocodePersonMark({
  label,
  email,
  image,
  logoUrl,
  roleId,
  countryCode,
  countryName,
  flagImage,
  registered,
  onClick,
}: {
  label: string;
  email?: string | null;
  image?: string | null;
  logoUrl?: string | null;
  roleId?: number | null;
  countryCode?: string | null;
  countryName?: string | null;
  flagImage?: string | null;
  registered?: boolean;
  onClick?: (name: string) => void;
}) {
  if (!label) return null;
  const entity = roleId != null && ENTITY_ROLES.has(roleId);
  const photo = entity
    ? logoUrl || ''
    : image
      ? promocodeProfileImageUrl(image)
      : '';
  const hoverEmail = email && email.includes('@') && email !== label ? email : undefined;
  const countryTitle = countryName || countryCode || '';

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {registered && (photo || entity) ? (
        <PromocodeAssetImage
          src={photo || PROMOCODE_NO_PROFILE_IMAGE}
          fallbackSrc={PROMOCODE_NO_PROFILE_IMAGE}
          alt=""
          className={entity ? 'h-6 w-8 object-contain' : 'h-6 w-6 rounded-full object-cover'}
        />
      ) : null}
      <span title={countryTitle}>
        <PromocodeAssetImage
          src={promocodeFlagImageUrl(flagImage, { countryCode })}
          fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
          countryCode={countryCode}
          alt={countryTitle}
          className="h-4 w-6 object-cover"
        />
      </span>
      {onClick ? (
        <button
          type="button"
          className="text-blue-800 underline"
          title={hoverEmail}
          onClick={(e) => {
            e.stopPropagation();
            onClick(label);
          }}
        >
          {label}
        </button>
      ) : (
        <span title={hoverEmail}>{label}</span>
      )}
    </span>
  );
}
