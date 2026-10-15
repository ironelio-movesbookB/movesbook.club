'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { sharingFetch } from '@/hooks/useSharingSummary';
import {
  SHARE_LIST_LABELS,
  SHARE_PARTY_KIND_LABELS,
  formatShareAvailable,
  isAllowedSharePair,
  notifySharingChanged,
  type ShareParty,
  type SharePartyKind,
  type ShareSearchRow,
  type SharingSummary,
} from '@/lib/sharing/sharingTypes';
import {
  ShareLogo,
  SharingModal,
  SharingPasswordModal,
  SharingSectionsPanel,
} from '@/components/sharing/SharingUi';

type Step = 'company' | 'password' | 'search' | 'panel' | 'sent';

const COMPANY_GROUP_LABELS: Partial<Record<SharePartyKind, string>> = {
  club: 'My clubs',
  team: 'My Teams',
  coach: 'My Groups trained',
  group: 'My Groups',
};

async function verifyAdminPassword(password: string): Promise<void> {
  await sharingFetch('/api/user/verify-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

/** "+" on a Communities list: pick the sharing company, password, search the recipient, choose sections. */
export default function SharingFlow({
  listKind,
  summary,
  onClose,
}: {
  listKind: SharePartyKind;
  summary: SharingSummary;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(summary.isCompanyAdmin ? 'company' : 'password');
  const [sender, setSender] = useState<ShareParty | null>(summary.isCompanyAdmin ? null : summary.self);
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ShareSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<ShareParty | null>(null);
  const [senderSections, setSenderSections] = useState<string[]>([]);
  const [recipientSections, setRecipientSections] = useState<string[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = summary.limits[listKind];

  const runSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      setError(null);
      try {
        const data = await sharingFetch<{ rows: ShareSearchRow[] }>(
          `/api/sharing/search?kind=${listKind}&q=${encodeURIComponent(q)}`,
        );
        setRows(data.rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [listKind],
  );

  useEffect(() => {
    if (step === 'search') void runSearch('');
  }, [step, runSearch]);

  const chooseRecipient = async (row: ShareSearchRow) => {
    if (!sender) return;
    const party: ShareParty = { kind: row.kind, id: row.id, name: row.name, logo: row.logo };
    setRecipient(party);
    setStep('panel');
    setLoadingSections(true);
    setError(null);
    try {
      const [own, theirs] = await Promise.all([
        sharingFetch<{ sections: string[] }>(
          `/api/sharing/defaults?ownerKind=${sender.kind}&ownerId=${encodeURIComponent(sender.id)}&recipientKind=${party.kind}`,
        ),
        sharingFetch<{ sections: string[] }>(
          `/api/sharing/defaults?ownerKind=${party.kind}&ownerId=${encodeURIComponent(party.id)}&recipientKind=${sender.kind}`,
        ),
      ]);
      setSenderSections(own.sections);
      setRecipientSections(theirs.sections);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the sections');
    } finally {
      setLoadingSections(false);
    }
  };

  const send = async () => {
    if (!sender || !recipient) return;
    setSending(true);
    setError(null);
    try {
      await sharingFetch('/api/sharing/requests', {
        method: 'POST',
        body: JSON.stringify({
          sender: { kind: sender.kind, id: sender.id },
          recipient: { kind: recipient.kind, id: recipient.id },
          senderSections,
          password,
        }),
      });
      notifySharingChanged();
      setStep('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request');
    } finally {
      setSending(false);
    }
  };

  const title = `Share — ${SHARE_LIST_LABELS[listKind]}`;

  if (limit && limit.available !== null && limit.available <= 0 && step !== 'sent') {
    return (
      <SharingModal title={title} onClose={onClose}>
        <p className="text-sm text-gray-700">
          You have reached the sharing limit for this list ({limit.limit}). Pending and accepted
          requests are counted.
        </p>
      </SharingModal>
    );
  }

  if (step === 'company') {
    const companies = summary.companies.filter((c) => isAllowedSharePair(c.kind, listKind));
    const groups = (['club', 'team', 'coach', 'group'] as SharePartyKind[])
      .map((kind) => ({ kind, items: companies.filter((c) => c.kind === kind) }))
      .filter((g) => g.items.length > 0);
    return (
      <SharingModal title={title} onClose={onClose}>
        <p className="mb-1 text-sm text-gray-700">Which company shares?</p>
        <p className="mb-3 text-xs text-gray-500">{formatShareAvailable(limit)}</p>
        {groups.length === 0 ? (
          <p className="text-sm text-red-600">You have no company to share from. Create one first.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.kind}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {COMPANY_GROUP_LABELS[group.kind]}
                </p>
                <ul className="space-y-1">
                  {group.items.map((company) => (
                    <li key={`${company.kind}-${company.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSender(company);
                          setStep('password');
                        }}
                        className="flex w-full items-center gap-3 rounded border border-gray-200 px-3 py-2 text-left text-sm hover:bg-teal-50"
                      >
                        <ShareLogo party={company} size={36} />
                        <span className="truncate font-medium text-gray-900">{company.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SharingModal>
    );
  }

  if (step === 'password') {
    return (
      <SharingPasswordModal
        title={title}
        message={`Enter the admin password to share as ${sender?.name ?? ''}.`}
        confirmLabel="Continue"
        onClose={onClose}
        onSubmit={async (value) => {
          await verifyAdminPassword(value);
          setPassword(value);
          setStep('search');
        }}
      />
    );
  }

  if (step === 'search') {
    return (
      <div className="fixed inset-0 z-[1200] bg-black/40" role="dialog" aria-modal="true">
        <div className="absolute inset-y-4 left-4 right-4 flex flex-col rounded-lg bg-white text-gray-900 shadow-xl lg:left-[22rem] lg:right-[18rem]">
          <div className="flex items-center justify-between rounded-t-lg bg-teal-800 px-4 py-2.5 text-white">
            <h2 className="text-sm font-semibold">
              {title} — search {SHARE_PARTY_KIND_LABELS[listKind].toLowerCase()}s
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-teal-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="flex gap-2 border-b border-gray-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
          >
            <div className="relative flex-1">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in the network"
                className="w-full rounded border border-gray-300 py-2 pl-3 pr-9 text-sm"
              />
              <Search className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
            </div>
            <button type="submit" className="rounded bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
              Search
            </button>
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
            {searching ? (
              <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </p>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">No results</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={`${row.kind}-${row.id}`}
                    className="flex items-center gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <ShareLogo party={row} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-blue-700">{row.name}</p>
                      <p className="truncate text-xs text-gray-500">{row.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void chooseRecipient(row)}
                      className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'sent' && recipient) {
    return (
      <SharingModal title={title} onClose={onClose}>
        <p className="text-sm text-gray-700">
          A request of sharing has been sent to <strong>{recipient.name}</strong>. You will see its
          status at the top of My Page.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white">
            OK
          </button>
        </div>
      </SharingModal>
    );
  }

  if (!sender || !recipient) return null;

  return (
    <SharingModal title={title} onClose={onClose} wide>
      <SharingSectionsPanel
        sender={sender}
        recipient={recipient}
        senderSections={senderSections}
        recipientSections={recipientSections}
        editableSide="sender"
        loading={loadingSections}
        onChange={(side, next) => {
          if (side === 'sender') setSenderSections(next);
        }}
      />
      <p className="mt-3 text-xs text-gray-500">
        Sharing is read-only: the recipient can view the shared sections but cannot insert or delete anything.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => setStep('search')} className="rounded border border-gray-300 px-4 py-1.5 text-sm">
          Back
        </button>
        <button
          type="button"
          disabled={sending || loadingSections}
          onClick={() => void send()}
          className="inline-flex items-center gap-1 rounded bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm and send request
        </button>
      </div>
    </SharingModal>
  );
}
