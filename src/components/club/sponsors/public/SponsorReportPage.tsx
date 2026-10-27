'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Eye, Image as ImageIcon, Layers, MousePointerClick, Printer, type LucideIcon } from 'lucide-react';
import type { SponsorReportData } from '@/lib/club/sponsors/sponsorPublicService';
import { SPONSOR_SECTIONS, type SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';
import { sponsorHeaderBackground } from '@/lib/club/sponsors/sponsorKitSettings';
import {
  SponsorLanguageSelect,
  initialSponsorPageLanguage,
  makeSponsorT,
  sectionLabel,
} from '@/components/club/sponsors/public/sponsorPublicShared';

/**
 * Print / "save as PDF": keep the colors of the bars and cards (browsers drop backgrounds by default),
 * print the header on white with black text, and never split a card between two pages.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body {
    background: #fff !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .spr-root {
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    background: #fff !important;
    overflow: visible !important;
  }
  .spr-root, .spr-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .spr-header {
    background: #fff !important;
    background-image: none !important;
    color: #000 !important;
    border-bottom: 2px solid #1e40af;
  }
  .spr-header * { color: #000 !important; }
  .spr-no-print { display: none !important; }
  .spr-root section, .spr-root tr { break-inside: avoid; page-break-inside: avoid; }
  .spr-root .shadow-sm { box-shadow: none !important; border: 1px solid #e2e8f0; }
}
`;

function formatDate(ymd: string, lang: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y) return ymd;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(lang || undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return ymd;
  }
}

export default function SponsorReportPage({ token }: { token: string }) {
  const [lang, setLang] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SponsorReportData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setFrom(sp.get('from') ?? '');
    setTo(sp.get('to') ?? '');
    setLang(initialSponsorPageLanguage());
  }, []);

  const load = useCallback(
    async (range: { from: string; to: string }, language: string) => {
      const qs = new URLSearchParams();
      if (language) qs.set('lang', language);
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      try {
        const res = await fetch(`/api/public/sponsor-report/${encodeURIComponent(token)}?${qs.toString()}`, {
          cache: 'no-store',
        });
        const d = res.ok ? ((await res.json()) as SponsorReportData) : null;
        setData(d);
        setStatus(d ? 'ok' : 'missing');
        if (d) {
          setFrom(d.stats.from);
          setTo(d.stats.to);
        }
      } catch {
        setStatus('missing');
      }
    },
    [token],
  );

  useEffect(() => {
    if (lang === null) return;
    void load({ from, to }, lang);
    // Period changes reload through the Update button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, load]);

  const t = makeSponsorT(data?.texts);

  if (status === 'loading' && !data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">…</div>;
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-600">{t('spr_not_found')}</div>;
  }

  const { org, sponsor, stats } = data;
  const placements = SPONSOR_SECTIONS.filter((s) => data.placements[s.key as SponsorSectionKey]);
  const maxViews = Math.max(1, ...stats.bySection.map((r) => r.views));
  const landing =
    sponsor.landingUrl && !/^https?:\/\//i.test(sponsor.landingUrl)
      ? `https://${sponsor.landingUrl}`
      : sponsor.landingUrl;

  const applyPeriod = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    window.history.replaceState(null, '', url.toString());
    void load({ from, to }, lang ?? '');
  };

  return (
    <div className="spr-root min-h-screen bg-slate-100 text-slate-900 print:block print:min-h-0 print:bg-white">
      <style>{PRINT_CSS}</style>
      <header
        className="spr-header text-white print:block print:bg-white print:text-black"
        style={sponsorHeaderBackground(data.header, org.bannerUrl, 'linear-gradient(rgba(15,23,42,.7), rgba(30,58,138,.75))')}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
            ) : null}
            <span className="font-bold">{org.name}</span>
          </div>
          <div className="spr-no-print flex items-center gap-3 print:hidden">
            <SponsorLanguageSelect value={data.language} label={t('spk_language')} onChange={setLang} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
            >
              <Printer className="h-4 w-4" />
              {t('spr_print')}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-5 pb-5 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-200 print:text-black">
            {t('spr_title')}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {sponsor.logoUrl ? (
              landing ? (
                <a href={landing} target="_blank" rel="noopener noreferrer sponsored" title={sponsor.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sponsor.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sponsor.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
              )
            ) : null}
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold md:text-3xl">{sponsor.name}</h1>
              <p className="text-blue-100 print:text-black">{t('spr_with_club', { club: org.name })}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-blue-50 print:text-black">
                {sponsor.phone ? (
                  <a href={`tel:${sponsor.phone}`} className="hover:underline">
                    {t('spr_phone')}: {sponsor.phone}
                  </a>
                ) : null}
                {sponsor.email ? (
                  <a href={`mailto:${sponsor.email}`} className="hover:underline">
                    {t('spr_email')}: {sponsor.email}
                  </a>
                ) : null}
                {landing ? (
                  <a href={landing} target="_blank" rel="noopener noreferrer sponsored" className="hover:underline">
                    {t('spr_website')}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto block max-w-5xl space-y-6 px-5 py-6 print:block print:max-w-none print:px-0">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mr-auto">
            <div className="text-xs font-semibold uppercase text-slate-500">{t('spr_period')}</div>
            <div className="font-bold">
              {formatDate(stats.from, data.language)} – {formatDate(stats.to, data.language)}
            </div>
          </div>
          <label className="spr-no-print text-sm print:hidden">
            <span className="block text-xs font-semibold text-slate-500">{t('spr_from')}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="spr-no-print text-sm print:hidden">
            <span className="block text-xs font-semibold text-slate-500">{t('spr_to')}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <button
            type="button"
            onClick={applyPeriod}
            className="spr-no-print rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 print:hidden"
          >
            {t('spr_update')}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi Icon={Eye} label={t('spr_views')} value={stats.views.toLocaleString()} />
          <Kpi Icon={MousePointerClick} label={t('spr_clicks')} value={stats.clicks.toLocaleString()} />
          <Kpi Icon={BarChart3} label={t('spr_ctr')} value={`${stats.ctr.toFixed(2)}%`} hint={t('spr_ctr_hint')} />
          <Kpi Icon={Layers} label={t('spr_sources')} value={String(stats.activeSources)} hint={t('spr_sources_hint')} />
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">{t('spr_by_section')}</h2>
          {stats.bySection.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t('spr_no_data')}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">{t('spr_section')}</th>
                    <th className="w-2/5 py-2 pr-3" />
                    <th className="py-2 pr-3 text-right">{t('spr_views')}</th>
                    <th className="py-2 pr-3 text-right">{t('spr_clicks')}</th>
                    <th className="py-2 text-right">{t('spr_ctr')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...stats.bySection]
                    .sort((a, b) => b.views - a.views)
                    .map((r) => (
                      <tr key={r.section}>
                        <td className="py-2.5 pr-3 font-medium">{sectionLabel(t, r.section)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-400"
                              style={{ width: `${(r.views / maxViews) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right">{r.views.toLocaleString()}</td>
                        <td className="py-2.5 pr-3 text-right">{r.clicks.toLocaleString()}</td>
                        <td className="py-2.5 text-right">
                          {r.views > 0 ? `${((r.clicks / r.views) * 100).toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">{t('spr_placements')}</h2>
            {placements.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t('spr_no_placements')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {placements.map((s) => (
                  <li key={s.key} className="flex items-center justify-between py-2 text-sm">
                    <span>{sectionLabel(t, s.key)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      <ImageIcon className="h-3 w-3" />
                      {data.placements[s.key as SponsorSectionKey] === 'banner' ? t('spr_banner') : t('spr_logo')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.contract ? (
              <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                <span className="font-semibold text-slate-500">{t('spr_contract')}: </span>
                {formatDate(data.contract.startDate, data.language)} – {formatDate(data.contract.endDate, data.language)}
              </div>
            ) : null}
          </section>
          {sponsor.bannerUrl ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">{t('spr_your_banner')}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sponsor.bannerUrl} alt="" className="mt-3 w-full rounded-lg border border-slate-200 object-contain" />
            </section>
          ) : null}
        </div>

        <footer className="pb-6 text-center text-xs text-slate-500">
          {t('spr_generated', { date: formatDate(new Date().toISOString().slice(0, 10), data.language) })} ·{' '}
          {t('spk_powered')}
        </footer>
      </main>
    </div>
  );
}

function Kpi({ Icon, label, value, hint }: { Icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        <Icon className="h-4 w-4 text-indigo-600" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}
