'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = { total: number; missing: Record<string, number> };

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Registers the sport profile / statistics labels in the Section languages and auto-translates missing ones. */
export default function SportLabelsSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/translations/sport-labels', { headers: authHeaders() });
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setBusy(true);
    setMessage('Translating… this can take a few minutes.');
    try {
      const res = await fetch('/api/admin/translations/sport-labels', {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      const failed = Object.values((data.failed ?? {}) as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      );
      setMessage(
        failed > 0
          ? `Done. ${failed} label(s) could not be translated automatically — run it again or edit them by hand.`
          : 'Done. All sport labels are available in every language.',
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  const missingTotal = status
    ? Object.values(status.missing).reduce((a, b) => a + b, 0)
    : null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" data-testid="sport-labels-sync">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Sport profiles and statistics labels</h3>
          <p className="text-sm text-gray-700">
            {status
              ? `${status.total} labels (category "sports"). Missing translations: ${missingTotal}.`
              : 'Labels of the athlete / team sport fields, stats and their tabs.'}
          </p>
          {status && missingTotal ? (
            <p className="mt-1 text-xs text-gray-600">
              {Object.entries(status.missing)
                .filter(([, n]) => n > 0)
                .map(([lang, n]) => `${lang.toUpperCase()}: ${n}`)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sync()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Translating…' : 'Add & auto-translate missing labels'}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-gray-800">{message}</p> : null}
      <p className="mt-2 text-xs text-gray-500">
        Existing translations are never overwritten; correct any of them in the list below
        (search for keys starting with <code>sport_</code>).
      </p>
    </div>
  );
}
