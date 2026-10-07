'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Calendar, Mail, User } from 'lucide-react';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';
import ProfileSportsMultiSelect from '@/components/profile/ProfileSportsMultiSelect';
import ClubAdminInfoFields from '@/components/profile/ClubAdminInfoFields';
import ClubStaffSetPasswordModal from '@/components/club/staff/ClubStaffSetPasswordModal';
import { parseClubAdminInfo } from '@/lib/club/clubAdminInfo';
import type { ClubAdminInfo } from '@/lib/club/clubAdminInfo';
import { resolvePublicImageUrl } from '@/lib/profileImageUrl';
import { clubApiFetch, getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  CLUB_STAFF_ROLES,
  CLUB_STAFF_TYPES,
  CLUB_STAFF_USER_LEVELS,
  isClubStaffType,
  notifyClubStaffChanged,
  type ClubStaffProfile,
  type ClubStaffType,
  type ClubStaffUserLevel,
} from '@/lib/club/clubStaff.constants';

const CKEditorComponent = dynamic(() => import('@/components/news/CKEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[200px] rounded border border-gray-300 bg-white p-4 text-sm text-gray-500">
      Loading editor…
    </div>
  ),
});

type FormState = {
  name: string;
  username: string;
  firstName: string;
  surname: string;
  country: string;
  preferredLanguage: string;
  gender: string;
  birthdate: string;
  email: string;
  password: string;
  confirmPassword: string;
  telegramAccount: string;
  youtubeChannelUrl: string;
  mainSports: string[];
  staffType: ClubStaffType | '';
  role: string;
  userLevels: ClubStaffUserLevel[];
  referencesHtml: string;
  referencesLevel: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  username: '',
  firstName: '',
  surname: '',
  country: '',
  preferredLanguage: 'en',
  gender: '',
  birthdate: '',
  email: '',
  password: '',
  confirmPassword: '',
  telegramAccount: '',
  youtubeChannelUrl: '',
  mainSports: [],
  staffType: '',
  role: '',
  userLevels: [],
  referencesHtml: '',
  referencesLevel: '1',
};

type Props = {
  mode: 'create' | 'edit';
  staffId?: string;
  defaultStaffType?: string;
};

