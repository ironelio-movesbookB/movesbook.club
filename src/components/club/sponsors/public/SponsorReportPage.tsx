'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Eye, Image as ImageIcon, Layers, MousePointerClick, Printer, type LucideIcon } from 'lucide-react';
import type { SponsorReportData } from '@/lib/club/sponsors/sponsorPublicService';
import { SPONSOR_SECTIONS, type SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';
import {
  SponsorLanguageSelect,
  initialSponsorPageLanguage,
  makeSponsorT,
  sectionLabel,
} from '@/components/club/sponsors/public/sponsorPublicShared';

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

  const applyPeriod = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    window.history.replaceState(null, '', url.toString());
    void load({ from, to }, lang ?? '');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
      <header className="bg-gradient-to-r from-slate-900 to-indigo-800 text-white print:bg-none print:text-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
            ) : null}
            <span className="font-bold">{org.name}</span>
          </div>
          <div className="flex items-center gap-3 print:hidden">
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
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-200 print:text-slate-500">
            {t('spr_title')}
          </div>
          <div className="mt-2 flex items-center gap-4">
            {sponsor.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sponsor.logoUrl} alt="" className="h-16 w-16 rounded-xl bg-white object-contain p-1" />
            ) : null}
            <div>
              <h1 className="text-3xl font-extrabold">{sponsor.name}</h1>
              <p className="text-blue-100 print:text-slate-600">{t('spr_with_club', { club: org.name })}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mr-auto">
            <div className="text-xs font-semibold uppercase text-slate-500">{t('spr_period')}</div>
            <div className="font-bold">
              {formatDate(stats.from, data.language)} – {formatDate(stats.to, data.language)}
            </div>
          </div>
          <label className="text-sm print:hidden">
            <span className="block text-xs font-semibold text-slate-500">{t('spr_from')}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="text-sm print:hidden">
            <span className="block text-xs font-semibold text-slate-500">{t('spr_to')}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <button
            type="button"
            onClick={applyPeriod}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 print:hidden"
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
