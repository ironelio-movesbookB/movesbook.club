'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PublicLinkBanner from '@/components/club/sponsors/PublicLinkBanner';
import EventSettingsCard from '@/components/club/events/EventSettingsCard';
import {
  dangerButton,
  formatYmd,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/events/eventUi';
import {
  clubEventPublicPath,
  clubEventSubscribePath,
  eventApi,
} from '@/lib/club/events/eventClient';
import { formatEventEuro, type ClubEventListItem, type ClubEventRegistration } from '@/lib/club/events/eventConstants';
import { sponsorWorkspaceId } from '@/lib/club/sponsors/sponsorClient';

export default function EventListPage() {
  const [events, setEvents] = useState<ClubEventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<{
    event: ClubEventListItem;
    registrations: ClubEventRegistration[];
    description?: string;
    coverUrl?: string | null;
  } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await eventApi<{ events: ClubEventListItem[] }>('');
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWorkspaceId(sponsorWorkspaceId());
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      `${e.name} ${e.location} ${e.eventType}`.toLowerCase().includes(q),
    );
  }, [events, search]);

  const openDetail = async (ev: ClubEventListItem) => {
    try {
      const [full, regs] = await Promise.all([
        eventApi<{ event: ClubEventListItem & { description?: string; coverUrl?: string | null } }>(`/${ev.id}`),
        eventApi<{ registrations: ClubEventRegistration[] }>(`/${ev.id}/registrations`),
      ]);
      setDetail({
        event: full.event,
        registrations: regs.registrations,
        description: full.event.description,
        coverUrl: full.event.coverUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open event');
    }
  };

  const remove = async (ev: ClubEventListItem) => {
    const msg =
      ev.registered > 0
        ? `This event has ${ev.registered} subscriber(s). Delete is blocked until they are removed.`
        : `Delete “${ev.name}”?`;
    if (ev.registered > 0) {
      window.alert(msg);
      return;
    }
    if (!window.confirm(msg)) return;
    try {
      await eventApi(`/${ev.id}`, { method: 'DELETE' });
      setMenuId(null);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const copyLink = async (ev: ClubEventListItem) => {
    const path = clubEventSubscribePath(workspaceId || sponsorWorkspaceId(), ev.publicToken);
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert('Subscription link copied');
    } catch {
      window.prompt('Copy the link', url);
    }
  };

  const income = detail
    ? detail.registrations.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Events</h1>
          <p className="text-sm text-gray-600">
            Internal club/team events that members and visitors can view and subscribe to.
          </p>
        </div>
        <Link href="/clubs/events/new" className={primaryButton}>
          + New event
        </Link>
      </div>

      {workspaceId ? (
        <PublicLinkBanner
          title="Page of our events"
          description="Insert this link on your website, share it on socials, WhatsApp or Telegram and promote all your club/team events."
          path={clubEventPublicPath(workspaceId)}
          qrFileName="club-events-qr"
        />
      ) : null}

      <EventSettingsCard />

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <input
          className={inputClass}
          placeholder="Search by title, location or type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Cost</th>
              <th className="px-3 py-2">Allowed</th>
              <th className="px-3 py-2">Registered</th>
              <th className="px-3 py-2">Options</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr
                key={ev.id}
                className="cursor-pointer border-t border-gray-100 hover:bg-blue-50/40"
                onDoubleClick={() => void openDetail(ev)}
              >
                <td className="px-3 py-2 font-medium text-gray-900">{ev.name}</td>
                <td className="px-3 py-2 text-gray-600">{ev.location || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatYmd(ev.startDate)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatYmd(ev.endDate)}</td>
                <td className="px-3 py-2">{ev.eventType}</td>
                <td className="px-3 py-2">{ev.subeventCount}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ev.cost > 0 ? formatEventEuro(ev.cost) : 'Free'}
                </td>
                <td className="px-3 py-2">{ev.seats > 0 ? ev.seats : '∞'}</td>
                <td className="px-3 py-2">{ev.registered}</td>
                <td className="relative px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setMenuId((m) => (m === ev.id ? null : ev.id))}
                  >
                    Options
                  </button>
                  {menuId === ev.id ? (
                    <div className="absolute right-2 z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      <Link
                        href={`/clubs/events/${ev.id}`}
                        className="block px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        onClick={() => void copyLink(ev)}
                      >
                        Get link
                      </button>
                      <a
                        href={clubEventSubscribePath(workspaceId || sponsorWorkspaceId(), ev.publicToken)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
                        onClick={() => void remove(ev)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && !filtered.length ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  No events yet. Create your first internal event.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{detail.event.name}</h2>
                <p className="text-sm text-gray-600">{detail.event.location || '—'}</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            {detail.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.coverUrl} alt="" className="mt-3 max-h-56 w-full rounded-lg object-cover" />
            ) : null}
            {detail.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{detail.description}</p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Subscribers" value={String(detail.registrations.length)} />
              <Stat label="Total income" value={formatEventEuro(income)} />
              <Stat label="Cost" value={detail.event.cost > 0 ? formatEventEuro(detail.event.cost) : 'Free'} />
              <Stat label="Sub-events" value={String(detail.event.subeventCount)} />
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-600">Subscribers</h3>
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
              {detail.registrations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{r.fullName}</span>
                    <span className="text-gray-500"> · {r.email}</span>
                  </span>
                  <span className="text-gray-700">{formatEventEuro(r.amountPaid)}</span>
                </li>
              ))}
              {!detail.registrations.length ? (
                <li className="px-3 py-4 text-center text-gray-500">No subscribers yet.</li>
              ) : null}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/clubs/events/${detail.event.id}`} className={primaryButton}>
                Edit
              </Link>
              <button type="button" className={dangerButton} onClick={() => void remove(detail.event)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}
