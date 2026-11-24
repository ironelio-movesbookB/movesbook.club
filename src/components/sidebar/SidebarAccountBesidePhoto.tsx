'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { movesbookUserTypeLabel } from '@/lib/adminLoginLogLabels';
import { kindFromUserType, STATS_KIND_COLORS } from '@/lib/admin/statisticsKinds';
import { getAuthToken } from '@/utils/auth.utils';
import type { UserType } from '@prisma/client';

type SidebarAccountBesidePhotoProps = {
  userType?: string | null;
};

/** "Club Base" → "Base", "Club Premium" → "Premium". */
function shortVersionLabel(name: string): string {
  const tiers = ['Trial', 'Professional', 'Premium', 'Base', 'Pro'] as const;
  for (const tier of tiers) {
    if (new RegExp(`\\b${tier}\\b`, 'i').test(name)) {
      return tier === 'Pro' ? 'Professional' : tier;
    }
  }
  return name;
}

function formatExpiration(ymd: string | null): string {
  if (!ymd) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) return ymd;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export default function SidebarAccountBesidePhoto({ userType }: SidebarAccountBesidePhotoProps) {
  const { t } = useLanguage();
  const [version, setVersion] = useState<string | null>(null);
  const [expiration, setExpiration] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    void fetch('/api/user/sidebar-account', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { version?: string | null; expiration?: string | null };
      })
      .then((body) => {
        if (cancelled || !body) return;
        setVersion(body.version?.trim() || null);
        setExpiration(body.expiration?.trim() || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userType]);

  const kind = userType ? kindFromUserType(userType) : null;
  const typeColor = kind ? STATS_KIND_COLORS[kind] : '#9ca3af';
  const typeLabel = userType ? movesbookUserTypeLabel(userType as UserType) : '—';

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[auto_auto_auto] items-center justify-start gap-x-2 gap-y-1 self-start pt-0.5 text-[11px] leading-tight">
      <span className="text-gray-300">{t('sidebar_type_of_user')}</span>
      <span className="truncate text-white">{typeLabel}</span>
      <span
        className="h-3 w-8 shrink-0 rounded-[2px] border border-black/30"
        style={{ backgroundColor: typeColor }}
        title={typeLabel}
        aria-hidden
      />
      <span className="text-gray-300">{t('sidebar_version')}</span>
      <span className="col-span-2 truncate text-white">{version ? shortVersionLabel(version) : '—'}</span>
      <span className="text-gray-300">{t('sidebar_expiration')}</span>
      <span className="col-span-2 truncate text-white">{formatExpiration(expiration)}</span>
    </div>
  );
}
