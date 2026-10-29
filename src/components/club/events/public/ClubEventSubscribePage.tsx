'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatYmd, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/club/events/eventUi';
import { clubEventPublicPath } from '@/lib/club/events/eventClient';
import { formatEventEuro, type ClubEvent } from '@/lib/club/events/eventConstants';

type OrgCard = { kind: string; name: string; logoUrl: string | null };
type Sponsor = { name: string; logoUrl: string | null; bannerUrl: string | null; landingUrl: string } | null;
type MemberHit = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  fiscalCode: string;
  birthdate: string;
  address: string;
  city: string;
};

type Props = { orgId: string; token: string };

export default function ClubEventSubscribePage({ orgId, token }: Props) {
  const [org, setOrg] = useState<OrgCard | null>(null);
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [sponsor, setSponsor] = useState<Sponsor>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isMemberAnswer, setIsMemberAnswer] = useState<'yes' | 'no' | null>(null);
  const [fiscalCode, setFiscalCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [member, setMember] = useState<MemberHit | null>(null);
  const [lookupMsg, setLookupMsg] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zip, setZip] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentFiscalCode, setParentFiscalCode] = useState('');
  const [groupOrTeamName, setGroupOrTeamName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMain, setSelectedMain] = useState(true);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [textAnswers, setTextAnswers] = useState<Record<string, boolean>>({});
  const [payMode, setPayMode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Not found');
      setOrg(data.org);
      setEvent(data.event);
      setSponsor(data.sponsor || null);
      if (data.event && !data.event.openToNonMembers) setIsMemberAnswer('yes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyMember = (m: MemberHit) => {
    setMember(m);
    setFullName(m.fullName);
    setEmail(m.email);
    setPhone(m.phone);
    setFiscalCode(m.fiscalCode);
    setBirthdate(m.birthdate);
    setAddress(m.address);
    setCity(m.city);
  };

  const lookup = async (mode: 'fiscal' | 'login') => {
    setLookupMsg('');
    try {
      const body =
        mode === 'fiscal'
          ? { action: 'lookup-member', fiscalCode }
          : { action: 'lookup-member', username, password };
      const res = await fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      if (!data.member) {
        setLookupMsg('No matching member found');
        setMember(null);
        return;
      }
      applyMember(data.member as MemberHit);
      setLookupMsg('Member recognized — fields filled automatically');
    } catch (e) {
      setLookupMsg(e instanceof Error ? e.message : 'Lookup failed');
    }
  };

  const toggleSub = (subId: string) => {
    setSelectedSubs((ids) => {
      if (ids.includes(subId)) return ids.filter((x) => x !== subId);
      if (!event?.allowMultiSubeventSelect && ids.length) return [subId];
      return [...ids, subId];
    });
  };

  const estimate = useMemo(() => {
    if (!event) return 0;
    let g = selectedMain ? event.cost : 0;
    for (const s of event.subevents) if (selectedSubs.includes(s.id)) g += s.cost;
    for (const s of event.services) if (selectedServices.includes(s.id)) g += s.price;
    return g;
  }, [event, selectedMain, selectedSubs, selectedServices]);

  const submit = async () => {
    if (!event) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          fiscalCode,
          birthdate,
          address,
          city,
          province,
          zip,
          isMinor,
          parentName,
          parentFiscalCode,
          notes,
          groupOrTeamName,
          isMember: Boolean(member) || isMemberAnswer === 'yes',
          memberUserId: member?.userId || null,
          selectedMainEvent: selectedMain,
          selectedSubeventIds: selectedSubs,
          selectedServiceIds: selectedServices,
          textAnswers,
          payMode,
          amountPaid: estimate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setDone(event.confirmationText || 'Registration received. You will get a confirmation email shortly.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading…</div>;
  if (error && !event) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!event) return null;

  if (done) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Thank you!</h1>
        <p className="mt-3 whitespace-pre-wrap text-slate-700">{done}</p>
        <Link href={clubEventPublicPath(orgId)} className={`${primaryButton} mt-6 inline-block`}>
          Back to events
        </Link>
      </div>
    );
  }

  const showMemberGate = event.openToNonMembers && isMemberAnswer === null;
  const showForm =
    !showMemberGate &&
    (isMemberAnswer === 'no' ||
      isMemberAnswer === 'yes' ||
      (!event.openToNonMembers && event.membersOnly) ||
      Boolean(member));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : null}
          <div>
            <div className="text-sm text-slate-500">{org?.name}</div>
            <Link href={clubEventPublicPath(orgId)} className="text-sm text-blue-700 hover:underline">
              All events
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-3xl font-bold text-slate-900">{formatYmd(event.startDate)}</p>
          {event.endDate !== event.startDate ? (
            <p className="text-sm text-slate-500">until {formatYmd(event.endDate)}</p>
          ) : null}
          <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{event.name}</h1>
          {event.location ? <p className="mt-1 text-slate-600">{event.location}</p> : null}
          <p className="mt-3 text-lg font-semibold text-blue-800">Subscribe yourself now!</p>
          <p className="mt-1 text-sm text-slate-600">
            {event.cost > 0 ? formatEventEuro(event.cost) : 'Free'}
            {event.seats > 0 ? ` · ${event.seats} seats` : ''}
            {event.membersOnly && !event.openToNonMembers ? ' · Members only' : ''}
          </p>
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="mt-4 max-h-56 w-full rounded-lg object-cover" />
          ) : null}
          {event.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{event.description}</p>
          ) : null}
        </div>

        {sponsor?.bannerUrl || sponsor?.logoUrl ? (
          <a
            href={sponsor.landingUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sponsor.bannerUrl || sponsor.logoUrl || ''}
              alt={sponsor.name}
              className="max-h-32 w-full object-contain"
            />
          </a>
        ) : null}

        {showMemberGate ? (
          <div className="rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Are you a member of the {org?.kind === 'team' ? 'team' : 'club'}, or have you been a member?
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={primaryButton} onClick={() => setIsMemberAnswer('yes')}>
                Yes
              </button>
              <button type="button" className={secondaryButton} onClick={() => setIsMemberAnswer('no')}>
                No
              </button>
            </div>
          </div>
        ) : null}

        {isMemberAnswer === 'yes' || (!event.openToNonMembers && event.membersOnly) ? (
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Member recognition</h2>
            <p className="text-sm text-slate-600">
              You can type your fiscal code or put the username and password of your account.
            </p>
            <div>
              <label className={labelClass}>Fiscal code</label>
              <div className="flex flex-wrap gap-2">
                <input className={inputClass} value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value)} />
                <button type="button" className={secondaryButton} onClick={() => void lookup('fiscal')}>
                  Recognize
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Username or email</label>
                <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <button type="button" className={secondaryButton} onClick={() => void lookup('login')}>
              Sign in to autofill
            </button>
            {lookupMsg ? <p className="text-sm text-blue-700">{lookupMsg}</p> : null}
          </div>
        ) : null}

        {showForm ? (
          <div className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Subscription form</h2>

            {event.subscriberType !== 'Singles' ? (
              <Field label={`Name of the ${event.subscriberType === 'Groups' ? 'group' : 'team'}`}>
                <input
                  className={inputClass}
                  value={groupOrTeamName}
                  onChange={(e) => setGroupOrTeamName(e.target.value)}
                />
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name *">
                <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Fiscal code">
                <input className={inputClass} value={fiscalCode} onChange={(e) => setFiscalCode(e.target.value)} />
              </Field>
              <Field label="Birth date">
                <input
                  type="date"
                  className={inputClass}
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </Field>
              <Field label="City">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Address">
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="Province / ZIP">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="ZIP"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
              Underage participant
            </label>
            {isMinor ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Parent / guardian name">
                  <input className={inputClass} value={parentName} onChange={(e) => setParentName(e.target.value)} />
                </Field>
                <Field label="Parent fiscal code">
                  <input
                    className={inputClass}
                    value={parentFiscalCode}
                    onChange={(e) => setParentFiscalCode(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {event.services.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-slate-600">Additional services</h3>
                <ul className="space-y-2">
                  {event.services.map((s) => {
                    const on = selectedServices.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedServices((ids) =>
                              on ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                            on ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                          }`}
                        >
                          <span>{s.name}</span>
                          <span>{formatEventEuro(s.price)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase text-slate-600">Select event / sub-events</h3>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedMain}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setSelectedMain(on);
                    if (on) {
                      setSelectedSubs((ids) =>
                        ids.filter((id) => event.subevents.find((s) => s.id === id)?.externalToMain),
                      );
                    }
                  }}
                />
                Whole event — {event.name} ({event.cost > 0 ? formatEventEuro(event.cost) : 'Free'})
              </label>
              <ul className="space-y-2">
                {event.subevents.map((s) => {
                  const blocked = selectedMain && !s.externalToMain;
                  const on = selectedSubs.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                          blocked ? 'opacity-50' : ''
                        } ${on ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={blocked}
                          checked={on}
                          onChange={() => toggleSub(s.id)}
                        />
                        <span>
                          {event.name} — {s.name} ({s.cost > 0 ? formatEventEuro(s.cost) : 'Free'})
                          {s.externalToMain ? ' · external' : ''}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {event.texts.filter((t) => t.enabled).map((t) => (
              <label key={t.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(textAnswers[t.id])}
                  onChange={(e) => setTextAnswers((a) => ({ ...a, [t.id]: e.target.checked }))}
                />
                <span>
                  {t.label}
                  {t.mandatory ? ' *' : ''}
                </span>
              </label>
            ))}

            {event.privacyText ? (
              <p className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600">{event.privacyText}</p>
            ) : null}
            {event.photoVideoText ? (
              <p className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600">
                {event.photoVideoText}
              </p>
            ) : null}

            {(event.attachment1Url || event.attachment2Url) && (
              <div className="text-sm">
                <div className="font-semibold text-slate-700">Attachments</div>
                {event.attachment1Url ? (
                  <a className="text-blue-700 underline" href={event.attachment1Url} target="_blank" rel="noreferrer">
                    {event.attachment1Name || 'Attachment 1'}
                  </a>
                ) : null}
                {event.attachment2Url ? (
                  <a
                    className="ml-3 text-blue-700 underline"
                    href={event.attachment2Url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.attachment2Name || 'Attachment 2'}
                  </a>
                ) : null}
              </div>
            )}

            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Payment mode (optional)">
              <input className={inputClass} value={payMode} onChange={(e) => setPayMode(e.target.value)} />
            </Field>

            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              Estimated total: {formatEventEuro(estimate)}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              className={primaryButton}
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? 'Sending…' : 'Send subscription'}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}
