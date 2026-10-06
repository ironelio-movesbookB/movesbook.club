'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import { getTranslateFetchHeaders } from '@/utils/richTextTranslation';
import AdminRegisteredUsersList from '@/components/admin/AdminRegisteredUsersList';

const TITLE_MAX = 30;
const DESCRIPTION_MAX = 255;

type OfferForm = {
  enabled: boolean;
  titleByLang: Record<string, string>;
  descriptionByLang: Record<string, string>;
  counterLangs: string[];
  validFrom: string;
  validTo: string;
  costEuro: string;
  maxSubscriptions: string;
  counterStart: string;
  logoUrl: string;
};

type OfferStatus = {
  registeredCount: number;
  stillFree: number | null;
  isActiveNow: boolean;
};

const EMPTY_FORM: OfferForm = {
  enabled: false,
  titleByLang: {},
  descriptionByLang: {},
  counterLangs: [],
  validFrom: '',
  validTo: '',
  costEuro: '',
  maxSubscriptions: '',
  counterStart: '0',
  logoUrl: '',
};

type Props = {
  versionId: number;
  versionName: string;
};

async function translateToAllLanguages(text: string): Promise<Record<string, string>> {
  const targetLanguages = SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => c !== 'en');
  const res = await fetch('/api/translate', {
    method: 'POST',
    cache: 'no-store',
    headers: getTranslateFetchHeaders(),
    body: JSON.stringify({ text, targetLanguages }),
  });
  if (!res.ok) throw new Error(`Translation failed (${res.status})`);
  const data = await res.json();
  const translations = (data?.translations ?? {}) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const code of targetLanguages) {
    const value = translations[code];
    if (typeof value === 'string' && value.trim()) out[code] = value.trim();
  }
  return out;
}

