'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import {
  SPONSOR_DELAY_MS_DEFAULT,
  SPONSOR_INTERVAL_MAX,
  SPONSOR_INTERVAL_MIN,
  SPONSOR_START_ROW_MAX,
  SPONSOR_START_ROW_MIN,
  clampDelayMs,
  clampIntervalRows,
  clampStartRow,
  findOgpArticleForSponsor,
  resolveSponsorImage,
  toSponsorDateInput,
  type OgpSponsor,
  type OgpSponsorLinkTarget,
  type OgpSponsorSettings,
  type OgpSponsorSize,
  type OgpSponsorSourceArticle,
} from '@/lib/news/ogpSponsors';

export type { OgpSponsorSourceArticle };

type DraftSponsor = {
  clientKey: string;
  id?: string;
  image: string;
  previewUrl: string | null;
  file: File | null;
  ogpArticleId: string;
  size: OgpSponsorSize;
  hoverTitle: string;
  linkUrl: string;
  linkTarget: OgpSponsorLinkTarget;
};

interface OgpSponsorsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial: OgpSponsorSettings | null;
  ogpArticles?: OgpSponsorSourceArticle[];
  onSaved: (settings: OgpSponsorSettings) => void;
}

function newClientKey(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDrafts(sponsors: OgpSponsor[], ogpArticles: OgpSponsorSourceArticle[]): DraftSponsor[] {
  return sponsors.map((s) => {
    const matched = findOgpArticleForSponsor({ ogpArticleId: null, linkUrl: s.linkUrl }, ogpArticles);
    return {
      clientKey: s.id,
      id: s.id,
      image: s.image,
      previewUrl: s.image,
      file: null,
      ogpArticleId: matched?.id ?? '',
      size: s.size,
      hoverTitle: s.hoverTitle,
      linkUrl: s.linkUrl,
      linkTarget: s.linkTarget,
    };
  });
}

function emptyDraft(): DraftSponsor {
  return {
    clientKey: newClientKey(),
    image: '',
    previewUrl: null,
    file: null,
    ogpArticleId: '',
    size: 'single',
    hoverTitle: '',
    linkUrl: '',
    linkTarget: 'tab',
  };
}

async function uploadSponsorImage(file: File): Promise<string> {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'picture');
  const res = await fetch('/api/news/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.path) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to upload picture');
  }
  return data.path as string;
}

