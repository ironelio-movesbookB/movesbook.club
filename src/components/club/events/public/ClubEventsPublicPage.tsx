'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import EventFrameModal, { type EventFrameItem } from '@/components/club/events/public/EventFrameModal';
import { formatYmd, primaryButton, secondaryButton } from '@/components/club/events/eventUi';
import { clubEventSubscribePath } from '@/lib/club/events/eventClient';
import { formatEventEuro, type ClubEventPublicCard } from '@/lib/club/events/eventConstants';

type OrgCard = { kind: string; name: string; logoUrl: string | null };

type Props = { orgId: string };

export default function ClubEventsPublicPage({ orgId }: Props) {
  const [org, setOrg] = useState<OrgCard | null>(null);
  const [events, setEvents] = useState<ClubEventPublicCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState<EventFrameItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/public/club-events/${encodeURIComponent(orgId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Not found');
      setOrg(data.org);
      setEvents(data.events || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5">
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-bold text-white">
              {(org?.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{org?.name || 'Events'}</h1>
            <p className="text-sm text-slate-600">Our events</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {events.map((ev) => {
          const href = clubEventSubscribePath(orgId, ev.publicToken);
          const open = expanded === ev.id;
          return (
            <article key={ev.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {ev.coverUrl ? (
                <button
                  type="button"
                  className="block w-full"
                  onClick={() =>
                    setFrame({
                      name: ev.name,
                      description: ev.description,
                      startDate: ev.startDate,
                      endDate: ev.endDate,
                      location: ev.location,
                      cost: ev.cost,
                      coverUrl: ev.coverUrl,
                      bannerUrl: ev.bannerUrl,
                      subscribeHref: href,
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ev.coverUrl} alt="" className="h-48 w-full object-cover" />
                </button>
              ) : null}
              <div className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ev.eventType}</div>
                <h2 className="text-xl font-bold text-slate-900">{ev.name}</h2>
                <p className="text-sm text-slate-600">
                  {formatYmd(ev.startDate)}
                  {ev.endDate !== ev.startDate ? ` – ${formatYmd(ev.endDate)}` : ''}
                  {ev.location ? ` · ${ev.location}` : ''}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {ev.cost > 0 ? formatEventEuro(ev.cost) : 'Free'}
                  {ev.subeventCount > 0 ? ` · ${ev.subeventCount} sub-event(s)` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={href} className={primaryButton}>
                    Display
                  </Link>
                  {ev.subeventCount > 0 ? (
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => setExpanded(open ? null : ev.id)}
                    >
                      {open ? 'Hide' : 'Discover more…'}
                    </button>
                  ) : null}
                </div>
                {open ? (
                  <ul className="mt-3 space-y-1 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    <li className="font-medium">{ev.name}</li>
                    {ev.subevents.map((s) => (
                      <li key={s.id}>
                        {ev.name} — {s.name}
                        {s.cost > 0 ? ` (${formatEventEuro(s.cost)})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}

        {!loading && !events.length && !error ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No published events at the moment.
          </p>
        ) : null}
      </main>

      <EventFrameModal item={frame} orgName={org?.name} onClose={() => setFrame(null)} />
    </div>
  );
}
