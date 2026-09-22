'use client';

import { useCallback, useEffect, useState } from 'react';
import ClubInfoContactsFields from '@/components/club/ClubInfoContactsFields';
import { emptyTeamContacts } from '@/lib/team/teamProfileDefaults';
import type { TeamContacts } from '@/lib/team/teamProfileTypes';

type Props = {
  clubId: string;
};

export default function ClubInfoContactsForm({ clubId }: Props) {
  const [form, setForm] = useState<TeamContacts>(() => emptyTeamContacts());
  const [initialForm, setInitialForm] = useState<TeamContacts>(() => emptyTeamContacts());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('Please sign in to load club info.');
        return;
      }
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load club info.');
      }
      const contacts =
        data.contacts && typeof data.contacts === 'object'
          ? ({ ...emptyTeamContacts(), ...(data.contacts as TeamContacts) } as TeamContacts)
          : emptyTeamContacts();
      setForm(contacts);
      setInitialForm(contacts);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load club info.');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please sign in to save club info.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/contacts`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contacts: form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save club info.');
      }
      const saved =
        data.contacts && typeof data.contacts === 'object'
          ? ({ ...emptyTeamContacts(), ...(data.contacts as TeamContacts) } as TeamContacts)
          : form;
      setForm(saved);
      setInitialForm(saved);
      setMessage(
        typeof data.message === 'string' ? data.message : 'Club info saved successfully.',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save club info.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setForm(initialForm);
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-gray-600">Loading club info…</div>
    );
  }

  return (
    <div>
      <ClubInfoContactsFields value={form} onChange={setForm} disabled={saving} />

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="min-w-[7rem] px-8 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-md shadow-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="min-w-[7rem] px-8 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-md shadow-sm"
          >
            Cancel
          </button>
        </div>
        {message ? (
          <p
            role="status"
            className={`text-sm ${message.includes('success') ? 'text-green-700' : 'text-red-600'}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