export default function OgpSponsorsSettingsModal({
  isOpen,
  onClose,
  initial,
  ogpArticles = [],
  onSaved,
}: OgpSponsorsSettingsModalProps) {
  const [startRow, setStartRow] = useState(2);
  const [intervalRows, setIntervalRows] = useState(12);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [enabled, setEnabled] = useState(true);
  const [enabledFrom, setEnabledFrom] = useState('');
  const [enabledTo, setEnabledTo] = useState('');
  const [drafts, setDrafts] = useState<DraftSponsor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;
    setStartRow(clampStartRow(initial?.startRow ?? 2));
    setIntervalRows(clampIntervalRows(initial?.intervalRows ?? 12));
    setDelaySeconds(Math.round(clampDelayMs(initial?.delayMs ?? SPONSOR_DELAY_MS_DEFAULT) / 1000));
    setEnabled(initial?.enabled !== false);
    setEnabledFrom(toSponsorDateInput(initial?.enabledFrom));
    setEnabledTo(toSponsorDateInput(initial?.enabledTo));
    setDrafts(toDrafts(initial?.sponsors ?? [], ogpArticles));
    setError(null);
    setSaving(false);
  }, [isOpen, initial, ogpArticles]);

  useEffect(() => {
    return () => {
      drafts.forEach((d) => {
        if (d.file && d.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(d.previewUrl);
      });
    };
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const updateDraft = (clientKey: string, patch: Partial<DraftSponsor>) => {
    setDrafts((prev) => prev.map((d) => (d.clientKey === clientKey ? { ...d, ...patch } : d)));
  };

  const handleFile = (clientKey: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, GIF, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be 5MB or less.');
      return;
    }
    setError(null);
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.clientKey !== clientKey) return d;
        if (d.file && d.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(d.previewUrl);
        return { ...d, file, previewUrl: URL.createObjectURL(file) };
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (enabledFrom && enabledTo && enabledFrom > enabledTo) {
        throw new Error('Enabled from must be on or before Enabled to.');
      }
      const sponsors = [];
      for (const draft of drafts) {
        let image = draft.file ? await uploadSponsorImage(draft.file) : draft.image.trim();
        if (!image) {
          image = resolveSponsorImage(
            { image: '', ogpArticleId: draft.ogpArticleId || null, linkUrl: draft.linkUrl },
            ogpArticles,
          );
        }
        if (!image) {
          throw new Error(
            'Each sponsor needs a picture, or an OGP News with a picture (used when no picture is selected).',
          );
        }
        const ogp = findOgpArticleForSponsor(
          { ogpArticleId: draft.ogpArticleId || null, linkUrl: draft.linkUrl },
          ogpArticles,
        );
        sponsors.push({
          id: draft.id,
          image,
          ogpArticleId: draft.ogpArticleId || ogp?.id || undefined,
          size: draft.size,
          hoverTitle: draft.hoverTitle.trim() || ogp?.title || '',
          linkUrl: draft.linkUrl.trim() || ogp?.url || '',
          linkTarget: draft.linkTarget,
        });
      }

      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/admin/ogp-sponsors', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startRow: clampStartRow(startRow),
          intervalRows: clampIntervalRows(intervalRows),
          delayMs: clampDelayMs(delaySeconds * 1000),
          enabled,
          enabledFrom: enabledFrom || null,
          enabledTo: enabledTo || null,
          sponsors,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save');
      }
      onSaved(data as OgpSponsorSettings);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save sponsored news');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ogp-sponsors-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-4 pr-12 border-b border-gray-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 id="ogp-sponsors-title" className="text-lg font-semibold text-gray-900 shrink-0">
              Sponsored News
            </h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none mr-1">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Display all sponsors
            </label>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
            <span className="font-medium whitespace-nowrap">Enabled from</span>
            <input
              type="date"
              value={enabledFrom}
              onChange={(e) => setEnabledFrom(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
              aria-label="Sponsors enabled from date"
            />
            <span className="whitespace-nowrap">to</span>
            <input
              type="date"
              value={enabledTo}
              onChange={(e) => setEnabledTo(e.target.value)}
              min={enabledFrom || undefined}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
              aria-label="Sponsors enabled to date"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Placement</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700">
                <span className="font-medium">A — First sponsor row</span>
                <select
                  value={startRow}
                  onChange={(e) => setStartRow(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Array.from({ length: SPONSOR_START_ROW_MAX - SPONSOR_START_ROW_MIN + 1 }, (_, i) => {
                    const n = SPONSOR_START_ROW_MIN + i;
                    return (
                      <option key={n} value={n}>
                        Row {n}
                      </option>
                    );
                  })}
                </select>
                <span className="mt-1 block text-xs text-gray-500">
                  If that row does not exist on a page, the sponsor is shown on the last available row.
                </span>
              </label>
              <label className="block text-sm text-gray-700">
                <span className="font-medium">B — Repeat every N rows</span>
                <input
                  type="number"
                  min={SPONSOR_INTERVAL_MIN}
                  max={SPONSOR_INTERVAL_MAX}
                  value={intervalRows}
                  onChange={(e) => setIntervalRows(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Min {SPONSOR_INTERVAL_MIN}, max {SPONSOR_INTERVAL_MAX}. Counts across pages (example: start at
                  row 2, every 12 rows, 5 rows/page → next sponsor is row 4 of page 3).
                </span>
              </label>
            </div>
            <label className="block text-sm text-gray-700 max-w-xs">
              <span className="font-medium">Delay between sponsor pictures (seconds)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                disabled={drafts.length < 2}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Used when more than one sponsor is added; pictures rotate in the sponsor slot.
              </span>
            </label>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Sponsors</h3>
              <button
                type="button"
                onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-700"
              >
                <Plus className="w-4 h-4" />
                Add sponsor
              </button>
            </div>

            {drafts.length === 0 && (
              <p className="text-sm text-gray-500">
                No sponsors yet. Add a picture (or use an OGP News picture), size, hover title, and click link.
              </p>
            )}

            <ul className="space-y-4">
              {drafts.map((draft, index) => {
                const ogpFallback = findOgpArticleForSponsor(
                  { ogpArticleId: draft.ogpArticleId || null, linkUrl: draft.linkUrl },
                  ogpArticles,
                );
                const previewSrc =
                  draft.previewUrl ||
                  resolveSponsorImage(
                    { image: draft.image, ogpArticleId: draft.ogpArticleId || null, linkUrl: draft.linkUrl },
                    ogpArticles,
                  ) ||
                  null;
                const usingOgpPicture = !draft.file && !draft.image && !!ogpFallback?.image;
                return (
                <li
                  key={draft.clientKey}
                  className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">Sponsor {index + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((prev) => prev.filter((d) => d.clientKey !== draft.clientKey))
                      }
                      className="p-1 rounded text-red-600 hover:bg-red-50"
                      aria-label={`Remove sponsor ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">OGP News</span>
                    <select
                      value={draft.ogpArticleId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const article = ogpArticles.find((a) => a.id === id);
                        updateDraft(draft.clientKey, {
                          ogpArticleId: id,
                          linkUrl: draft.linkUrl.trim() || article?.url || '',
                          hoverTitle: draft.hoverTitle.trim() || article?.title || '',
                        });
                      }}
                      className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">Select OGP News (optional)</option>
                      {ogpArticles.map((article) => (
                        <option key={article.id} value={article.id}>
                          {article.title || article.url}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-gray-500">
                      If you do not select a picture, this OGP News picture is used.
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-4">
                    <div>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[draft.clientKey] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          handleFile(draft.clientKey, e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[draft.clientKey]?.click()}
                        className="relative w-36 h-24 rounded-lg overflow-hidden border border-dashed border-gray-400 bg-white hover:bg-gray-100"
                      >
                        {previewSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewSrc}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 flex flex-col items-center justify-center text-xs text-gray-500 gap-1">
                            <ImagePlus className="w-5 h-5" />
                            Picture
                          </span>
                        )}
                      </button>
                      <p className="mt-1 text-[11px] text-gray-500 w-36 leading-snug">
                        {usingOgpPicture
                          ? 'Using OGP News picture'
                          : 'Optional. If empty, the OGP News picture is used.'}
                      </p>
                    </div>
                    <div className="flex-1 min-w-[12rem] space-y-2">
                      <fieldset className="text-sm">
                        <legend className="font-medium text-gray-700 mb-1">Size of the picture</legend>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`size-${draft.clientKey}`}
                              checked={draft.size === 'single'}
                              onChange={() => updateDraft(draft.clientKey, { size: 'single' })}
                            />
                            Single size
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`size-${draft.clientKey}`}
                              checked={draft.size === 'double'}
                              onChange={() => updateDraft(draft.clientKey, { size: 'double' })}
                            />
                            Double size
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`size-${draft.clientKey}`}
                              checked={draft.size === 'triple'}
                              onChange={() => updateDraft(draft.clientKey, { size: 'triple' })}
                            />
                            Triple size
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`size-${draft.clientKey}`}
                              checked={draft.size === 'quadruple'}
                              onChange={() => updateDraft(draft.clientKey, { size: 'quadruple' })}
                            />
                            Quadruple size
                          </label>
                        </div>
                      </fieldset>
                      <label className="block text-sm">
                        <span className="font-medium text-gray-700">Title on hover</span>
                        <input
                          type="text"
                          value={draft.hoverTitle}
                          onChange={(e) => updateDraft(draft.clientKey, { hoverTitle: e.target.value })}
                          className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                          placeholder="Shown when the mouse is on the picture"
                        />
                      </label>
                    </div>
                  </div>

                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">Link</span>
                    <input
                      type="url"
                      value={draft.linkUrl}
                      onChange={(e) => {
                        const linkUrl = e.target.value;
                        const matched = findOgpArticleForSponsor(
                          { ogpArticleId: draft.ogpArticleId || null, linkUrl },
                          ogpArticles,
                        );
                        updateDraft(draft.clientKey, {
                          linkUrl,
                          ogpArticleId: draft.ogpArticleId || matched?.id || '',
                        });
                      }}
                      className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                      placeholder="https://"
                    />
                  </label>
                  <fieldset className="text-sm">
                    <legend className="font-medium text-gray-700 mb-1">Open link in</legend>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`target-${draft.clientKey}`}
                          checked={draft.linkTarget === 'tab'}
                          onChange={() => updateDraft(draft.clientKey, { linkTarget: 'tab' })}
                        />
                        New tab
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`target-${draft.clientKey}`}
                          checked={draft.linkTarget === 'window'}
                          onChange={() => updateDraft(draft.clientKey, { linkTarget: 'window' })}
                        />
                        New window
                      </label>
                    </div>
                  </fieldset>
                </li>
                );
              })}
            </ul>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
