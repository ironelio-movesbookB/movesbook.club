'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PublicLinkBanner from '@/components/club/sponsors/PublicLinkBanner';
import PostInviteToMovesbookModal from '@/components/club/PostInviteToMovesbookModal';
import SocialShareModal from '@/components/news/SocialShareModal';
import EventSettingsCard from '@/components/club/events/EventSettingsCard';
import EventDescription from '@/components/club/events/EventDescription';
import EventSubscribersList from '@/components/club/events/EventSubscribersList';
import ArchiveListToolbar, {
  emptyArchiveFilterValues,
  type ArchiveListFilterValues,
} from '@/components/procedures/ArchiveListToolbar';
import {
  dangerButton,
  formatYmd,
  inputClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/events/eventUi';
import {
  clubEventPublicPath,
  clubEventSelectionPath,
  clubEventSubscribePath,
  eventApi,
} from '@/lib/club/events/eventClient';
import {
  CLUB_EVENT_TYPES,
  EVENT_AUTO_REMOVE_DAYS,
  formatEventEuro,
  type ClubEventListItem,
  type ClubEventRegistration,
  type ClubEventSettings,
} from '@/lib/club/events/eventConstants';
import { sponsorWorkspaceId } from '@/lib/club/sponsors/sponsorClient';

function isExpired(endDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return endDate < ymd;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type MenuState = { id: string; top: number; right: number };

export default function EventListPage() {
  const [events, setEvents] = useState<ClubEventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [draft, setDraft] = useState<ArchiveListFilterValues>(emptyArchiveFilterValues());
  const [applied, setApplied] = useState<ArchiveListFilterValues>(emptyArchiveFilterValues());
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [appliedType, setAppliedType] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{
    event: ClubEventListItem;
    registrations: ClubEventRegistration[];
    description?: string;
    coverUrl?: string | null;
  } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [linkTypes, setLinkTypes] = useState<string[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [autoRemove, setAutoRemove] = useState(false);
  const [savingAutoRemove, setSavingAutoRemove] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await eventApi<{ events: ClubEventListItem[]; settings?: ClubEventSettings }>('');
      setEvents(data.events);
      setAutoRemove(Boolean(data.settings?.autoRemoveExpired));
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWorkspaceId(sponsorWorkspaceId());
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('click', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('click', close);
    };
  }, [menu]);

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    let list = [...events];
    if (q) {
      list = list.filter((e) => `${e.name} ${e.location} ${e.eventType}`.toLowerCase().includes(q));
    }
    if (applied.fromDate) list = list.filter((e) => e.startDate >= applied.fromDate);
    if (applied.toDate) list = list.filter((e) => e.startDate <= applied.toDate);
    if (appliedType !== 'all') list = list.filter((e) => e.eventType === appliedType);
    list.sort((a, b) => {
      const cmp = a.startDate.localeCompare(b.startDate);
      return applied.orderBy === 'old' ? cmp : -cmp;
    });
    return list;
  }, [events, applied, appliedType]);

  const checkedEvents = useMemo(() => filtered.filter((e) => selectedIds.has(e.id)), [filtered, selectedIds]);

  const orgId = workspaceId || sponsorWorkspaceId();
  const selectionPath = checkedEvents.length && orgId
    ? clubEventSelectionPath(orgId, checkedEvents.map((e) => e.publicToken))
    : '';
  const selectionTitle =
    checkedEvents.length === 1 ? checkedEvents[0].name : `Our events (${checkedEvents.length})`;
  const selectionPostHtml = checkedEvents.length
    ? `<p>You are invited to:</p><ul>${checkedEvents
        .map((e) => `<li><strong>${escapeHtml(e.name)}</strong>${e.location ? ` — ${escapeHtml(e.location)}` : ''}</li>`)
        .join('')}</ul>`
    : '';

  const requireChecked = (): boolean => {
    if (checkedEvents.length) return true;
    window.alert('Check one or more events first.');
    return false;
  };

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

  const canDelete = (ev: ClubEventListItem) => isExpired(ev.endDate) || ev.registered === 0;

  const toggleAutoRemove = async (on: boolean) => {
    if (
      on &&
      !window.confirm(
        `Events ended more than ${EVENT_AUTO_REMOVE_DAYS} days ago will be removed now and automatically from now on. Subscriptions and cash archive records are kept. Continue?`,
      )
    ) {
      return;
    }
    setSavingAutoRemove(true);
    try {
      await eventApi('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings: { autoRemoveExpired: on } }),
      });
      setAutoRemove(on);
      if (on) await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not save the setting');
    } finally {
      setSavingAutoRemove(false);
    }
  };

  const removeOne = async (ev: ClubEventListItem) => {
    if (!canDelete(ev)) {
      window.alert(
        `Cannot delete: ${ev.registered} subscriber(s) registered and the event is not expired.`,
      );
      return;
    }
    if (!window.confirm(`Delete “${ev.name}”?`)) return;
    try {
      await eventApi(`/${ev.id}`, { method: 'DELETE' });
      setMenu(null);
      if (selectedId === ev.id) setSelectedId(null);
      setDetail(null);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const deleteSelected = async () => {
    const targets = checkedEvents;
    if (!targets.length) return;
    const blocked = targets.filter((e) => !canDelete(e));
    if (blocked.length) {
      window.alert(
        `${blocked.length} event(s) have subscribers and are not expired. Remove them from the selection or wait until they expire.`,
      );
      return;
    }
    if (!window.confirm(`Delete ${targets.length} selected event(s)?`)) return;
    for (const ev of targets) {
      try {
        await eventApi(`/${ev.id}`, { method: 'DELETE' });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : `Could not delete ${ev.name}`);
        break;
      }
    }
    setSelectedId(null);
    await load();
  };

  const copyLink = async (ev: ClubEventListItem) => {
    const path = clubEventSubscribePath(orgId, ev.publicToken);
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert('Subscription link copied');
    } catch {
      window.prompt('Copy the link', url);
    }
  };

  const toggleCheck = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((e) => e.id)));
  };

  const openMenu = (ev: ClubEventListItem, button: HTMLElement) => {
    if (menu?.id === ev.id) {
      setMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenu({ id: ev.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  const menuEvent = menu ? events.find((e) => e.id === menu.id) || null : null;

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

      {orgId ? (
        <PublicLinkBanner
          title="Page of our events"
          description="Insert this link on your website, share it on socials, WhatsApp or Telegram and promote all your club/team events."
          path={clubEventPublicPath(orgId, linkTypes)}
          qrFileName="club-events-qr"
          postBodyHtml="<p>Discover all our club/team events and subscribe online.</p>"
          postToAllMembers
        >
          <EventTypeMultiSelect value={linkTypes} onChange={setLinkTypes} />
        </PublicLinkBanner>
      ) : null}

      {selectionPath ? (
        <PublicLinkBanner
          title="BANNER OF PROMOTION OF THE SELECTED EVENT"
          description={`Send this page to potential subscribers — ${checkedEvents.length} checked event(s).`}
          path={selectionPath}
          qrFileName="selected-events-qr"
          postBodyHtml={selectionPostHtml}
          postToAllMembers
        />
      ) : null}

      <EventSettingsCard />

      <ArchiveListToolbar
        title="Filter"
        values={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onApply={() => {
          setApplied(draft);
          setAppliedType(eventTypeFilter);
        }}
        onClear={() => {
          const empty = emptyArchiveFilterValues();
          setDraft(empty);
          setApplied(empty);
          setEventTypeFilter('all');
          setAppliedType('all');
        }}
        selectedCount={selectedIds.size}
        onDeleteSelected={() => void deleteSelected()}
        onSendData={() => {
          if (requireChecked()) setSendOpen(true);
        }}
        sendDataTitle="Mail the checked events"
        onShare={() => {
          if (requireChecked()) setShareOpen(true);
        }}
        shareButtonTitle="Share the presentation page of the checked events"
        additionalFilter={
          <label className="flex min-w-[150px] flex-col">
            <span className="mb-1 block text-[12px] font-semibold text-gray-800">Type of event</span>
            <select
              className={inputClass}
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {CLUB_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      <label className="flex w-fit items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={autoRemove}
          disabled={savingAutoRemove}
          onChange={(e) => void toggleAutoRemove(e.target.checked)}
        />
        Remove expired after {EVENT_AUTO_REMOVE_DAYS} days
      </label>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
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
            {filtered.map((ev) => {
              const checked = selectedIds.has(ev.id);
              const active = selectedId === ev.id;
              const expired = isExpired(ev.endDate);
              return (
                <tr
                  key={ev.id}
                  title={expired ? 'Expired event' : undefined}
                  className={`cursor-pointer border-t border-gray-100 ${expired ? 'text-gray-400' : ''} ${
                    checked ? 'bg-amber-50' : active ? 'bg-amber-100' : 'hover:bg-blue-50/40'
                  }`}
                  onClick={() => setSelectedId(ev.id)}
                  onDoubleClick={() => void openDetail(ev)}
                >
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheck(ev.id)}
                      aria-label={`Select ${ev.name}`}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium ${expired ? '' : 'text-gray-900'}`}>{ev.name}</td>
                  <td className={`px-3 py-2 ${expired ? '' : 'text-gray-600'}`}>{ev.location || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatYmd(ev.startDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatYmd(ev.endDate)}</td>
                  <td className="px-3 py-2">{ev.eventType}</td>
                  <td className="px-3 py-2">{ev.subeventCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ev.cost > 0 ? formatEventEuro(ev.cost, ev.currency) : 'Free'}
                  </td>
                  <td className="px-3 py-2">{ev.seats > 0 ? ev.seats : '∞'}</td>
                  <td className="px-3 py-2">{ev.registered}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={secondaryButton}
                      aria-haspopup="menu"
                      aria-expanded={menu?.id === ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(ev, e.currentTarget);
                      }}
                    >
                      Options
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && !filtered.length ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                  No events match the filter. Create your first internal event.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {menu && menuEvent ? (
        <div
          role="menu"
          className="fixed z-40 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          style={{ top: menu.top, right: menu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/clubs/events/${menuEvent.id}`} className="block px-3 py-1.5 text-sm hover:bg-gray-50">
            Edit
          </Link>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              setMenu(null);
              void copyLink(menuEvent);
            }}
          >
            Get link
          </button>
          <a
            href={clubEventSubscribePath(orgId, menuEvent.publicToken)}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => setMenu(null)}
          >
            Open
          </a>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => void removeOne(menuEvent)}
          >
            Delete
          </button>
        </div>
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{detail.event.name}</h2>
                <p className="text-sm text-gray-600">{detail.event.location || '—'}</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <div className="shrink-0">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {detail.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.coverUrl} alt="" className="max-h-48 w-full rounded-lg object-cover" />
                  ) : null}
                  {detail.description ? (
                    <div className="max-h-48 overflow-y-auto text-sm text-gray-700">
                      <EventDescription html={detail.description} />
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Subscribers" value={String(detail.registrations.length)} />
                  <Stat label="Total income" value={formatEventEuro(income, detail.event.currency)} />
                  <Stat
                    label="Cost"
                    value={detail.event.cost > 0 ? formatEventEuro(detail.event.cost, detail.event.currency) : 'Free'}
                  />
                  <Stat label="Sub-events" value={String(detail.event.subeventCount)} />
                </div>
                <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-600">Subscribers</h3>
              </div>
              <div className="mt-2 min-h-[120px] flex-1 overflow-y-auto">
                <EventSubscribersList registrations={detail.registrations} />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-gray-100 px-5 py-3">
              <Link href={`/clubs/events/${detail.event.id}`} className={primaryButton}>
                Edit
              </Link>
              <button type="button" className={dangerButton} onClick={() => void removeOne(detail.event)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SendEventsDataModal
        open={sendOpen}
        events={checkedEvents}
        onClose={() => setSendOpen(false)}
      />

      <SocialShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        articleUrl={selectionPath ? `${origin}${selectionPath}` : ''}
        articleTitle={selectionTitle}
        heading="Share this page"
        onPostToMovesbook={() => {
          setShareOpen(false);
          setPostOpen(true);
        }}
      />

      <PostInviteToMovesbookModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title={selectionTitle}
        bodyHtml={selectionPostHtml}
        inviteUrl={selectionPath ? `${origin}${selectionPath}` : ''}
        allMembers
      />
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

/** Multi-check dropdown of event types for the shared events link (empty = all types). */
function EventTypeMultiSelect({ value, onChange }: { value: string[]; onChange: (types: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (type: string) => {
    onChange(value.includes(type) ? value.filter((t) => t !== type) : [...value, type]);
  };

  return (
    <div ref={ref} className="relative inline-block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-blue-100">
        Types of events shared
      </span>
      <button
        type="button"
        className="inline-flex min-w-[240px] items-center justify-between gap-2 rounded-md border border-white/60 bg-white px-3 py-1.5 text-left text-gray-900"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{value.length ? value.join(', ') : 'All types'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[240px] rounded-md border border-gray-200 bg-white py-1 text-gray-900 shadow-lg">
          {CLUB_EVENT_TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-blue-50">
              <input type="checkbox" checked={value.includes(t)} onChange={() => toggle(t)} />
              {t}
            </label>
          ))}
          <button
            type="button"
            className="mt-1 block w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs text-blue-700 hover:bg-gray-50"
            onClick={() => onChange([])}
          >
            All types
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SendEventsDataModal({
  open,
  events,
  onClose,
}: {
  open: boolean;
  events: ClubEventListItem[];
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) setMessage('');
  }, [open]);

  if (!open) return null;

  const send = async () => {
    setSending(true);
    setMessage('');
    try {
      await eventApi('/send-data', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), eventIds: events.map((e) => e.id) }),
      });
      window.alert(`${events.length} event(s) sent to ${email.trim()}`);
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Send events data</h2>
        <p className="mt-1 text-sm text-gray-600">
          The grid of the {events.length} checked event(s) and the link to their presentation page will be mailed.
        </p>
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 p-2 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <strong>{e.name}</strong> · {formatYmd(e.startDate)}
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-[12px] font-semibold uppercase text-gray-700">Email</label>
        <input
          type="email"
          className={inputClass}
          value={email}
          placeholder="name@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={sending || !email.trim()}
            onClick={() => void send()}
          >
            {sending ? 'Sending…' : 'Send mail'}
          </button>
        </div>
      </div>
    </div>
  );
}
