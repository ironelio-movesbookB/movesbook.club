'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EventDescription from '@/components/club/events/EventDescription';
import EventAttachmentViewer, { type EventAttachment } from '@/components/club/events/public/EventAttachmentViewer';
import { formatYmd, inputClass, labelClass, primaryButton, secondaryButton } from '@/components/club/events/eventUi';
import { fetchEventQuickRegistrationText } from '@/constants/eventQuickRegistrationLongText';
import { useLanguage } from '@/contexts/LanguageContext';
import { clubEventPublicPath } from '@/lib/club/events/eventClient';
import {
  EVENT_TEXT_FILE_ACCEPT,
  EVENT_PAY_CHOICE_LABELS,
  EVENT_TEXT_FILE_MAX_BYTES,
  eventAvailability,
  formatEventEuro,
  payChoicesFor,
  subeventTextColorHex,
  todayYmd,
  type ClubEvent,
  type EventPayChoice,
  type ClubEventSubevent,
} from '@/lib/club/events/eventConstants';
import { COUNTRIES } from '@/lib/news/countries';
import { stripStoredHtml } from '@/lib/promocodes/suggestMovesbookCopy';

type Quote = {
  gross: number;
  discountPercent: number;
  paid: number;
  relativeFound: boolean;
  relativeDiscountApplied?: boolean;
  appliedRule?: { minSubevents: number; discountPercent: number } | null;
  selectedCount?: number;
};
type OnlineProvider = 'stripe' | 'paypal';
type UploadedFile = { name: string; path: string };

