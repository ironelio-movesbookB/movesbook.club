'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  SHARE_PARTY_KIND_LABELS,
  shareSectionsForKind,
  type ShareParty,
  type ShareSide,
} from '@/lib/sharing/sharingTypes';

export function ShareLogo({
  party,
  size = 56,
  onClick,
  title,
}: {
  party: ShareParty;
  size?: number;
  onClick?: () => void;
  title?: string;
}) {
  const initials = party.name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const content = party.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={party.logo} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm font-bold text-gray-600">{initials || '?'}</span>
  );
  const className =
    'flex shrink-0 items-center justify-center overflow-hidden rounded border border-gray-300 bg-gray-100';
  if (!onClick) {
    return (
      <span className={className} style={{ width: size, height: size }} title={title ?? party.name}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} hover:ring-2 hover:ring-teal-500`}
      style={{ width: size, height: size }}
      title={title ?? party.name}
    >
      {content}
    </button>
  );
}

export function SharingModal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className={`flex max-h-[90vh] w-full flex-col rounded-lg bg-white text-gray-900 shadow-xl ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between rounded-t-lg bg-teal-800 px-4 py-2.5 text-white">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-teal-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Asks the admin password and hands it back (the server checks it again with the action). */
export function SharingPasswordModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onClose,
  onSubmit,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password.trim()) {
      setError('Enter your admin password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SharingModal title={title} onClose={onClose}>
      <p className="mb-3 text-sm text-gray-700">{message}</p>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        placeholder="Admin password"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        aria-label="Admin password"
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex items-center gap-1 rounded bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </SharingModal>
  );
}

export function SectionsChecklist({
  party,
  sections,
  editable,
  onChange,
}: {
  party: ShareParty;
  sections: string[];
  editable: boolean;
  onChange?: (next: string[]) => void;
}) {
  const selected = new Set(sections);
  return (
    <ul className="space-y-1.5">
      {shareSectionsForKind(party.kind).map((section) => (
        <li key={section.key}>
          <label className={`flex items-center gap-2 text-sm ${editable ? 'cursor-pointer text-gray-800' : 'text-gray-600'}`}>
            <input
              type="checkbox"
              checked={selected.has(section.key)}
              disabled={!editable}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(section.key);
                else next.delete(section.key);
                onChange?.(shareSectionsForKind(party.kind).map((s) => s.key).filter((k) => next.has(k)));
              }}
            />
            {section.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

function PartyColumn({
  party,
  caption,
  sections,
  editable,
  onChange,
  loading,
}: {
  party: ShareParty;
  caption: string;
  sections: string[];
  editable: boolean;
  onChange?: (next: string[]) => void;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 p-4">
      <div className="mb-3 flex items-center gap-3">
        <ShareLogo party={party} size={64} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{caption}</p>
          <p className="truncate text-base font-semibold text-gray-900">{party.name}</p>
          <p className="text-xs text-gray-500">{SHARE_PARTY_KIND_LABELS[party.kind]}</p>
        </div>
      </div>
      <p className="mb-2 text-xs font-semibold text-gray-700">
        {editable ? 'Sections shared (you can change them)' : 'Sections shared'}
      </p>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      ) : (
        <SectionsChecklist party={party} sections={sections} editable={editable} onChange={onChange} />
      )}
    </div>
  );
}

/** Popup split vertically: sender on the left, recipient on the right, each with its sections. */
export function SharingSectionsPanel({
  sender,
  recipient,
  senderSections,
  recipientSections,
  editableSide,
  onChange,
  loading,
}: {
  sender: ShareParty;
  recipient: ShareParty;
  senderSections: string[];
  recipientSections: string[];
  editableSide: ShareSide | null;
  onChange?: (side: ShareSide, next: string[]) => void;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col divide-y divide-gray-300 rounded border border-gray-300 md:flex-row md:divide-x md:divide-y-0">
      <PartyColumn
        party={sender}
        caption="Sender"
        sections={senderSections}
        editable={editableSide === 'sender'}
        onChange={(next) => onChange?.('sender', next)}
        loading={loading}
      />
      <PartyColumn
        party={recipient}
        caption="Recipient"
        sections={recipientSections}
        editable={editableSide === 'recipient'}
        onChange={(next) => onChange?.('recipient', next)}
        loading={loading}
      />
    </div>
  );
}

export function formatShareDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
