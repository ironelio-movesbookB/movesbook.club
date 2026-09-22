'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PromocodeInviteEntry } from '@/lib/promocodes/types';

/** Scrollable list until this many invites; beyond PAGE_SELECTOR_THRESHOLD we paginate. */
const SCROLL_SOFT_MAX = 30;
const PAGE_SELECTOR_THRESHOLD = 50;
const PAGE_SIZE = 30;

type PromocodeInviteEmailsModalProps = {
  open: boolean;
  entries: PromocodeInviteEntry[];
  onClose: () => void;
};

export default function PromocodeInviteEmailsModal({
  open,
  entries,
  onClose,
}: PromocodeInviteEmailsModalProps) {
  const [page, setPage] = useState(1);
  const total = entries.length;
  const usePagination = total > PAGE_SELECTOR_THRESHOLD;
  const totalPages = usePagination ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  useEffect(() => {
    if (open) setPage(1);
  }, [open, entries]);

  const pageEntries = useMemo(() => {
    if (!usePagination) return entries;
    const start = (page - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, page, usePagination]);

  if (!open) return null;

  const scrollable = total > 8 || pageEntries.length > 8;
  const maxVisibleHint = Math.min(SCROLL_SOFT_MAX, pageEntries.length);

  return (
    <div className="promo-invite-emails-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="promo-invite-emails-modal" onClick={(e) => e.stopPropagation()}>
        <div className="promo-invite-emails-header">Invite emails</div>

        {usePagination ? (
          <div className="promo-invite-emails-pager">
            <button
              type="button"
              className="promo-invite-emails-pager-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="promo-invite-emails-pager-label">
              Page{' '}
              <select
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
                aria-label="Invite emails page"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>{' '}
              of {totalPages} ({total} invites)
            </span>
            <button
              type="button"
              className="promo-invite-emails-pager-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        ) : null}

        <div
          className={`promo-invite-emails-body${scrollable ? ' promo-invite-emails-body--scroll' : ''}`}
          style={
            scrollable
              ? { maxHeight: `min(60vh, ${Math.max(8, Math.min(maxVisibleHint, SCROLL_SOFT_MAX)) * 2.2}rem)` }
              : undefined
          }
        >
          {total === 0 ? (
            <p className="promo-invite-emails-empty">No invites sent.</p>
          ) : (
            pageEntries.map((entry, index) => {
              // Registered → username (blue). Pending → invite mail address (red).
              const identity = entry.registered
                ? entry.username || entry.email
                : entry.email || entry.username;
              const isMailAddress = /@/.test(identity || '');
              const identityClass = isMailAddress
                ? 'promo-invite-emails-address'
                : 'promo-invite-emails-username';

              return (
                <div
                  key={`${entry.email}-${entry.username ?? ''}-${index}`}
                  className="promo-invite-emails-row"
                >
                  <div className="promo-invite-emails-identity">
                    {identity ? <span className={identityClass}>{identity}</span> : null}
                  </div>
                  <div className="promo-invite-emails-meta">
                    {entry.inviteDate ? (
                      <span className="promo-invite-emails-date">invite {entry.inviteDate}</span>
                    ) : null}
                    {entry.registered ? (
                      <span className="promo-invite-emails-registration">
                        registered
                        {entry.registrationDate ? ` ${entry.registrationDate}` : ''}
                        {entry.subscriptionName ? ` ${entry.subscriptionName}` : ''}
                      </span>
                    ) : (
                      <span className="promo-invite-emails-pending">pending</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="promo-invite-emails-footer">
          <button type="button" className="btn-gray" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