type OrgCard = { kind: string; name: string; logoUrl: string | null };
type Sponsor = { name: string; logoUrl: string | null; bannerUrl: string | null; landingUrl: string } | null;
type MemberHit = {
  userId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  fiscalCode: string;
  birthdate: string;
  address: string;
  city: string;
  province?: string;
  zip?: string;
  sex?: string;
  birthCountry?: string;
  birthLocality?: string;
  /** The fiscal code field holds a foreigner identification code. */
  foreignIdCode?: boolean;
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

  const { currentLanguage } = useLanguage();
  const [quickText, setQuickText] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [quickFiscal, setQuickFiscal] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [member, setMember] = useState<MemberHit | null>(null);
  const [lookupMsg, setLookupMsg] = useState('');
  const [viewer, setViewer] = useState<EventAttachment | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState('');
  const [useForeignId, setUseForeignId] = useState(false);
  const [foreignIdCode, setForeignIdCode] = useState('');
  const [birthCountry, setBirthCountry] = useState('');
  const [birthLocality, setBirthLocality] = useState('');
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
  const [textFiles, setTextFiles] = useState<Record<string, UploadedFile>>({});
  const [uploadingText, setUploadingText] = useState<string | null>(null);
  const [relativeName, setRelativeName] = useState('');
  const [relativeFiscalCode, setRelativeFiscalCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [payChoice, setPayChoice] = useState<EventPayChoice | ''>('');
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([]);
  const [provider, setProvider] = useState<OnlineProvider | ''>('');
  /** Read-only until focused, so the browser cannot autofill saved credentials on open. */
  const [loginUnlocked, setLoginUnlocked] = useState(false);
  const router = useRouter();

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
      const providers = (Array.isArray(data.onlineProviders) ? data.onlineProviders : []) as OnlineProvider[];
      setOnlineProviders(providers);
      setProvider(providers[0] || '');
      if (data.event && eventAvailability(data.event).full) setSelectedMain(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void fetchEventQuickRegistrationText(currentLanguage).then((value) => {
      if (active) setQuickText(stripStoredHtml(value));
    });
    return () => {
      active = false;
    };
  }, [currentLanguage]);

  const applyMember = (m: MemberHit) => {
    setMember(m);
    if (m.firstName || m.lastName) {
      setFirstName(m.firstName || '');
      setLastName(m.lastName || '');
    } else {
      const [first, ...rest] = m.fullName.split(/\s+/);
      setFirstName(first || '');
      setLastName(rest.join(' '));
    }
    setEmail(m.email);
    setPhone(m.phone);
    if (m.foreignIdCode) {
      setUseForeignId(true);
      setForeignIdCode(m.fiscalCode);
      setFiscalCode('');
    } else {
      setUseForeignId(false);
      setForeignIdCode('');
      setFiscalCode(m.fiscalCode);
    }
    setBirthdate(m.birthdate);
    setAddress(m.address);
    setCity(m.city);
    setProvince(m.province || '');
    setZip(m.zip || '');
    setSex(m.sex === 'M' || m.sex === 'F' ? m.sex : '');
    setBirthCountry(m.birthCountry || '');
    setBirthLocality(m.birthLocality || '');
    setPassword('');
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(clubEventPublicPath(orgId));
  };

  const lookup = async (mode: 'fiscal' | 'login') => {
    setLookupMsg('');
    try {
      const body =
        mode === 'fiscal'
          ? { action: 'lookup-member', fiscalCode: quickFiscal }
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

  const claimsAsMember = Boolean(member);
  const showRelative = Boolean(
    event?.siblingDiscount.enabled &&
      event.siblingDiscount.percent > 0 &&
      (claimsAsMember || event.siblingDiscount.applyToNonMembers),
  );

  useEffect(() => {
    if (!event) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quote',
          isMember: claimsAsMember,
          memberUserId: member?.userId || null,
          selectedMainEvent: selectedMain,
          selectedSubeventIds: selectedSubs,
          selectedServiceIds: selectedServices,
          relativeName: showRelative ? relativeName : '',
          relativeFiscalCode: showRelative ? relativeFiscalCode : '',
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (active) setQuote(data?.quote ?? null);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    event,
    token,
    claimsAsMember,
    member?.userId,
    selectedMain,
    selectedSubs,
    selectedServices,
    showRelative,
    relativeName,
    relativeFiscalCode,
  ]);

  const uploadTextFile = async (textId: string, file: File) => {
    if (file.size > EVENT_TEXT_FILE_MAX_BYTES) {
      setError('File too large (max 10 MB)');
      return;
    }
    setUploadingText(textId);
    setError('');
    try {
      const body = new FormData();
      body.set('textId', textId);
      body.set('file', file);
      const res = await fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        method: 'POST',
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setTextFiles((f) => ({ ...f, [textId]: data.file as UploadedFile }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingText(null);
    }
  };

  const currency = event?.currency || 'EUR';
  const amountDue = event?.paymentModality === 'A' ? 0 : quote ? quote.paid : estimate;
  const allowedChoices = useMemo(() => (event ? payChoicesFor(event.paymentModality) : []), [event]);
  const payChoices = useMemo(
    () => allowedChoices.filter((c) => c === 'club' || onlineProviders.length > 0),
    [allowedChoices, onlineProviders],
  );
  const needsPayChoice = amountDue > 0 && allowedChoices.length > 0;
  const orgKindLabel = org?.kind === 'team' ? 'team' : 'club';

  useEffect(() => {
    if (payChoices.length === 1 && payChoice !== payChoices[0]) setPayChoice(payChoices[0]);
    if (payChoice && !payChoices.includes(payChoice)) setPayChoice('');
  }, [payChoices, payChoice]);

  const submit = async () => {
    if (!event) return;
    if (needsPayChoice && !payChoice) {
      setError(payChoices.length ? 'Choose how you want to pay' : 'Online payment is not available yet. Please contact the club.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/public/club-events/by-token/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          sex,
          birthCountry,
          birthLocality,
          foreignIdCode: useForeignId ? foreignIdCode : '',
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
          isMember: claimsAsMember,
          memberUserId: member?.userId || null,
          selectedMainEvent: selectedMain,
          selectedSubeventIds: selectedSubs,
          selectedServiceIds: selectedServices,
          textAnswers,
          textFiles,
          relativeName: showRelative ? relativeName : '',
          relativeFiscalCode: showRelative ? relativeFiscalCode : '',
          payChoice: needsPayChoice ? payChoice : undefined,
          provider: provider || undefined,
          language: typeof navigator !== 'undefined' ? navigator.language : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      if (data.payUrl) {
        window.location.href = String(data.payUrl);
        return;
      }
      const lines = [event.confirmationText || 'Registration received.'];
      if (data.confirmationRequired) {
        lines.push('We sent you an email: click the confirmation link to confirm your subscription.');
      }
      if (data.payLinkEmailed) lines.push('The payment link was sent to your email: you can pay later.');
      if (payChoice === 'club' && amountDue > 0) {
        lines.push(`You can pay ${formatEventEuro(amountDue, currency)} at the ${orgKindLabel} (cash or cheque).`);
      }
      setDone(lines.join('\n\n'));
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

  const status = eventAvailability(event);
  const openSubevents = event.subevents.filter((s) => !subeventBlockMessage(s));
  const blocked = status.expired || status.closed || (status.full && !openSubevents.length);
  const memberOnly = event.membersOnly && !event.openToNonMembers;
  const needsRecognition = memberOnly && !member;
  const orgName = org?.name || (org?.kind === 'team' ? 'the team' : 'the club');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 py-3 sm:px-3">
          <div className="flex justify-start">
            <SponsorLogo sponsor={sponsor} />
          </div>
          <div className="flex items-center gap-3">
            {org?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : null}
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{org?.name}</div>
              <Link href={clubEventPublicPath(orgId)} className="text-sm text-blue-700 hover:underline">
                All events
              </Link>
            </div>
          </div>
          <div className="flex justify-end">
            <SponsorLogo sponsor={sponsor} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <button type="button" className={secondaryButton} onClick={goBack}>
          ← Back
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-3xl font-bold text-slate-900">{formatYmd(event.startDate)}</p>
          {event.endDate !== event.startDate ? (
            <p className="text-sm text-slate-500">until {formatYmd(event.endDate)}</p>
          ) : null}
          <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{event.name}</h1>
          {event.location ? <p className="mt-1 text-slate-600">{event.location}</p> : null}
          <p className="mt-3 text-lg font-semibold text-blue-800">Subscribe yourself now!</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">
            {event.cost > 0 ? formatEventEuro(event.cost, currency) : 'Free'}
            {event.seats > 0 ? ` · ${event.seats} seats` : ''}
            {memberOnly ? ' · Members only' : ''}
          </p>
          {status.seatsLeft !== null && status.seatsLeft > 0 ? (
            <p className="text-red-600">
              {status.seatsLeft} {status.seatsLeft === 1 ? 'seat' : 'seats'} still available
            </p>
          ) : null}
          {status.blockMessage ? (
            <p className="mt-2 text-lg font-bold text-red-600">{status.blockMessage}</p>
          ) : null}
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="mt-4 max-h-56 w-full rounded-lg object-cover" />
          ) : null}
          {event.description ? (
            <EventDescription
              html={event.description}
              className="mt-3 max-h-72 overflow-y-auto pr-1 text-sm text-slate-700"
            />
          ) : null}
        </div>

        {!blocked ? (
          <div className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Subscription form</h2>

            {event.membersOnly ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-sm font-medium text-slate-800">{quickText.replace(/\{club\}/g, orgName)}</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} max-w-xs`}
                    placeholder="Fiscal code"
                    value={quickFiscal}
                    onChange={(e) => setQuickFiscal(e.target.value.toUpperCase())}
                  />
                  <button type="button" className={primaryButton} onClick={() => void lookup('fiscal')}>
                    Send / Check
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-blue-700 underline"
                  onClick={() => setShowLogin((v) => !v)}
                >
                  or sign in with username / password
                </button>
                {showLogin ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Username or email</label>
                        <input
                          className={inputClass}
                          name="event-member-ident"
                          autoComplete="off"
                          readOnly={!loginUnlocked}
                          onFocus={() => setLoginUnlocked(true)}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Password</label>
                        <input
                          type="password"
                          className={inputClass}
                          name="event-member-secret"
                          autoComplete="new-password"
                          readOnly={!loginUnlocked}
                          onFocus={() => setLoginUnlocked(true)}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <button type="button" className={secondaryButton} onClick={() => void lookup('login')}>
                      Sign in to autofill
                    </button>
                  </div>
                ) : null}
                {lookupMsg ? (
                  <p className={`text-sm ${member ? 'text-emerald-700' : 'text-red-600'}`}>{lookupMsg}</p>
                ) : null}
                {needsRecognition ? (
                  <p className="text-xs font-semibold text-red-600">
                    This event is only for members: the quick registration is required to send the subscription.
                  </p>
                ) : null}
              </div>
            ) : null}

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
              <Field label="Name *">
                <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field label="Surname *">
                <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
              <Field label="Mail *">
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
              <Field label="Birth date">
                <input
                  type="date"
                  className={inputClass}
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </Field>
              <Field label="Fiscal code">
                <input
                  className={inputClass}
                  value={fiscalCode}
                  disabled={useForeignId}
                  onChange={(e) => setFiscalCode(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Sex">
                <select className={inputClass} value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">—</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </Field>
              <Field label="City or foreign country of birth">
                <select className={inputClass} value={birthCountry} onChange={(e) => setBirthCountry(e.target.value)}>
                  <option value="">— Country —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Locality">
                <input
                  className={inputClass}
                  value={birthLocality}
                  onChange={(e) => setBirthLocality(e.target.value)}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${secondaryButton} w-full cursor-not-allowed opacity-60`}
                  disabled
                  title="Coming soon"
                >
                  Calculate fiscal code
                </button>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useForeignId}
                    onChange={(e) => setUseForeignId(e.target.checked)}
                  />
                  Use identification code (for foreigners)
                </label>
                {useForeignId ? (
                  <input
                    className={`${inputClass} mt-2`}
                    placeholder="Identification code"
                    value={foreignIdCode}
                    onChange={(e) => setForeignIdCode(e.target.value)}
                  />
                ) : null}
              </div>
              <Field label="City">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Address">
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="Province">
                <input className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)} />
              </Field>
              <Field label="ZIP">
                <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value)} />
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

            {showRelative ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                <h3 className="text-sm font-semibold text-emerald-900">
                  Relative / sibling discount ({event.siblingDiscount.percent}%)
                </h3>
                <p className="mt-1 text-xs text-emerald-900">
                  Type the name and fiscal code of a relative already subscribed to this event. The discount does not
                  apply to additional services.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="Relative name">
                    <input
                      className={inputClass}
                      value={relativeName}
                      onChange={(e) => setRelativeName(e.target.value)}
                    />
                  </Field>
                  <Field label="Relative fiscal code">
                    <input
                      className={inputClass}
                      value={relativeFiscalCode}
                      onChange={(e) => setRelativeFiscalCode(e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>
                {relativeName.trim() && relativeFiscalCode.trim().length >= 6 && quote ? (
                  <p className={`mt-2 text-xs font-semibold ${quote.relativeFound ? 'text-emerald-700' : 'text-red-600'}`}>
                    {quote.relativeFound
                      ? `Relative found — ${event.siblingDiscount.percent}% discount applied.`
                      : 'No subscribed relative found with this name and fiscal code.'}
                  </p>
                ) : null}
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
                          <span>{formatEventEuro(s.price, currency)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase text-slate-600">Select event / sub-events</h3>
              <label
                className={`mb-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  selectedMain ? 'border-yellow-400 bg-yellow-100' : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMain}
                  disabled={status.full}
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
                Whole event — {event.name} ({event.cost > 0 ? formatEventEuro(event.cost, currency) : 'Free'})
              </label>
              <ul className="space-y-2">
                {event.subevents.map((s) => {
                  const subMessage = subeventBlockMessage(s);
                  const disabled = (selectedMain && !s.externalToMain) || Boolean(subMessage);
                  const on = selectedSubs.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                          disabled ? 'opacity-60' : ''
                        } ${on ? 'border-yellow-400 bg-yellow-100' : 'border-slate-200'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={on}
                          onChange={() => toggleSub(s.id)}
                        />
                        <span>
                          {event.name} —{' '}
                          <span className="font-semibold" style={{ color: subeventTextColorHex(s.textColor) }}>
                            {s.name}
                          </span>{' '}
                          ({s.cost > 0 ? formatEventEuro(s.cost, currency) : 'Free'})
                          {s.externalToMain ? ' · external' : ''}
                        </span>
                        {subMessage ? <span className="font-bold text-red-600">{subMessage}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {event.texts.filter((t) => t.enabled).map((t) => (
              <div key={t.id} className="text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(textAnswers[t.id])}
                    onChange={(e) => setTextAnswers((a) => ({ ...a, [t.id]: e.target.checked }))}
                  />
                  <span className="whitespace-pre-wrap">
                    {t.label}
                    {t.mandatory ? ' *' : ''}
                  </span>
                </label>
                {t.fileUploadEnabled ? (
                  <div className="ml-6 mt-2 rounded-md border border-dashed border-slate-300 p-2">
                    <label className={labelClass}>
                      {t.fileUploadLabel || 'Attach a file'}
                      {t.mandatory ? ' *' : ''}
                    </label>
                    <input
                      type="file"
                      accept={EVENT_TEXT_FILE_ACCEPT}
                      disabled={uploadingText === t.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadTextFile(t.id, f);
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {uploadingText === t.id
                        ? 'Uploading…'
                        : textFiles[t.id]
                          ? `Attached: ${textFiles[t.id].name}`
                          : 'TXT, DOC, DOCX, XLS, XLSX, PDF, JPG, PNG — max 10 MB'}
                    </p>
                  </div>
                ) : null}
              </div>
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
                  <button
                    type="button"
                    className="text-blue-700 underline"
                    onClick={() =>
                      setViewer({ url: event.attachment1Url || '', name: event.attachment1Name || 'Attachment 1' })
                    }
                  >
                    {event.attachment1Name || 'Attachment 1'}
                  </button>
                ) : null}
                {event.attachment2Url ? (
                  <button
                    type="button"
                    className="ml-3 text-blue-700 underline"
                    onClick={() =>
                      setViewer({ url: event.attachment2Url || '', name: event.attachment2Name || 'Attachment 2' })
                    }
                  >
                    {event.attachment2Name || 'Attachment 2'}
                  </button>
                ) : null}
              </div>
            )}

            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {event.paymentModality === 'A' ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">No payment is required for this event.</p>
            ) : needsPayChoice ? (
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <h3 className="text-sm font-semibold uppercase text-slate-600">Payment</h3>
                {payChoices.length ? (
                  payChoices.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="event-pay-choice"
                        checked={payChoice === c}
                        onChange={() => setPayChoice(c)}
                      />
                      {c === 'club' ? `Pay at the ${orgKindLabel} (cash or cheque)` : EVENT_PAY_CHOICE_LABELS[c]}
                    </label>
                  ))
                ) : (
                  <p className="text-sm font-semibold text-red-600">
                    Online payment is not available yet. Please contact the {orgKindLabel}.
                  </p>
                )}
                {(payChoice === 'online' || payChoice === 'later') && onlineProviders.length > 1 ? (
                  <select
                    className={`${inputClass} max-w-xs`}
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as OnlineProvider)}
                  >
                    {onlineProviders.map((p) => (
                      <option key={p} value={p}>
                        {p === 'paypal' ? 'PayPal' : 'Credit card'}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              {event.paymentModality === 'A' ? (
                <>Total: Free</>
              ) : quote && quote.paid < quote.gross ? (
                <>
                  Total:{' '}
                  <span className="mr-2 text-slate-500 line-through">{formatEventEuro(quote.gross, currency)}</span>
                  {formatEventEuro(quote.paid, currency)}
                  <span className="ml-2 text-xs font-medium text-emerald-700">
                    discount {quote.discountPercent}% on the event
                  </span>
                </>
              ) : (
                <>Estimated total: {formatEventEuro(amountDue, currency)}</>
              )}
              {event.paymentModality !== 'A' && quote?.appliedRule ? (
                <p className="mt-1 text-xs font-medium text-emerald-800">
                  Multi sub-event rule applied: {quote.appliedRule.minSubevents} or more selections (
                  {quote.selectedCount} selected) → {quote.appliedRule.discountPercent}% discount
                  {quote.relativeDiscountApplied ? ' (the higher relative discount is used on the event)' : ''}
                </p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              className={primaryButton}
              disabled={submitting || Boolean(uploadingText) || needsRecognition}
              title={needsRecognition ? 'Use the quick registration with your fiscal code first' : undefined}
              onClick={() => void submit()}
            >
              {submitting ? 'Sending…' : 'Send subscription'}
            </button>
          </div>
        ) : null}
      </main>
      <EventAttachmentViewer file={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function subeventBlockMessage(s: ClubEventSubevent): string {
  if (s.endDate && s.endDate < todayYmd()) return 'Date end expired';
  if (s.seats > 0 && s.registered >= s.seats) return 'Seats not more available';
  return '';
}

function SponsorLogo({ sponsor }: { sponsor: Sponsor }) {
  const src = sponsor?.logoUrl || sponsor?.bannerUrl;
  if (!sponsor || !src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={src} alt={sponsor.name} className="max-h-14 max-w-[180px] object-contain" />;
  return sponsor.landingUrl ? (
    <a href={sponsor.landingUrl} target="_blank" rel="noopener noreferrer" title={sponsor.name}>
      {img}
    </a>
  ) : (
    img
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
