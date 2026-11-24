'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
import FaqMetaForm, { type FaqMetaValues } from '@/components/faqs/admin/FaqMetaForm';
import { faqAdminFetch } from '@/lib/faqs/faqClient';
import { FAQ_CHAPTER_COLORS, type FaqAdminRowDto } from '@/lib/faqs/faqConstants';
import type { FaqDetailDto } from '@/lib/faqs/faqService';

export function FaqModal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
  headerClass = 'bg-white text-[#2b54c5] text-center',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  headerClass?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} overflow-hidden rounded-lg bg-[#e6e6e6] shadow-2xl`}>
        <div className={`relative px-4 py-3 text-lg ${headerClass}`}>
          {title}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** Red message popup (PHP "The FAQ added successfully."). */
export function FaqNoticeModal({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 p-4 pt-24" onMouseDown={onClose}>
      <div className="relative w-full max-w-md rounded bg-white p-3 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-700 bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="rounded border border-red-900 bg-[#e05050] py-2 text-center text-sm font-bold text-gray-900">{text}</p>
      </div>
    </div>
  );
}

export function FaqConfirmModal({
  text,
  onConfirm,
  onClose,
}: {
  text: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <FaqModal title="Confirm" onClose={onClose} width="max-w-sm">
      <p className="text-center text-sm text-gray-800">{text}</p>
      {error ? <p className="mt-2 text-center text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex justify-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Operation failed');
              setBusy(false);
            }
          }}
          className="rounded bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" onClick={onClose} className="rounded bg-white px-4 py-1.5 text-sm hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </FaqModal>
  );
}

/** ⋮ → Edit: the parameters of the FAQ (not the content). */
export function FaqEditModal({
  faq,
  onClose,
  onSaved,
}: {
  faq: FaqAdminRowDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial: FaqMetaValues = {
    code: faq.code,
    pairs: faq.pairs,
    iconPath: faq.iconPath,
    docType: faq.docType,
    url: faq.url,
    title: faq.title,
    subtitle: faq.subtitle,
  };
  return (
    <FaqModal title="Edit Faq" onClose={onClose} width="max-w-2xl">
      <div className="rounded bg-white p-3">
        <FaqMetaForm
          compact
          initial={initial}
          onCancel={onClose}
          onSubmit={async (values) => {
            await faqAdminFetch(`/api/admin/faqs/items/${encodeURIComponent(faq.id)}`, { method: 'PUT', json: values });
            onSaved();
          }}
        />
      </div>
    </FaqModal>
  );
}

/** "Movesbook FAQ-related pages": the pages where this FAQ is shown by "FAQs of the Page". */
export function FaqPagesModal({ faqId, onClose }: { faqId: string; onClose: () => void }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    faqAdminFetch<{ faq: FaqDetailDto }>(`/api/admin/faqs/items/${encodeURIComponent(faqId)}`)
      .then((d) => setPages(d.faq.pages.map((p) => p.url)))
      .catch((e) => setError(e.message));
  }, [faqId]);

  const save = async () => {
    if (!pages) return;
    setSaving(true);
    setError('');
    try {
      await faqAdminFetch(`/api/admin/faqs/items/${encodeURIComponent(faqId)}/pages`, {
        method: 'PUT',
        json: { pages: pages.map((p) => p.trim()).filter(Boolean) },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <FaqModal
      title="Movesbook FAQ-related pages"
      onClose={onClose}
      width="max-w-2xl"
      headerClass="bg-[#0ea5e9] text-white text-center font-bold"
    >
      <div className="rounded bg-white p-3">
        {!pages ? (
          <p className="text-sm text-gray-500">{error || 'Loading…'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-300 text-gray-800">
                <th className="px-2 py-2 text-center">URL</th>
                <th className="w-24 px-2 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-2 py-3 text-center text-gray-500">No pages linked yet.</td>
                </tr>
              ) : null}
              {pages.map((url, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-2 py-1.5">
                    {editing === i ? (
                      <input
                        autoFocus
                        value={url}
                        placeholder="https://movesbook.eu/users/club_user_faccess"
                        onChange={(e) => setPages((p) => p!.map((x, j) => (j === i ? e.target.value : x)))}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                        className="w-full rounded-sm border border-gray-300 px-2 py-1"
                      />
                    ) : (
                      <span className="break-all">{url || <em className="text-gray-400">empty</em>}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      aria-label="Edit url"
                      onClick={() => setEditing(i)}
                      className="mr-2 rounded p-1 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove url"
                      onClick={() => {
                        setPages((p) => p!.filter((_, j) => j !== i));
                        setEditing(null);
                      }}
                      className="rounded bg-red-700 p-1 text-white hover:bg-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Full URL or path of a Movesbook page, e.g. /users/club_user_faccess. The FAQ is shown when a user presses
          “FAQs of the Page” on that page.
        </p>
        {error && pages ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-4">
          <button
            type="button"
            disabled={!pages}
            onClick={() => {
              setPages((p) => [...(p ?? []), '']);
              setEditing(pages?.length ?? 0);
            }}
            className="rounded bg-gray-600 px-4 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Add a new page linked
          </button>
          <button
            type="button"
            disabled={!pages || saving}
            onClick={save}
            className="rounded bg-gray-600 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </FaqModal>
  );
}

/** "Create Chapter": title + background/text color preset, inserted above the selected FAQ. */
export function FaqChapterModal({
  beforeFaqId,
  onClose,
  onCreated,
}: {
  beforeFaqId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(3);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return setError('Type a title for the chapter');
    setSaving(true);
    try {
      const c = FAQ_CHAPTER_COLORS[color];
      await faqAdminFetch('/api/admin/faqs/chapters', {
        method: 'POST',
        json: { title: title.trim(), bg: c.bg, fg: c.fg, beforeFaqId },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <FaqModal title="Create Chapter" onClose={onClose} headerClass="text-gray-700 text-center text-xl">
      <label htmlFor="faq-chapter-title" className="text-base text-gray-800">Chapter Title:</label>
      <input
        id="faq-chapter-title"
        autoFocus
        value={title}
        maxLength={255}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-1 w-full rounded-sm border border-gray-200 bg-white px-2 py-1.5 text-sm"
      />
      <p className="mt-3 text-base text-gray-800">Choose Background Color:</p>
      <div className="mt-2 grid grid-cols-9 gap-2">
        {FAQ_CHAPTER_COLORS.map((c, i) => (
          <button
            key={c.bg + i}
            type="button"
            aria-label={`Color ${i + 1}`}
            aria-pressed={color === i}
            onClick={() => setColor(i)}
            style={{ backgroundColor: c.bg, color: c.fg }}
            className={`h-8 w-8 rounded-sm text-base font-bold ${color === i ? 'ring-2 ring-black ring-offset-1' : ''}`}
          >
            A
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 flex justify-between px-12">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded bg-white px-4 py-1.5 text-base hover:bg-gray-100 disabled:opacity-60"
        >
          Ok
        </button>
        <button type="button" onClick={onClose} className="rounded bg-white px-4 py-1.5 text-base hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </FaqModal>
  );
}
