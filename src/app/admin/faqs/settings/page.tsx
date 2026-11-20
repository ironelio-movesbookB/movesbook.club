'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFaqAdminGate } from '@/components/faqs/admin/useFaqAdminGate';
import { faqAdminFetch } from '@/lib/faqs/faqClient';
import {
  FAQ_CURRENT_PAGE_SETTING_KEY,
  FAQ_SECTION_PAIRS,
  FAQ_VIEW_MODES,
  faqPairKey,
  faqPairLabel,
  type FaqViewMode,
} from '@/lib/faqs/faqConstants';

const ROWS = [
  ...FAQ_SECTION_PAIRS.map((p) => ({ key: faqPairKey(p.section, p.subsection), label: faqPairLabel(p.section, p.subsection) })),
  { key: FAQ_CURRENT_PAGE_SETTING_KEY, label: 'FAQ of the current page' },
];

/** Settings → "Modality Of View" (PHP admins/faq_settings). */
export default function AdminFaqSettingsPage() {
  const router = useRouter();
  const ready = useFaqAdminGate();
  const [settings, setSettings] = useState<Record<string, FaqViewMode> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    faqAdminFetch<{ settings: Record<string, FaqViewMode> }>('/api/admin/faqs/settings')
      .then((d) => setSettings(d.settings))
      .catch((e) => setMessage({ ok: false, text: e.message }));
  }, [ready]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const d = await faqAdminFetch<{ settings: Record<string, FaqViewMode> }>('/api/admin/faqs/settings', {
        method: 'PUT',
        json: { settings },
      });
      setSettings(d.settings);
      setMessage({ ok: true, text: 'Settings saved.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="p-4">
      <div className="border border-gray-300 bg-white">
        <h1 className="border-b border-gray-300 bg-[#e3e3e3] px-3 py-1.5 text-base font-bold text-gray-900">
          Modality Of View
        </h1>
        <div className="p-4">
          {!settings ? (
            <p className="text-sm text-gray-500">{message?.text ?? 'Loading…'}</p>
          ) : (
            <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-center gap-x-6 gap-y-2">
              {ROWS.map((row) => (
                <label key={row.key} className="contents">
                  <span className="text-right text-[15px] text-gray-700">{row.label}</span>
                  <select
                    value={settings[row.key]}
                    onChange={(e) => setSettings((s) => ({ ...s!, [row.key]: e.target.value as FaqViewMode }))}
                    className="w-full rounded-sm border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    {FAQ_VIEW_MODES.map((m) => (
                      <option key={m.key} value={m.key}>-{m.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {message && settings ? (
            <p className={`mt-3 text-center text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
          ) : null}
          <div className="mt-6 flex justify-center gap-5">
            <button
              type="button"
              onClick={save}
              disabled={!settings || saving}
              className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/faqs')}
              className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
