'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { MovesbookDeadlineRow } from '@/lib/movesbookDeadlines/movesbookDeadlines.shared';

type RenewalOption = {
  code: string | null;
  label: string;
  totalEur: number;
  monthlyEur: number;
  deadlines: number;
  firstDeadlineEur: number;
  days: number;
};

type Status = {
  overdue: MovesbookDeadlineRow[];
  upcoming: MovesbookDeadlineRow[];
  renewal: {
    versionName: string;
    currentDateEnd: string;
    daysLeft: number;
    renewalDiscountPercent: number;
    options: RenewalOption[];
  } | null;
};

const DISMISS_KEY = 'movesbook:subscription-warning-dismissed';
const HIDDEN_PATHS = ['/admin', '/register', '/login'];

function euro(value: number): string {
  return `€ ${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dmy(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Warning shown to a logged-in user from 1 week before a deadline (or the end of the subscription):
 * pay the deadline online, or renew with the renewal price.
 */
export default function SubscriptionExpiryHost() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewChoice, setRenewChoice] = useState<string | null>(null);

  const hidden = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (hidden) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem('token');
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      return;
    }
    if (!token || !localStorage.getItem('user')) return;
    let cancelled = false;
    fetch('/api/users/subscription-status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Status | null) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {
        /* the warning is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [hidden, pathname]);

  const startPayment = useCallback(
    async (body: Record<string, unknown>, key: string) => {
      setBusy(key);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/users/subscription-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.paymentUrl) throw new Error(data?.error || 'Could not start the payment');
        router.push(data.paymentUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start the payment');
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  if (hidden || !status || dismissed) return null;
  const deadlines = [...status.overdue, ...status.upcoming].slice(0, 3);
  const renewal = status.renewal && status.renewal.options.length > 0 ? status.renewal : null;
  if (deadlines.length === 0 && !renewal) return null;
  const cheapest = renewal ? renewal.options.reduce((a, b) => (a.totalEur <= b.totalEur ? a : b)) : null;

  return (
    <>
      <div
        role="alert"
        className="fixed inset-x-0 bottom-0 z-[90] border-t-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-gray-900 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]"
      >
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-2">
            {deadlines.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={d.overdue ? 'font-semibold text-red-700' : ''}>
                  {d.overdue ? 'Expired deadline' : 'Payment due'}: <strong>{euro(d.restEur)}</strong> — {d.detail}, expiring on{' '}
                  <strong>{dmy(d.dueDate)}</strong>.
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => startPayment({ action: 'pay-deadline', deadlineId: d.id }, d.id)}
                  className="inline-flex items-center gap-1 rounded bg-[#7a1f2e] px-3 py-1 text-xs font-bold text-white hover:bg-[#5c1824] disabled:opacity-60"
                >
                  {busy === d.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  Pay now
                </button>
              </div>
            ))}
            {renewal && cheapest && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Your subscription <strong>{renewal.versionName}</strong>{' '}
                  {renewal.daysLeft >= 0 ? (
                    <>
                      expires on <strong>{dmy(renewal.currentDateEnd)}</strong>
                      {renewal.daysLeft === 0 ? ' (today)' : ` (in ${renewal.daysLeft} day${renewal.daysLeft === 1 ? '' : 's'})`}
                    </>
                  ) : (
                    <>
                      expired on <strong>{dmy(renewal.currentDateEnd)}</strong>
                    </>
                  )}
                  . Renewal from <strong>{euro(cheapest.totalEur)}</strong>
                  {renewal.renewalDiscountPercent > 0 ? ` (${renewal.renewalDiscountPercent}% renewal discount)` : ''}.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRenewChoice(renewal.options.find((o) => o.code === 'A')?.code ?? renewal.options[0].code);
                    setRenewOpen(true);
                  }}
                  className="rounded bg-[#337ab7] px-3 py-1 text-xs font-bold text-white hover:bg-[#286090]"
                >
                  Renew
                </button>
              </div>
            )}
            {error && <p className="text-red-700">{error}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(DISMISS_KEY, '1');
              } catch {
                /* hidden until reload */
              }
            }}
            className="text-gray-500 hover:text-gray-900"
            aria-label="Close the warning"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {renewOpen && renewal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#7a1f2e] px-4 py-3 text-white">
              <h2 className="font-semibold">Renew {renewal.versionName}</h2>
              <button type="button" onClick={() => setRenewOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1 p-4 text-sm">
              {renewal.options.map((o) => (
                <label
                  key={o.code ?? 'renewal'}
                  className={`flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 rounded px-2 py-1.5 ${
                    renewChoice === o.code ? 'bg-[#7a1f2e]/5 ring-1 ring-[#7a1f2e]/30' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="renewal-option"
                    checked={renewChoice === o.code}
                    onChange={() => setRenewChoice(o.code)}
                    className="accent-[#7a1f2e]"
                  />
                  <span className="min-w-[13rem] font-semibold">{o.label}</span>
                  <span className="font-bold">{euro(o.totalEur)}</span>
                  <span className="text-xs text-gray-600">
                    {o.deadlines > 1 ? `${o.deadlines} payments of ${euro(o.firstDeadlineEur)}` : 'single payment'}
                  </span>
                </label>
              ))}
              {error && <p className="pt-2 text-red-700">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button type="button" onClick={() => setRenewOpen(false)} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => startPayment({ action: 'renew', modality: renewChoice }, 'renew')}
                className="inline-flex items-center gap-2 rounded bg-[#7a1f2e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === 'renew' && <Loader2 className="h-4 w-4 animate-spin" />}
                Renew and pay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
