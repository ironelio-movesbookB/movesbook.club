'use client';

import { useEffect, useMemo, useState } from 'react';
import SponsorSlot, { useSponsorViews } from '@/components/club/sponsors/SponsorSlot';
import {
  ArrowRight,
  CalendarDays,
  Copy,
  CreditCard,
  Facebook,
  FileText,
  Flag,
  Gift,
  Globe,
  HeartHandshake,
  Instagram,
  Mail,
  MapPin,
  Music2,
  Phone,
  ShoppingBag,
  Stethoscope,
  Trophy,
  UserCog,
  UserPlus,
  Users,
  X,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import type { PublicSiteData } from '@/lib/club/website/websiteService';
import type { WebsiteSocialKey } from '@/lib/club/website/websiteConstants';
import { WEBSITE_PUBLIC_TEXTS } from '@/lib/club/website/websitePublicTexts';
import { fillSponsorText } from '@/lib/club/sponsors/sponsorPublicTexts';
import { SponsorLanguageSelect, initialSponsorPageLanguage } from '@/components/club/sponsors/public/sponsorPublicShared';
import { getAuthToken } from '@/utils/auth.utils';

const LINK_ICONS: Record<string, LucideIcon> = {
  registrations: UserPlus,
  online_payments: CreditCard,
  calendar: CalendarDays,
  medical_visit: Stethoscope,
};

const SOCIAL_ICONS: Record<WebsiteSocialKey, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
};

function formatDay(ymd: string, lang: string): { day: string; month: string; full: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const loc = lang || undefined;
  try {
    return {
      day: String(d).padStart(2, '0'),
      month: date.toLocaleDateString(loc, { month: 'short' }),
      full: date.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    };
  } catch {
    return { day: String(d), month: String(m), full: ymd };
  }
}

