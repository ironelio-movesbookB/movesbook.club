'use client';

import { getLastNewsForLang } from '@/lib/admin/subscriptionSlogan';

type RegistrationVersionLastNewsBlockProps = {
  lastNewsByLang: Record<string, string>;
  lang: string;
  versionName?: string;
  variant?: 'registration' | 'admin-preview' | 'tab';
};

export default function RegistrationVersionLastNewsBlock({
  lastNewsByLang,
  lang,
  versionName,
  variant = 'registration',
}: RegistrationVersionLastNewsBlockProps) {
  const newsHtml = getLastNewsForLang(lastNewsByLang, lang);

  if (variant === 'tab') {
    return (
      <div className="p-6">
        <h3 className="text-center text-lg font-bold text-[#7a1f2e]">Last news about this version</h3>
        <hr className="my-4 border-gray-200" />
        {newsHtml ? (
          <div
            className="prose prose-sm max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: newsHtml }}
          />
        ) : (
          <p className="text-center text-sm text-gray-600">
            Last news for this version will be available soon.
          </p>
        )}
      </div>
    );
  }

  if (!newsHtml) {
    if (variant === 'admin-preview') {
      return (
        <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs text-gray-500">
          No last news yet for this language. Enter English text above — other languages fall back to
          English during registration when their locale is empty.
        </p>
      );
    }
    return null;
  }

  const isRegistration = variant === 'registration';
  const containerClass = isRegistration
    ? 'rounded-md border border-[#7a1f2e]/20 bg-white/90 px-4 py-3 min-h-[120px]'
    : 'rounded border border-gray-300 bg-white px-3 py-3';

  return (
    <div className={containerClass}>
      <div
        className={`${isRegistration ? 'text-xs' : 'text-[10px]'} font-bold uppercase tracking-wide text-[#7a1f2e]`}
      >
        {versionName ? `Last news — ${versionName}` : 'Last news about this version'}
      </div>
      <div
        className={`prose prose-sm mt-1 max-w-none text-gray-800 [&_p:last-child]:mb-0 ${isRegistration ? 'text-[15px]' : ''}`}
        dangerouslySetInnerHTML={{ __html: newsHtml }}
      />
    </div>
  );
}