const inputClass = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-[#fffde7]';

export default function SpecialOfferSettingsPanel({ versionId, versionName }: Props) {
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);
  const [status, setStatus] = useState<OfferStatus | null>(null);
  const [activeLang, setActiveLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyOffer = useCallback((offer: Record<string, unknown>) => {
    setForm({
      enabled: Boolean(offer.enabled),
      titleByLang: (offer.titleByLang as Record<string, string>) || {},
      descriptionByLang: (offer.descriptionByLang as Record<string, string>) || {},
      counterLangs: (offer.counterLangs as string[]) || [],
      validFrom: String(offer.validFrom || ''),
      validTo: String(offer.validTo || ''),
      costEuro: offer.costEuro ? String(offer.costEuro) : '',
      maxSubscriptions: offer.maxSubscriptions ? String(offer.maxSubscriptions) : '',
      counterStart: String(offer.counterStart ?? 0),
      logoUrl: String(offer.logoUrl || ''),
    });
    setStatus({
      registeredCount: Number(offer.registeredCount) || 0,
      stillFree: offer.stillFree == null ? null : Number(offer.stillFree),
      isActiveNow: Boolean(offer.isActiveNow),
    });
  }, []);

  useEffect(() => {
    const token = getAdminBearerToken();
    if (!token) {
      setMessage({ tone: 'error', text: 'Admin session not found. Please log in again.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch(`/api/admin/subscriptions/special-offers/${versionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load the special offer');
        applyOffer(data.offer || {});
      })
      .catch((e) => setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Failed to load' }))
      .finally(() => setLoading(false));
  }, [versionId, applyOffer]);

  const setLangText = (field: 'titleByLang' | 'descriptionByLang', value: string) => {
    const max = field === 'titleByLang' ? TITLE_MAX : DESCRIPTION_MAX;
    setForm((prev) => ({ ...prev, [field]: { ...prev[field], [activeLang]: value.slice(0, max) } }));
  };

  const toggleCounterLang = (lang: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      counterLangs: checked
        ? [...new Set([...prev.counterLangs, lang])]
        : prev.counterLangs.filter((l) => l !== lang),
    }));
  };

  async function handleTranslate() {
    const title = form.titleByLang.en?.trim() || '';
    const description = form.descriptionByLang.en?.trim() || '';
    if (!title && !description) {
      setMessage({ tone: 'error', text: 'Enter the English title or description first, then press Translation.' });
      return;
    }
    setTranslating(true);
    setMessage(null);
    try {
      const [titles, descriptions] = await Promise.all([
        title ? translateToAllLanguages(title) : Promise.resolve({} as Record<string, string>),
        description ? translateToAllLanguages(description) : Promise.resolve({} as Record<string, string>),
      ]);
      const clip = (map: Record<string, string>, max: number) =>
        Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.slice(0, max)]));
      setForm((prev) => ({
        ...prev,
        titleByLang: { ...prev.titleByLang, ...clip(titles, TITLE_MAX) },
        descriptionByLang: { ...prev.descriptionByLang, ...clip(descriptions, DESCRIPTION_MAX) },
      }));
      setMessage({ tone: 'ok', text: 'Translations added. Review them, then press Save.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Translation failed' });
    } finally {
      setTranslating(false);
    }
  }

  async function handleLogoFile(file: File | undefined) {
    if (!file) return;
    const token = getAdminBearerToken();
    if (!token) return;
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/subscriptions/special-offers/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((prev) => ({ ...prev, logoUrl: String(data.path || '') }));
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    const token = getAdminBearerToken();
    if (!token) return;
    if (form.enabled) {
      if (!form.titleByLang.en?.trim()) {
        setMessage({ tone: 'error', text: 'Enter at least the English title of the special offer.' });
        return;
      }
      if (!form.validFrom || !form.validTo) {
        setMessage({ tone: 'error', text: 'Set the validity period (from … to …).' });
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/special-offers/${versionId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          costEuro: Number(form.costEuro) || 0,
          maxSubscriptions: Number(form.maxSubscriptions) || 0,
          counterStart: Number(form.counterStart) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      applyOffer(data.offer || {});
      setListRevision((v) => v + 1);
      setMessage({ tone: 'ok', text: 'Special offer saved.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading special offer…</div>;
  }

  const activeLangInfo = SUPPORTED_LANGUAGES.find((l) => l.code === activeLang);
  const title = form.titleByLang[activeLang] || '';
  const description = form.descriptionByLang[activeLang] || '';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-300">
        <div className="bg-[#5cb85c] px-4 py-2 text-sm font-bold text-white">
          Special offer — {versionName}
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Activate the special offer for this version
          </label>

          {status ? (
            <p className="text-xs text-gray-600">
              {status.isActiveNow ? (
                <span className="font-semibold text-green-700">Visible on the registration page now.</span>
              ) : (
                <span className="font-semibold text-gray-500">Not visible on the registration page (disabled or outside the validity period).</span>
              )}{' '}
              Registered with this offer: <strong>{status.registeredCount}</strong>
              {status.stillFree !== null ? (
                <>
                  {' '}· Still free: <strong>{status.stillFree}</strong>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="border border-gray-200 rounded">
            <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-[#f5f5f5] px-2 py-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const filled = Boolean(form.titleByLang[lang.code]?.trim());
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setActiveLang(lang.code)}
                    className={`min-w-[36px] px-2 py-0.5 text-xs font-semibold border ${
                      activeLang === lang.code
                        ? 'bg-[#f0ad4e] border-[#eea236] text-gray-900'
                        : filled
                          ? 'bg-white border-green-500 text-gray-700'
                          : 'bg-white border-gray-300 text-gray-500'
                    }`}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gradient-to-r from-indigo-500 to-purple-500 px-2 py-0.5 text-xs font-bold text-white">
                    {activeLang.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-800">{activeLangInfo?.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleTranslate()}
                  disabled={translating}
                  className="border-2 border-red-600 px-4 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {translating ? 'Translating…' : 'Translation'}
                </button>
              </div>
              <label className="block text-sm">
                <span className="font-semibold text-gray-800">
                  Title <span className="text-gray-400 font-normal">(max {TITLE_MAX} chars)</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => setLangText('titleByLang', e.target.value)}
                  maxLength={TITLE_MAX}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-400">
                  {title.length}/{TITLE_MAX}
                </span>
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-gray-800">
                  Description <span className="text-gray-400 font-normal">(max {DESCRIPTION_MAX} chars)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setLangText('descriptionByLang', e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  rows={6}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-400">
                  {description.length}/{DESCRIPTION_MAX}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={form.counterLangs.includes(activeLang)}
                  onChange={(e) => toggleCounterLang(activeLang, e.target.checked)}
                />
                Enable the offer counter (&quot;Still free&quot;) in {activeLangInfo?.name || activeLang}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="text-sm">
              <span className="block font-semibold text-gray-800 mb-1">Validity period</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">from</span>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))}
                  className={inputClass}
                />
                <span className="text-gray-600">to</span>
                <input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <label className="text-sm">
              <span className="block font-semibold text-gray-800 mb-1">Cost in €</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.costEuro}
                onChange={(e) => setForm((prev) => ({ ...prev, costEuro: e.target.value }))}
                className={`${inputClass} w-32`}
              />
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-800 mb-1">
                Maximum number of allowed subscriptions
              </span>
              <input
                type="number"
                min={0}
                value={form.maxSubscriptions}
                onChange={(e) => setForm((prev) => ({ ...prev, maxSubscriptions: e.target.value }))}
                className={`${inputClass} w-32`}
              />
              <span className="block text-xs text-gray-500 mt-1">Leave empty or 0 for no limit.</span>
            </label>
            <label className="text-sm">
              <span className="block font-semibold text-gray-800 mb-1">Counter start point</span>
              <input
                type="number"
                min={0}
                value={form.counterStart}
                onChange={(e) => setForm((prev) => ({ ...prev, counterStart: e.target.value }))}
                className={`${inputClass} w-32`}
              />
              <span className="block text-xs text-gray-500 mt-1">
                Subscriptions already counted as taken when the offer starts.
              </span>
            </label>
          </div>

          <div className="text-sm">
            <span className="block font-semibold text-gray-800 mb-1">Offer logo icon</span>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="" className="h-20 w-20 object-contain border border-gray-200 bg-white" />
              ) : (
                <div className="h-20 w-20 border border-dashed border-gray-300 bg-gray-50" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleLogoFile(e.target.files?.[0])}
                className="text-xs"
              />
              {uploading ? <span className="text-xs text-gray-500">Uploading…</span> : null}
              {form.logoUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          {message ? (
            <p className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
          ) : null}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-[#333] hover:bg-black text-white px-8 py-2 text-sm font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300">
        <div className="bg-[#a94442] px-4 py-2 text-sm font-bold text-white">
          Users registered with this special offer
        </div>
        <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
          <AdminRegisteredUsersList
            key={listRevision}
            segment="all"
            roleTitle={`Special offer — ${versionName}`}
            historicalSubtitle="Users who registered themselves with the special offer of this version"
            specialOfferVersionId={versionId}
          />
        </Suspense>
      </div>
    </div>
  );
}
