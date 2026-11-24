'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { PromocodeMeta, PromocodeSettingFormData, PromocodeSettingRow } from '@/lib/promocodes/types';
import { promocodesFetch } from './usePromocodesAdminAuth';
import { mergePromocodeLanguageOptions, PROMOCODE_FORM_LANGUAGES } from '@/lib/promocodes/promocodeLanguages';
import { fetchGeneratedPromocode } from '@/lib/promocodes/generatePromocode';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

function parseValidTo(validTo: string | null | undefined) {
  if (!validTo) {
    const now = new Date();
    return {
      toDay: String(now.getDate()).padStart(2, '0'),
      toMonth: String(now.getMonth() + 1).padStart(2, '0'),
      toYear: String(now.getFullYear()),
    };
  }
  const [y, m, d] = validTo.split('-');
  return { toDay: d?.padStart(2, '0') ?? '01', toMonth: m ?? '01', toYear: y ?? String(new Date().getFullYear()) };
}

function settingToForm(
  setting: PromocodeSettingRow | null,
  socialOptions: Record<string, unknown>
): PromocodeSettingFormData {
  const dates = parseValidTo(setting?.validTo);
  return {
    code: setting?.code ?? '',
    enable: setting?.enable === 'Enable',
    ...dates,
    versionIds: setting?.versionId
      ? setting.versionId.split(',').map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [],
    discount: setting?.discount ?? '',
    usableBy: setting?.usableBy ?? 'Once',
    enableExtension: setting?.enableExtension === '1' || setting?.enableExtension === 'on',
    subscriptionExtends: setting?.subscriptionExtends ?? '',
    managementSection: setting?.managementSection ?? '',
    socialOptions,
    enableFreeAccounts: setting?.enableFreeAccounts === '1' || setting?.enableFreeAccounts === 'on',
    basicVersion: setting?.basicVersion ?? '',
    premiumVersion: setting?.premiumVersion ?? '',
    professionalVersion: setting?.professionalVersion ?? '',
    helpHtmlPagesId: setting?.helpHtmlPagesId ?? null,
    languageId: setting?.languageId ?? 1,
    email: setting?.email ?? '',
    recipient: setting?.recipient ?? '',
  };
}

