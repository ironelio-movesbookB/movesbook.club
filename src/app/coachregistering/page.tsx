'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import CoachFields, { validateCoachInput } from '@/components/club/coaches/CoachFields';
import { EMPTY_CLUB_COACH_INPUT, type ClubCoachInput } from '@/lib/club/clubCoach.constants';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import TranslatedTemplate from '@/components/i18n/TranslatedTemplate';

type Society = { kind: 'club' | 'team'; name: string };
type AccountMode = 'register' | 'login';
type StoredUser = { id?: string; username?: string; email?: string; userType?: string; name?: string };

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

function readStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null') as StoredUser | null;
    return token && user ? user : null;
  } catch {
    return null;
  }
}

const isCoachUser = (user: StoredUser | null) => String(user?.userType || '').toUpperCase() === 'COACH';

function CoachRegisteringContent() {
  const searchParams = useSearchParams();
  const societyId = searchParams?.get('society') ?? '';

  const [society, setSociety] = useState<Society | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [coachUser, setCoachUser] = useState<StoredUser | null>(null);
  /** Logged in with a non-coach account: registering here would replace that session, so the form is blocked. */
  const [otherUser, setOtherUser] = useState<StoredUser | null>(null);
  const [mode, setMode] = useState<AccountMode>('register');
  const [account, setAccount] = useState({ username: '', email: '', password: '', country: 'Italy', identifier: '' });
  const [profile, setProfile] = useState<ClubCoachInput>({ ...EMPTY_CLUB_COACH_INPUT });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const stored = readStoredUser();
    setCoachUser(isCoachUser(stored) ? stored : null);
    setOtherUser(stored && !isCoachUser(stored) ? stored : null);
  }, []);

  useEffect(() => {
    if (!societyId) {
      setLoadError('This invitation link is not valid');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/public/coach-registering?society=${encodeURIComponent(societyId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error || 'This invitation link is not valid');
        else setSociety(data.society);
      })
      .catch(() => !cancelled && setLoadError('Could not load the invitation'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [societyId]);

  const ensureCoachToken = async (): Promise<string> => {
    const existing = localStorage.getItem('token');
    if (coachUser && existing) return existing;
    const stored = readStoredUser();
    if (stored && !isCoachUser(stored)) {
      throw new Error('Only coach accounts can register with this link. Log out first, then open the link again.');
    }

    const res =
      mode === 'register'
        ? await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${profile.firstName} ${profile.surname}`.trim(),
              firstName: profile.firstName,
              surname: profile.surname,
              username: account.username,
              email: account.email,
              password: account.password,
              userType: 'coach',
              birthdate: profile.birthDate || undefined,
              country: account.country,
            }),
          })
        : await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: account.identifier, password: account.password }),
          });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || 'Could not access your coach account');
    if (String(data.user?.userType || '').toUpperCase() !== 'COACH') {
      throw new Error('Only coach accounts can register with this link.');
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setCoachUser(data.user);
    return data.token as string;
  };

  const validateAccount = (): string | null => {
    if (coachUser) return null;
    if (mode === 'login') {
      if (!account.identifier.trim() || !account.password) return 'Enter your username or email and password';
      return null;
    }
    if (!account.username.trim()) return 'Username is required';
    if (!account.email.trim()) return 'Email is required';
    if (account.password.length < 6) return 'Password must be at least 6 characters';
    if (!account.country) return 'Country is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateAccount() || validateCoachInput(profile);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = await ensureCoachToken();
      const res = await fetch('/api/public/coach-registering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...profile,
          email: profile.email || account.email || coachUser?.email || '',
          society: societyId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCoachUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading invitation…
      </div>
    );
  }

  if (loadError || !society) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {loadError || 'This invitation link is not valid'}
      </div>
    );
  }

  const entityLabel = society.kind === 'team' ? 'team' : 'club';

  if (otherUser) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
        <h1 className="mb-2 text-lg font-semibold">Coach registration</h1>
        <p className="text-sm">
          <TranslatedTemplate
            text="You are logged in as {0}, which is not a coach account. Only coach accounts can register with this link."
            values={[<strong key="u" translate="no">{otherUser.username || otherUser.email}</strong>]}
          />
        </p>
        <p className="mt-3 text-sm">
          <TranslatedTemplate
            text={
              entityLabel === 'team'
                ? 'Log out first, or open the link in a private window, to register as a coach in the team {0}.'
                : 'Log out first, or open the link in a private window, to register as a coach in the club {0}.'
            }
            values={[<strong key="s" translate="no">{society.name}</strong>]}
          />
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded border border-teal-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-teal-600" />
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Request sent</h1>
        <p className="text-sm text-gray-600">
          <TranslatedTemplate
            text={
              entityLabel === 'team'
                ? 'Your coach registration has been sent to the team {0}. It will be active as soon as the team approves it.'
                : 'Your coach registration has been sent to the club {0}. It will be active as soon as the club approves it.'
            }
            values={[<strong key="s" translate="no">{society.name}</strong>]}
          />
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 rounded bg-[#c4b5e0] px-5 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Coach registration</h1>
        <p className="text-sm text-gray-800">
          <TranslatedTemplate
            text={
              entityLabel === 'team'
                ? 'You have been invited to join the team {0} as a coach.'
                : 'You have been invited to join the club {0} as a coach.'
            }
            values={[<strong key="s" translate="no">{society.name}</strong>]}
          />
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded border border-gray-200 bg-white p-5 shadow-sm">
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Your coach account</h2>
          {coachUser ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-teal-50 px-3 py-2 text-sm text-teal-900">
              <span>
                <span>Logged in as</span> <strong translate="no">{coachUser.username || coachUser.email}</strong>
              </span>
              <button type="button" onClick={signOut} className="text-teal-700 underline">
                Use another account
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-2 text-sm">
                {(['register', 'login'] as AccountMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded px-3 py-1.5 font-medium ${
                      mode === m ? 'bg-[#4f4f4f] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {m === 'register' ? 'New coach account' : 'I already have a coach account'}
                  </button>
                ))}
              </div>
              {mode === 'register' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Username*</span>
                    <input
                      className={inputClass}
                      value={account.username}
                      onChange={(e) => setAccount({ ...account, username: e.target.value })}
                      autoComplete="username"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Email*</span>
                    <input
                      type="email"
                      className={inputClass}
                      value={account.email}
                      onChange={(e) => setAccount({ ...account, email: e.target.value })}
                      autoComplete="email"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Password*</span>
                    <input
                      type="password"
                      className={inputClass}
                      value={account.password}
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Country*</span>
                    <select
                      className={inputClass}
                      value={account.country}
                      onChange={(e) => setAccount({ ...account, country: e.target.value })}
                    >
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Username or email*</span>
                    <input
                      className={inputClass}
                      value={account.identifier}
                      onChange={(e) => setAccount({ ...account, identifier: e.target.value })}
                      autoComplete="username"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Password*</span>
                    <input
                      type="password"
                      className={inputClass}
                      value={account.password}
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      autoComplete="current-password"
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </section>

        <CoachFields value={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} disabled={saving} />

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Send registration
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CoachRegisteringPage() {
  return (
    <Suspense fallback={null}>
      <AutoTranslate>
        <CoachRegisteringContent />
      </AutoTranslate>
    </Suspense>
  );
}
