'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SubscriptionEditSettingsForm from '@/components/admin/subscriptions/SubscriptionEditSettingsForm';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import {
  getSubscriptionRowsByUserType,
  getUserTypeLabel,
} from '@/lib/admin/subscriptionSettingsMock';
import type { SubscriptionEditData, SubscriptionUserType } from '@/types/adminSubscriptionSettings';

type VersionSettingsPayload = {
  userId: string;
  versionId: number | null;
  userType: SubscriptionUserType;
  data: SubscriptionEditData;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/** PCU → Version settings: the user's own copy of the purchased version, editable by Movesbook staff. */
export default function PcuVersionSettingsPanel({ userId }: { userId: string }) {
  const [payload, setPayload] = useState<VersionSettingsPayload | null>(null);
  const [draft, setDraft] = useState<SubscriptionEditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyVersionId, setCopyVersionId] = useState<number | ''>('');

  const endpoint = `/api/admin/registered-users/${encodeURIComponent(userId)}/version-settings`;

  const apply = (next: VersionSettingsPayload) => {
    setPayload(next);
    setDraft(next.data);
    setCopyVersionId(next.versionId ?? '');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminBearerToken();
      const res = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load version settings');
      apply(body.versionSettings as VersionSettingsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load version settings');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const versionOptions = useMemo(
    () =>
      payload
        ? getSubscriptionRowsByUserType(payload.userType).filter((r) => !r.isTemplate && r.name)
        : [],
    [payload],
  );

  const save = async (body: Record<string, unknown>, okMessage: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = getAdminBearerToken();
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save version settings');
      apply(data.versionSettings as VersionSettingsPayload);
      setNotice(okMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save version settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 border border-gray-300 bg-white p-8 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading version settings…
      </div>
    );
  }

  if (!payload || !draft) {
    return (
      <div className="border border-gray-300 bg-white p-6 text-sm text-red-600">
        {error || 'No version settings for this user.'}
      </div>
    );
  }

  const variant = payload.userType === 'athlete' ? 'athlete' : 'coach';

  return (
    <div className="border border-gray-300 bg-white p-4 space-y-4">
      <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
        <div>
          <span className="font-semibold">Version purchased: </span>
          {draft.general.name || '—'} {draft.general.code ? `(${draft.general.code})` : ''}
        </div>
        <div>
          <span className="font-semibold">User type: </span>
          {getUserTypeLabel(payload.userType)}
        </div>
        <div>
          <span className="font-semibold">Copied on: </span>
          {formatDate(payload.createdAt)}
        </div>
        <div>
          <span className="font-semibold">Last update: </span>
          {formatDate(payload.updatedAt)}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        These values belong to this user only. Limits (companies the admin can create, sharing
        limits) are read from here, not from the version settings.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-700">Copy again from version</span>
        <select
          value={copyVersionId}
          onChange={(e) => setCopyVersionId(e.target.value ? Number(e.target.value) : '')}
          className="border border-gray-300 bg-[#fffacd] px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {versionOptions.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || copyVersionId === ''}
          onClick={() => {
            if (copyVersionId === '') return;
            if (!window.confirm('Replace this user\u2019s version settings with the selected version?')) return;
            void save({ copyFromVersionId: copyVersionId }, 'Version settings copied.');
          }}
          className="rounded bg-gray-700 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Copy
        </button>
      </div>

      <SubscriptionEditSettingsForm
        settings={draft.settings}
        userType={payload.userType}
        variant={variant}
        daysValue={draft.general.renewalDays || draft.general.firstSubscriptionDays}
        onChange={(settings) => setDraft({ ...draft, settings })}
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <div className="flex justify-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save({ data: draft }, 'Version settings saved.')}
          className="bg-[#333] px-8 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setDraft(payload.data)}
          className="bg-[#333] px-8 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
