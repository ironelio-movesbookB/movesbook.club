'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flag, MapPin, Users } from 'lucide-react';

type InviteView = {
  promocode: string;
  language: string;
  sections: { intro: boolean; body: boolean; doc: boolean; links: boolean };
  introMessage: string;
  inviteBodyHtml: string;
  documentHtml: string;
  otherInfo: string;
  visitAlso: string;
  registerUrl: string;
  sender: {
    username: string;
    displayName: string;
    photoUrl: string | null;
    bannerUrl: string | null;
    location: string | null;
    kindLabel: string;
    visitorPageUrl: string | null;
    members: number | null;
    staff: number | null;
    sinceYear: number | null;
  };
};

function asHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function PublicInvitePage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<InviteView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const promocode = searchParams?.get('promocode')?.trim() || '';
    if (!promocode) {
      setError('This invite link is missing a promocode.');
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    params.set('promocode', promocode);
    for (const key of ['inviter', 'lang', 'sections', 'invite_by', 'user_email'] as const) {
      const value = searchParams?.get(key);
      if (value) params.set(key, value);
    }
    let active = true;
    setLoading(true);
    void fetch(`/api/public/invite?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Invite not found');
        if (active) setData(json as InviteView);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Invite not found');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-slate-600">Loading invite…</div>;
  }
  if (!data) {
    return <div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-red-700">{error || 'Invite not found'}</div>;
  }

  const banner = data.sender.bannerUrl;
  const photo = data.sender.photoUrl;
  const otherHref = asHref(data.otherInfo);
  const visitHref = asHref(data.visitAlso);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header
        className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-sky-700 text-white"
        style={
          banner
            ? {
                backgroundImage: `linear-gradient(rgba(15,23,42,.55), rgba(15,23,42,.75)), url(${banner})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 px-5 py-14 md:flex-row md:items-center">
          {photo ? (
            data.sender.visitorPageUrl ? (
              <a href={data.sender.visitorPageUrl}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt=""
                  className="h-24 w-24 rounded-full border-2 border-white/80 bg-white object-cover shadow-lg"
                />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-24 w-24 rounded-full border-2 border-white/80 bg-white object-cover shadow-lg"
              />
            )
          ) : null}
          <div>
            <h1 className="text-3xl font-extrabold md:text-5xl">{data.sender.displayName}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
              {data.sender.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {data.sender.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Flag className="h-4 w-4" />
                {data.sender.kindLabel}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {data.sender.members != null ? (
                <span className="rounded bg-black/25 px-3 py-1.5">
                  <Users className="mr-1 inline h-4 w-4" />
                  {data.sender.members.toLocaleString()} Members
                </span>
              ) : null}
              {data.sender.sinceYear ? (
                <span className="rounded bg-black/25 px-3 py-1.5">{data.sender.sinceYear} Since</span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <div className="overflow-hidden rounded-xl bg-gradient-to-r from-[#7d0e1f] to-[#b42318] px-5 py-8 text-white shadow">
          <p className="text-sm uppercase tracking-wide text-white/80">Official invite</p>
          <h2 className="mt-1 text-2xl font-bold">Join Movesbook with a promotional code</h2>
          <p className="mt-2 text-sm text-white/90">
            Promotional code{' '}
            <span className="rounded bg-white/15 px-2 py-0.5 font-semibold">{data.promocode}</span>
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/banner_picture.jpg"
          alt=""
          className="w-full object-cover"
          style={{ maxHeight: 320 }}
        />

        {data.sections.intro && data.introMessage.trim() ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-slate-800">
            <h3 className="text-sm font-semibold text-amber-900">Message of intro</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{data.introMessage}</p>
          </section>
        ) : null}

        {data.sections.body && data.inviteBodyHtml.trim() ? (
          <section
            className="prose prose-slate max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: data.inviteBodyHtml }}
          />
        ) : null}

        <p className="text-sm text-slate-700">
          Regards, <span className="font-semibold text-[#7d0e1f]">{data.sender.displayName}</span>
        </p>

        {data.sections.doc && data.documentHtml.trim() ? (
          <section className="overflow-hidden rounded-lg border border-slate-200">
            <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-[#7d0e1f]">
              Document in attachment
            </div>
            <div
              className="prose prose-slate max-w-none px-4 py-4"
              dangerouslySetInnerHTML={{ __html: data.documentHtml }}
            />
          </section>
        ) : null}

        {data.sections.links && (data.otherInfo.trim() || data.visitAlso.trim()) ? (
          <section className="rounded-lg border border-slate-200 px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Links in attachment</h3>
            <div className="mt-3 space-y-2 text-sm">
              {data.otherInfo.trim() ? (
                <p>
                  <span className="font-medium text-slate-600">Other info: </span>
                  {otherHref ? (
                    <a href={otherHref} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                      {data.otherInfo}
                    </a>
                  ) : (
                    data.otherInfo
                  )}
                </p>
              ) : null}
              {data.visitAlso.trim() ? (
                <p>
                  <span className="font-medium text-slate-600">Visit also: </span>
                  {visitHref ? (
                    <a href={visitHref} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                      {data.visitAlso}
                    </a>
                  ) : (
                    data.visitAlso
                  )}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <a
          href="https://movesbook.eu"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 hover:bg-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/payment_logo/logo_movesbook_brand.jpg" alt="Movesbook" className="h-12 w-auto object-contain" />
          <span className="text-sm font-semibold text-slate-800">Open the Movesbook website</span>
        </a>

        <div className="pb-10 text-center">
          <a
            href={data.registerUrl}
            className="inline-flex min-w-[240px] items-center justify-center rounded-lg bg-[#7d0e1f] px-8 py-4 text-lg font-bold text-white shadow hover:bg-[#641018]"
          >
            Register free now!
          </a>
        </div>
      </main>
    </div>
  );
}
