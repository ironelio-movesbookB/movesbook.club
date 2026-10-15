'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import { sharingFetch, useSharingSummary } from '@/hooks/useSharingSummary';
import {
  SHARE_LIST_LABELS,
  formatShareAvailable,
  isAllowedSharePair,
  notifySharingChanged,
  type SharePartyKind,
  type SharedEntry,
} from '@/lib/sharing/sharingTypes';
import SharingFlow from '@/components/sharing/SharingFlow';
import SharingDefaultsModal from '@/components/sharing/SharingDefaultsModal';
import { SharingPasswordModal } from '@/components/sharing/SharingUi';

const LIST_ORDER: SharePartyKind[] = ['user', 'club', 'coach', 'team', 'group'];

/**
 * Communities → Sharing friends / My Clubs / My Coaches / My teams / My Groups.
 * "N available" comes from the user's PCU version settings; accepted sharings are listed in yellow.
 */
export default function CommunitiesSharingLists({
  renderListExtra,
  defaultOpenKind,
}: {
  /** Extra rows under a list (e.g. athlete team memberships under My teams). */
  renderListExtra?: (kind: SharePartyKind) => ReactNode;
  defaultOpenKind?: SharePartyKind;
}) {
  const { summary } = useSharingSummary();
  const [openKinds, setOpenKinds] = useState<Set<SharePartyKind>>(
    () => new Set(defaultOpenKind ? [defaultOpenKind] : []),
  );
  const [flowKind, setFlowKind] = useState<SharePartyKind | null>(null);
  const [gearKind, setGearKind] = useState<SharePartyKind | null>(null);
  const [removing, setRemoving] = useState<SharedEntry | null>(null);

  const toggle = (kind: SharePartyKind) =>
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const canShareTo = (kind: SharePartyKind) => {
    if (!summary) return false;
    if (summary.isCompanyAdmin) return summary.companies.some((c) => isAllowedSharePair(c.kind, kind));
    return isAllowedSharePair('user', kind);
  };

  return (
    <>
      {LIST_ORDER.map((kind) => {
        const open = openKinds.has(kind);
        const entries = summary?.shared[kind] ?? [];
        const sharable = canShareTo(kind);
        const extra = renderListExtra?.(kind);
        return (
          <div key={kind} className="border-t border-gray-700" data-sharing-list={kind}>
            <div className="flex w-full items-center gap-1 px-2 py-2 hover:bg-gray-750">
              <button
                type="button"
                onClick={() => sharable && setFlowKind(kind)}
                disabled={!sharable}
                aria-label={`Share — ${SHARE_LIST_LABELS[kind]}`}
                title={sharable ? 'Add a sharing' : undefined}
                className="rounded p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => toggle(kind)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-left"
              >
                <span className="text-sm">{SHARE_LIST_LABELS[kind]}</span>
                {summary && sharable ? (
                  <span className="text-[11px] font-semibold text-yellow-300">
                    {formatShareAvailable(summary.limits[kind])}
                  </span>
                ) : null}
              </button>
              {sharable ? (
                <button
                  type="button"
                  onClick={() => setGearKind(kind)}
                  aria-label={`Sharing settings — ${SHARE_LIST_LABELS[kind]}`}
                  title="Sharing settings"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(kind)}
                aria-label={open ? 'Collapse' : 'Expand'}
                className="rounded p-1.5"
              >
                <ChevronDown
                  className={`h-4 w-4 opacity-60 transition-transform ${open ? 'rotate-180' : 'rotate-[-90deg]'}`}
                />
              </button>
            </div>
            {open ? (
              <div className="border-t border-gray-700 bg-[#2d2d2d] px-4 py-3">
                {entries.length === 0 && !extra ? (
                  <p className="py-1 text-center text-xs text-gray-400">No sharing yet</p>
                ) : null}
                {entries.length > 0 ? (
                  <ul className="space-y-1">
                    {entries.map((entry) => (
                      <li key={entry.shareId} className="flex items-center gap-2">
                        <Link
                          href={`/sharing/view/${encodeURIComponent(entry.shareId)}`}
                          className="min-w-0 flex-1 truncate text-sm font-semibold text-yellow-300 hover:underline"
                          title={entry.party.name}
                        >
                          {entry.party.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRemoving(entry)}
                          className="shrink-0 rounded bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {extra}
              </div>
            ) : null}
          </div>
        );
      })}

      {flowKind && summary ? (
        <SharingFlow listKind={flowKind} summary={summary} onClose={() => setFlowKind(null)} />
      ) : null}
      {gearKind && summary ? (
        <SharingDefaultsModal listKind={gearKind} summary={summary} onClose={() => setGearKind(null)} />
      ) : null}
      {removing ? (
        <SharingPasswordModal
          title="Remove sharing"
          message={`Enter the admin password to remove the sharing with ${removing.party.name}.`}
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onSubmit={async (password) => {
            await sharingFetch(`/api/sharing/requests/${encodeURIComponent(removing.shareId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ action: 'remove', password }),
            });
            setRemoving(null);
            notifySharingChanged();
          }}
        />
      ) : null}
    </>
  );
}
