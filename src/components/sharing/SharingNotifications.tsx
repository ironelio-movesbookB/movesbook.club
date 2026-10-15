'use client';

import { useCallback, useEffect, useState } from 'react';
import { sharingFetch } from '@/hooks/useSharingSummary';
import {
  SHARING_CHANGED_EVENT,
  notifySharingChanged,
  type SharePartyKind,
  type ShareRequestView,
  type ShareSide,
} from '@/lib/sharing/sharingTypes';
import {
  ShareLogo,
  SharingModal,
  SharingSectionsPanel,
  formatShareDate,
} from '@/components/sharing/SharingUi';

export type SharingNotificationsScope =
  | { type: 'mypage' }
  | { type: 'party'; kind: SharePartyKind; id: string };

const STATUS_STYLES: Record<ShareRequestView['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  accepted: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  removed: 'bg-gray-100 text-gray-700 border-gray-300',
};

const STATUS_LABELS: Record<ShareRequestView['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  removed: 'Removed',
};

function messageFor(req: ShareRequestView): string {
  const created = formatShareDate(req.createdAt);
  if (req.status === 'removed') {
    const remover = req.removedBy === 'sender' ? req.sender : req.recipient;
    return `${remover.name} removed the sharing with you on date ${formatShareDate(req.removedAt)}`;
  }
  if (req.viewerSide === 'sender') {
    if (req.status === 'pending') {
      return `A request of sharing has been sent to ${req.recipient.name} in date ${created}`;
    }
    return `The recipient ${req.recipient.name} on date ${formatShareDate(req.respondedAt)} ${
      req.status === 'accepted' ? 'accepted' : 'rejected'
    } your request of sharing`;
  }
  return `A request of sharing has been sent from ${req.sender.name} in date ${created}`;
}

function SettingsDialog({
  req,
  editSide,
  onClose,
}: {
  req: ShareRequestView;
  editSide: ShareSide | null;
  onClose: () => void;
}) {
  const [senderSections, setSenderSections] = useState(req.senderSections);
  const [recipientSections, setRecipientSections] = useState(req.recipientSections);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = editSide && (req.status === 'pending' || req.status === 'accepted') ? editSide : null;

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      await sharingFetch(`/api/sharing/requests/${encodeURIComponent(req.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'update_sections',
          sections: editable === 'sender' ? senderSections : recipientSections,
          saveAsDefault,
        }),
      });
      notifySharingChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SharingModal title="Sharing settings" onClose={onClose} wide>
      <SharingSectionsPanel
        sender={req.sender}
        recipient={req.recipient}
        senderSections={senderSections}
        recipientSections={recipientSections}
        editableSide={editable}
        onChange={(side, next) => (side === 'sender' ? setSenderSections(next) : setRecipientSections(next))}
      />
      {editable ? (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
            Use these sections as my default for this type of {editable === 'sender' ? 'recipient' : 'sender'}
          </label>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      ) : null}
    </SharingModal>
  );
}

/** Sharing notifications shown at the top of the central frame (My Page / My Club / My Team…). */
export default function SharingNotifications({ scope }: { scope: SharingNotificationsScope | null }) {
  const [requests, setRequests] = useState<ShareRequestView[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ req: ShareRequestView; editSide: ShareSide | null } | null>(null);

  const scopeKey = scope ? (scope.type === 'mypage' ? 'mypage' : `${scope.kind}:${scope.id}`) : '';

  const load = useCallback(async () => {
    if (!scope || typeof window === 'undefined' || !localStorage.getItem('token')) {
      setRequests([]);
      return;
    }
    const qs =
      scope.type === 'mypage'
        ? 'scope=mypage'
        : `scope=party&kind=${scope.kind}&id=${encodeURIComponent(scope.id)}`;
    try {
      const data = await sharingFetch<{ requests: ShareRequestView[] }>(`/api/sharing/requests?${qs}`);
      setRequests(data.requests);
    } catch {
      setRequests([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(SHARING_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHARING_CHANGED_EVENT, onChange);
  }, [load]);

  const act = async (req: ShareRequestView, action: 'accept' | 'reject' | 'hide') => {
    setBusyId(req.id);
    setError(null);
    try {
      await sharingFetch(`/api/sharing/requests/${encodeURIComponent(req.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      notifySharingChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <section className="mb-4 space-y-2" aria-label="Sharing notifications" data-testid="sharing-notifications">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {requests.map((req) => {
        const viewerIsSender = req.viewerSide === 'sender';
        const busy = busyId === req.id;
        return (
          <div
            key={req.id}
            data-share-id={req.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-white p-3 shadow-sm"
          >
            <ShareLogo
              party={req.sender}
              size={52}
              onClick={() => setDialog({ req, editSide: viewerIsSender ? 'sender' : null })}
              title={viewerIsSender ? 'Your sharing settings' : `Settings of ${req.sender.name}`}
            />
            <div className="min-w-[200px] flex-1">
              <p className="text-sm text-gray-800">{messageFor(req)}</p>
              <span
                className={`mt-1 inline-block rounded border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[req.status]}`}
              >
                {STATUS_LABELS[req.status]}
              </span>
            </div>
            <ShareLogo
              party={req.recipient}
              size={52}
              onClick={() => setDialog({ req, editSide: viewerIsSender ? null : 'recipient' })}
              title={viewerIsSender ? `Settings of ${req.recipient.name}` : 'Your sharing settings'}
            />
            <div className="flex flex-wrap gap-2">
              {!viewerIsSender && req.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(req, 'accept')}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(req, 'reject')}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {!viewerIsSender || req.status !== 'pending' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(req, 'hide')}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Delete notification
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {dialog ? (
        <SettingsDialog req={dialog.req} editSide={dialog.editSide} onClose={() => setDialog(null)} />
      ) : null}
    </section>
  );
}
