'use client';

import { useEffect, useRef, useState } from 'react';
import PublicLinkBanner from '@/components/club/sponsors/PublicLinkBanner';
import {
  dangerButton,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/sponsors/sponsorUi';
import { clubWorkspaceApi } from '@/lib/club/sponsors/sponsorClient';
import {
  WEBSITE_LINK_SECTIONS,
  WEBSITE_SECTIONS,
  WEBSITE_SOCIALS,
  slugifyWebsite,
  websitePath,
  websiteSeasonOptions,
  type WebsiteSectionKey,
  type WebsiteSettings,
} from '@/lib/club/website/websiteConstants';

type SettingsResponse = { settings: WebsiteSettings; saved: boolean };

const SOCIAL_LABELS: Record<(typeof WEBSITE_SOCIALS)[number], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export default function WebsiteSettingsPage() {
  const [form, setForm] = useState<WebsiteSettings | null>(null);
  const [savedSlug, setSavedSlug] = useState('');
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState('');
  const coverInput = useRef<HTMLInputElement>(null);

  const apply = (data: SettingsResponse) => {
    setForm(data.settings);
    setSavedSlug(data.saved ? data.settings.slug : '');
    setSavedEnabled(data.saved && data.settings.enabled);
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    clubWorkspaceApi<SettingsResponse>('/api/club/website')
      .then(apply)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the website settings'));
  }, []);

  if (!form) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : 'Loading…'}
      </div>
    );
  }

  const set = <K extends keyof WebsiteSettings>(key: K, value: WebsiteSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const setSection = (key: WebsiteSectionKey, patch: Partial<WebsiteSettings['sections'][WebsiteSectionKey]>) =>
    setForm((f) => (f ? { ...f, sections: { ...f.sections, [key]: { ...f.sections[key], ...patch } } } : f));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await clubWorkspaceApi<SettingsResponse>('/api/club/website', {
        method: 'PUT',
        body: JSON.stringify({ settings: form }),
      });
      apply(data);
      setNotice(data.settings.enabled ? 'Website saved and published' : 'Website saved (not published)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File | null) => {
    setUploading(true);
    setError('');
    try {
      let data: SettingsResponse;
      if (file) {
        const body = new FormData();
        body.append('file', file);
        data = await clubWorkspaceApi<SettingsResponse>('/api/club/website/cover', { method: 'POST', body });
      } else {
        data = await clubWorkspaceApi<SettingsResponse>('/api/club/website/cover', { method: 'DELETE' });
      }
      setForm((f) => (f ? { ...f, coverUrl: data.settings.coverUrl } : f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website</h1>
          <p className="text-sm text-gray-600">
            A public page that presents your club with its sections, events, shop, sponsors and 5x1000.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={!savedSlug}
            title={savedSlug ? '' : 'Save the settings first'}
            onClick={() => window.open(websitePath(savedSlug), '_blank', 'noopener')}
          >
            Preview
          </button>
          <button type="button" className={primaryButton} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {savedSlug && savedEnabled ? (
        <PublicLinkBanner
          title="Your website is online"
          description="Share the link or the QR code with members, families and sponsors."
          path={websitePath(savedSlug)}
          qrFileName="website-qr"
        />
      ) : savedSlug ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The website is not published yet. Only you can see it with <strong>Preview</strong>. Turn on &quot;Enable
          website&quot; and save to publish it.
        </div>
      ) : null}

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

      <Card title="Settings">
        <label className="flex items-center gap-3">
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} />
          <span className="text-sm font-semibold text-gray-800">Enable website</span>
        </label>

        <div className="mt-4">
          <span className={labelClass}>Website address</span>
          <div className="flex items-stretch overflow-hidden rounded-md border border-gray-300 focus-within:border-blue-500">
            <span className="flex items-center bg-gray-100 px-3 text-sm text-gray-500">{origin}/site/</span>
            <input
              className="min-w-0 flex-1 px-3 py-2 text-sm focus:outline-none"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60))}
              onBlur={(e) => set('slug', slugifyWebsite(e.target.value))}
            />
          </div>
          <span className="mt-1 block text-xs text-gray-500">Lowercase letters, numbers and hyphens (3–60).</span>
        </div>

        <div className="mt-4">
          <span className={labelClass}>Cover image</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex aspect-[3/1] w-72 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
              {form.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">No cover (the club banner is used)</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={coverInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCover(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className={secondaryButton}
                disabled={!savedSlug || uploading}
                title={savedSlug ? '' : 'Save the settings first'}
                onClick={() => coverInput.current?.click()}
              >
                {uploading ? 'Uploading…' : form.coverUrl ? 'Replace' : 'Upload'}
              </button>
              {form.coverUrl ? (
                <button type="button" className={dangerButton} disabled={uploading} onClick={() => void uploadCover(null)}>
                  Remove
                </button>
              ) : null}
              <span className="text-xs text-gray-500">Wide image, 1600 × 600 px, max 8MB.</span>
            </div>
          </div>
        </div>

        <label className="mt-4 block">
          <span className={labelClass}>About us</span>
          <textarea
            className={`${inputClass} min-h-[140px]`}
            value={form.about}
            maxLength={10000}
            placeholder="Who you are, your history, your values, your sports…"
            onChange={(e) => set('about', e.target.value)}
          />
        </label>
      </Card>

      <Card title="Sections of the website">
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {WEBSITE_SECTIONS.map((s) => {
            const value = form.sections[s.key];
            const isLink = WEBSITE_LINK_SECTIONS.includes(s.key);
            return (
              <div key={s.key} className="space-y-2 px-4 py-3">
                <label className="flex items-center gap-3">
                  <Toggle checked={value.enabled} onChange={(v) => setSection(s.key, { enabled: v })} />
                  <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                </label>
                {value.enabled ? (
                  <div className="flex flex-wrap items-center gap-2 pl-14">
                    {isLink ? (
                      <input
                        className={`${inputClass} max-w-md`}
                        placeholder={`${s.linkHint} (optional)`}
                        value={value.url}
                        onChange={(e) => setSection(s.key, { url: e.target.value })}
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{s.linkHint}.</span>
                    )}
                    {s.key === 'online_payments' ? (
                      <select
                        className={`${inputClass} w-40`}
                        value={form.season}
                        onChange={(e) => set('season', e.target.value)}
                      >
                        {websiteSeasonOptions(form.season).map((season) => (
                          <option key={season} value={season}>
                            Season {season}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Without a link, the section shows a &quot;Contact us&quot; button with your club email.
        </p>
      </Card>

      <Card title="5x1000">
        <label className="flex items-center gap-3">
          <Toggle checked={form.donationEnabled} onChange={(v) => set('donationEnabled', v)} />
          <span className="text-sm font-semibold text-gray-800">Show the 5x1000 donation box</span>
        </label>
        {form.donationEnabled ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Tax code *</span>
              <input
                className={inputClass}
                value={form.donationTaxCode}
                onChange={(e) => set('donationTaxCode', e.target.value.toUpperCase())}
              />
            </label>
            <label className="block md:col-span-2">
              <span className={labelClass}>Text (optional)</span>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={form.donationText}
                maxLength={2000}
                placeholder="Leave empty to use the standard text, translated in the visitor's language."
                onChange={(e) => set('donationText', e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </Card>

      <Card title="Social links">
        <div className="grid gap-4 md:grid-cols-2">
          {WEBSITE_SOCIALS.map((k) => (
            <label key={k} className="block">
              <span className={labelClass}>{SOCIAL_LABELS[k]}</span>
              <input
                className={inputClass}
                placeholder={`https://www.${k}.com/…`}
                value={form.socials[k]}
                onChange={(e) => set('socials', { ...form.socials, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={!savedSlug}
          onClick={() => window.open(websitePath(savedSlug), '_blank', 'noopener')}
        >
          Preview
        </button>
        <button type="button" className={primaryButton} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
