'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import { getTranslateFetchHeaders } from '@/utils/richTextTranslation';
import AdminRegisteredUsersList from '@/components/admin/AdminRegisteredUsersList';
import SpecialOfferLogoImage from '@/components/subscriptions/SpecialOfferLogoImage';

type Form = {
  enabled: boolean;
  titleByLang: Record<string, string>;
  descriptionByLang: Record<string, string>;
  buttonLabelByLang: Record<string, string>;
  validFrom: string;
  validTo: string;
  costEuro: string;
  daysOfSubscription: string;
  analyzeWithinDays: string;
  logoUrl: string;
};

const EMPTY: Form = {
  enabled: false,
  titleByLang: {},
  descriptionByLang: {},
  buttonLabelByLang: { en: 'CLICK HERE' },
  validFrom: '',
  validTo: '',
  costEuro: '',
  daysOfSubscription: '1095',
  analyzeWithinDays: '60',
  logoUrl: '',
};

type Props = { versionId: number; versionName: string };

const inputClass = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-[#fffde7] w-full';

export default function SpecialUpgradeSettingsPanel({ versionId, versionName }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [activeLang, setActiveLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = getAdminBearerToken();
    if (!token) {
      setMessage({ tone: 'error', text: 'Admin session not found' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/special-upgrades/${versionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const o = data.offer || {};
      setForm({
        enabled: Boolean(o.enabled),
        titleByLang: o.titleByLang || {},
        descriptionByLang: o.descriptionByLang || {},
        buttonLabelByLang: o.buttonLabelByLang || { en: 'CLICK HERE' },
        validFrom: String(o.validFrom || ''),
        validTo: String(o.validTo || ''),
        costEuro: o.costEuro != null ? String(o.costEuro) : '',
        daysOfSubscription: String(o.daysOfSubscription ?? 1095),
        analyzeWithinDays: String(o.analyzeWithinDays ?? 60),
        logoUrl: String(o.logoUrl || ''),
      });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Load failed' });
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const token = getAdminBearerToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/special-upgrades/${versionId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          titleByLang: form.titleByLang,
          descriptionByLang: form.descriptionByLang,
          buttonLabelByLang: form.buttonLabelByLang,
          validFrom: form.validFrom,
          validTo: form.validTo,
          costEuro: Number(form.costEuro) || 0,
          daysOfSubscription: Number(form.daysOfSubscription) || 365,
          analyzeWithinDays: Number(form.analyzeWithinDays) || 0,
          logoUrl: form.logoUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage({ tone: 'ok', text: 'Special upgrade saved' });
      setListRevision((n) => n + 1);
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const translate = async () => {
    const title = form.titleByLang[activeLang] || form.titleByLang.en || '';
    const desc = form.descriptionByLang[activeLang] || form.descriptionByLang.en || '';
    if (!title && !desc) return;
    try {
      const targets = SUPPORTED_LANGUAGES.map((l) => l.code).filter((c) => c !== activeLang);
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: getTranslateFetchHeaders(),
        body: JSON.stringify({ text: `${title}\n---\n${desc}`, targetLanguages: targets }),
      });
      const data = await res.json();
      const translations = (data?.translations ?? {}) as Record<string, string>;
      setForm((f) => {
        const titleByLang = { ...f.titleByLang };
        const descriptionByLang = { ...f.descriptionByLang };
        for (const [code, text] of Object.entries(translations)) {
          const [t, d] = String(text).split('\n---\n');
          if (t?.trim()) titleByLang[code] = t.trim();
          if (d?.trim()) descriptionByLang[code] = d.trim();
        }
        return { ...f, titleByLang, descriptionByLang };
      });
    } catch {
      setMessage({ tone: 'error', text: 'Translation failed' });
    }
  };

  const uploadLogo = async (file: File) => {
    const token = getAdminBearerToken();
    if (!token) return;
    const body = new FormData();
    body.set('file', file);
    body.set('kind', 'special-offer-logo');
    const res = await fetch('/api/admin/subscriptions/special-offers/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) setForm((f) => ({ ...f, logoUrl: String(data.url) }));
  };

  if (loading) return <p className="p-4 text-sm text-gray-500">Loading special upgrade…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="rounded bg-green-700 px-3 py-2 text-white">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          Activate the special upgrade
        </label>
      </div>

      <div className="flex flex-wrap gap-1">
        {SUPPORTED_LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setActiveLang(l.code)}
            className={`rounded px-2 py-1 text-xs font-bold ${
              activeLang === l.code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Title</label>
        <input
          className={inputClass}
          value={form.titleByLang[activeLang] || ''}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              titleByLang: { ...f.titleByLang, [activeLang]: e.target.value },
            }))
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Description</label>
        <textarea
          className={inputClass}
          rows={4}
          value={form.descriptionByLang[activeLang] || ''}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              descriptionByLang: { ...f.descriptionByLang, [activeLang]: e.target.value },
            }))
          }
        />
      </div>
      <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => void translate()}>
        Translation
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Valid from</label>
          <input
            type="date"
            className={inputClass}
            value={form.validFrom}
            onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Valid to</label>
          <input
            type="date"
            className={inputClass}
            value={form.validTo}
            onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">New price (€)</label>
          <input
            className={inputClass}
            value={form.costEuro}
            onChange={(e) => setForm((f) => ({ ...f, costEuro: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
            Days of subscription in upgrade
          </label>
          <input
            className={inputClass}
            value={form.daysOfSubscription}
            onChange={(e) => setForm((f) => ({ ...f, daysOfSubscription: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
            Analyze within this number of days
          </label>
          <input
            className={inputClass}
            value={form.analyzeWithinDays}
            onChange={(e) => setForm((f) => ({ ...f, analyzeWithinDays: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Button label</label>
          <input
            className={inputClass}
            value={form.buttonLabelByLang[activeLang] || ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                buttonLabelByLang: { ...f.buttonLabelByLang, [activeLang]: e.target.value },
              }))
            }
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">Offer logo icon</label>
        {form.logoUrl ? <SpecialOfferLogoImage src={form.logoUrl} className="mb-2 h-20 w-20 object-contain" /> : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadLogo(f);
          }}
        />
      </div>

      {message ? (
        <p className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded bg-black px-6 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      <div className="border-t pt-4">
        <div className="mb-2 rounded bg-red-800 px-3 py-2 text-sm font-semibold text-white">
          Users registered with special upgrade
        </div>
        <p className="mb-2 text-sm text-purple-800">
          Users who registered themselves with the special upgrade — {versionName}
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
          <AdminRegisteredUsersList
            key={listRevision}
            segment="all"
            roleTitle="Special upgrade"
            historicalSubtitle="Special upgrade registrations"
            specialUpgradeVersionId={versionId}
          />
        </Suspense>
      </div>
    </div>
  );
}
