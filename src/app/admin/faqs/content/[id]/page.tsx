'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useFaqAdminGate } from '@/components/faqs/admin/useFaqAdminGate';
import { faqAdminFetch } from '@/lib/faqs/faqClient';
import {
  FAQ_LANGUAGES,
  faqPairLabel,
  type FaqLanguageCode,
  type FaqTranslationDto,
} from '@/lib/faqs/faqConstants';
import type { FaqDetailDto } from '@/lib/faqs/faqService';

const CKEditor4 = dynamic(() => import('@/components/promocodes/PromocodeInviteCKEditor4'), {
  ssr: false,
  loading: () => <div className="min-h-[360px] border border-gray-300 p-3 text-sm text-gray-500">Loading editor…</div>,
});

/** CKEditor 4 "full" like the PHP site, without the PHP kcfinder file browser (not ported). */
const CKE_CONFIG = {
  language: 'en',
  removeButtons: '',
  filebrowserBrowseUrl: '',
  filebrowserImageBrowseUrl: '',
  filebrowserFlashBrowseUrl: '',
  filebrowserUploadUrl: '',
  filebrowserImageUploadUrl: '',
  filebrowserFlashUploadUrl: '',
  uploadUrl: '',
  removeDialogTabs: 'image:Upload;image:advanced;link:upload',
};

type Draft = Record<FaqLanguageCode, { title: string; subtitle: string; content: string }>;

function buildDraft(faq: FaqDetailDto): Draft {
  const draft = {} as Draft;
  for (const l of FAQ_LANGUAGES) {
    const t = faq.translations.find((x) => x.lang === l.code);
    draft[l.code] = { title: t?.title ?? '', subtitle: t?.subtitle ?? '', content: t?.content ?? '' };
  }
  // PHP: the English editor starts from the Variable Title / Subtitle of the FAQ.
  if (!draft.en.title && !draft.en.subtitle && !draft.en.content) {
    draft.en = { ...draft.en, title: faq.title, subtitle: faq.subtitle };
  }
  return draft;
}

/** "Edit a FAQ Variable (Title, Sub Title and Content) Languages" — opened by clicking a title. */
export default function AdminFaqContentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const ready = useFaqAdminGate();

  const [faq, setFaq] = useState<FaqDetailDto | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState<FaqLanguageCode>('en');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const d = await faqAdminFetch<{ faq: FaqDetailDto }>(`/api/admin/faqs/items/${encodeURIComponent(id)}`);
    setFaq(d.faq);
    return d.faq;
  }, [id]);

  useEffect(() => {
    if (!ready || !id) return;
    load()
      .then((f) => setDraft(buildDraft(f)))
      .catch((e) => setMessage({ ok: false, text: e.message }));
  }, [ready, id, load]);

  const filled = useMemo(() => new Set(faq?.filledLangs ?? []), [faq]);

  const update = (field: 'title' | 'subtitle' | 'content', value: string) =>
    setDraft((d) => (d ? { ...d, [lang]: { ...d[lang], [field]: value } } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const translations: FaqTranslationDto[] = FAQ_LANGUAGES.map((l) => ({ lang: l.code, ...draft[l.code] }));
      await faqAdminFetch(`/api/admin/faqs/items/${encodeURIComponent(id)}/translations`, {
        method: 'PUT',
        json: { translations },
      });
      await load();
      setMessage({ ok: true, text: 'FAQ saved.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  const langMeta = FAQ_LANGUAGES.find((l) => l.code === lang)!;
  const current = draft?.[lang];

  return (
    <div className="space-y-4 p-4">
      <div className="border border-gray-300 bg-white">
        <h1 className="border-b border-gray-300 bg-[#e3e3e3] px-3 py-1.5 text-base font-bold text-gray-900">
          Edit a FAQ Variable (Title,Sub Title and Content) Languages
        </h1>
        {!faq ? (
          <p className="p-3 text-sm text-gray-500">{message?.text ?? 'Loading…'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-3 py-2 font-normal">Select</th>
                  <th className="px-3 py-2 font-normal">Variable Title</th>
                  <th className="px-3 py-2 font-normal">Section</th>
                  <th className="px-3 py-2 font-normal">Language</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      aria-label="Activate editing"
                      checked={editing}
                      onChange={() => setEditing(true)}
                    />
                  </td>
                  <td className="px-3 py-2">{faq.title || faq.code}</td>
                  <td className="px-3 py-2">
                    {faq.pairs.map((p) => faqPairLabel(p.section, p.subsection).replace(' - ', '-')).join(', ')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {FAQ_LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          disabled={!editing}
                          onClick={() => setLang(l.code)}
                          title={
                            editing
                              ? `${l.name}${filled.has(l.code) ? ' — saved' : ' — empty'}`
                              : 'Select the row first'
                          }
                          className={`inline-flex items-center gap-1 rounded px-0.5 ${
                            editing && lang === l.code ? 'bg-yellow-100 ring-1 ring-red-500' : ''
                          } ${editing ? 'hover:bg-gray-200' : 'cursor-default'}`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${filled.has(l.code) ? 'bg-green-600' : 'bg-orange-500'}`}
                            aria-hidden
                          />
                          {l.label}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.flag} alt="" className="h-3 w-4 object-cover" />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            {!editing ? (
              <p className="px-3 pb-2 text-xs text-gray-500">
                Click the radio to activate the editing, then select a language.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => router.push('/admin/faqs')}
          className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
        >
          Cancel
        </button>
      </div>

      {editing && current ? (
        <div className="border border-gray-300 bg-white p-4">
          <h2 className="mb-4 bg-[#c5bde8] py-2 text-center text-base font-bold text-white">
            FAQ Variable (Title,Sub Title and Content) Languages
          </h2>
          <div className="mx-auto mb-4 max-w-2xl rounded border border-gray-300 p-3">
            <div className="grid grid-cols-[70px_56px_minmax(0,1fr)] items-center gap-2">
              <label htmlFor="faq-tr-title" className="text-sm text-gray-700">Title</label>
              <span className="rounded border border-red-500 bg-[#f5deb3] py-0.5 text-center text-base text-gray-900">
                {langMeta.code.charAt(0).toUpperCase() + langMeta.code.slice(1)}
              </span>
              <input
                id="faq-tr-title"
                value={current.title}
                maxLength={500}
                placeholder="Title for this FAQ"
                onChange={(e) => update('title', e.target.value)}
                className="rounded-sm border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900"
              />
              <label htmlFor="faq-tr-subtitle" className="text-sm text-gray-700">Sub-Title</label>
              <span />
              <input
                id="faq-tr-subtitle"
                value={current.subtitle}
                maxLength={500}
                placeholder="Sub-Title for this FAQ"
                onChange={(e) => update('subtitle', e.target.value)}
                className="rounded-sm border border-gray-300 px-2 py-1 text-sm text-gray-900"
              />
            </div>
          </div>
          <p className="mb-1 text-sm text-gray-700">Content</p>
          <CKEditor4
            id="faq_content_editor"
            value={current.content}
            onChange={(html) => update('content', html)}
            minHeightPx={360}
            config={CKE_CONFIG}
          />
          {message ? (
            <p className={`mt-3 text-center text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
          ) : null}
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/faqs')}
              className="rounded bg-[#333] px-4 py-1.5 text-sm font-bold text-white hover:bg-black"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
