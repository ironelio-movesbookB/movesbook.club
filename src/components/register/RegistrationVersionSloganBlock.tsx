'use client';

import { getSloganForLang } from '@/lib/admin/subscriptionSlogan';
import type { SubscriptionGeneralSettings } from '@/types/adminSubscriptionSettings';

type RegistrationVersionSloganBlockProps = {
  general: SubscriptionGeneralSettings;
  lang: string;
  versionName?: string;
  variant?: 'registration' | 'admin-preview';
};

export default function RegistrationVersionSloganBlock({
  general,
  lang,
  versionName,
  variant = 'registration',
}: RegistrationVersionSloganBlockProps) {
  const sloganHtml = getSloganForLang(general.sloganByLang, lang);

  if (!sloganHtml) {
    if (variant === 'admin-preview') {
      return (
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs text-gray-500">
          No Info version text yet for this language. Enter content above — it opens when the user
          clicks Info Versions during registration (English used as fallback).
        </p>
      );
    }
    return null;
  }

  const containerClass =
    variant === 'registration'
      ? 'rounded-md border border-[#7a1f2e]/20 bg-white/90 px-3 py-2.5'
      : 'rounded border border-gray-300 bg-white px-3 py-3';

  return (
    <div className={containerClass}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#7a1f2e]">
        {versionName ? `Info version — ${versionName}` : 'Info version'}
      </div>
      <div
        className="prose prose-sm mt-1 max-w-none text-gray-800 [&_p:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: sloganHtml }}
      />
    </div>
  );
}
