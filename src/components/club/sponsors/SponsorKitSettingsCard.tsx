'use client';

import { useEffect, useState } from 'react';
import { inputClass, labelClass, primaryButton } from '@/components/club/sponsors/sponsorUi';
import { sponsorApi } from '@/lib/club/sponsors/sponsorClient';
import {
  DEFAULT_SPONSOR_KIT_SETTINGS,
  SPONSOR_REPORT_MAX_INTERVAL_DAYS,
  sponsorHeaderBackground,
  type SponsorKitSettings,
} from '@/lib/club/sponsors/sponsorKitSettings';

/** Header of the sponsorship kit and of the sponsor report, and how often the report is sent. */
export default function SponsorKitSettingsCard() {
  const [form, setForm] = useState<SponsorKitSettings>(DEFAULT_SPONSOR_KIT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    sponsorApi<{ settings: SponsorKitSettings }>('/settings')
      .then((d) => {
        setForm(d.settings);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the settings'));
  }, []);

  const set = <K extends keyof SponsorKitSettings>(key: K, value: SponsorKitSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const d = await sponsorApi<{ settings: SponsorKitSettings }>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: form }),
      });
      setForm(d.settings);
      setNotice('Settings saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-base font-bold text-gray-900">Kit and report settings</h2>
      <p className="mb-4 text-sm text-gray-600">
        Choose the header of the sponsorship kit and of the sponsor report, and how often the report is sent.
      </p>

      {error ? <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={form.useBanner}
              disabled={!loaded}
              onChange={(e) => set('useBanner', e.target.checked)}
            />
            Use the club / team banner in the header
          </label>
          {!form.useBanner ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Gradient from</span>
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white p-1"
                  value={form.gradientFrom}
                  onChange={(e) => set('gradientFrom', e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Gradient to</span>
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white p-1"
                  value={form.gradientTo}
                  onChange={(e) => set('gradientTo', e.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Without a banner, or when this option is off, a gradient with the colors you choose is used.
            </p>
          )}
          <div
            className="flex h-16 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={sponsorHeaderBackground(
              form.useBanner ? { ...form, useBanner: false } : form,
              null,
            )}
          >
            {form.useBanner ? 'Club banner (gradient fallback)' : 'Header preview'}
          </div>
        </div>

        <div>
          <label className="block">
            <span className={labelClass}>How many days after the last submission should the new report be sent?</span>
            <input
              type="number"
              min={0}
              max={SPONSOR_REPORT_MAX_INTERVAL_DAYS}
              className={`${inputClass} max-w-[160px]`}
              value={form.reportIntervalDays}
              disabled={!loaded}
              onChange={(e) =>
                set(
                  'reportIntervalDays',
                  Math.min(SPONSOR_REPORT_MAX_INTERVAL_DAYS, Math.max(0, Math.round(Number(e.target.value)) || 0)),
                )
              }
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">0 = the report is never sent automatically.</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" className={primaryButton} disabled={saving || !loaded} onClick={save}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </section>
  );
}
