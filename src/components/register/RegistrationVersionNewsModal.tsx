'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getLastNewsForLang, getSloganForLang } from '@/lib/admin/subscriptionSlogan';
import { getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import { hasRichTextContent } from '@/utils/richTextTranslation';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

export type RegistrationVersionTextMode = 'info' | 'news';

type RegistrationVersionNewsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  versionId: number | null;
  versionName?: string;
  lang: string;
  editData?: SubscriptionEditData | null;
  /** info = "Info version" text, news = "Last news about this version". */
  mode?: RegistrationVersionTextMode;
  /** Opens the package comparison of all versions (Info mode only). */
  onShowAllVersions?: () => void;
};

/** Registration modal for the version texts set in the subscription admin (Info version / Last news). */
export default function RegistrationVersionNewsModal({
  isOpen,
  onClose,
  versionId,
  versionName,
  lang,
  editData: editDataProp,
  mode = 'news',
  onShowAllVersions,
}: RegistrationVersionNewsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const editData =
    editDataProp ?? (versionId ? getSubscriptionEditData(versionId, false) : null);
  const html = editData
    ? mode === 'info'
      ? getSloganForLang(editData.general.sloganByLang, lang)
      : getLastNewsForLang(editData.settings.lastNewsByLang, lang)
    : '';
  const title = mode === 'info' ? 'Info version' : 'News about version';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#7a1f2e] px-4 py-3 text-white">
          <h3 className="font-bold text-sm uppercase">
            {title}
            {versionName ? ` — ${versionName}` : ''}
          </h3>
          <button type="button" onClick={onClose} className="text-white hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {hasRichTextContent(html) ? (
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-gray-600">
              {mode === 'info'
                ? 'Info version content for this plan will be available soon.'
                : 'There are no news about this version yet.'}
            </p>
          )}
          {mode === 'info' && onShowAllVersions ? (
            <div className="mt-5 border-t border-gray-200 pt-4 text-center">
              <button
                type="button"
                onClick={onShowAllVersions}
                className="rounded-md bg-[#555] px-4 py-2 text-xs font-bold text-white hover:bg-[#333]"
              >
                Compare all versions
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
