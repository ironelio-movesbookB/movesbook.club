'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { FREE_TIME_ACTIVITY_OPTIONS } from '@/lib/club/memberProfileDefaults';
import type { ActivitiesData, ContactsData } from '@/lib/club/memberProfileTypes';

type Props = {
  embedded?: boolean;
  onClose?: () => void;
};

type Loaded = {
  contacts: ContactsData;
  activities: ActivitiesData;
  displayName: string;
};

const PUBLIC_LINK_FIELDS: Array<{
  key: keyof Pick<
    ContactsData,
    'myWebsite' | 'whatsapp' | 'instagram' | 'youtube' | 'linkedin' | 'blogSite' | 'googleMap'
  >;
  label: string;
}> = [
  { key: 'myWebsite', label: 'My Website' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'blogSite', label: 'My blog site' },
  { key: 'googleMap', label: 'Google map' },
];

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MemberVisitorContactActivitiesPanel({
  embedded = true,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/user/member-profile', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string' ? json.error : 'Failed to load profile',
          );
        }
        if (cancelled) return;
        const user = json.user || {};
        const displayName =
          [user.firstName || user.name, user.surname].filter(Boolean).join(' ') ||
          user.username ||
          'Member';
        setData({
          contacts: json.contacts,
          activities: json.activities,
          displayName,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contacts = data?.contacts;
  const activities = data?.activities;
  const publicLinks = PUBLIC_LINK_FIELDS.map(({ key, label }) => {
    const item = contacts?.[key];
    if (!item?.showInPublicInfo || !String(item.url || '').trim()) return null;
    return { label, url: item.url.trim() };
  }).filter(Boolean) as Array<{ label: string; url: string }>;

  const socialSites = (contacts?.socialSites || []).filter((s) => String(s.url || '').trim());
  const selectedDays = DAY_ORDER.filter((d) =>
    (activities?.preferredDays || []).includes(d),
  );
  const selectedActivities = (activities?.freeTimeActivities || []).filter(Boolean);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ${
        embedded ? '' : 'max-w-3xl'
      }`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-[#2f6fb5] px-4 py-3 text-white">
        <div>
          <h2 className="text-base font-bold">Contact info & selected activities</h2>
          {data?.displayName ? (
            <p className="text-xs text-white/85">{data.displayName}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : (
          <>
            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                Contact info
              </h3>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                {contacts?.alternateEmail ? (
                  <p>
                    <span className="font-semibold text-gray-700">Email: </span>
                    <a
                      href={`mailto:${contacts.alternateEmail}`}
                      className="text-blue-700 underline"
                    >
                      {contacts.alternateEmail}
                    </a>
                  </p>
                ) : null}
                {contacts?.phonePrefix || contacts?.phoneNumber ? (
                  <p>
                    <span className="font-semibold text-gray-700">Phone: </span>
                    {[contacts.phonePrefix, contacts.phoneNumber].filter(Boolean).join(' ')}
                  </p>
                ) : null}
                {socialSites.map((site, i) => (
                  <p key={`${site.platform}-${i}`}>
                    <span className="font-semibold text-gray-700">{site.platform}: </span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-700 underline"
                    >
                      {site.url}
                    </a>
                  </p>
                ))}
                {publicLinks.map((link) => (
                  <p key={link.label}>
                    <span className="font-semibold text-gray-700">{link.label}: </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-700 underline"
                    >
                      {link.url}
                    </a>
                  </p>
                ))}
                {contacts?.aboutMe?.trim() ? (
                  <div>
                    <p className="font-semibold text-gray-700">About me</p>
                    <p className="mt-1 whitespace-pre-wrap text-gray-800">{contacts.aboutMe}</p>
                  </div>
                ) : null}
                {!contacts?.alternateEmail &&
                !contacts?.phoneNumber &&
                socialSites.length === 0 &&
                publicLinks.length === 0 &&
                !contacts?.aboutMe?.trim() ? (
                  <p className="text-gray-500">No contact info shared yet.</p>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                Selected days
              </h3>
              {selectedDays.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedDays.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-900"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No preferred days selected.</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                Selected activities
              </h3>
              {selectedActivities.length ? (
                <ul className="flex flex-wrap gap-2">
                  {selectedActivities.map((label) => {
                    const opt = FREE_TIME_ACTIVITY_OPTIONS.find((o) => o.label === label);
                    return (
                      <li
                        key={label}
                        className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-900"
                      >
                        {opt?.label || label}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No free-time activities selected.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
