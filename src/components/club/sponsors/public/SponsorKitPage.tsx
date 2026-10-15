'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Eye,
  Globe,
  HeartHandshake,
  Layers,
  Mail,
  MousePointerClick,
  Phone,
  SlidersHorizontal,
  Smartphone,
  Target,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  CalendarClock,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { SponsorKitData } from '@/lib/club/sponsors/sponsorPublicService';
import {
  SponsorLanguageSelect,
  initialSponsorPageLanguage,
  makeSponsorT,
} from '@/components/club/sponsors/public/sponsorPublicShared';

export default function SponsorKitPage({ orgId }: { orgId: string }) {
  const [lang, setLang] = useState<string | null>(null);
  const [data, setData] = useState<SponsorKitData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    setLang(initialSponsorPageLanguage());
  }, []);

  useEffect(() => {
    if (lang === null) return;
    let cancelled = false;
    fetch(`/api/public/sponsor-kit/${encodeURIComponent(orgId)}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: SponsorKitData | null) => {
        if (cancelled) return;
        setData(d);
        setStatus(d ? 'ok' : 'missing');
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [orgId, lang]);

  const t = makeSponsorT(data?.texts);

  if (status === 'loading' && !data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">…</div>;
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-600">{t('spk_not_found')}</div>;
  }

  const { org, community, demographics, touchpoints, last30 } = data;
  const club = org.name;
  const totalGender = demographics.male + demographics.female + demographics.other;
  const maxAge = Math.max(1, ...demographics.ages.map((a) => a.count));

  const whatYouGet: Array<{ Icon: LucideIcon; n: number }> = [
    { Icon: Smartphone, n: 1 },
    { Icon: Globe, n: 2 },
    { Icon: Mail, n: 3 },
    { Icon: MousePointerClick, n: 4 },
    { Icon: BarChart3, n: 5 },
    { Icon: Trophy, n: 6 },
  ];
  const whyUs: Array<{ Icon: LucideIcon; n: number }> = [
    { Icon: Target, n: 1 },
    { Icon: TrendingUp, n: 2 },
    { Icon: SlidersHorizontal, n: 3 },
  ];
  const comparison = ['spk_cmp_1', 'spk_cmp_2', 'spk_cmp_3', 'spk_cmp_4', 'spk_cmp_5'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero */}
      <header
        className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-800 text-white"
        style={
          org.bannerUrl
            ? { backgroundImage: `linear-gradient(rgba(15,23,42,.82), rgba(30,58,138,.85)), url(${org.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-11 w-11 rounded-full bg-white object-contain p-0.5" />
            ) : null}
            <span className="text-lg font-bold">{club}</span>
          </div>
          <SponsorLanguageSelect value={data.language} label={t('spk_language')} onChange={setLang} />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:pb-24">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {t('spk_title')}
          </span>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">
            {t('spk_hero_title', { club })}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-blue-100 md:text-lg">{t('spk_hero_text')}</p>
          {org.email || org.phone ? (
            <a
              href={org.email ? `mailto:${org.email}` : `tel:${org.phone}`}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 font-bold text-slate-900 shadow-lg hover:bg-amber-300"
            >
              <HeartHandshake className="h-5 w-5" />
              {t('spk_contact_us')}
            </a>
          ) : null}
        </div>
      </header>

      {/* Take your brand */}
      <Section title={t('spk_brand_title')} text={t('spk_brand_text')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigNumber Icon={Users} value={community.members} label={t('spk_members')} />
          <BigNumber Icon={UserCog} value={community.staff} label={t('spk_staff')} />
          {org.kind === 'club' ? <BigNumber Icon={Layers} value={community.groups} label={t('spk_groups')} /> : null}
          <BigNumber Icon={CalendarClock} value={community.years} label={t('spk_years')} />
        </div>
      </Section>

      {/* Our results */}
      <Section title={t('spk_results_title')} text={t('spk_results_text')} tinted>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t('spk_demographics')} · {t('spk_gender')}
            </h3>
            <div className="mt-4 space-y-3">
              {(
                [
                  ['spk_male', demographics.male, 'bg-blue-500'],
                  ['spk_female', demographics.female, 'bg-pink-500'],
                  ['spk_not_specified', demographics.other, 'bg-slate-400'],
                ] as const
              ).map(([key, count, color]) => (
                <Bar key={key} label={t(key)} count={count} pct={totalGender ? (count / totalGender) * 100 : 0} color={color} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t('spk_demographics')} · {t('spk_age')}
            </h3>
            <div className="mt-4 space-y-3">
              {demographics.ages.map((a) => (
                <Bar
                  key={a.label || 'unknown'}
                  label={a.label ? `${a.label} ${t('spk_years_old')}` : t('spk_not_specified')}
                  count={a.count}
                  pct={(a.count / maxAge) * 100}
                  color="bg-indigo-500"
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{t('spk_touchpoints')}</h3>
            <ul className="mt-4 space-y-3">
              <Touch Icon={Smartphone} value={touchpoints.app} label={t('spk_touch_app')} />
              <Touch Icon={Globe} value={touchpoints.web} label={t('spk_touch_web')} />
              <Touch Icon={Mail} value={touchpoints.email} label={t('spk_touch_email')} />
            </ul>
            {last30.views > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <MiniStat Icon={Eye} value={last30.views} label={t('spk_views_30')} />
                <MiniStat Icon={MousePointerClick} value={last30.clicks} label={t('spk_clicks_30')} />
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Total transparency */}
      <Section title={t('spk_transparency_title')} text={t('spk_transparency_text')}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="mx-auto w-64">
            <div className="rounded-[2.2rem] border-[10px] border-slate-900 bg-white shadow-2xl">
              <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-slate-300" />
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  {org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logoUrl} alt="" className="h-6 w-6 rounded-full object-contain" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-indigo-200" />
                  )}
                  <span className="truncate text-xs font-bold">{club}</span>
                </div>
                <div className="h-3 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
                <div className="flex aspect-[4/1] items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-amber-400 bg-amber-50">
                  {data.sampleBannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.sampleBannerUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700">{t('spk_your_brand_here')}</span>
                  )}
                </div>
                <div className="h-16 rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-200" />
                <div className="h-10 rounded bg-slate-100" />
              </div>
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-slate-600">{t('spk_app_preview')}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{t('spk_report_preview')}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {t('spk_example')}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <MiniStat Icon={Eye} value={12480} label={t('spr_views')} />
              <MiniStat Icon={MousePointerClick} value={374} label={t('spr_clicks')} />
              <div className="rounded-xl bg-slate-50 p-3">
                <BarChart3 className="mx-auto h-5 w-5 text-indigo-600" />
                <div className="mt-1 text-xl font-extrabold">3.00%</div>
                <div className="text-[11px] text-slate-500">{t('spr_ctr')}</div>
              </div>
            </div>
            <div className="mt-5 flex h-28 items-end gap-1.5">
              {[35, 52, 44, 68, 58, 80, 72, 95, 88, 76, 90, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-blue-400" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* What you get */}
      <Section title={t('spk_what_title')} tinted>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {whatYouGet.map(({ Icon, n }) => (
            <div key={n} className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{t(`spk_what_${n}_title`)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(`spk_what_${n}_text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Why choose us */}
      <Section title={t('spk_why_title')}>
        <div className="grid gap-5 md:grid-cols-3">
          {whyUs.map(({ Icon, n }) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{t(`spk_why_${n}_title`)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(`spk_why_${n}_text`)}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-200 px-6 py-4 text-lg font-bold">{t('spk_compare_title')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3" />
                  <th className="px-4 py-3 text-center font-semibold text-slate-500">{t('spk_compare_classic')}</th>
                  <th className="px-4 py-3 text-center font-bold text-indigo-700">{t('spk_compare_ours', { club })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.map((key) => (
                  <tr key={key}>
                    <td className="px-6 py-3 font-medium">{t(key)}</td>
                    <td className="px-4 py-3 text-center">
                      <X className="mx-auto h-5 w-5 text-red-400" />
                    </td>
                    <td className="bg-indigo-50/50 px-4 py-3 text-center">
                      <Check className="mx-auto h-5 w-5 text-green-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Current sponsors */}
      {data.sponsors.length ? (
        <Section title={t('spk_sponsors_title')} tinted>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {data.sponsors.map((s) => {
              const inner = s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt={s.name} className="h-16 w-32 object-contain" />
              ) : (
                <span className="text-base font-bold text-slate-700">{s.name}</span>
              );
              return (
                <div key={s.name} className="flex h-24 w-40 items-center justify-center rounded-xl bg-white p-3 shadow-sm">
                  {s.landingUrl ? (
                    <a href={s.landingUrl} target="_blank" rel="noopener noreferrer sponsored" title={s.name}>
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* Call to action */}
      <section className="bg-gradient-to-r from-indigo-700 to-blue-700 text-white">
        <div className="mx-auto max-w-4xl px-5 py-14 text-center">
          <h2 className="text-3xl font-extrabold">{t('spk_cta_title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">{t('spk_cta_text')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {org.email ? (
              <a href={`mailto:${org.email}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-indigo-800 hover:bg-blue-50">
                <Mail className="h-5 w-5" />
                {t('spk_contact_us')}
              </a>
            ) : null}
            {org.phone ? (
              <a href={`tel:${org.phone}`} className="inline-flex items-center gap-2 rounded-lg border border-white/60 px-5 py-3 font-bold hover:bg-white/10">
                <Phone className="h-5 w-5" />
                {t('spk_call')} {org.phone}
              </a>
            ) : null}
            {org.website ? (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/60 px-5 py-3 font-bold hover:bg-white/10">
                <Globe className="h-5 w-5" />
                {t('spk_website')}
              </a>
            ) : null}
          </div>
        </div>
      </section>
      <footer className="py-6 text-center text-xs text-slate-500">{t('spk_powered')}</footer>
    </div>
  );
}

function Section({
  title,
  text,
  tinted,
  children,
}: {
  title: string;
  text?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={tinted ? 'bg-indigo-50/60' : 'bg-slate-50'}>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold md:text-3xl">{title}</h2>
        {text ? <p className="mt-2 max-w-2xl text-slate-600">{text}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function BigNumber({ Icon, value, label }: { Icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
      <Icon className="mx-auto h-8 w-8 text-indigo-600" />
      <div className="mt-3 text-4xl font-extrabold">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Bar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500">{count.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(count ? 3 : 0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function Touch({ Icon, value, label }: { Icon: LucideIcon; value: number; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-2xl font-extrabold">{value}</span>
      <span className="text-sm text-slate-600">{label}</span>
    </li>
  );
}

function MiniStat({ Icon, value, label }: { Icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <Icon className="mx-auto h-5 w-5 text-indigo-600" />
      <div className="mt-1 text-xl font-extrabold">{value.toLocaleString()}</div>
      <div className="text-[11px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}
