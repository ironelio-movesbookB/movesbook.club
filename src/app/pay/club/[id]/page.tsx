'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type PaymentView = {
  id: string;
  status: 'pending' | 'paid';
  amountEur: number;
  description: string;
  entityName: string;
  memberName: string;
  provider: 'stripe' | 'paypal';
};

type PageProps = {
  params: { id: string };
  searchParams: { provider?: string; session_id?: string; token?: string; cancelled?: string };
};

function euro(amount: number): string {
  return `€ ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ClubMemberPayPage({ params, searchParams }: PageProps) {
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    searchParams.cancelled ? 'The payment was cancelled. You can try again.' : '',
  );
  const confirmStarted = useRef(false);

  const loadPayment = useCallback(
    () =>
      fetch(`/api/club-member-payments/${encodeURIComponent(params.id)}`).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Payment not found');
        setPayment(data as PaymentView);
      }),
    [params.id],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadPayment()
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Payment not found');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadPayment]);

  useEffect(() => {
    const returning =
      (searchParams.provider === 'stripe' && searchParams.session_id) ||
      (searchParams.provider === 'paypal' && searchParams.token);
    if (!returning || confirmStarted.current) return;
    confirmStarted.current = true;
    setBusy(true);
    void fetch(`/api/club-member-payments/${encodeURIComponent(params.id)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: searchParams.session_id,
        orderId: searchParams.token,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'The payment was not completed');
        return loadPayment();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'The payment was not completed');
      })
      .finally(() => setBusy(false));
  }, [loadPayment, params.id, searchParams.provider, searchParams.session_id, searchParams.token]);

  const pay = async () => {
    if (!payment) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/club-member-payments/${encodeURIComponent(payment.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start the payment');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-950">Pay your club</h1>
        {loading ? (
          <p className="mt-6 flex items-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading the payment
          </p>
        ) : !payment ? (
          <p className="mt-6 text-sm text-red-700">{error || 'Payment not found'}</p>
        ) : payment.status === 'paid' ? (
          <div className="mt-6">
            <p className="text-lg font-semibold text-green-800">Payment received</p>
            <p className="mt-2 text-sm text-gray-700">
              {euro(payment.amountEur)} is paid to {payment.entityName}. You can close this page.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-gray-600">{payment.description}</p>
            <p className="mt-1 text-sm text-gray-600">Paying to {payment.entityName}</p>
            <p className="mt-4 text-3xl font-semibold text-gray-950">{euro(payment.amountEur)}</p>
            {notice ? <p className="mt-3 text-sm text-amber-800">{notice}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void pay()}
              className="mt-6 w-full rounded bg-[#7d0e1f] px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
            >
              {busy
                ? 'Opening the payment…'
                : payment.provider === 'paypal'
                  ? `Pay ${euro(payment.amountEur)} with PayPal`
                  : `Pay ${euro(payment.amountEur)} by card`}
            </button>
            <p className="mt-3 text-xs text-gray-500">
              {payment.provider === 'paypal'
                ? 'PayPal opens next. The money goes to the club PayPal account.'
                : 'The card page opens next. The money goes to the club Stripe account.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
