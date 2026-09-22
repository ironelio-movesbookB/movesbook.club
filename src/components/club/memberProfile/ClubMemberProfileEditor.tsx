'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BookOpen,
  Compass,
  Crosshair,
  Dumbbell,
  Fish,
  Flower2,
  Footprints,
  Globe,
  MessageCircle,
  MoreHorizontal,
  Mountain,
  Music,
  Palette,
  Plane,
  Radio,
  TreePine,
  Tv,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import {
  calcAge,
  isMemberUnderage,
  normalizeContacts,
  FREE_TIME_ACTIVITY_OPTIONS,
} from '@/lib/club/memberProfileDefaults';
import {
  ATHLETE_STATUS_OPTIONS,
  INSURANCE_COMPANY_OPTIONS,
  KINSHIP_OPTIONS,
  MAIN_SPORTS,
  PARENTS_TAB_LABEL,
  THEME_OPTIONS,
  getThemeColorById,
  type MemberProfileBundle,
} from '@/lib/club/memberProfileTypes';
import { PAYMENT_TYPE_OPTIONS } from '@/lib/procedures/payModes';
import MemberOwnerScheduleSections, {
  ForeignerAndIbanFields,
  MedicalCertExtraFields,
} from '@/components/club/memberProfile/MemberOwnerScheduleSections';
import {
  CheckRow,
  Field,
  Row2,
  Row3,
  SectionCard,
  TextArea,
  TextInput,
  TextSelect,
} from '@/components/club/memberProfile/FormBits';
import SignaturePad, {
  type SignaturePadHandle,
} from '@/components/club/memberProfile/SignaturePad';
import NewsCategoryMultiSelect from '@/components/club/memberProfile/NewsCategoryMultiSelect';
import MemberProfileSettingsTab from '@/components/club/memberProfile/MemberProfileSettingsTab';
import CoachNotesPanel from '@/components/club/memberProfile/CoachNotesPanel';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { renewMembershipDates } from '@/lib/club/memberMembershipDates';
import { COUNTRIES } from '@/lib/news/countries';
import { resolveRegionsForCountryName } from '@/lib/countries/countrySettingsStorage';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import { getWorldTimezones } from '@/lib/timezones';

const CKEditor = dynamic(() => import('@/components/news/CKEditor'), { ssr: false });
const MovesbookEditor = dynamic(() => import('@/components/club/Editor'), { ssr: false });

export type ProfileTabId =
  | 'owner-profile'
  | 'contacts'
  | 'activities'
  | 'references'
  | 'pay-for'
  | 'other-details'
  | 'parents'
  | 'settings'
  | 'messages-staff'
  | 'notes-coach'
  | 'presences';

type Props = {
  data: MemberProfileBundle;
  activeTab: ProfileTabId;
  mode: 'view' | 'edit';
  onChange: (next: MemberProfileBundle) => void;
  onReload: () => void;
  /** When set, shared sections save/load via /api/user/member-profile (no club). */
  profileSource?: 'club' | 'self';
};

