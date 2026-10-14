'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { flagEmojiFromCountryName } from '@/lib/admin/countryFlag';
import {
  entityCompanyLabel,
  gridCardShowsOwnedEntities,
  ownedEntitiesLabel,
  type AdminGridCardGroup,
} from '@/lib/admin/groupRegisteredUserGridCards';
import {
  inferMembershipEndDateYmd,
  membershipDateClassName,
  type ClubSubscriptionStatusTone,
} from '@/lib/admin/clubSubscriptionStatus';

function formatMembershipDateRange(
  dateStart: string | null | undefined,
  dateEnd: string | null | undefined,
): string {
  const start = dateStart?.trim() || '—';
  const end = inferMembershipEndDateYmd(dateStart, dateEnd) ?? '—';
  return `${start} — ${end}`;
}
const isDataUrl = (src: string) =>
  src.startsWith('data:image/') || src.startsWith('blob:');

function clubAdminStatusClassName(tone?: ClubSubscriptionStatusTone): string {
  switch (tone) {
    case 'not-active':
      return 'text-red-900 font-bold';
    case 'pending':
      return 'text-red-600 font-semibold';
    case 'not-yet-active':
      return 'text-sky-400 font-semibold';
    case 'expiring':
      return 'text-amber-600 font-semibold';
    case 'partial-expired':
      return 'text-orange-600 font-semibold';
    case 'all-expired':
      return 'text-red-600 font-semibold';
    case 'active':
    default:
      return 'text-green-700 font-semibold';
  }
}

type AdminRegisteredUserGridCardProps = {
  group: AdminGridCardGroup;
  /** Opens PCU history user page → Profile tab → Admin Profile sub-tab. */
  onOpenAdminProfile: (userId: string, userType: string, clubId?: string | null) => void;
  /** Opens PCU history user page → Profile tab → club/team/group/coach profile sub-tab. */
  onOpenEntityProfile: (
    userId: string,
    userType: string,
    entityId: string | null,
  ) => void;
  /** Opens the online_new_* / online_old_* user panel modal. */
  onOpenUserPanel: (userId: string, entityId: string | null) => void;
};

const PLACEHOLDER_AVATAR = '/images/no_image.jpg';

export default function AdminRegisteredUserGridCard({
  group,
  onOpenAdminProfile,
  onOpenEntityProfile,
  onOpenUserPanel,
}: AdminRegisteredUserGridCardProps) {
  const { admin, entities } = group;
  const showOwnedList = gridCardShowsOwnedEntities(group);
  const adminAvatarSrc = resolvePublicImageUrl(admin.imageUrl);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    setAvatarBroken(false);
  }, [admin.imageUrl]);

  const avatarDisplaySrc =
    !adminAvatarSrc ? null : avatarBroken ? PLACEHOLDER_AVATAR : adminAvatarSrc;

  return (
    <div className="border border-gray-300 bg-white p-4 rounded shadow-sm text-sm">
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-gray-900">{admin.displayName || '—'}</div>
          <div className="text-gray-700">
            {admin.country || '—'}{' '}
            {flagEmojiFromCountryName(admin.country) && (
              <span className="ml-0.5">{flagEmojiFromCountryName(admin.country)}</span>
            )}
          </div>
          <div className="text-gray-600">{admin.location?.trim() || '—'}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() =>
                onOpenUserPanel(
                  admin.id,
                  admin.primaryClubId ?? entities[0]?.entityId ?? entities[0]?.primaryClubId ?? null,
                )
              }
              className="text-blue-800 font-medium hover:text-blue-950 underline underline-offset-2"
            >
              @{admin.accountUsername ?? admin.username}
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenAdminProfile(
                  admin.id,
                  admin.userType,
                  admin.primaryClubId ?? entities[0]?.entityId ?? entities[0]?.primaryClubId ?? null,
                )
              }
              className="text-blue-800 underline hover:text-blue-950"
            >
              View profile
            </button>
          </div>
          <div className={membershipDateClassName(admin.statusTone)}>
            {formatMembershipDateRange(admin.dateStart, admin.dateEnd)}
          </div>
          <div className={admin.specialOffer ? 'text-blue-600 font-semibold' : 'text-gray-700'}>
            {admin.version}
          </div>
        </div>
        <div className="w-[4.5rem] h-[4.5rem] shrink-0 border-2 border-red-600 bg-gray-50 flex items-center justify-center overflow-hidden">
          {avatarDisplaySrc ? (
            isDataUrl(avatarDisplaySrc) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarDisplaySrc}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <Image
                src={avatarDisplaySrc}
                alt=""
                width={72}
                height={72}
                className="object-cover w-full h-full"
                unoptimized
                onError={() => setAvatarBroken(true)}
              />
            )
          ) : (
            <User className="w-9 h-9 text-gray-400" aria-hidden />
          )}
        </div>
      </div>

      {showOwnedList ? (
        <>
          <p className="mt-3 text-red-600 font-semibold">
            {ownedEntitiesLabel(admin.userType, entities.length)}
          </p>
          <ul className="mt-2 space-y-2 border-t border-gray-200 pt-2">
            {entities.map((entity) => (
              <li key={entity.rowKey} className="text-sm">
                <div className="text-gray-800">
                  {entityCompanyLabel(entity.entityKind)}:{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onOpenUserPanel(
                        admin.id,
                        entity.entityId ?? entity.primaryClubId ?? null,
                      )
                    }
                    className="font-medium text-blue-800 underline hover:text-blue-950"
                  >
                    {entity.companyName?.trim() || '—'}
                  </button>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`whitespace-nowrap ${membershipDateClassName(entity.statusTone)}`}
                  >
                    {formatMembershipDateRange(entity.dateStart, entity.dateEnd)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEntityProfile(
                        admin.id,
                        admin.userType,
                        entity.entityId ?? entity.primaryClubId ?? null,
                      )
                    }
                    className="text-blue-800 underline hover:text-blue-950"
                  >
                    View profile
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className={`mt-2 ${clubAdminStatusClassName(admin.statusTone)}`}>{admin.status}</div>
          <button
            type="button"
            onClick={() =>
              onOpenUserPanel(admin.id, admin.primaryClubId ?? null)
            }
            className="mt-2 text-sm text-blue-800 underline hover:text-blue-950"
          >
            View profile
          </button>
        </>
      )}
    </div>
  );
}