export default function ClubStaffProfileForm({ mode, staffId, defaultStaffType }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    staffType: isClubStaffType(defaultStaffType ?? '') ? defaultStaffType : '',
  });
  const [profile, setProfile] = useState<ClubStaffProfile | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<ClubAdminInfo>(() =>
    parseClubAdminInfo({ phonePrefix: '+39' }),
  );
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  useEffect(() => {
    if (!pendingPhoto) {
      setPendingPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingPhoto);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);

  const load = useCallback(async () => {
    if (mode !== 'edit' || !staffId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await clubApiFetch<{ staff: ClubStaffProfile }>(`/api/club/staff/${staffId}`);
      const staff = data.staff;
      setProfile(staff);
      setImagePath(staff.image);
      setForm({
        name: staff.name ?? '',
        username: staff.username ?? '',
        firstName: staff.firstName ?? '',
        surname: staff.surname ?? '',
        country: staff.country ?? '',
        preferredLanguage: staff.preferredLanguage || 'en',
        gender: staff.gender ?? '',
        birthdate: staff.birthdate ?? '',
        email: staff.email ?? '',
        password: '',
        confirmPassword: '',
        telegramAccount: staff.telegramAccount ?? '',
        youtubeChannelUrl: staff.youtubeChannelUrl ?? '',
        mainSports: staff.mainSports ?? [],
        staffType: isClubStaffType(staff.staffType) ? staff.staffType : '',
        role: staff.role ?? '',
        userLevels: staff.userLevels ?? [],
        referencesHtml: staff.referencesHtml ?? '',
        referencesLevel: staff.referencesLevel || '1',
      });
      setAdminInfo(() => {
        const parsed = staff.adminInfo
          ? parseClubAdminInfo(staff.adminInfo)
          : parseClubAdminInfo({ phonePrefix: '+39' });
        const yt = staff.youtubeChannelUrl?.trim() ?? '';
        if (yt && !parsed.youtube.url.trim()) {
          parsed.youtube = { ...parsed.youtube, url: yt };
        }
        if (!parsed.phonePrefix.trim()) {
          parsed.phonePrefix = '+39';
        }
        return parsed;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load staff profile');
    } finally {
      setLoading(false);
    }
  }, [mode, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadPhoto = async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(withSelectedClubId(`/api/club/staff/${id}/avatar`), {
      method: 'POST',
      headers: { Authorization: (getAuthHeaders() as Record<string, string>).Authorization ?? '' },
      body,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to upload photo');
    }
    return typeof payload.path === 'string' ? payload.path : null;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const name =
      form.name.trim() || [form.firstName, form.surname].filter(Boolean).join(' ').trim();
    if (!name) {
      setError('Display name is required.');
      return;
    }
    if (!form.staffType) {
      setError('Select a type of staff.');
      return;
    }
    if (!form.role) {
      setError('Select a role.');
      return;
    }
    if (mode === 'create') {
      if (!form.username.trim()) {
        setError('Username is required.');
        return;
      }
      if (!form.email.trim()) {
        setError('Email is required.');
        return;
      }
      if (form.password.length < 6) {
        setError('Set a password with Set Password (at least 6 characters).');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match. Use Set Password again.');
        return;
      }
    } else if (form.password) {
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name,
        firstName: form.firstName.trim() || null,
        surname: form.surname.trim() || null,
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        country: form.country.trim() || null,
        gender: form.gender.trim() || null,
        birthdate: form.birthdate.trim() || null,
        preferredLanguage: form.preferredLanguage,
        telegramAccount: form.telegramAccount.trim() || null,
        youtubeChannelUrl: form.youtubeChannelUrl.trim() || null,
        mainSports: form.mainSports,
        staffType: form.staffType,
        role: form.role,
        userLevels: form.userLevels,
        referencesHtml: form.referencesHtml,
        referencesLevel: form.referencesLevel,
        adminInfo,
      };

      let savedId = staffId;
      if (mode === 'create') {
        const created = await clubApiFetch<{ staff: ClubStaffProfile }>('/api/club/staff', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedId = created.staff.id;
        setProfile(created.staff);
      } else if (staffId) {
        const updated = await clubApiFetch<{ staff: ClubStaffProfile }>(`/api/club/staff/${staffId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setProfile(updated.staff);
      }

      if (savedId && pendingPhoto) {
        const path = await uploadPhoto(savedId, pendingPhoto);
        if (path) setImagePath(path);
        setPendingPhoto(null);
      }

      notifyClubStaffChanged();
      setMessage(mode === 'create' ? 'Club staff added successfully.' : 'Club staff profile saved.');
      if (mode === 'create' && savedId) {
        router.push(`/club/staff/${savedId}`);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save club staff');
    } finally {
      setSaving(false);
    }
  };

  const enteredName = form.name.trim() || [form.firstName, form.surname].filter(Boolean).join(' ');
  const displayName = enteredName || 'New club staff';
  const avatarSrc = pendingPreview || resolvePublicImageUrl(imagePath);
  const typeLabel = form.staffType
    ? CLUB_STAFF_TYPES.find((item) => item.value === form.staffType)?.label
    : 'Club staff';

  const contactPageUrl = useMemo(() => {
    if (!origin) return '';
    if (mode === 'edit' && staffId) {
      return `${origin}/club/staff/${staffId}`;
    }
    const username = form.username.trim();
    if (username) {
      return `${origin}/club/staff/new?type=${encodeURIComponent(form.staffType || 'operator')}&u=${encodeURIComponent(username)}`;
    }
    return `${origin}/club/staff`;
  }, [origin, mode, staffId, form.username, form.staffType]);

  const qrImageSrc = contactPageUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(contactPageUrl)}`
    : '';

  const handlePasswordSave = async (payload: { oldPassword: string; newPassword: string }) => {
    if (mode === 'create') {
      setForm((f) => ({
        ...f,
        password: payload.newPassword,
        confirmPassword: payload.newPassword,
      }));
      setMessage('Password set. Click Save profile to create this staff account.');
      return;
    }
    if (!staffId) throw new Error('Staff id is required.');
    await clubApiFetch(`/api/club/staff/${staffId}/password`, {
      method: 'POST',
      body: JSON.stringify({
        oldPassword: payload.oldPassword,
        newPassword: payload.newPassword,
      }),
    });
    setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    setMessage('Staff login password updated.');
  };

  const toggleLevel = (value: ClubStaffUserLevel) => {
    setForm((prev) => ({
      ...prev,
      userLevels: prev.userLevels.includes(value)
        ? prev.userLevels.filter((item) => item !== value)
        : [...prev.userLevels, value],
    }));
  };

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">Loading staff profile…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/club/staff" className="font-medium text-blue-600 hover:text-blue-800">
          ← Back to staff list
        </Link>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-600">
          {mode === 'create' ? 'Add Club Staff' : 'Club Staff Profile'}
        </span>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-3xl font-bold text-white">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800" translate={enteredName ? 'no' : undefined}>
              {displayName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4" />
              <span translate="no">{form.email || '—'}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4" />
              {form.username ? <span translate="no">@{form.username}</span> : <span>@username</span>}
            </p>
            <div className="mt-2">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {typeLabel}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              Member Since
            </p>
            <p className="font-semibold">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-xl font-bold text-gray-800">Club Staff Profile</h2>
        <p className="mb-4 text-sm text-gray-600">
          {mode === 'create'
            ? 'Fill the staff details below, then click Save profile to add this account.'
            : 'Edit the details below, then click Save profile to update this staff account.'}
        </p>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <label className="cursor-pointer text-sm font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800">
              Change profile photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => setPendingPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="ml-auto flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-gray-600">Contact page</p>
            <div className="flex h-[120px] w-[120px] items-center justify-center border border-gray-300 bg-white">
              {qrImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImageSrc} alt="Contact page QR code" width={120} height={120} />
              ) : (
                <span className="px-2 text-center text-[10px] text-gray-400">QR unavailable</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              disabled={saving}
              className="rounded border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-1.5 text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800 disabled:opacity-60"
            >
              Set Password
            </button>
            {mode === 'create' && form.password ? (
              <p className="text-[11px] text-green-700">Password ready to save</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Display name" htmlFor="staff-name">
            <input
              id="staff-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Username" htmlFor="staff-username">
            <input
              id="staff-username"
              type="text"
              value={form.username}
              readOnly={mode === 'edit'}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className={mode === 'edit' ? readOnlyClass : inputClass}
            />
          </Field>
          <Field label="First name" htmlFor="staff-first">
            <input
              id="staff-first"
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Surname" htmlFor="staff-surname">
            <input
              id="staff-surname"
              type="text"
              value={form.surname}
              onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Country" htmlFor="staff-country">
            <select
              id="staff-country"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Select country —</option>
              {ALL_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preferred language" htmlFor="staff-lang">
            <select
              id="staff-lang"
              value={form.preferredLanguage}
              onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}
              className={inputClass}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} translate="no">
                  {lang.name} ({lang.code.toUpperCase()})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gender" htmlFor="staff-gender">
            <select
              id="staff-gender"
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Birthdate" htmlFor="staff-birthdate">
            <input
              id="staff-birthdate"
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Email" htmlFor="staff-email">
              <input
                id="staff-email"
                type="email"
                value={form.email}
                readOnly={mode === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={mode === 'edit' ? readOnlyClass : inputClass}
              />
            </Field>
          </div>
          <Field label="Telegram account" htmlFor="staff-telegram">
            <input
              id="staff-telegram"
              type="text"
              value={form.telegramAccount}
              onChange={(e) => setForm((f) => ({ ...f, telegramAccount: e.target.value }))}
              placeholder="@username"
              translate="no"
              className={inputClass}
            />
          </Field>
          <Field label="YouTube channel" htmlFor="staff-youtube">
            <input
              id="staff-youtube"
              type="url"
              value={form.youtubeChannelUrl}
              onChange={(e) => setForm((f) => ({ ...f, youtubeChannelUrl: e.target.value }))}
              placeholder="https://youtube.com/@channel"
              translate="no"
              className={inputClass}
            />
          </Field>
          <Field label="Account type" htmlFor="staff-account-type">
            <input
              id="staff-account-type"
              type="text"
              value={translateSportLabel(t, 'Club staff')}
              readOnly
              className={readOnlyClass}
            />
          </Field>
          <Field label="Member since" htmlFor="staff-since">
            <input
              id="staff-since"
              type="text"
              value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
              readOnly
              className={readOnlyClass}
            />
          </Field>
          <div className="md:col-span-2">
            <label htmlFor="staff-sports" className="mb-1 block text-sm font-medium text-gray-700">
              Main sports
            </label>
            <ProfileSportsMultiSelect
              id="staff-sports"
              value={form.mainSports}
              onChange={(mainSports) => setForm((f) => ({ ...f, mainSports }))}
              disabled={saving}
            />
          </div>

          <Field label="Type of staff" htmlFor="staff-type">
            <select
              id="staff-type"
              value={form.staffType}
              onChange={(e) =>
                setForm((f) => ({ ...f, staffType: e.target.value as ClubStaffType | '' }))
              }
              className={inputClass}
              required
            >
              <option value="">— Select —</option>
              {CLUB_STAFF_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role" htmlFor="staff-role">
            <select
              id="staff-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={inputClass}
              required
            >
              <option value="">— Select —</option>
              {CLUB_STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium text-gray-700">User level</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLUB_STAFF_USER_LEVELS.map((level) => (
                <label key={level.value} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={form.userLevels.includes(level.value)}
                    onChange={() => toggleLevel(level.value)}
                    className="rounded border-gray-400"
                  />
                  {level.label}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 border border-[#c9bd7a] bg-[#efe7b3] px-4 py-2 text-sm font-semibold text-gray-900">
              References of the staff
            </div>
            <div className="border border-gray-300 bg-white p-3">
              <CKEditorComponent
                value={form.referencesHtml}
                onChange={(html) => setForm((f) => ({ ...f, referencesHtml: html }))}
                minHeightPx={220}
                placeholder=""
              />
              <div className="mt-3 grid max-w-md grid-cols-[160px_1fr] items-center gap-2 text-sm">
                <label className="text-gray-800">References level</label>
                <select
                  value={form.referencesLevel}
                  onChange={(e) => setForm((f) => ({ ...f, referencesLevel: e.target.value }))}
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
          </div>

          <div className="md:col-span-2">
            <ClubAdminInfoFields
              value={adminInfo}
              onChange={setAdminInfo}
              disabled={saving}
              title="Club Staff Information"
              showVisibilityCheckboxes={false}
            />
          </div>

          {(error || message) && (
            <div className="md:col-span-2">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-green-700">{message}</p> : null}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <Link href="/club/staff" className="text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </Link>
          </div>
        </form>
      </section>

      <ClubStaffSetPasswordModal
        isOpen={passwordModalOpen}
        mode={mode}
        onClose={() => setPasswordModalOpen(false)}
        onSave={handlePasswordSave}
      />
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const readOnlyClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
