'use client';

import Image from 'next/image';
import { Users } from 'lucide-react';
import { resolveManagedEntityDisplayImageUrl } from '@/lib/entity/resolveManagedEntityDisplayImage';

type ManagedEntitySidebarAvatarProps = {
  description?: string | null;
  imageUrl?: string | null;
  userImageUrl?: string | null;
  alt?: string;
  className?: string;
};

const isDataUrl = (src: string) =>
  src.startsWith('data:image/') || src.startsWith('blob:');

/**
 * Large avatar on my-club / my-team / my-group / my-coaching-group sidebars.
 * Shows entity logo when set; otherwise the signed-in user's profile photo.
 */
export default function ManagedEntitySidebarAvatar({
  description,
  imageUrl,
  userImageUrl,
  alt = '',
  className = 'w-20 h-20 rounded-2xl',
}: ManagedEntitySidebarAvatarProps) {
  const src = resolveManagedEntityDisplayImageUrl({
    description,
    imageUrl,
    userImageUrl,
  });

  if (src) {
    if (isDataUrl(src)) {
      return (
        <div
          className={`relative overflow-hidden shadow-lg bg-gray-100 ${className}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        </div>
      );
    }
    return (
      <div className={`relative overflow-hidden shadow-lg bg-gray-100 ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ${className}`}
    >
      <Users className="w-10 h-10 text-white" />
    </div>
  );
}
