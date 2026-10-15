'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { sharingFetch } from '@/hooks/useSharingSummary';
import {
  SHARE_LIST_LABELS,
  isAllowedSharePair,
  type ShareParty,
  type SharePartyKind,
  type SharingSummary,
} from '@/lib/sharing/sharingTypes';
import { SectionsChecklist, ShareLogo, SharingModal } from '@/components/sharing/SharingUi';

/**
 * Gear icon on a Communities list: default sections this company (or single user)
 * shares with that recipient type. Used to pre-fill new sharing requests.
 */
export default function SharingDefaultsModal({
  listKind,
  summary,
  onClose,
  initialOwner,
}: {
  listKind: SharePartyKind;
  summary: SharingSummary;
  onClose: () => void;
  initialOwner?: ShareParty;
}) {
  const owners = useMemo(() => {
    const list = summary.isCompanyAdmin ? summary.companies : [summary.self];
    return list.filter((p) => isAllowedSharePair(p.kind, listKind));
  }, [summary, listKind]);
  const [owner, setOwner] = useState<ShareParty | null>(initialOwner ?? owners[0] ?? null);
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setError(null);
    sharingFetch<{ sections: string[] }>(
      `/api/sharing/defaults?ownerKind=${owner.kind}&ownerId=${encodeURIComponent(owner.id)}&recipientKind=${listKind}`,
    )
      .then((data) => {
        if (!cancelled) setSections(data.sections);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, listKind]);

  const save = async () => {
    if (!owner) return;
    setSaving(true);
    setError(null);
    try {
      const data = await sharingFetch<{ sections: string[] }>('/api/sharing/defaults', {
        method: 'PUT',
        body: JSON.stringify({ ownerKind: owner.kind, ownerId: owner.id, recipientKind: listKind, sections }),
      });
      setSections(data.sections);
      setMessage('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SharingModal title={`Sharing settings — ${SHARE_LIST_LABELS[listKind]}`} onClose={onClose}>
      {owners.length === 0 || !owner ? (
        <p className="text-sm text-gray-700">You have no company to share from.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-500">
            Sections shared by default with this type of recipient.
          </p>
          {owners.length > 1 ? (
            <select
              value={`${owner.kind}:${owner.id}`}
              onChange={(e) => {
                const next = owners.find((o) => `${o.kind}:${o.id}` === e.target.value);
                if (next) setOwner(next);
              }}
              className="mb-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              aria-label="Company"
            >
              {owners.map((o) => (
                <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="mb-3 flex items-center gap-3">
            <ShareLogo party={owner} size={44} />
            <span className="font-semibold text-gray-900">{owner.name}</span>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          ) : (
            <SectionsChecklist party={owner} sections={sections} editable onChange={setSections} />
          )}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-1.5 text-sm">
              Close
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="rounded bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}
    </SharingModal>
  );
}