export default function ClubMemberProfileEditor({
  data,
  activeTab,
  mode,
  onChange,
  onReload,
  profileSource = 'club',
}: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [noteDraft, setNoteDraft] = useState({ title: '', body: '' });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [payForSelectId, setPayForSelectId] = useState('');
  const [otherChildrenSelectId, setOtherChildrenSelectId] = useState<{
    parent1: string;
    parent2: string;
  }>({ parent1: '', parent2: '' });

  const readOnlyOwner = mode === 'view' || !data.viewer.canEditOwner;
  const readOnlyMemberTabs =
    mode === 'view' || !data.viewer.canEditContactsActivitiesReferences;
  const readOnlyClub = mode === 'view' || !data.viewer.canEditClubScoped;
  const canEditSignature =
    mode !== 'view' &&
    Boolean(
      data.viewer.canEditClubScoped ||
        data.viewer.canEditMemberSignature ||
        data.viewer.isSelf,
    );
  const readOnlyMemberSignature = !canEditSignature;
  const canSaveClubSection = data.viewer.canEditClubScoped
    ? !readOnlyClub
    : canEditSignature;

  const clubRef = useRef(data.club);
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  clubRef.current = data.club;

  const underage = useMemo(() => {
    const age = calcAge(data.owner.personal.dateOfBirth);
    return age != null && age < 18;
  }, [data.owner.personal.dateOfBirth]);

  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  /** View-only member profile — default payload encoded in the user QR. */
  const defaultProfileViewUrl = useMemo(() => {
    if (!origin || !data.memberId || !data.clubId) return '';
    const q = new URLSearchParams();
    if (data.workspaceKind === 'team') q.set('teamId', data.clubId);
    else q.set('clubId', data.clubId);
    q.set('mode', 'view');
    return `${origin}/clubMembers/memberProfile/${encodeURIComponent(data.memberId)}?${q.toString()}`;
  }, [origin, data.memberId, data.clubId, data.workspaceKind]);

  const residenceRegionOptions = useMemo(
    () => resolveRegionsForCountryName(data.owner.address.country || ''),
    [data.owner.address.country],
  );

  const worldTimezones = useMemo(() => getWorldTimezones(), []);

  const saveClubSection = (signatureField?: 'parents' | 'otherDetails') => {
    let clubToSave = clubRef.current;
    const sig = signaturePadRef.current?.getValue()?.trim() ?? '';
    if (signatureField) {
      if (signatureField === 'parents') {
        clubToSave = {
          ...clubToSave,
          parents: { ...clubToSave.parents, signatureDataUrl: sig },
        };
      } else {
        clubToSave = {
          ...clubToSave,
          otherDetails: { ...clubToSave.otherDetails, signatureDataUrl: sig },
        };
      }
      clubRef.current = clubToSave;
      onChange({ ...data, club: clubToSave });
    }
    void saveSection('club', { club: clubToSave });
  };

  const patchOwner = (path: (o: MemberProfileBundle['owner']) => MemberProfileBundle['owner']) => {
    onChange({ ...data, owner: path(data.owner) });
  };

  const saveSection = async (
    section: 'owner' | 'contacts' | 'activities' | 'references' | 'club',
    override?: Partial<{
      owner: MemberProfileBundle['owner'];
      contacts: MemberProfileBundle['contacts'];
      activities: MemberProfileBundle['activities'];
      referencesHtml: string;
      referencesLevel: string;
      club: MemberProfileBundle['club'];
    }>,
  ): Promise<boolean> => {
    setSaving(true);
    setMessage('');
    try {
      const body: Record<string, unknown> = {};
      if (section === 'owner') body.owner = override?.owner ?? data.owner;
      if (section === 'contacts') body.contacts = override?.contacts ?? data.contacts;
      if (section === 'activities') body.activities = override?.activities ?? data.activities;
      if (section === 'references') {
        body.referencesHtml = override?.referencesHtml ?? data.referencesHtml;
        body.referencesLevel = override?.referencesLevel ?? data.referencesLevel;
      }
      if (section === 'club') body.club = override?.club ?? clubRef.current;

      const sharedOnly = section !== 'club';
      const useSelfApi = profileSource === 'self' && sharedOnly;

      const url = useSelfApi
        ? '/api/user/member-profile'
        : withSelectedClubId(
            `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile`,
          );

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setMessage('Saved.');
      onReload();
      return true;
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadOwnerFile = async (kind: 'image' | 'pdf' | 'photo' | 'ecg', file: File) => {
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);

      const url =
        profileSource === 'self' || !data.clubId
          ? '/api/user/member-profile/medical-upload'
          : withSelectedClubId(
              `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile/medical-upload`,
            );

      // Do not use getAuthHeaders() here — it forces Content-Type: application/json
      // and breaks multipart FormData (browser must set the boundary).
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload failed');

      const path = String(json.path || '');
      if (!path) throw new Error('Upload did not return a file path');

      // Build next owner synchronously — React state is stale until next render,
      // so the follow-up PATCH must use this object (not data.owner).
      const nextOwner: MemberProfileBundle['owner'] = {
        ...data.owner,
        ...(kind === 'photo'
          ? { photoUrl: path }
          : {
              medical: {
                ...data.owner.medical,
                ...(kind === 'image'
                  ? { imageUrl: path }
                  : kind === 'ecg'
                    ? { ecgUrl: path }
                    : { pdfUrl: path }),
              },
            }),
      };
      onChange({ ...data, owner: nextOwner });
      const saved = await saveSection('owner', { owner: nextOwner });
      if (saved) {
        setMessage('Uploaded and saved.');
      } else {
        setMessage((prev) =>
          prev ? `${prev} (file uploaded — click Save to keep the link)` : 'Upload saved failed',
        );
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const refreshMembershipFromArchive = async () => {
    if (!data.clubId) {
      setMessage('Select a club first.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile/membership-dates`,
        ),
        { headers: getAuthHeaders() },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load membership dates');
      const dates = json.dates as { from?: string; to?: string } | null;
      if (!dates) {
        setMessage('No membership archive record found.');
        return;
      }
      onChange({
        ...data,
        club: {
          ...data.club,
          otherDetails: {
            ...data.club.otherDetails,
            membershipFrom: dates.from || data.club.otherDetails.membershipFrom,
            membershipTo: dates.to || data.club.otherDetails.membershipTo,
          },
        },
      });
      setMessage('Loaded from archive. Click Save to persist.');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setSaving(false);
    }
  };

  const handleRenewMembership = async () => {
    const od = data.club.otherDetails;
    const next = renewMembershipDates(od.membershipFrom, od.membershipTo);
    const nextData: MemberProfileBundle = {
      ...data,
      club: {
        ...data.club,
        otherDetails: {
          ...od,
          membershipFrom: next.from,
          membershipTo: next.to,
        },
      },
    };
    onChange(nextData);
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile`,
        ),
        {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ club: nextData.club }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Renew failed');
      setMessage('Membership renewed (+1 year).');
      onReload();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Renew failed');
    } finally {
      setSaving(false);
    }
  };

  const postNote = async (kind: 'staff' | 'coach', parentId?: string) => {
    const body = parentId ? replyDrafts[parentId] || '' : noteDraft.body;
    const title = parentId ? '' : noteDraft.title;
    if (!body.trim()) {
      setMessage('Enter a message.');
      return;
    }

    const sessionAuthor = (() => {
      if (typeof window === 'undefined') return { label: 'You' };
      try {
        const raw = localStorage.getItem('user');
        if (!raw) return { label: 'You' };
        const u = JSON.parse(raw) as { username?: string; name?: string };
        return { label: String(u.username || u.name || 'You').trim() || 'You' };
      } catch {
        return { label: 'You' };
      }
    })();

    setSaving(true);
    try {
      const clubSnapshot = clubRef.current;

      if (kind === 'staff' && !parentId && data.viewer.canEditClubScoped) {
        const saveRes = await fetch(
          withSelectedClubId(
            `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile`,
          ),
          {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ club: clubSnapshot }),
          },
        );
        if (!saveRes.ok) {
          const j = await saveRes.json().catch(() => ({}));
          throw new Error(j.error || 'Failed to save staff document');
        }
      }

      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/notes`,
        ),
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            title,
            body,
            parentId,
            visibleToMember:
              kind === 'coach'
                ? clubSnapshot.visibility.notesCoach
                : clubSnapshot.visibility.messagesStaff,
            commentsEnabled: clubSnapshot.visibility.notesCoachComments,
            // Root staff posts inherit Messages schedule (Show at Login/Logout + dates).
            // Replies never become login/logout notices.
            enableFrom: parentId ? null : clubSnapshot.staffMessage.enableFrom || null,
            enableTo: parentId ? null : clubSnapshot.staffMessage.enableTo || null,
            showAtLogin: parentId ? false : Boolean(clubSnapshot.staffMessage.showAtLogin),
            showAtLogout: parentId ? false : Boolean(clubSnapshot.staffMessage.showAtLogout),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to post');
      setNoteDraft({ title: '', body: '' });
      if (parentId) setReplyDrafts((d) => ({ ...d, [parentId]: '' }));
      setMessage('Posted.');

      // Member replies / new root notes: update threads in place (no full profile reload).
      if (parentId) {
        const replyId = String(json.note?.id || `local-${Date.now()}`);
        const reply = {
          id: replyId,
          body: body.trim(),
          createdAt: new Date().toISOString(),
          authorLabel: sessionAuthor.label,
        };
        if (kind === 'staff') {
          onChange({
            ...data,
            staffNotes: data.staffNotes.map((n) =>
              n.id === parentId ? { ...n, replies: [reply, ...n.replies] } : n,
            ),
          });
        } else {
          onChange({
            ...data,
            coachNotes: data.coachNotes.map((n) =>
              n.id === parentId ? { ...n, replies: [reply, ...n.replies] } : n,
            ),
          });
        }
      } else if (kind === 'staff') {
        const noteId = String(json.note?.id || `local-${Date.now()}`);
        onChange({
          ...data,
          staffNotes: [
            {
              id: noteId,
              title: title.trim(),
              body: body.trim(),
              createdAt: new Date().toISOString(),
              authorLabel: sessionAuthor.label,
              // Mirrors the schedule the API just inherited for this root post.
              showAtLogin: Boolean(clubSnapshot.staffMessage.showAtLogin),
              showAtLogout: Boolean(clubSnapshot.staffMessage.showAtLogout),
              replies: [],
            },
            ...data.staffNotes,
          ],
        });
      } else {
        onReload();
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setSaving(false);
    }
  };

  const resetNotes = async (kind: 'staff' | 'coach') => {
    if (!window.confirm(`Reset all ${kind} documents and replies?`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/notes?resetKind=${kind}`,
        ),
        { method: 'DELETE', headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error('Reset failed');
      setMessage('Reset done.');
      onReload();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  const SaveBar = ({
    onSave,
    canSave,
  }: {
    onSave: () => void;
    canSave: boolean;
  }) =>
    canSave ? (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message ? <span className="text-sm text-gray-700">{message}</span> : null}
      </div>
    ) : (
      <p className="mt-3 text-xs text-gray-500">View only for your role on this section.</p>
    );

  if (activeTab === 'owner-profile') {
    const o = data.owner;
    const qrPayloadUrl = defaultProfileViewUrl;
    const qrImageSrc = qrPayloadUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayloadUrl)}`
      : '';
    return (
      <div>
        <SectionCard title="Private settings" tone="red">
          <CheckRow
            label="Disallow the Club Admins to modify my data in the personal profile"
            checked={o.privateSettings.disallowClubAdmins}
            disabled={mode === 'view' || !data.viewer.isSelf}
            onChange={(v) =>
              patchOwner((prev) => ({
                ...prev,
                privateSettings: { disallowClubAdmins: v },
              }))
            }
          />
          <p className="text-xs text-gray-500">
            Only the member can change this flag. When checked, club admins cannot edit Owner
            profile fields.
          </p>
        </SectionCard>

        <SectionCard title="Photo and QR code">
          <Row2>
            <Field label="Personal photo">
              <TextInput
                disabled={readOnlyOwner}
                value={o.photoUrl}
                onChange={(e) => patchOwner((p) => ({ ...p, photoUrl: e.target.value }))}
                placeholder="/uploads/..."
              />
              {!readOnlyOwner ? (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-red-700 underline">
                  Upload image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadOwnerFile('photo', f);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
              {o.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.photoUrl} alt="" className="mt-2 h-28 w-28 object-cover border" />
              ) : null}
            </Field>
            <Field label="QR code URL">
              <TextInput
                disabled
                value={defaultProfileViewUrl}
                placeholder="View-only profile URL"
              />
              <p className="mt-1 text-xs text-gray-500">
                Auto-generated link encoded in the QR. Scanning it opens this member&apos;s
                profile in view-only mode. It is not an editable free-text field.
              </p>
              <div className="mt-3 flex flex-col items-start gap-2">
                <p className="text-sm font-medium text-gray-700">Dynamic User QR code</p>
                <div className="flex h-[220px] w-[220px] items-center justify-center border border-gray-300 bg-white">
                  {qrImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrImageSrc}
                      alt={`QR code for ${data.user.username || 'member'}`}
                      width={220}
                      height={220}
                    />
                  ) : (
                    <span className="px-3 text-center text-xs text-gray-400">
                      QR unavailable (missing club or member)
                    </span>
                  )}
                </div>
              </div>
            </Field>
          </Row2>
        </SectionCard>

        <SectionCard title="Data for Login">
          <Row2>
            <Field label="Username">
              <TextInput disabled value={o.login.username} />
            </Field>
            <Field label="Mail address">
              <TextInput
                disabled={readOnlyOwner}
                type="email"
                value={o.login.email}
                onChange={(e) =>
                  patchOwner((p) => ({ ...p, login: { ...p.login, email: e.target.value } }))
                }
              />
            </Field>
            <Field label="First name">
              <TextInput
                disabled={readOnlyOwner}
                value={o.login.firstName}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    login: { ...p.login, firstName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Last name">
              <TextInput
                disabled={readOnlyOwner}
                value={o.login.lastName}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    login: { ...p.login, lastName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="New password">
              <TextInput
                disabled={readOnlyOwner}
                type="password"
                value={o.login.newPassword}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    login: { ...p.login, newPassword: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Repeat password">
              <TextInput
                disabled={readOnlyOwner}
                type="password"
                value={o.login.repeatPassword}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    login: { ...p.login, repeatPassword: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>
          <p className="text-xs text-gray-500">
            Reset password (send old one to mail) — use the standard account recovery flow for
            now.
          </p>
        </SectionCard>

        <SectionCard title="Residence data">
          <Row2>
            {(
              [
                ['address', 'Address'],
                ['city', 'Location'],
                ['zipCode', 'ZIP'],
                ['province', 'Province'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  disabled={readOnlyOwner}
                  value={o.address[key]}
                  onChange={(e) =>
                    patchOwner((p) => ({
                      ...p,
                      address: { ...p.address, [key]: e.target.value },
                    }))
                  }
                />
              </Field>
            ))}
            <Field label="Country">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.address.country}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  patchOwner((p) => {
                    const nextRegions = resolveRegionsForCountryName(nextCountry);
                    const keepRegion = nextRegions.includes(p.address.region)
                      ? p.address.region
                      : '';
                    return {
                      ...p,
                      address: {
                        ...p.address,
                        country: nextCountry,
                        region: keepRegion,
                      },
                    };
                  });
                }}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {o.address.country &&
                !COUNTRIES.includes(o.address.country as (typeof COUNTRIES)[number]) ? (
                  <option value={o.address.country}>{o.address.country}</option>
                ) : null}
              </TextSelect>
            </Field>
            <Field label="Region">
              <TextSelect
                disabled={readOnlyOwner || !o.address.country.trim()}
                value={o.address.region}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    address: { ...p.address, region: e.target.value },
                  }))
                }
              >
                <option value="">
                  {o.address.country.trim() ? 'Select region' : 'Select country first'}
                </option>
                {residenceRegionOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {o.address.region && !residenceRegionOptions.includes(o.address.region) ? (
                  <option value={o.address.region}>{o.address.region}</option>
                ) : null}
              </TextSelect>
            </Field>
            <Field
              label="Geographical coordinates"
              action={
                (() => {
                  const parts = o.address.geoCoordinates.trim().split(/[,;\s]+/).filter(Boolean);
                  const lat = parts.length >= 2 ? Number.parseFloat(parts[0]) : NaN;
                  const lng = parts.length >= 2 ? Number.parseFloat(parts[1]) : NaN;
                  const valid =
                    Number.isFinite(lat) &&
                    Number.isFinite(lng) &&
                    lat >= -90 &&
                    lat <= 90 &&
                    lng >= -180 &&
                    lng <= 180;
                  const openMap = () => {
                    if (!valid) return;
                    const href = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
                    window.open(href, '_blank', 'noopener,noreferrer');
                  };
                  return (
                    <button
                      type="button"
                      disabled={!valid}
                      onClick={openMap}
                      title={
                        valid
                          ? 'Open this position in Google Maps (new tab)'
                          : 'Enter valid lat, lng first'
                      }
                      className={`text-sm font-medium underline disabled:cursor-not-allowed disabled:no-underline ${
                        valid
                          ? 'text-red-700 hover:text-red-900'
                          : 'text-gray-400'
                      }`}
                    >
                      Open on Map
                    </button>
                  );
                })()
              }
            >
              <TextInput
                disabled={readOnlyOwner}
                value={o.address.geoCoordinates}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    address: { ...p.address, geoCoordinates: e.target.value },
                  }))
                }
              />
            </Field>
            {(
              [
                ['alternativeMail', 'Alternative mail'],
                ['whatsappGroupName', 'Whatsapp group name'],
                ['telegramGroupName', 'Telegram group name'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  disabled={readOnlyOwner}
                  value={o.address[key]}
                  onChange={(e) =>
                    patchOwner((p) => ({
                      ...p,
                      address: { ...p.address, [key]: e.target.value },
                    }))
                  }
                />
              </Field>
            ))}
          </Row2>
          <p className="mb-2 text-xs text-gray-500">
            Citizenship is under Administrative data. Phone 1 / Phone 2 below.
            Region options follow the selected country (same list as Countries admin).
          </p>
          {(
            [
              ['phone', 'Phone (landline)', 'phoneWhatsapp', 'phoneTelegram'],
              ['mobile1', 'Phone 1', 'mobile1Whatsapp', 'mobile1Telegram'],
              ['mobile2', 'Phone 2', 'mobile2Whatsapp', 'mobile2Telegram'],
            ] as const
          ).map(([numKey, label, waKey, tgKey]) => (
            <div key={numKey} className="rounded border border-gray-200 p-2">
              <Field label={label}>
                <TextInput
                  disabled={readOnlyOwner}
                  value={o.address[numKey]}
                  onChange={(e) =>
                    patchOwner((p) => ({
                      ...p,
                      address: { ...p.address, [numKey]: e.target.value },
                    }))
                  }
                />
              </Field>
              <div className="mt-2 flex flex-wrap gap-4">
                <CheckRow
                  label="WhatsApp"
                  disabled={readOnlyOwner}
                  checked={o.address[waKey]}
                  onChange={(v) =>
                    patchOwner((p) => ({
                      ...p,
                      address: { ...p.address, [waKey]: v },
                    }))
                  }
                />
                <CheckRow
                  label="Telegram"
                  disabled={readOnlyOwner}
                  checked={o.address[tgKey]}
                  onChange={(v) =>
                    patchOwner((p) => ({
                      ...p,
                      address: { ...p.address, [tgKey]: v },
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Personal Data">
          <Row2>
            <Field label="Gender">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.personal.gender}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, gender: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </TextSelect>
            </Field>
            <Field label="Date of birth">
              <TextInput
                disabled={readOnlyOwner}
                type="date"
                value={o.personal.dateOfBirth}
                onChange={(e) => {
                  const dateOfBirth = e.target.value;
                  const age = calcAge(dateOfBirth);
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, dateOfBirth, age },
                  }));
                }}
              />
            </Field>
            <Field label="Age (auto)">
              <TextInput disabled value={o.personal.age ?? ''} />
            </Field>
            <Field label="Birthday country">
              <TextInput
                disabled={readOnlyOwner}
                value={o.personal.countryOfBirth}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, countryOfBirth: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Birthday location">
              <TextInput
                disabled={readOnlyOwner}
                value={o.personal.locationOfBirth}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, locationOfBirth: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Province">
              <TextInput
                disabled={readOnlyOwner}
                value={o.personal.provinceOfBirth}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, provinceOfBirth: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Name day (day-month)" hint="e.g. 03-15">
              <TextInput
                disabled={readOnlyOwner}
                value={o.personal.nameDay}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, nameDay: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Occupation">
              <TextInput
                disabled={readOnlyOwner}
                value={o.personal.occupation}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, occupation: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Since date / User entry date">
              <TextInput
                disabled={readOnlyOwner}
                type="date"
                value={o.personal.sinceDate}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, sinceDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Main sport (1 only)">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.personal.mainSport}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    personal: { ...p.personal, mainSport: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                {MAIN_SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </Row2>
          <Field label="Other sports (multi)">
            <div className="flex flex-wrap gap-3">
              {MAIN_SPORTS.map((s) => (
                <CheckRow
                  key={s}
                  label={s}
                  disabled={readOnlyOwner}
                  checked={o.personal.otherSports.includes(s)}
                  onChange={(v) =>
                    patchOwner((p) => ({
                      ...p,
                      personal: {
                        ...p.personal,
                        otherSports: v
                          ? [...p.personal.otherSports, s]
                          : p.personal.otherSports.filter((x) => x !== s),
                      },
                    }))
                  }
                />
              ))}
            </div>
          </Field>
        </SectionCard>

        <SectionCard title="Administrative data">
          <Row2>
            {(
              [
                ['fiscalCode', 'Fiscal code'],
                ['documentId', 'Document ID'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  disabled={readOnlyOwner}
                  value={o.administrative[key]}
                  onChange={(e) =>
                    patchOwner((p) => ({
                      ...p,
                      administrative: { ...p.administrative, [key]: e.target.value },
                    }))
                  }
                />
              </Field>
            ))}
            <Field label="Citizenship">
              {(() => {
                const raw = o.administrative.citizenship || '';
                const canonical =
                  COUNTRIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase()) || raw;
                return (
                  <TextSelect
                    disabled={readOnlyOwner}
                    value={canonical}
                    onChange={(e) =>
                      patchOwner((p) => ({
                        ...p,
                        administrative: { ...p.administrative, citizenship: e.target.value },
                      }))
                    }
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {canonical &&
                    !COUNTRIES.some((c) => c.toLowerCase() === canonical.toLowerCase()) ? (
                      <option value={canonical}>{canonical}</option>
                    ) : null}
                  </TextSelect>
                );
              })()}
            </Field>
            <Field label="Car driving license">
              <TextInput
                disabled={readOnlyOwner}
                value={o.administrative.carDrivingLicense}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    administrative: {
                      ...p.administrative,
                      carDrivingLicense: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </Row2>
          <ForeignerAndIbanFields
            owner={o}
            readOnly={readOnlyOwner}
            onChange={(next) => patchOwner(() => next)}
          />
        </SectionCard>

        <SectionCard title="Medical Info">
          <Row2>
            <Field label="Blood group">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.bloodGroup}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, bloodGroup: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Medical certificate info">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.medical.medicalExamination}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, medicalExamination: e.target.value },
                  }))
                }
              >
                <option value="">—</option>
                <option value="Competitive">Competitive</option>
                <option value="Non-competitive">Non-competitive</option>
                <option value="Not required">Not required</option>
              </TextSelect>
            </Field>
            <Field label="Medical certificate date">
              <TextInput
                type="date"
                disabled={readOnlyOwner}
                value={o.medical.releaseDate}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, releaseDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field
              label="Medical certificate expiring date"
              hint={
                o.medical.alert30gg && o.medical.expirationDate
                  ? (() => {
                      const exp = new Date(`${o.medical.expirationDate}T12:00:00`);
                      if (Number.isNaN(exp.getTime())) {
                        return 'Set a valid expiring date for Alert -30gg.';
                      }
                      const alertAt = new Date(exp);
                      alertAt.setDate(alertAt.getDate() - 30);
                      const y = alertAt.getFullYear();
                      const m = String(alertAt.getMonth() + 1).padStart(2, '0');
                      const d = String(alertAt.getDate()).padStart(2, '0');
                      return `Alert -30gg: reminder from ${d}/${m}/${y} until expiry.`;
                    })()
                  : o.medical.alert30gg
                    ? 'Set the expiring date — Alert -30gg warns 30 days before that date.'
                    : 'Check Alert -30gg to warn 30 days before this expiry date.'
              }
            >
              <TextInput
                type="date"
                disabled={readOnlyOwner}
                value={o.medical.expirationDate}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, expirationDate: e.target.value },
                  }))
                }
                className={
                  o.medical.alert30gg ? 'ring-2 ring-sky-400 border-sky-500' : undefined
                }
              />
              <div className="mt-2">
                <CheckRow
                  label="Alert -30gg"
                  disabled={readOnlyOwner}
                  checked={o.medical.alert30gg}
                  onChange={(v) =>
                    patchOwner((p) => ({
                      ...p,
                      medical: { ...p.medical, alert30gg: v },
                    }))
                  }
                />
              </div>
            </Field>
            <Field label="Outcome">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.outcome}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, outcome: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Doctor who issued">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.doctorWhoIssued}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, doctorWhoIssued: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Emergency contact phone">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.emergencyContactPhone}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, emergencyContactPhone: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Emergency contact name">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.emergencyContactName}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, emergencyContactName: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>
          <MedicalCertExtraFields
            owner={o}
            readOnly={readOnlyOwner}
            onChange={(next) => patchOwner(() => next)}
          />
          <Row2>
            <Field label="Medical image">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.imageUrl}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, imageUrl: e.target.value },
                  }))
                }
              />
              {!readOnlyOwner ? (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-red-700 underline">
                  Upload image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadOwnerFile('image', f);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
              {o.medical.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.medical.imageUrl} alt="" className="mt-2 max-h-40 rounded border" />
              ) : null}
            </Field>
            <Field label="Medical PDF">
              <TextInput
                disabled={readOnlyOwner}
                value={o.medical.pdfUrl}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    medical: { ...p.medical, pdfUrl: e.target.value },
                  }))
                }
              />
              {!readOnlyOwner ? (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-red-700 underline">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadOwnerFile('pdf', f);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
              {o.medical.pdfUrl ? (
                <a
                  href={o.medical.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm text-blue-700 underline"
                >
                  View PDF
                </a>
              ) : null}
            </Field>
          </Row2>
          <Field label="ECG">
            <TextInput
              disabled={readOnlyOwner}
              value={o.medical.ecgUrl || ''}
              onChange={(e) =>
                patchOwner((p) => ({
                  ...p,
                  medical: { ...p.medical, ecgUrl: e.target.value },
                }))
              }
            />
            {!readOnlyOwner ? (
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-red-700 underline">
                Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadOwnerFile('ecg', f);
                    e.target.value = '';
                  }}
                />
              </label>
            ) : null}
            {o.medical.ecgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.medical.ecgUrl} alt="ECG" className="mt-2 max-h-40 rounded border" />
            ) : null}
          </Field>
        </SectionCard>

        <MemberOwnerScheduleSections
          owner={o}
          readOnly={readOnlyOwner}
          onChange={(next) => patchOwner(() => next)}
          onUploadDocument={async ({ docKey, side, file }) => {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Failed to read file'));
              reader.readAsDataURL(file);
            });
            patchOwner((p) => ({
              ...p,
              documents: {
                ...p.documents,
                [docKey]: {
                  ...p.documents[docKey],
                  [side === 'front' ? 'frontUrl' : 'backUrl']: dataUrl,
                },
              },
            }));
          }}
        />

        <SectionCard title="Other references">
          <Row2>
            <Field label="Language">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.otherReferences.language}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    otherReferences: { ...p.otherReferences, language: e.target.value },
                  }))
                }
              >
                <option value="">Select language</option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.code})
                  </option>
                ))}
                {o.otherReferences.language &&
                !SUPPORTED_LANGUAGES.some((l) => l.code === o.otherReferences.language) ? (
                  <option value={o.otherReferences.language}>
                    {o.otherReferences.language}
                  </option>
                ) : null}
              </TextSelect>
            </Field>
            <Field label="Timezone">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.otherReferences.timezone}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    otherReferences: { ...p.otherReferences, timezone: e.target.value },
                  }))
                }
              >
                <option value="">Select timezone</option>
                {worldTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
                {o.otherReferences.timezone &&
                !worldTimezones.includes(o.otherReferences.timezone) ? (
                  <option value={o.otherReferences.timezone}>
                    {o.otherReferences.timezone}
                  </option>
                ) : null}
              </TextSelect>
            </Field>
            <Field label="Unit of measure">
              <TextSelect
                disabled={readOnlyOwner}
                value={o.otherReferences.unitOfMeasure}
                onChange={(e) =>
                  patchOwner((p) => ({
                    ...p,
                    otherReferences: { ...p.otherReferences, unitOfMeasure: e.target.value },
                  }))
                }
              >
                <option value="metric">Metric</option>
                <option value="imperial">Imperial</option>
              </TextSelect>
            </Field>
            <Field
              label="Theme"
              hint="Selected color is applied as the background of this user's My Page."
            >
              <div className="flex items-center gap-2">
                <TextSelect
                  disabled={readOnlyOwner}
                  value={o.otherReferences.theme}
                  onChange={(e) => {
                    const nextTheme = e.target.value;
                    patchOwner((p) => ({
                      ...p,
                      otherReferences: { ...p.otherReferences, theme: nextTheme },
                    }));
                    if (typeof window !== 'undefined' && data.viewer.isSelf) {
                      try {
                        localStorage.setItem(
                          'movesbook_mypage_theme_color',
                          getThemeColorById(nextTheme),
                        );
                        localStorage.setItem('movesbook_mypage_theme_id', nextTheme);
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                  className="flex-1"
                >
                  {THEME_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.color})
                    </option>
                  ))}
                </TextSelect>
                <span
                  title={getThemeColorById(o.otherReferences.theme)}
                  className="inline-block h-9 w-9 shrink-0 rounded border border-gray-400"
                  style={{ backgroundColor: getThemeColorById(o.otherReferences.theme) }}
                  aria-label={`Theme color ${getThemeColorById(o.otherReferences.theme)}`}
                />
              </div>
            </Field>
          </Row2>
          <Field label="Notes about the user">
            <TextArea
              disabled={readOnlyOwner}
              rows={3}
              value={o.otherReferences.notes}
              onChange={(e) =>
                patchOwner((p) => ({
                  ...p,
                  otherReferences: { ...p.otherReferences, notes: e.target.value },
                }))
              }
            />
          </Field>
        </SectionCard>

        <SaveBar canSave={!readOnlyOwner} onSave={() => void saveSection('owner')} />
      </div>
    );
  }

  if (activeTab === 'contacts') {
    const c = normalizeContacts(data.contacts);
    const socialPlatforms = [
      'Facebook',
      'Twitter',
      'Instagram',
      'LinkedIn',
      'YouTube',
      'WhatsApp',
      'TikTok',
      'Other',
    ];
    const publicLinkFields: {
      key: keyof Pick<
        typeof c,
        | 'myWebsite'
        | 'whatsapp'
        | 'instagram'
        | 'youtube'
        | 'linkedin'
        | 'blogSite'
        | 'googleMap'
      >;
      label: string;
    }[] = [
      { key: 'myWebsite', label: 'My Website' },
      { key: 'whatsapp', label: 'Whatsapp' },
      { key: 'instagram', label: 'Instagram' },
      { key: 'youtube', label: 'You tube' },
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'blogSite', label: 'My blog site' },
      { key: 'googleMap', label: 'Google map' },
    ];

    const patchContacts = (next: typeof c) => {
      onChange({ ...data, contacts: next });
    };

    return (
      <div>
        <SectionCard
          title="MY CONTACTS (managed only by the user/member)"
          tone="blue"
        >
          <Field label="Alternate Email">
            <TextInput
              disabled={readOnlyMemberTabs}
              type="email"
              value={c.alternateEmail}
              onChange={(e) =>
                patchContacts({ ...c, alternateEmail: e.target.value })
              }
            />
          </Field>

          <Field label="Phone">
            <div className="flex max-w-md gap-2">
              <TextInput
                disabled={readOnlyMemberTabs}
                value={c.phonePrefix}
                onChange={(e) =>
                  patchContacts({ ...c, phonePrefix: e.target.value })
                }
                placeholder="+39"
                className="w-24 shrink-0"
              />
              <TextInput
                disabled={readOnlyMemberTabs}
                value={c.phoneNumber}
                onChange={(e) =>
                  patchContacts({ ...c, phoneNumber: e.target.value })
                }
              />
            </div>
          </Field>

          {c.socialSites.map((site, index) => (
            <Field key={index} label="Social Site">
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextSelect
                  disabled={readOnlyMemberTabs}
                  value={site.platform}
                  onChange={(e) => {
                    const socialSites = [...c.socialSites] as typeof c.socialSites;
                    socialSites[index] = {
                      ...socialSites[index],
                      platform: e.target.value,
                    };
                    patchContacts({ ...c, socialSites });
                  }}
                  className="sm:w-36 shrink-0"
                >
                  {socialPlatforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </TextSelect>
                <TextInput
                  disabled={readOnlyMemberTabs}
                  value={site.url}
                  onChange={(e) => {
                    const socialSites = [...c.socialSites] as typeof c.socialSites;
                    socialSites[index] = {
                      ...socialSites[index],
                      url: e.target.value,
                    };
                    patchContacts({ ...c, socialSites });
                  }}
                />
              </div>
            </Field>
          ))}

          {publicLinkFields.map(({ key, label }) => (
            <Field key={key} label={label}>
              <div className="space-y-2">
                <TextInput
                  disabled={readOnlyMemberTabs}
                  value={c[key].url}
                  onChange={(e) =>
                    patchContacts({
                      ...c,
                      [key]: { ...c[key], url: e.target.value },
                    })
                  }
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    disabled={readOnlyMemberTabs}
                    checked={c[key].showInPublicInfo}
                    onChange={(e) =>
                      patchContacts({
                        ...c,
                        [key]: {
                          ...c[key],
                          showInPublicInfo: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-gray-400"
                  />
                  Show in public info
                </label>
              </div>
            </Field>
          ))}

          <Field label="About Me">
            <TextArea
              disabled={readOnlyMemberTabs}
              rows={5}
              value={c.aboutMe}
              onChange={(e) => patchContacts({ ...c, aboutMe: e.target.value })}
            />
          </Field>
        </SectionCard>
        <SaveBar
          canSave={!readOnlyMemberTabs}
          onSave={() => void saveSection('contacts', { contacts: c })}
        />
      </div>
    );
  }

  if (activeTab === 'activities') {
    const a = data.activities;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const selectedActivities = Array.isArray(a.freeTimeActivities) ? a.freeTimeActivities : [];

    const FREE_TIME_ICON_MAP: Record<string, LucideIcon> = {
      Music,
      Tv,
      Radio,
      Flower2,
      BookOpen,
      Footprints,
      Palette,
      Fish,
      Crosshair,
      Compass,
      Plane,
      UtensilsCrossed,
      MessageCircle,
      Globe,
      Dumbbell,
      Mountain,
      Waves,
      TreePine,
      MoreHorizontal,
    };

    const toggleFreeTimeActivity = (label: string, checked: boolean) => {
      onChange({
        ...data,
        activities: {
          ...a,
          freeTimeActivities: checked
            ? [...selectedActivities.filter((x) => x !== label), label]
            : selectedActivities.filter((x) => x !== label),
        },
      });
    };

    return (
      <div>
        <SectionCard title="My Activities" tone="blue">
          <Field label="Preferred days">
            <div className="flex flex-wrap gap-3">
              {days.map((d) => (
                <CheckRow
                  key={d}
                  label={d}
                  disabled={readOnlyMemberTabs}
                  checked={a.preferredDays.includes(d)}
                  onChange={(v) =>
                    onChange({
                      ...data,
                      activities: {
                        ...a,
                        preferredDays: v
                          ? [...a.preferredDays, d]
                          : a.preferredDays.filter((x) => x !== d),
                      },
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label="Activities in the free time">
            <p className="mb-2 text-xs text-gray-500">
              Tick the activities you enjoy in your free time. You can select more than one.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {FREE_TIME_ACTIVITY_OPTIONS.map((opt) => {
                const Icon = FREE_TIME_ICON_MAP[opt.icon] || MoreHorizontal;
                return (
                  <label
                    key={opt.id}
                    className={`inline-flex items-center gap-2 text-sm text-gray-800 ${
                      readOnlyMemberTabs ? 'opacity-70' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={readOnlyMemberTabs}
                      checked={selectedActivities.includes(opt.label)}
                      onChange={(e) => toggleFreeTimeActivity(opt.label, e.target.checked)}
                    />
                    <Icon className="h-4 w-4 shrink-0 text-gray-700" aria-hidden />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Notes">
            <TextArea
              disabled={readOnlyMemberTabs}
              rows={4}
              value={a.notes}
              onChange={(e) =>
                onChange({ ...data, activities: { ...a, notes: e.target.value } })
              }
            />
          </Field>
        </SectionCard>
        <SaveBar
          canSave={!readOnlyMemberTabs}
          onSave={() => void saveSection('activities')}
        />
      </div>
    );
  }

  if (activeTab === 'references') {
    return (
      <div>
        <SectionCard title="References" tone="blue">
          <div className="mb-2 border border-[#c9bd7a] bg-[#efe7b3] px-4 py-2 text-sm font-semibold text-gray-900">
            References
          </div>
          {readOnlyMemberTabs ? (
            <div
              className="prose max-w-none rounded border border-gray-300 bg-white p-3 text-sm"
              dangerouslySetInnerHTML={{
                __html: data.referencesHtml || '<p class="text-gray-500">No references.</p>',
              }}
            />
          ) : (
            <div className="border border-gray-300 bg-white p-3">
              <MovesbookEditor
                value={data.referencesHtml}
                onChange={(html) => onChange({ ...data, referencesHtml: html })}
                placeholder="Write references…"
              />
              <div className="mt-3 grid max-w-md grid-cols-[160px_1fr] items-center gap-2 text-sm">
                <label className="text-gray-800">References level</label>
                <select
                  value={data.referencesLevel || '1'}
                  onChange={(e) =>
                    onChange({ ...data, referencesLevel: e.target.value })
                  }
                  className="w-24 rounded border border-gray-400 bg-gray-100 px-2 py-1.5"
                >
                  {['1', '2', '3', '4', '5', '6'].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {readOnlyMemberTabs ? (
            <div className="mt-3 grid max-w-md grid-cols-[160px_1fr] items-center gap-2 text-sm">
              <span className="text-gray-800">References level</span>
              <span className="font-medium">{data.referencesLevel || '1'}</span>
            </div>
          ) : null}
        </SectionCard>
        <SaveBar
          canSave={!readOnlyMemberTabs}
          onSave={() => void saveSection('references')}
        />
      </div>
    );
  }

  // Club-scoped tabs below
  const club = data.club;
  const setClub = (
    next: typeof club | ((prev: typeof club) => typeof club),
  ) => {
    const resolved = typeof next === 'function' ? next(clubRef.current) : next;
    clubRef.current = resolved;
    onChange({ ...data, club: resolved });
  };

  if (activeTab === 'pay-for') {
    const payForOptions = data.clubMembersForPayFor.filter(
      (m) => !club.payForMemberIds.includes(m.id),
    );
    const payForSelected = club.payForMemberIds
      .map((id) => data.clubMembersForPayFor.find((m) => m.id === id))
      .filter((m): m is { id: string; label: string } => Boolean(m));

    const addPayForMember = () => {
      if (!payForSelectId || club.payForMemberIds.includes(payForSelectId)) return;
      setClub({
        ...club,
        payForMemberIds: [...club.payForMemberIds, payForSelectId],
      });
      setPayForSelectId('');
    };

    return (
      <div>
        {data.viewer.isClubAdmin ? (
          <SectionCard title="Member visibility" tone="purple">
            <CheckRow
              label="Allow member to see Pay for… section"
              checked={club.visibility.payFor}
              disabled={readOnlyClub}
              onChange={(v) =>
                setClub({
                  ...club,
                  visibility: { ...club.visibility, payFor: v },
                })
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              When enabled, this member can open Pay for… on their profile and see who they pay
              for in this club. Editing the list remains an admin action.
            </p>
          </SectionCard>
        ) : null}
        <SectionCard
          title="Pay for others (managed by the Admin of the club selected)"
          titleClassName="text-lg"
        >
          <p className="mb-3 text-sm text-gray-600">
            Use this list when the current member pays membership fees or purchases for other
            people in the club (for example children or family). Select a member from the archive,
            click <span className="font-semibold">ADD</span>, then Save. The club admin manages
            who appears here and can allow the member to read this section.
          </p>

          {!readOnlyClub ? (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Field label="Member">
                  <TextSelect
                    value={payForSelectId}
                    disabled={payForOptions.length === 0}
                    onChange={(e) => setPayForSelectId(e.target.value)}
                  >
                    <option value="">
                      {payForOptions.length === 0
                        ? 'No more members available'
                        : 'Select member…'}
                    </option>
                    {payForOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </TextSelect>
                </Field>
              </div>
              <button
                type="button"
                disabled={!payForSelectId || saving}
                onClick={addPayForMember}
                className="rounded bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                ADD
              </button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded border border-gray-300 bg-white">
            <div className="border-b border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">
              Members managed (paid) by this member
            </div>
            {payForSelected.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500">No members selected yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {payForSelected.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-900">{m.label}</span>
                    {!readOnlyClub ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-700 hover:underline"
                        onClick={() =>
                          setClub({
                            ...club,
                            payForMemberIds: club.payForMemberIds.filter((id) => id !== m.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.clubMembersForPayFor.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No other members in this club.</p>
          ) : null}
        </SectionCard>
        <SaveBar canSave={!readOnlyClub} onSave={() => void saveSection('club')} />
      </div>
    );
  }

  if (activeTab === 'other-details') {
    const od = club.otherDetails;
    const customQuestions = data.customQuestions || [];
    const entityNoun = data.workspaceKind === 'team' ? 'Team' : 'Club';
    const byAdmin = `managed by the ${entityNoun} admin`;
    const byMember = 'managed by the member';
    return (
      <div>
        <div className="mb-4 border-b border-gray-200 pb-3">
          <p className="text-sm font-semibold text-gray-900">
            Other {entityNoun} data · {data.clubName}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Sections marked <span className="font-semibold">({byAdmin})</span> are edited by the{' '}
            {entityNoun.toLowerCase()} admin. Sections marked{' '}
            <span className="font-semibold">({byMember})</span> are filled by the athlete (rules /
            privacy acceptance and signature).
          </p>
        </div>

        {data.viewer.isClubAdmin ? (
          <SectionCard title={`Member visibility (${byAdmin})`} tone="purple">
            <CheckRow
              label="Allow member to read Other member's details"
              checked={club.visibility.otherDetails}
              disabled={readOnlyClub}
              onChange={(v) =>
                setClub({
                  ...club,
                  visibility: { ...club.visibility, otherDetails: v },
                })
              }
            />
          </SectionCard>
        ) : null}

        <SectionCard title={`Athlete status (${byAdmin})`}>
          <div className="flex flex-wrap gap-4">
            {ATHLETE_STATUS_OPTIONS.map((status) => (
              <label key={status} className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="radio"
                  name="athleteStatus"
                  disabled={readOnlyClub}
                  checked={od.athleteStatus === status}
                  onChange={() =>
                    // Club\Gym membership status only — the TEAM athlete status uses a
                    // different vocabulary (Active / Inactive / Injured / Suspended).
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, athleteStatus: status },
                    }))
                  }
                  className="border-gray-400"
                />
                {status}
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={`Group trained (${byAdmin})`}>
          <Field label="Connect member to a group trained">
            <TextSelect
              disabled={readOnlyClub}
              value={od.groupTrainedId}
              onChange={(e) =>
                setClub((c) => ({
                  ...c,
                  otherDetails: { ...c.otherDetails, groupTrainedId: e.target.value },
                }))
              }
            >
              <option value="">—</option>
            </TextSelect>
          </Field>
        </SectionCard>

        <SectionCard title={`Last Membership to the ${entityNoun} (${byAdmin})`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-blue-800">
            <span>Edit dates below</span>
            <div className="flex flex-wrap gap-2">
              {!readOnlyClub ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void refreshMembershipFromArchive()}
                  className="rounded border border-blue-700 px-2 py-1 text-xs font-semibold hover:bg-blue-50"
                >
                  Load from archive
                </button>
              ) : null}
              {!readOnlyClub ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRenewMembership()}
                  className="rounded bg-blue-800 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-900"
                >
                  Renew (+1 year)
                </button>
              ) : (
                <span>Renew</span>
              )}
            </div>
          </div>
          <Row2>
            <Field label="Membership from">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={od.membershipFrom}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, membershipFrom: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Membership to (expiration)">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={od.membershipTo}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, membershipTo: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>
          <p className="mt-2 text-xs text-red-700">
            Last membership can also be loaded from the Archive of Memberships. Editing these
            dates may update membership archive data. Renew updates these dates.
          </p>
          <Row2>
            <Field label="Membership Registration to">
              <TextInput
                disabled={readOnlyClub}
                value={od.membershipRegistrationTo}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: {
                      ...c.otherDetails,
                      membershipRegistrationTo: e.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Membership Registration number">
              <TextInput
                disabled={readOnlyClub}
                value={od.membershipRegistrationNumber}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: {
                      ...c.otherDetails,
                      membershipRegistrationNumber: e.target.value,
                    },
                  }))
                }
              />
            </Field>
            <Field label="Expiring date">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={od.membershipTo}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, membershipTo: e.target.value },
                  }))
                }
              />
            </Field>
          </Row2>
        </SectionCard>

        <SectionCard title={`Privacy (${byAdmin})`}>
          <CheckRow
            label="User authorizes data treatments"
            disabled={readOnlyClub}
            checked={od.privacyDataTreatments}
            onChange={(v) =>
              setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, privacyDataTreatments: v } }))
            }
          />
          <CheckRow
            label="User authorizes Club's admin to furnish personal data to third party firms"
            disabled={readOnlyClub}
            checked={od.privacyThirdParty}
            onChange={(v) =>
              setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, privacyThirdParty: v } }))
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <CheckRow
              label="User underage — Yes"
              checked={underage || od.userUnderage}
              disabled
              onChange={() => undefined}
            />
            <TextInput
              disabled={readOnlyClub || !(underage || od.userUnderage)}
              value={od.underageCode}
              placeholder="Code / notes"
              onChange={(e) =>
                setClub((c) => ({
                  ...c,
                  otherDetails: { ...c.otherDetails, underageCode: e.target.value },
                }))
              }
              className="max-w-xs"
            />
          </div>
          <p className="text-xs text-gray-500">
            Underage is set automatically from date of birth (&lt; 18) and is not manually
            editable.
          </p>
        </SectionCard>

        <SectionCard title={`Club / Team tutors and External tutors (${byAdmin})`}>
          <div className="grid grid-cols-1 border border-gray-200 sm:grid-cols-[9rem_1fr]">
            <div className="bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 sm:flex sm:items-start sm:justify-end">
              Vendors
            </div>
            <div className="space-y-2 px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    disabled={readOnlyClub}
                    checked={od.vendorsEnabled}
                    onChange={(e) =>
                      setClub((c) => ({
                        ...c,
                        otherDetails: { ...c.otherDetails, vendorsEnabled: e.target.checked },
                      }))
                    }
                    className="rounded border-gray-400"
                  />
                  Yes
                </label>
                <TextSelect
                  disabled={readOnlyClub || !od.vendorsEnabled}
                  value={od.vendors[0] || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClub((c) => ({
                      ...c,
                      otherDetails: {
                        ...c.otherDetails,
                        vendors: value
                          ? [value, ...c.otherDetails.vendors.slice(1)].slice(0, 3)
                          : [],
                      },
                    }));
                  }}
                  className="min-w-[12rem] max-w-sm flex-1"
                >
                  <option value="">Select</option>
                  {(data.vendorCoachOptions || []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </TextSelect>
                <span className="text-xs text-gray-500">Max 3</span>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  disabled={readOnlyClub || !od.vendorsEnabled}
                  checked={od.enableCommission}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, enableCommission: e.target.checked },
                    }))
                  }
                  className="rounded border-gray-400"
                />
                Enable Commission
              </label>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 border border-gray-200 sm:grid-cols-[9rem_1fr]">
            <div className="bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 sm:flex sm:items-start sm:justify-end">
              Coach
            </div>
            <div className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    disabled={readOnlyClub}
                    checked={od.coachEnabled}
                    onChange={(e) =>
                      setClub((c) => ({
                        ...c,
                        otherDetails: { ...c.otherDetails, coachEnabled: e.target.checked },
                      }))
                    }
                    className="rounded border-gray-400"
                  />
                  Yes
                </label>
                <TextSelect
                  disabled={readOnlyClub || !od.coachEnabled}
                  value={od.coachName}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, coachName: e.target.value },
                    }))
                  }
                  className="min-w-[12rem] max-w-sm flex-1"
                >
                  <option value="">Select</option>
                  {(data.coachOptions || []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </TextSelect>
                <span className="text-xs text-gray-500">Max 1</span>
              </div>
            </div>
          </div>

          <div className="mt-2">
            <Field label="Sport Season (year)">
              <TextInput
                disabled={readOnlyClub}
                value={od.sportSeason}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, sportSeason: e.target.value },
                  }))
                }
              />
            </Field>
          </div>

          <div className="mt-2">
            <CheckRow
              label="Supplementary insurance required"
              disabled={readOnlyClub}
              checked={od.supplementaryInsuranceRequired}
              onChange={(v) =>
                setClub((c) => ({
                  ...c,
                  otherDetails: { ...c.otherDetails, supplementaryInsuranceRequired: v },
                }))
              }
            />
            <Row3>
              <Field label="Insurance Company">
                <TextSelect
                  disabled={readOnlyClub}
                  value={od.insuranceCompany}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, insuranceCompany: e.target.value },
                    }))
                  }
                >
                  <option value="">—</option>
                  {INSURANCE_COMPANY_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {od.insuranceCompany &&
                  !(INSURANCE_COMPANY_OPTIONS as readonly string[]).includes(od.insuranceCompany) ? (
                    <option value={od.insuranceCompany}>{od.insuranceCompany}</option>
                  ) : null}
                </TextSelect>
              </Field>
              <Field label="Insurance number">
                <TextInput
                  disabled={readOnlyClub}
                  value={od.insuranceNumber}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, insuranceNumber: e.target.value },
                    }))
                  }
                />
              </Field>
              <Field label="Expiring date">
                <TextInput
                  type="date"
                  disabled={readOnlyClub}
                  value={od.insuranceDeadline}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, insuranceDeadline: e.target.value },
                    }))
                  }
                />
              </Field>
            </Row3>
          </div>

          <div className="mt-3">
            <Field label="Payment method preferred (multicheck)">
              <div className="flex flex-wrap gap-3">
                {PAYMENT_TYPE_OPTIONS.map((m) => (
                  <CheckRow
                    key={m.value}
                    label={m.label}
                    disabled={readOnlyClub}
                    checked={od.preferredPaymentMethods.includes(m.value)}
                    onChange={(v) =>
                      setClub((c) => ({
                        ...c,
                        otherDetails: {
                          ...c.otherDetails,
                          preferredPaymentMethods: v
                            ? [...c.otherDetails.preferredPaymentMethods, m.value]
                            : c.otherDetails.preferredPaymentMethods.filter((x) => x !== m.value),
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </Field>
          </div>

          {od.badges.map((b, idx) => (
            <div key={idx} className="mt-2">
              <Row3>
                <Field label={`Badge Federation ${idx + 1} name`}>
                  <TextInput
                    disabled={readOnlyClub}
                    value={b.name}
                    onChange={(e) => {
                      const badges = od.badges.map((x, i) =>
                        i === idx ? { ...x, name: e.target.value } : x,
                      );
                      setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, badges } }));
                    }}
                  />
                </Field>
                <Field label={`Badge number ${idx + 1}`}>
                  <TextInput
                    disabled={readOnlyClub}
                    value={b.number}
                    onChange={(e) => {
                      const badges = od.badges.map((x, i) =>
                        i === idx ? { ...x, number: e.target.value } : x,
                      );
                      setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, badges } }));
                    }}
                  />
                </Field>
                <Field label="Expiring date">
                  <TextInput
                    type="date"
                    disabled={readOnlyClub}
                    value={b.deadline}
                    onChange={(e) => {
                      const badges = od.badges.map((x, i) =>
                        i === idx ? { ...x, deadline: e.target.value } : x,
                      );
                      setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, badges } }));
                    }}
                  />
                </Field>
              </Row3>
            </div>
          ))}
        </SectionCard>

        {!underage ? (
          <SectionCard title={`Signatures — overage member (${byMember})`}>
            <p className="mb-2 text-xs text-gray-600">
              The athlete accepts club/team rules and privacy, and draws the signature. The{' '}
              {entityNoun.toLowerCase()} admin can view these fields but only the member (or an
              admin with signature permission) can change them.
            </p>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CheckRow
                label="Acceptance of the rules of the club/team"
                disabled={readOnlyMemberSignature}
                checked={od.acceptanceRules}
                onChange={(v) =>
                  setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, acceptanceRules: v } }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/club/legal-documents/rules?clubId=${encodeURIComponent(data.clubId)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
                className="text-sm font-semibold text-red-700 underline hover:text-red-900"
              >
                Rules
              </button>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CheckRow
                label="I have read Privacy policy"
                disabled={readOnlyMemberSignature}
                checked={od.privacyPolicyRead}
                onChange={(v) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, privacyPolicyRead: v },
                  }))
                }
              />
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/club/legal-documents/privacy-policy?clubId=${encodeURIComponent(data.clubId)}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
                className="text-sm font-semibold text-red-700 underline hover:text-red-900"
              >
                Privacy policy
              </button>
            </div>
            <Field label="Signature">
              <SignaturePad
                ref={signaturePadRef}
                disabled={readOnlyMemberSignature}
                value={od.signatureDataUrl}
                onChange={(v) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, signatureDataUrl: v },
                  }))
                }
              />
            </Field>
          </SectionCard>
        ) : null}

        <SectionCard title={`Section News (${byAdmin})`}>
          <div className="grid grid-cols-1 border border-gray-200 sm:grid-cols-[11rem_1fr]">
            <div className="bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 sm:flex sm:items-start sm:justify-end">
              Enable the reading of news
            </div>
            <div className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    disabled={readOnlyClub}
                    checked={od.newsReadEnabled}
                    onChange={(e) =>
                      setClub((c) => ({
                        ...c,
                        otherDetails: { ...c.otherDetails, newsReadEnabled: e.target.checked },
                      }))
                    }
                    className="rounded border-gray-400"
                  />
                  Yes
                </label>
                <NewsCategoryMultiSelect
                  disabled={readOnlyClub || !od.newsReadEnabled}
                  value={od.newsReadCategories}
                  onChange={(ids) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, newsReadCategories: ids },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 border border-gray-200 sm:grid-cols-[11rem_1fr]">
            <div className="bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 sm:flex sm:items-start sm:justify-end">
              Enable the member to post news
            </div>
            <div className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    disabled={readOnlyClub}
                    checked={od.newsPostEnabled}
                    onChange={(e) =>
                      setClub((c) => ({
                        ...c,
                        otherDetails: { ...c.otherDetails, newsPostEnabled: e.target.checked },
                      }))
                    }
                    className="rounded border-gray-400"
                  />
                  Yes
                </label>
                <NewsCategoryMultiSelect
                  disabled={readOnlyClub || !od.newsPostEnabled}
                  value={od.newsPostCategories}
                  onChange={(ids) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, newsPostCategories: ids },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={`Section Messages (${byAdmin})`}>
          <CheckRow
            label="Generic automatic messages — Yes"
            disabled={readOnlyClub}
            checked={od.genericAutoMessages}
            onChange={(v) =>
              setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, genericAutoMessages: v } }))
            }
          />
          <CheckRow
            label="Specific alert messages — Yes"
            disabled={readOnlyClub}
            checked={od.specificAlertMessages}
            onChange={(v) =>
              setClub((c) => ({ ...c, otherDetails: { ...c.otherDetails, specificAlertMessages: v } }))
            }
          />
        </SectionCard>

        <SectionCard title={`Affiliation and consent (${byAdmin})`}>
          <Row2>
            <Field label="Date of initial affiliation">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={od.initialAffiliationDate}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: {
                      ...c.otherDetails,
                      initialAffiliationDate: e.target.value,
                    },
                  }))
                }
              />
            </Field>
            <div className="space-y-2">
              <Field label="Consent date">
                <TextInput
                  type="date"
                  disabled={readOnlyClub}
                  value={od.consentDate}
                  onChange={(e) =>
                    setClub((c) => ({
                      ...c,
                      otherDetails: { ...c.otherDetails, consentDate: e.target.value },
                    }))
                  }
                />
              </Field>
              <CheckRow
                label="Photo/video processing approval"
                disabled={readOnlyClub}
                checked={od.photoVideoApproval}
                onChange={(v) =>
                  setClub((c) => ({
                    ...c,
                    otherDetails: { ...c.otherDetails, photoVideoApproval: v },
                  }))
                }
              />
            </div>
          </Row2>
        </SectionCard>

        <SectionCard title={`Answers to personalized questions (${byAdmin})`}>
          {customQuestions.length === 0 ? (
            <p className="text-sm text-gray-500">
              No customized questions yet.{' '}
              {data.viewer.isClubAdmin ? (
                <a
                  href={`/club/settings/customized-fields?clubId=${encodeURIComponent(data.clubId)}`}
                  className="text-red-700 underline"
                >
                  Manage customized fields
                </a>
              ) : null}
            </p>
          ) : (
            <div className="space-y-4">
              {customQuestions.map((q) => {
                const answer = od.customQuestionAnswers[q.id];
                const listOpts = q.listOptions
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                return (
                  <div key={q.id} className="rounded border border-gray-200 p-3">
                    <div className="mb-2 text-sm font-semibold text-gray-900">
                      {q.question}
                      {q.mandatory ? <span className="text-red-600"> *</span> : null}
                    </div>
                    {q.answerType === 'free' ? (
                      <TextArea
                        disabled={readOnlyClub}
                        rows={2}
                        value={typeof answer === 'string' ? answer : ''}
                        onChange={(e) =>
                          setClub((c) => ({
                            ...c,
                            otherDetails: {
                              ...c.otherDetails,
                              customQuestionAnswers: {
                                ...c.otherDetails.customQuestionAnswers,
                                [q.id]: e.target.value,
                              },
                            },
                          }))
                        }
                      />
                    ) : null}
                    {q.answerType === 'checkbox' ? (
                      <CheckRow
                        label="Yes"
                        disabled={readOnlyClub}
                        checked={Boolean(answer)}
                        onChange={(v) =>
                          setClub((c) => ({
                            ...c,
                            otherDetails: {
                              ...c.otherDetails,
                              customQuestionAnswers: {
                                ...c.otherDetails.customQuestionAnswers,
                                [q.id]: v,
                              },
                            },
                          }))
                        }
                      />
                    ) : null}
                    {q.answerType === 'yes_no' ? (
                      <div className="flex flex-wrap gap-4">
                        {['Yes', 'No'].map((opt) => (
                          <label
                            key={opt}
                            className="inline-flex items-center gap-2 text-sm text-gray-800"
                          >
                            <input
                              type="radio"
                              name={`cq-${q.id}`}
                              disabled={readOnlyClub}
                              checked={answer === opt}
                              onChange={() =>
                                setClub((c) => ({
                                  ...c,
                                  otherDetails: {
                                    ...c.otherDetails,
                                    customQuestionAnswers: {
                                      ...c.otherDetails.customQuestionAnswers,
                                      [q.id]: opt,
                                    },
                                  },
                                }))
                              }
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    {q.answerType === 'list' ? (
                      <TextSelect
                        disabled={readOnlyClub}
                        value={typeof answer === 'string' ? answer : ''}
                        onChange={(e) =>
                          setClub((c) => ({
                            ...c,
                            otherDetails: {
                              ...c.otherDetails,
                              customQuestionAnswers: {
                                ...c.otherDetails.customQuestionAnswers,
                                [q.id]: e.target.value,
                              },
                            },
                          }))
                        }
                      >
                        <option value="">—</option>
                        {listOpts.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </TextSelect>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SaveBar canSave={canSaveClubSection} onSave={() => saveClubSection('otherDetails')} />
      </div>
    );
  }

  if (activeTab === 'parents') {
    const pr = club.parents;
    const memberDob = data.owner.personal.dateOfBirth || data.user.birthdate || '';
    const parentsEnabled = isMemberUnderage(memberDob);

    const renderOtherChildrenPicker = (key: 'parent1' | 'parent2') => {
      const p = pr[key];
      const available = data.clubMembersForPayFor.filter(
        (m) => !p.otherChildrenMemberIds.includes(m.id),
      );
      const selected = p.otherChildrenMemberIds
        .map((id) => data.clubMembersForPayFor.find((m) => m.id === id))
        .filter((m): m is { id: string; label: string } => Boolean(m));
      const selectId = otherChildrenSelectId[key];

      const addOtherChild = () => {
        if (!selectId || p.otherChildrenMemberIds.includes(selectId)) return;
        setClub((c) => ({
          ...c,
          parents: {
            ...c.parents,
            [key]: {
              ...c.parents[key],
              otherChildrenMemberIds: [...c.parents[key].otherChildrenMemberIds, selectId],
            },
          },
        }));
        setOtherChildrenSelectId((s) => ({ ...s, [key]: '' }));
      };

      return (
        <Field label="Other children at the sports facility">
          <p className="mb-2 text-xs text-gray-500">
            Add names of other members from the Archive of Members. Once saved, this parent&apos;s
            data will be copied into the profile of each tagged member.
          </p>

          {!readOnlyClub ? (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <TextSelect
                  value={selectId}
                  disabled={available.length === 0}
                  onChange={(e) =>
                    setOtherChildrenSelectId((s) => ({ ...s, [key]: e.target.value }))
                  }
                >
                  <option value="">
                    {available.length === 0
                      ? 'No more members available'
                      : 'Select member from archive…'}
                  </option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </TextSelect>
              </div>
              <button
                type="button"
                disabled={!selectId || saving}
                onClick={addOtherChild}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                aria-label="Add other child"
              >
                +
              </button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded border border-gray-300 bg-white">
            <div className="border-b border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">
              Other children tagged
            </div>
            {selected.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-500">No other members added yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {selected.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-900">{m.label}</span>
                    {!readOnlyClub ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-700 hover:underline"
                        onClick={() =>
                          setClub((c) => ({
                            ...c,
                            parents: {
                              ...c.parents,
                              [key]: {
                                ...c.parents[key],
                                otherChildrenMemberIds: c.parents[key].otherChildrenMemberIds.filter(
                                  (id) => id !== m.id,
                                ),
                              },
                            },
                          }))
                        }
                      >
                        REMOVE
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.clubMembersForPayFor.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No other members in the archive of this club.</p>
          ) : null}
        </Field>
      );
    };

    const renderParent = (key: 'parent1' | 'parent2', title: string) => {
      const p = pr[key];
      const catalog = data.clubParentsCatalog || [];
      const applyCatalogParent = (catalogKey: string) => {
        if (!catalogKey) {
          setClub((c) => ({
            ...c,
            parents: {
              ...c.parents,
              [key]: { ...c.parents[key], linkedParentKey: '' },
            },
          }));
          return;
        }
        const entry = catalog.find((x) => x.key === catalogKey);
        if (!entry) return;
        const d = entry.data;
        setClub((c) => ({
          ...c,
          parents: {
            ...c.parents,
            [key]: {
              ...c.parents[key],
              ...d,
              linkedParentKey: catalogKey,
              otherChildrenMemberIds: c.parents[key].otherChildrenMemberIds,
            },
          },
        }));
      };
      const patchParent = (patch: Partial<typeof p>) =>
        setClub((c) => ({
          ...c,
          parents: {
            ...c.parents,
            [key]: { ...c.parents[key], ...patch },
          },
        }));
      return (
        <SectionCard title={title}>
          <Field label="Search parent / tutor">
            <TextSelect
              disabled={readOnlyClub}
              value={p.linkedParentKey || ''}
              onChange={(e) => applyCatalogParent(e.target.value)}
            >
              <option value="">— Select from members' parents/tutors —</option>
              {catalog
                .filter((entry) => entry.sourceMemberId !== data.memberId)
                .map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
            </TextSelect>
          </Field>
          <p className="mb-3 text-xs text-gray-500">
            Selecting a parent/tutor fills the fields below and links this profile to that
            record.
          </p>
          <Row2>
            <Field label="Surname">
              <TextInput
                disabled={readOnlyClub}
                value={p.surname}
                onChange={(e) => patchParent({ surname: e.target.value })}
              />
            </Field>
            <Field label="Name">
              <TextInput
                disabled={readOnlyClub}
                value={p.name}
                onChange={(e) => patchParent({ name: e.target.value })}
              />
            </Field>
            <Field label="Birthdate">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={p.birthDate}
                onChange={(e) => patchParent({ birthDate: e.target.value })}
              />
            </Field>
          </Row2>
          <Row2>
            <Field label="Country">
              <TextInput
                disabled={readOnlyClub}
                value={p.country}
                onChange={(e) => patchParent({ country: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <TextInput
                disabled={readOnlyClub}
                value={p.location}
                onChange={(e) => patchParent({ location: e.target.value })}
              />
            </Field>
            <Field label="Province">
              <TextInput
                disabled={readOnlyClub}
                value={p.province}
                onChange={(e) => patchParent({ province: e.target.value })}
              />
            </Field>
          </Row2>
          <Field label="Fiscal code">
            <TextInput
              disabled={readOnlyClub}
              value={p.fiscalCode}
              onChange={(e) => patchParent({ fiscalCode: e.target.value })}
            />
          </Field>
          <CheckRow
            label="Identification code for foreigners"
            disabled={readOnlyClub}
            checked={p.foreignerIdCode}
            onChange={(v) => patchParent({ foreignerIdCode: v })}
          />
          <CheckRow
            label="The holder of this tax code will receive the invoice"
            disabled={readOnlyClub}
            checked={p.invoiceHolder}
            onChange={(v) => patchParent({ invoiceHolder: v })}
          />
          <Field label="Degree of kinship">
            <TextSelect
              disabled={readOnlyClub}
              value={p.kinship}
              onChange={(e) => patchParent({ kinship: e.target.value })}
            >
              <option value="">Select</option>
              {KINSHIP_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Row2>
            <Field label="Mail">
              <TextInput
                disabled={readOnlyClub}
                value={p.mainEmail}
                onChange={(e) => patchParent({ mainEmail: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                disabled={readOnlyClub}
                value={p.phone1}
                onChange={(e) => patchParent({ phone1: e.target.value })}
              />
            </Field>
            <Field label="Alternative phone">
              <TextInput
                disabled={readOnlyClub}
                value={p.phone2}
                onChange={(e) => patchParent({ phone2: e.target.value })}
              />
            </Field>
            <Field label="Alternative mail">
              <TextInput
                disabled={readOnlyClub}
                value={p.alternativeMail}
                onChange={(e) => patchParent({ alternativeMail: e.target.value })}
              />
            </Field>
          </Row2>
          <Row2>
            <Field label="Residence address">
              <TextInput
                disabled={readOnlyClub}
                value={p.residentialAddress}
                onChange={(e) => patchParent({ residentialAddress: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <TextInput
                disabled={readOnlyClub}
                value={p.residenceLocation}
                onChange={(e) => patchParent({ residenceLocation: e.target.value })}
              />
            </Field>
            <Field label="ZIP">
              <TextInput
                disabled={readOnlyClub}
                value={p.residenceZip}
                onChange={(e) => patchParent({ residenceZip: e.target.value })}
              />
            </Field>
            <Field label="Province">
              <TextInput
                disabled={readOnlyClub}
                value={p.residenceProvince}
                onChange={(e) => patchParent({ residenceProvince: e.target.value })}
              />
            </Field>
          </Row2>
          <CheckRow
            label="Present in the group Whatsapp of the team"
            disabled={readOnlyClub}
            checked={p.whatsappGroup}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                parents: { ...c.parents, [key]: { ...c.parents[key], whatsappGroup: v } },
              }))
            }
          />
          <CheckRow
            label="Present in the group Telegram of the team"
            disabled={readOnlyClub}
            checked={p.telegramGroup}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                parents: { ...c.parents, [key]: { ...c.parents[key], telegramGroup: v } },
              }))
            }
          />
          {renderOtherChildrenPicker(key)}
        </SectionCard>
      );
    };

    if (!parentsEnabled) {
      return (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{PARENTS_TAB_LABEL}</p>
          <p className="mt-1">
            This section is available only when the member is underage (under 18). Set the
            member&apos;s date of birth in Owner profile to enable it.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-4 border-b border-gray-200 pb-3">
          <p className="text-sm font-semibold text-gray-900">{PARENTS_TAB_LABEL}</p>
          <p className="mt-1 text-xs text-gray-600">
            * managed only by the admin of the club selected
          </p>
        </div>

        {renderParent('parent1', 'PARENT 1')}
        {renderParent('parent2', 'PARENT 2')}

        <SectionCard title="Administrative data">
          <p className="mb-3 text-sm font-semibold text-gray-800">Invoice address</p>
          <Row2>
            <Field label="Full name">
              <TextInput
                disabled={readOnlyClub}
                value={pr.invoice.fullName}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    parents: {
                      ...c.parents,
                      invoice: { ...c.parents.invoice, fullName: e.target.value },
                    },
                  }))
                }
              />
            </Field>
            <Field label="Fiscal code">
              <TextInput
                disabled={readOnlyClub}
                value={pr.invoice.fiscalCode}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    parents: {
                      ...c.parents,
                      invoice: { ...c.parents.invoice, fiscalCode: e.target.value },
                    },
                  }))
                }
              />
            </Field>
            <Field label="Address">
              <TextInput
                disabled={readOnlyClub}
                value={pr.invoice.address}
                onChange={(e) =>
                  setClub((c) => ({
                    ...c,
                    parents: {
                      ...c.parents,
                      invoice: { ...c.parents.invoice, address: e.target.value },
                    },
                  }))
                }
              />
            </Field>
          </Row2>
        </SectionCard>

        <SectionCard title="Data for % deduction">
          <label className="mb-3 inline-flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              disabled={readOnlyClub}
              checked={pr.deduction.enabled}
              onChange={(e) =>
                setClub((c) => ({
                  ...c,
                  parents: {
                    ...c.parents,
                    deduction: { ...c.parents.deduction, enabled: e.target.checked },
                  },
                }))
              }
              className="rounded border-gray-400"
            />
          </label>
          <Field label="Select year">
            <TextInput
              disabled={readOnlyClub || !pr.deduction.enabled}
              value={pr.deduction.year}
              onChange={(e) =>
                setClub((c) => ({
                  ...c,
                  parents: {
                    ...c.parents,
                    deduction: { ...c.parents.deduction, year: e.target.value },
                  },
                }))
              }
            />
          </Field>
        </SectionCard>

        <SectionCard title="Signatures">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CheckRow
              label="Acceptance of the rules of the club/team"
              disabled={readOnlyClub}
              checked={pr.acceptanceRules}
              onChange={(v) =>
                setClub((c) => ({ ...c, parents: { ...c.parents, acceptanceRules: v } }))
              }
            />
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/club/legal-documents/rules?clubId=${encodeURIComponent(data.clubId)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              className="text-sm font-semibold text-red-700 underline hover:text-red-900"
            >
              Rules
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CheckRow
              label="I have read Privacy policy"
              disabled={readOnlyClub}
              checked={pr.privacyPolicyRead}
              onChange={(v) =>
                setClub((c) => ({ ...c, parents: { ...c.parents, privacyPolicyRead: v } }))
              }
            />
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/club/legal-documents/privacy-policy?clubId=${encodeURIComponent(data.clubId)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              className="text-sm font-semibold text-red-700 underline hover:text-red-900"
            >
              Privacy policy
            </button>
          </div>
          <Field label="Signature">
            <SignaturePad
              ref={signaturePadRef}
              disabled={readOnlyClub}
              value={pr.signatureDataUrl}
              onChange={(v) =>
                setClub((c) => ({ ...c, parents: { ...c.parents, signatureDataUrl: v } }))
              }
            />
          </Field>
        </SectionCard>

        <SaveBar canSave={!readOnlyClub} onSave={() => saveClubSection('parents')} />
      </div>
    );
  }

  if (activeTab === 'settings') {
    return (
      <MemberProfileSettingsTab
        clubId={data.clubId}
        entitySportDefault={data.entitySportDefault || 'Football'}
        workspaceKind={data.workspaceKind === 'team' ? 'team' : 'club'}
        club={club}
        setClub={setClub}
        readOnlyClub={readOnlyClub}
        showVisibility={data.viewer.isClubAdmin}
        canEditPaymentDefaults={data.viewer.isClubAdmin}
        saving={saving}
        message={message}
        onSave={() => void saveSection('club')}
      />
    );
  }

  if (activeTab === 'messages-staff') {
    return (
      <div>
        {data.viewer.isClubAdmin ? (
          <SectionCard title="Member visibility" tone="purple">
            <CheckRow
              label="Allow member to read Messages from the Staff"
              checked={club.visibility.messagesStaff}
              disabled={readOnlyClub}
              onChange={(v) =>
                setClub({
                  ...club,
                  visibility: { ...club.visibility, messagesStaff: v },
                })
              }
            />
            <button
              type="button"
              className="mt-2 text-sm text-red-700 underline"
              disabled={saving}
              onClick={() => void resetNotes('staff')}
            >
              Reset Document and replies
            </button>
          </SectionCard>
        ) : null}

        <SectionCard title="Current message posted by the Club staff" tone="blue">
          <Row2>
            <Field label="Enable From">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={club.staffMessage.enableFrom}
                onChange={(e) =>
                  setClub({
                    ...club,
                    staffMessage: {
                      ...club.staffMessage,
                      enableFrom: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="To">
              <TextInput
                type="date"
                disabled={readOnlyClub}
                value={club.staffMessage.enableTo}
                onChange={(e) =>
                  setClub({
                    ...club,
                    staffMessage: {
                      ...club.staffMessage,
                      enableTo: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </Row2>
          <div className="flex flex-wrap gap-4">
            <CheckRow
              label="Show at Login"
              disabled={readOnlyClub}
              checked={club.staffMessage.showAtLogin}
              onChange={(v) =>
                setClub({
                  ...club,
                  staffMessage: { ...club.staffMessage, showAtLogin: v },
                })
              }
            />
            <CheckRow
              label="Show at Logout"
              disabled={readOnlyClub}
              checked={club.staffMessage.showAtLogout}
              onChange={(v) =>
                setClub({
                  ...club,
                  staffMessage: { ...club.staffMessage, showAtLogout: v },
                })
              }
            />
          </div>
          {data.viewer.isClubAdmin && !readOnlyClub ? (
            <div className="mt-3 rounded border-2 border-red-600 p-2">
              <p className="mb-2 text-xs font-semibold text-red-700">Document editor</p>
              <CKEditor
                value={club.staffMessage.html}
                onChange={(html) =>
                  setClub({
                    ...club,
                    staffMessage: { ...club.staffMessage, html },
                  })
                }
                minHeightPx={220}
              />
              <div className="mt-3 space-y-2">
                <TextInput
                  placeholder="Title"
                  value={noteDraft.title}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, title: e.target.value }))}
                />
                <TextArea
                  rows={3}
                  placeholder="Or post a short staff note…"
                  value={noteDraft.body}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, body: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={saving}
                  className="rounded bg-red-700 px-3 py-1.5 text-sm text-white"
                  onClick={() => void postNote('staff')}
                >
                  Post staff message
                </button>
              </div>
            </div>
          ) : (
            <div
              className="mt-3 prose max-w-none text-sm"
              dangerouslySetInnerHTML={{
                __html: club.staffMessage.html || '<p>No document.</p>',
              }}
            />
          )}
        </SectionCard>

        <SectionCard title="Comments">
          <p className="mb-3 text-xs text-gray-600">
            Root staff posts use the Enable From / To and Show at Login / Logout settings above.
            Save those checkboxes, then post — the member sees matching posts at login/logout.
          </p>
          {data.staffNotes.length === 0 ? (
            <p className="text-sm text-gray-500">No comments found.</p>
          ) : (
            <ul className="space-y-3">
              {data.staffNotes.map((n) => (
                <li key={n.id} className="rounded border border-gray-200 p-3 text-sm">
                  <p className="font-semibold">{n.title || 'Staff message'}</p>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {n.authorLabel} · {new Date(n.createdAt).toLocaleString()}
                    {n.showAtLogin || n.showAtLogout || club.staffMessage.showAtLogin || club.staffMessage.showAtLogout ? (
                      <span className="ml-2 text-sky-700">
                        {[
                          (n.showAtLogin || (!n.showAtLogin && !n.showAtLogout && club.staffMessage.showAtLogin))
                            ? 'Login'
                            : null,
                          (n.showAtLogout || (!n.showAtLogin && !n.showAtLogout && club.staffMessage.showAtLogout))
                            ? 'Logout'
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </p>
                  {n.replies.map((r) => (
                    <div key={r.id} className="mt-2 ml-4 border-l pl-3 text-gray-700">
                      <p className="whitespace-pre-wrap">{r.body}</p>
                      <p className="text-xs text-gray-500">
                        {r.authorLabel} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {data.viewer.isSelf && data.club.visibility.messagesStaff ? (
                    <div className="mt-2">
                      <TextArea
                        rows={2}
                        placeholder="Your comment… (Ctrl+Enter to send)"
                        value={replyDrafts[n.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((d) => ({ ...d, [n.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            if (!saving && (replyDrafts[n.id] || '').trim()) {
                              void postNote('staff', n.id);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="mt-1 text-sm text-blue-800 underline"
                        disabled={saving}
                        onClick={() => void postNote('staff', n.id)}
                      >
                        Reply
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SaveBar canSave={!readOnlyClub} onSave={() => void saveSection('club')} />
      </div>
    );
  }

  if (activeTab === 'notes-coach') {
    return (
      <CoachNotesPanel
        data={data}
        club={club}
        setClub={setClub}
        readOnlyClub={readOnlyClub}
        saving={saving}
        message={message}
        setMessage={setMessage}
        onChange={onChange}
        onReload={onReload}
        onSaveVisibility={() => void saveSection('club')}
      />
    );
  }

  if (activeTab === 'presences') {
    return (
      <div>
        {data.viewer.isClubAdmin ? (
          <SectionCard title="Member visibility" tone="purple">
            <CheckRow
              label="Allow member to read Graphs of the presences"
              checked={club.visibility.presences}
              disabled={readOnlyClub}
              onChange={(v) =>
                setClub((c) => ({
                  ...c,
                  visibility: { ...c.visibility, presences: v },
                }))
              }
            />
            <SaveBar canSave={!readOnlyClub} onSave={() => void saveSection('club')} />
          </SectionCard>
        ) : null}

        <div className="mb-4 border-b border-gray-200 pb-3">
          <p className="text-sm font-semibold text-gray-900">Graphs of the presences</p>
        </div>
      </div>
    );
  }

  return null;
}