export default function PromocodeForm({
  mode,
  settingId,
  initialSetting,
  initialSocialOptions,
  onSaved,
}: {
  mode: 'add' | 'edit';
  settingId?: number;
  initialSetting?: PromocodeSettingRow | null;
  initialSocialOptions?: Record<string, unknown>;
  onSaved?: (id: number) => void;
}) {
  const [meta, setMeta] = useState<PromocodeMeta | null>(null);
  const [form, setForm] = useState<PromocodeSettingFormData>(() =>
    settingToForm(initialSetting ?? null, initialSocialOptions ?? {})
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [languageOptions, setLanguageOptions] = useState<{ id: number; value: string }[]>(
    PROMOCODE_FORM_LANGUAGES
  );

  useEffect(() => {
    promocodesFetch('/api/admin/promocodes/meta')
      .then((r) => r.json())
      .then(setMeta)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (mode === 'add' && !form.code) {
      fetchGeneratedPromocode()
        .then((code) => setForm((f) => ({ ...f, code })))
        .catch(console.error);
    }
  }, [mode, form.code]);

  const refreshCode = async () => {
    try {
      const code = await fetchGeneratedPromocode();
      setForm((f) => ({ ...f, code }));
    } catch (err) {
      console.error('refreshCode:', err);
    }
  };

  const loadLanguagesForPage = async (pageId: number | null) => {
    if (!pageId || !meta) return;
    const page = meta.helpHtmlPages.find((p) => p.id === pageId);
    if (!page) return;
    const res = await promocodesFetch('/api/admin/promocodes/language-list', {
      method: 'POST',
      body: JSON.stringify({ pageTitle: page.title }),
    });
    const langs = await res.json();
    if (Array.isArray(langs)) {
      setLanguageOptions(mergePromocodeLanguageOptions(langs));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const url =
        mode === 'edit' ? '/api/admin/promocodes/settings' : '/api/admin/promocodes/settings';
      const res = await promocodesFetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          id: settingId,
          creatorId: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage(mode === 'edit' ? 'Promocode has been updated.' : 'Promocode has been saved.');
      onSaved?.(data.id ?? settingId ?? 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() + i));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#4a6fa5] text-white px-4 py-2 font-bold">Promo code setting</div>

      {message && (
        <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm">{message}</div>
      )}

      <div className="bg-white border border-gray-300 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <label className="font-medium">Promo code</label>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="flex-1 px-3 py-2 border bg-yellow-100 text-red-700 font-semibold"
              required
            />
            <button type="button" onClick={refreshCode} className="p-2 hover:bg-gray-100 rounded" title="Change code">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enable}
              onChange={(e) => setForm({ ...form, enable: e.target.checked })}
            />
            Enable
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <label className="font-medium">Promocode will expire on</label>
          <select
            value={form.toDay}
            onChange={(e) => setForm({ ...form, toDay: e.target.value })}
            className="px-3 py-2 border"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={form.toMonth}
            onChange={(e) => setForm({ ...form, toMonth: e.target.value })}
            className="px-3 py-2 border"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={form.toYear}
            onChange={(e) => setForm({ ...form, toYear: e.target.value })}
            className="px-3 py-2 border"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-medium block mb-2">Versions</label>
          <div className="border h-32 overflow-y-auto p-2 space-y-1 bg-white">
            {meta?.subscriptions.map((sub) => (
              <label key={sub.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.versionIds.includes(sub.id)}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      versionIds: e.target.checked
                        ? [...form.versionIds, sub.id]
                        : form.versionIds.filter((id) => id !== sub.id),
                    });
                  }}
                />
                {sub.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <label className="font-medium">Discount</label>
          <input
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: e.target.value })}
            className="px-3 py-2 border"
          />
          <span>%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <label className="font-medium">Usable by</label>
          <select
            value={form.usableBy}
            onChange={(e) => setForm({ ...form, usableBy: e.target.value })}
            className="px-3 py-2 border md:col-span-2"
          >
            <option value="">--Select--</option>
            <option value="Once">Once</option>
            <option value="Always">Always</option>
          </select>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Invitation email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border mt-1"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-red-700">Expedition name</label>
              <input
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="w-full px-3 py-2 border mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Html document in attachment</label>
              <select
                value={form.helpHtmlPagesId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setForm({ ...form, helpHtmlPagesId: id });
                  void loadLanguagesForPage(id);
                }}
                className="w-full px-3 py-2 border mt-1"
              >
                <option value="">--Select--</option>
                {meta?.helpHtmlPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Language available</label>
              <select
                value={form.languageId ?? ''}
                onChange={(e) =>
                  setForm({ ...form, languageId: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full px-3 py-2 border mt-1"
              >
                {(languageOptions.length ? languageOptions : meta?.languages.map((l) => ({ id: l.id, value: l.name })) ?? []).map(
                  (l) => (
                    <option key={l.id} value={l.id}>
                      {l.value}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-purple-700 text-yellow-300 px-4 py-2 font-bold">
        Club settings <span className="text-sm font-normal">(Only for club versions)</span>
      </div>
      <div className="bg-white border border-gray-300 p-4 space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enableExtension}
            onChange={(e) => setForm({ ...form, enableExtension: e.target.checked })}
          />
          Enable extension
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          After the expiration extends the subscription for
          <input
            value={form.subscriptionExtends}
            onChange={(e) => setForm({ ...form, subscriptionExtends: e.target.value })}
            className="w-20 px-2 py-1 border"
          />
          days
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-[#7b0a26] text-white font-semibold rounded hover:bg-[#5c081c] disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'edit' ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  );
}