export default function PublicSitePage({ slug }: { slug: string }) {
  const [lang, setLang] = useState<string | null>(null);
  const [data, setData] = useState<PublicSiteData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [openDoc, setOpenDoc] = useState<'rules' | 'privacy' | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLang(initialSponsorPageLanguage());
  }, []);

  useEffect(() => {
    if (lang === null) return;
    let cancelled = false;
    const token = getAuthToken();
    fetch(`/api/public/site/${encodeURIComponent(slug)}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: PublicSiteData | null) => {
        if (cancelled) return;
        setData(d);
        setStatus(d ? 'ok' : 'missing');
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  useEffect(() => {
    if (data?.org.name) document.title = data.org.name;
  }, [data?.org.name]);

  const presentationViews = useMemo(
    () => (data?.sponsors ?? []).map((s) => ({ id: s.id, section: '' })),
    [data?.sponsors],
  );
  useSponsorViews(presentationViews);

  const t = (key: string, vars?: Record<string, string | number>) =>
    fillSponsorText(data?.texts?.[key] ?? WEBSITE_PUBLIC_TEXTS[key]?.en ?? key, vars);

  if (status === 'loading' && !data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">…</div>;
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-gray-600">{t('web_not_found')}</div>;
  }

  const { org } = data;
  const language = data.language;
  const cover = data.coverUrl || org.bannerUrl;
  const hasServices = data.links.length > 0 || data.documents.length > 0;
  const hasEvents = data.events !== null;
  const hasShop = !!data.shop?.length;
  const hasSponsors = data.sponsors !== null;
  const socials = Object.entries(data.socials) as Array<[WebsiteSocialKey, string]>;
  const contactHref = org.email ? `mailto:${org.email}` : org.phone ? `tel:${org.phone}` : '';
  const price = (v: number) =>
    new Intl.NumberFormat(language || undefined, { style: 'currency', currency: 'EUR' }).format(v);

  const nav: Array<[string, string, boolean]> = [
    ['about', t('web_nav_about'), Boolean(data.about)],
    ['services', t('web_nav_services'), hasServices],
    ['events', t('web_nav_events'), hasEvents],
    ['shop', t('web_nav_shop'), hasShop],
    ['sponsors', t('web_nav_sponsors'), hasSponsors],
    ['donate', t('web_nav_donate'), Boolean(data.donation)],
    ['contacts', t('web_nav_contacts'), true],
  ];

  const copyTaxCode = async () => {
    if (!data.donation) return;
    try {
      await navigator.clipboard.writeText(data.donation.taxCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code stays visible */
    }
  };

  const docHtml = data.documents.find((d) => d.key === openDoc)?.html ?? '';

  return (
    <div className="min-h-screen scroll-smooth bg-white text-slate-900">
      {data.preview ? (
        <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-900">
          {t('web_preview_banner')}
        </div>
      ) : null}

      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <a href="#top" className="flex min-w-0 items-center gap-2">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-9 w-9 rounded-full object-contain" />
            ) : null}
            <span className="truncate font-bold">{org.name}</span>
          </a>
          <div className="ml-auto hidden items-center gap-4 text-sm font-medium text-slate-600 lg:flex">
            {nav
              .filter(([, , show]) => show)
              .map(([id, label]) => (
                <a key={id} href={`#${id}`} className="hover:text-indigo-700">
                  {label}
                </a>
              ))}
          </div>
          <SponsorLanguageSelect
            value={language}
            label={t('web_language')}
            onChange={setLang}
            className="ml-auto text-slate-700 lg:ml-0 [&_select]:border-slate-300 [&_select]:bg-white"
          />
        </div>
      </nav>

      {/* Hero */}
      <header
        id="top"
        className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-sky-700 text-white"
        style={
          cover
            ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,.55), rgba(15,23,42,.75)), url(${cover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="mb-5 h-24 w-24 rounded-full bg-white object-contain p-1 shadow-lg" />
          ) : null}
          <h1 className="text-4xl font-extrabold md:text-6xl">{org.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
            {org.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {org.location}
              </span>
            ) : null}
            {org.sports.length ? (
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                {org.sports.join(' · ')}
              </span>
            ) : null}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <HeroStat Icon={Users} value={org.members.toLocaleString()} label={t('web_members')} />
            <HeroStat Icon={UserCog} value={org.staff.toLocaleString()} label={t('web_staff')} />
            <HeroStat Icon={Flag} value={String(org.foundedYear)} label={t('web_since')} />
          </div>
        </div>
      </header>

      {data.about ? (
        <Block id="about" title={t('web_about_title')}>
          <p className="max-w-3xl whitespace-pre-line text-lg leading-relaxed text-slate-700">{data.about}</p>
        </Block>
      ) : null}

      {hasServices ? (
        <Block id="services" title={t('web_services_title')} text={t('web_services_text')} tinted>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.links.map((l) => {
              const Icon = LINK_ICONS[l.key] ?? ArrowRight;
              const href = l.url || contactHref;
              return (
                <ServiceCard
                  key={l.key}
                  Icon={Icon}
                  title={t(`web_sec_${l.key}`)}
                  text={t(`web_sec_${l.key}_text`, { season: data.season })}
                >
                  {href ? (
                    <a
                      href={href}
                      target={l.url ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline"
                    >
                      {l.url ? t('web_open') : t('web_contact_us')}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                  <SponsorSlot
                    items={data.sectionSponsors[l.key] ?? []}
                    title={t('web_sponsored_by')}
                    compact
                    className="mt-4 border-t border-slate-100 pt-3"
                  />
                </ServiceCard>
              );
            })}
            {data.documents.length ? (
              <ServiceCard Icon={FileText} title={t('web_sec_documents')} text={t('web_sec_documents_text')}>
                <div className="flex flex-wrap gap-3">
                  {data.documents.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setOpenDoc(d.key)}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline"
                    >
                      {d.key === 'rules' ? t('web_doc_rules') : t('web_doc_privacy')}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </ServiceCard>
            ) : null}
          </div>
        </Block>
      ) : null}

      {hasEvents ? (
        <Block id="events" title={t('web_events_title')}>
          {data.events!.length === 0 ? (
            <p className="text-slate-500">{t('web_events_empty')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.events!.map((e) => {
                const d = formatDay(e.date, language);
                return (
                  <div key={e.id} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-600 text-white">
                      <span className="text-2xl font-extrabold leading-none">{d.day}</span>
                      <span className="text-xs uppercase">{d.month}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold">{e.title}</div>
                      <div className="text-sm capitalize text-slate-500">
                        {d.full}
                        {e.type ? ` · ${e.type}` : ''}
                      </div>
                      {e.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.description}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <SponsorSlot items={data.sectionSponsors.events ?? []} title={t('web_sponsored_by')} className="mt-8" />
        </Block>
      ) : null}

      {hasShop ? (
        <Block id="shop" title={t('web_shop_title')} text={t('web_shop_text')} tinted>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.shop!.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="font-semibold">{item.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-lg font-extrabold text-indigo-700">
                      {item.price !== null ? price(item.price) : ''}
                    </span>
                    {contactHref ? (
                      <a href={contactHref} className="text-xs font-bold text-slate-500 hover:text-indigo-700">
                        {t('web_shop_ask')}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SponsorSlot items={data.sectionSponsors.shop ?? []} title={t('web_sponsored_by')} className="mt-8" />
        </Block>
      ) : null}

      {hasSponsors ? (
        <Block id="sponsors" title={t('web_sponsors_title')} text={t('web_sponsors_text')}>
          {data.sponsors!.length ? (
            <div className="flex flex-wrap items-center justify-center gap-5">
              {data.sponsors!.map((s) => {
                const inner = s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt={s.name} className="h-16 w-32 object-contain" />
                ) : (
                  <span className="font-bold text-slate-700">{s.name}</span>
                );
                return (
                  <div key={s.id} className="flex h-24 w-44 items-center justify-center rounded-xl border border-slate-200 p-3">
                    {s.clickUrl ? (
                      <a href={s.clickUrl} target="_blank" rel="noopener noreferrer sponsored" title={s.name}>
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="mt-8 text-center">
            <a
              href={data.sponsorKitPath}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-indigo-600 px-5 py-2.5 font-bold text-indigo-700 hover:bg-indigo-50"
            >
              <HeartHandshake className="h-5 w-5" />
              {t('web_become_sponsor')}
            </a>
          </div>
        </Block>
      ) : null}

      {data.donation ? (
        <section id="donate" className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-3">
                <Gift className="h-9 w-9" />
                <h2 className="text-3xl font-extrabold">{t('web_donate_title')}</h2>
              </div>
              <p className="mt-3 max-w-2xl whitespace-pre-line text-emerald-50">
                {data.donation.text || t('web_donate_text')}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center text-slate-900 shadow-lg">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('web_tax_code')}</div>
              <div className="mt-1 font-mono text-2xl font-extrabold tracking-wider">{data.donation.taxCode}</div>
              <button
                type="button"
                onClick={copyTaxCode}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <Copy className="h-4 w-4" />
                {copied ? t('web_copied') : t('web_copy')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <footer id="contacts" className="bg-slate-900 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-white">{t('web_contacts_title')}</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {org.email ? (
                <li>
                  <a href={`mailto:${org.email}`} className="inline-flex items-center gap-2 hover:text-white">
                    <Mail className="h-4 w-4" />
                    {org.email}
                  </a>
                </li>
              ) : null}
              {org.phone ? (
                <li>
                  <a href={`tel:${org.phone}`} className="inline-flex items-center gap-2 hover:text-white">
                    <Phone className="h-4 w-4" />
                    {org.phone}
                  </a>
                </li>
              ) : null}
              {org.website ? (
                <li>
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                    <Globe className="h-4 w-4" />
                    {t('web_website')}
                  </a>
                </li>
              ) : null}
              {org.location ? (
                <li className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {org.location}
                </li>
              ) : null}
            </ul>
          </div>
          {socials.length ? (
            <div>
              <h2 className="text-xl font-bold text-white">{t('web_follow_us')}</h2>
              <div className="mt-4 flex gap-3">
                {socials.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">{t('web_powered')}</div>
      </footer>

      {openDoc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenDoc(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-bold">{openDoc === 'rules' ? t('web_doc_rules') : t('web_doc_privacy')}</h3>
              <button type="button" onClick={() => setOpenDoc(null)} aria-label={t('web_close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-700 [&_a]:text-indigo-700 [&_a]:underline [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Block({
  id,
  title,
  text,
  tinted,
  children,
}: {
  id: string;
  title: string;
  text?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${tinted ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-extrabold">{title}</h2>
        {text ? <p className="mt-2 text-slate-600">{text}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function HeroStat({ Icon, value, label }: { Icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur">
      <Icon className="h-5 w-5" />
      <div>
        <div className="text-lg font-extrabold leading-none">{value}</div>
        <div className="text-xs text-white/80">{label}</div>
      </div>
    </div>
  );
}

function ServiceCard({
  Icon,
  title,
  text,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-slate-600">{text}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
