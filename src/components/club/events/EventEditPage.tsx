'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  dangerButton,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/events/eventUi';
import { eventApi } from '@/lib/club/events/eventClient';
import {
  CLUB_EVENT_SUBSCRIBER_TYPES,
  CLUB_EVENT_TYPES,
  emptyEventProfile,
  formatEventEuro,
  type ClubEvent,
  type ClubEventExtraText,
  type ClubEventProfile,
  type ClubEventRegistration,
  type ClubEventService,
  type ClubEventSubevent,
} from '@/lib/club/events/eventConstants';
import { sponsorApi } from '@/lib/club/sponsors/sponsorClient';

type Props = { eventId?: string };

type SponsorOption = { id: string; name: string };

export default function EventEditPage({ eventId }: Props) {
  const router = useRouter();
  const isNew = !eventId || eventId === 'new';
  const [profile, setProfile] = useState<ClubEventProfile>(emptyEventProfile());
  const [services, setServices] = useState<ClubEventService[]>([]);
  const [texts, setTexts] = useState<ClubEventExtraText[]>([]);
  const [subevents, setSubevents] = useState<ClubEventSubevent[]>([]);
  const [registrations, setRegistrations] = useState<ClubEventRegistration[]>([]);
  const [sponsors, setSponsors] = useState<SponsorOption[]>([]);
  const [id, setId] = useState(isNew ? '' : eventId);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('0');
  const [textDraft, setTextDraft] = useState('');
  const [subDraft, setSubDraft] = useState({
    name: '',
    startDate: '',
    endDate: '',
    cost: '0',
    seats: '0',
    externalToMain: false,
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError('');
    try {
      const [{ event }, regs] = await Promise.all([
        eventApi<{ event: ClubEvent }>(`/${eventId}`),
        eventApi<{ registrations: ClubEventRegistration[] }>(`/${eventId}/registrations`),
      ]);
      setId(event.id);
      setProfile({
        name: event.name,
        eventType: event.eventType as ClubEventProfile['eventType'],
        startDate: event.startDate,
        endDate: event.endDate,
        cost: event.cost,
        seats: event.seats,
        allowSubevents: event.allowSubevents,
        hideFromShare: event.hideFromShare,
        allowMultiSubeventSelect: event.allowMultiSubeventSelect,
        subscriberType: event.subscriberType,
        membersOnly: event.membersOnly,
        openToNonMembers: event.openToNonMembers,
        confirmationText: event.confirmationText,
        city: event.city,
        zip: event.zip,
        address: event.address,
        province: event.province,
        description: event.description,
        bannerUrl: event.bannerUrl,
        coverUrl: event.coverUrl,
        sponsorId: event.sponsorId,
        privacyText: event.privacyText,
        photoVideoText: event.photoVideoText,
        attachment1Name: event.attachment1Name,
        attachment1Url: event.attachment1Url,
        attachment2Name: event.attachment2Name,
        attachment2Url: event.attachment2Url,
        fileUploadEnabled: event.fileUploadEnabled,
        fileUploadLabel: event.fileUploadLabel,
        siblingDiscount: event.siblingDiscount,
      });
      setServices(event.services);
      setTexts(event.texts);
      setSubevents(event.subevents);
      setCoverUrl(event.coverUrl);
      setRegistrations(regs.registrations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event');
    } finally {
      setLoading(false);
    }
  }, [eventId, isNew]);

  useEffect(() => {
    void load();
    void sponsorApi<{ items: SponsorOption[] }>('')
      .then((d) => setSponsors((d.items || []).map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSponsors([]));
  }, [load]);

  const set = <K extends keyof ClubEventProfile>(key: K, value: ClubEventProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const ensureSaved = async (): Promise<string> => {
    if (id) {
      const data = await eventApi<{ event: ClubEvent }>(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ profile }),
      });
      return data.event.id;
    }
    const data = await eventApi<{ event: ClubEvent }>('', {
      method: 'POST',
      body: JSON.stringify({ profile }),
    });
    setId(data.event.id);
    return data.event.id;
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      const eventIdSaved = await ensureSaved();
      await eventApi(`/${eventIdSaved}/children`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'services', services }),
      });
      await eventApi(`/${eventIdSaved}/children`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'texts', texts }),
      });
      if (isNew) router.replace(`/clubs/events/${eventIdSaved}`);
      else await load();
      window.alert('Event saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadMedia = async (kind: 'cover' | 'attachment1' | 'attachment2', file: File) => {
    setSaving(true);
    setError('');
    try {
      const eventIdSaved = await ensureSaved();
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', file);
      if (kind !== 'cover') body.set('displayName', file.name);
      const data = await eventApi<{ event: ClubEvent }>(`/${eventIdSaved}/media`, { method: 'POST', body });
      setCoverUrl(data.event.coverUrl);
      setProfile((p) => ({
        ...p,
        coverUrl: data.event.coverUrl,
        attachment1Name: data.event.attachment1Name,
        attachment1Url: data.event.attachment1Url,
        attachment2Name: data.event.attachment2Name,
        attachment2Url: data.event.attachment2Url,
      }));
      if (isNew) router.replace(`/clubs/events/${eventIdSaved}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const addService = () => {
    const name = svcName.trim();
    if (!name) return;
    setServices((list) => [
      ...list,
      { id: `tmp-${Date.now()}`, name, price: Number(svcPrice) || 0, sortOrder: list.length },
    ]);
    setSvcName('');
    setSvcPrice('0');
  };

  const addText = () => {
    const label = textDraft.trim();
    if (!label) return;
    setTexts((list) => [
      ...list,
      { id: `tmp-${Date.now()}`, label, mandatory: false, enabled: true, sortOrder: list.length },
    ]);
    setTextDraft('');
  };

  const saveSubevent = async () => {
    const name = subDraft.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const eventIdSaved = await ensureSaved();
      const data = await eventApi<{ event: ClubEvent }>(`/${eventIdSaved}/children`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'subevent',
          subevent: {
            name,
            startDate: subDraft.startDate || profile.startDate,
            endDate: subDraft.endDate || profile.endDate,
            cost: Number(subDraft.cost) || 0,
            seats: Number(subDraft.seats) || 0,
            externalToMain: subDraft.externalToMain,
          },
        }),
      });
      setSubevents(data.event.subevents);
      setProfile((p) => ({ ...p, allowSubevents: true }));
      setSubDraft({ name: '', startDate: '', endDate: '', cost: '0', seats: '0', externalToMain: false });
      if (isNew) router.replace(`/clubs/events/${eventIdSaved}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save sub-event');
    } finally {
      setSaving(false);
    }
  };

  const deleteSub = async (subId: string) => {
    if (!id || !window.confirm('Delete this sub-event?')) return;
    setSaving(true);
    try {
      const data = await eventApi<{ event: ClubEvent }>(`/${id}/children`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'delete-subevent', subeventId: subId }),
      });
      setSubevents(data.event.subevents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete sub-event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading event…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/clubs/events" className="text-sm text-blue-700 hover:underline">
            ← Manage Events
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{isNew ? 'Add an event' : 'Edit event'}</h1>
        </div>
        <button type="button" className={primaryButton} disabled={saving} onClick={() => void saveAll()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Section title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={profile.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={profile.eventType}
              onChange={(e) => set('eventType', e.target.value as ClubEventProfile['eventType'])}
            >
              {CLUB_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              type="date"
              className={inputClass}
              value={profile.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              className={inputClass}
              value={profile.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
          <Field label="Cost (€)">
            <input
              className={inputClass}
              value={String(profile.cost)}
              onChange={(e) => set('cost', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Seats (0 = unlimited)">
            <input
              className={inputClass}
              value={String(profile.seats)}
              onChange={(e) => set('seats', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Subscriber type">
            <select
              className={inputClass}
              value={profile.subscriberType}
              onChange={(e) => set('subscriberType', e.target.value as ClubEventProfile['subscriberType'])}
            >
              {CLUB_EVENT_SUBSCRIBER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.membersOnly}
              onChange={(e) => set('membersOnly', e.target.checked)}
            />
            Members only
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.openToNonMembers}
              onChange={(e) => set('openToNonMembers', e.target.checked)}
            />
            Also open to non-members
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.hideFromShare}
              onChange={(e) => set('hideFromShare', e.target.checked)}
            />
            Hide from the shared events page
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={profile.allowMultiSubeventSelect}
              onChange={(e) => set('allowMultiSubeventSelect', e.target.checked)}
            />
            Allow selecting multiple sub-events
          </label>
        </div>
        <Field label="Confirmation text (shown after subscription)" className="mt-3">
          <textarea
            className={inputClass}
            rows={3}
            value={profile.confirmationText}
            onChange={(e) => set('confirmationText', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Sibling / relative discount">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.siblingDiscount.enabled}
            onChange={(e) =>
              set('siblingDiscount', { ...profile.siblingDiscount, enabled: e.target.checked })
            }
          />
          Enable relative discount
        </label>
        {profile.siblingDiscount.enabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Parent / relative name">
              <input
                className={inputClass}
                value={profile.siblingDiscount.parentName}
                onChange={(e) =>
                  set('siblingDiscount', { ...profile.siblingDiscount, parentName: e.target.value })
                }
              />
            </Field>
            <Field label="Fiscal code">
              <input
                className={inputClass}
                value={profile.siblingDiscount.fiscalCode}
                onChange={(e) =>
                  set('siblingDiscount', { ...profile.siblingDiscount, fiscalCode: e.target.value })
                }
              />
            </Field>
            <Field label="Discount %">
              <input
                className={inputClass}
                value={String(profile.siblingDiscount.percent)}
                onChange={(e) =>
                  set('siblingDiscount', {
                    ...profile.siblingDiscount,
                    percent: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Additional services">
        <ul className="space-y-2">
          {services.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
              <span>
                {s.name} — {formatEventEuro(s.price)}
              </span>
              <button
                type="button"
                className={dangerButton}
                onClick={() => setServices((list) => list.filter((_, idx) => idx !== i))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Service name"
            value={svcName}
            onChange={(e) => setSvcName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Price"
            value={svcPrice}
            onChange={(e) => setSvcPrice(e.target.value)}
          />
          <button type="button" className={secondaryButton} onClick={addService}>
            Add service
          </button>
        </div>
      </Section>

      <Section title="Additional texts">
        <p className="mb-2 text-xs text-gray-500">
          One row to start; add more with the button. Max about two lines per text. Mark mandatory when the
          subscriber must confirm it.
        </p>
        <ul className="space-y-2">
          {texts.map((t, i) => (
            <li key={t.id} className="rounded border border-gray-200 p-3 text-sm">
              <textarea
                className={inputClass}
                rows={2}
                value={t.label}
                onChange={(e) =>
                  setTexts((list) => list.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) =>
                      setTexts((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, enabled: e.target.checked } : x)),
                      )
                    }
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={t.mandatory}
                    onChange={(e) =>
                      setTexts((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, mandatory: e.target.checked } : x)),
                      )
                    }
                  />
                  Mandatory
                </label>
                <button
                  type="button"
                  className={dangerButton}
                  onClick={() => setTexts((list) => list.filter((_, idx) => idx !== i))}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <textarea
            className={`${inputClass} max-w-xl`}
            rows={2}
            placeholder="New additional text"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
          />
          <button type="button" className={secondaryButton} onClick={addText}>
            Add text
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.fileUploadEnabled}
            onChange={(e) => set('fileUploadEnabled', e.target.checked)}
          />
          Ask the subscriber to upload a file
        </label>
        {profile.fileUploadEnabled ? (
          <Field label="Upload label" className="mt-2">
            <input
              className={inputClass}
              value={profile.fileUploadLabel}
              onChange={(e) => set('fileUploadLabel', e.target.value)}
            />
          </Field>
        ) : null}
      </Section>

      <Section title="Location">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address">
            <input className={inputClass} value={profile.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={profile.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="ZIP">
            <input className={inputClass} value={profile.zip} onChange={(e) => set('zip', e.target.value)} />
          </Field>
          <Field label="Province">
            <input
              className={inputClass}
              value={profile.province}
              onChange={(e) => set('province', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Banner, cover & sponsor">
        <Field label="Description (under the banner / EVENT FRAME)">
          <textarea
            className={inputClass}
            rows={4}
            value={profile.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field label="Banner click URL (opens in a new tab)" className="mt-3">
          <input
            className={inputClass}
            placeholder="https://"
            value={profile.bannerUrl}
            onChange={(e) => set('bannerUrl', e.target.value)}
          />
        </Field>
        <Field label="Sponsor" className="mt-3">
          <select
            className={inputClass}
            value={profile.sponsorId}
            onChange={(e) => set('sponsorId', e.target.value)}
          >
            <option value="">— None —</option>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3">
          <label className={labelClass}>Cover / banner image</label>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="mb-2 max-h-40 rounded-lg object-cover" />
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadMedia('cover', f);
            }}
          />
        </div>
      </Section>

      <Section title="Privacy & attachments">
        <Field label="Privacy text">
          <textarea
            className={inputClass}
            rows={3}
            value={profile.privacyText}
            onChange={(e) => set('privacyText', e.target.value)}
          />
        </Field>
        <Field label="Photo / video notice" className="mt-3">
          <textarea
            className={inputClass}
            rows={3}
            value={profile.photoVideoText}
            onChange={(e) => set('photoVideoText', e.target.value)}
          />
        </Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Attachment 1 {profile.attachment1Name ? `(${profile.attachment1Name})` : ''}</label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadMedia('attachment1', f);
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Attachment 2 {profile.attachment2Name ? `(${profile.attachment2Name})` : ''}</label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadMedia('attachment2', f);
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Sub-events">
        <p className="mb-2 text-xs text-gray-500">
          Example: a 3-day camp as the main event, with single days as sub-events. Mark “external to main” if
          it can be selected together with the whole event.
        </p>
        <ul className="space-y-2">
          {subevents.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
              <span>
                <strong>{s.name}</strong> · {s.startDate} → {s.endDate} · {formatEventEuro(s.cost)}
                {s.externalToMain ? ' · external' : ''}
              </span>
              <button type="button" className={dangerButton} onClick={() => void deleteSub(s.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Sub-event name"
            value={subDraft.name}
            onChange={(e) => setSubDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subDraft.externalToMain}
              onChange={(e) => setSubDraft((d) => ({ ...d, externalToMain: e.target.checked }))}
            />
            External to the main event
          </label>
          <input
            type="date"
            className={inputClass}
            value={subDraft.startDate}
            onChange={(e) => setSubDraft((d) => ({ ...d, startDate: e.target.value }))}
          />
          <input
            type="date"
            className={inputClass}
            value={subDraft.endDate}
            onChange={(e) => setSubDraft((d) => ({ ...d, endDate: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Cost"
            value={subDraft.cost}
            onChange={(e) => setSubDraft((d) => ({ ...d, cost: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Seats"
            value={subDraft.seats}
            onChange={(e) => setSubDraft((d) => ({ ...d, seats: e.target.value }))}
          />
        </div>
        <button type="button" className={`${secondaryButton} mt-2`} disabled={saving} onClick={() => void saveSubevent()}>
          Add sub-event
        </button>
      </Section>

      {!isNew ? (
        <Section title={`Subscribers (${registrations.length})`}>
          <ul className="divide-y divide-gray-100 rounded border">
            {registrations.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {r.fullName} · {r.email}
                </span>
                <span>{formatEventEuro(r.amountPaid)}</span>
              </li>
            ))}
            {!registrations.length ? (
              <li className="px-3 py-4 text-center text-gray-500">No subscribers yet.</li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      <div className="flex justify-end gap-2 pb-8">
        <Link href="/clubs/events" className={secondaryButton}>
          Cancel
        </Link>
        <button type="button" className={primaryButton} disabled={saving} onClick={() => void saveAll()}>
          {saving ? 'Saving…' : 'Save event'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
