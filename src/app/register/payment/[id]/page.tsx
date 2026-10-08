'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CreditCard, Loader2 } from 'lucide-react';
import { formatEuroAmount, formatLocalAmount } from '@/lib/countries/countryPriceFormula';

type PaymentView = {
  id: string;
  status: 'pending' | 'paid' | 'test' | 'free';
  versionName: string;
  specialOffer: boolean;
  amountEur: number;
  amountLocal: number | null;
  currencyCode: string;
  name: string;
  username: string;
  providers: { stripe: boolean; paypal: boolean };
};

type Provider = 'paypal' | 'stripe';

type PageProps = {
  params: { id: string };
  searchParams: { provider?: string; session_id?: string; token?: string; cancelled?: string };
};

export default function RegistrationPaymentPage({ params, searchParams }: PageProps) {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    searchParams.cancelled ? 'The payment was cancelled. You can try again.' : '',
  );
  const confirmStarted = useRef(false);

  const successUrl = `/register/success?p=${encodeURIComponent(params.id)}`;
  const returningFrom: Provider | null =
    searchParams.provider === 'stripe' && searchParams.session_id
      ? 'stripe'
      : searchParams.provider === 'paypal' && searchParams.token
        ? 'paypal'
        : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/registration-payments/${encodeURIComponent(params.id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment not found');
        if (cancelled) return;
        const view = data as PaymentView;
        if (view.status !== 'pending') {
          router.replace(successUrl);
          return;
        }
        setPayment(view);
        setProvider(view.providers.paypal ? 'paypal' : view.providers.stripe ? 'stripe' : null);

        if (returningFrom && !confirmStarted.current) {
          confirmStarted.current = true;
          setBusy(true);
          setNotice('Checking your payment…');
          const confirmRes = await fetch(
            `/api/registration-payments/${encodeURIComponent(params.id)}/confirm`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: returningFrom,
                ref: returningFrom === 'stripe' ? searchParams.session_id : searchParams.token,
              }),
            },
          );
          const confirm = await confirmRes.json().catch(() => ({}));
          if (cancelled) return;
          if (confirmRes.ok && confirm.paid) {
            router.replace(confirm.next || successUrl);
            return;
          }
          setNotice('');
          setError(confirm.error || 'The payment was not completed. You can try again.');
          setBusy(false);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the payment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handlePay = async () => {
    if (!provider) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/registration-payments/${encodeURIComponent(params.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start the payment');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the payment');
      setBusy(false);
    }
  };

  const localText =
    payment && payment.amountLocal != null && payment.currencyCode && payment.currencyCode !== 'EUR'
      ? formatLocalAmount(payment.amountLocal, payment.currencyCode)
      : '';
  const noProvider = payment && !payment.providers.paypal && !payment.providers.stripe;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-12 relative">
      <div className="fixed inset-0 z-0">
        <Image src="/images/licensed-image.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black bg-opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-[#8b2942] px-6 py-4 text-white">
          <h1 className="text-xl font-bold">Movesbook</h1>
          <p className="text-sm opacity-90">Complete your registration</p>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          ) : !payment ? (
            <p className="text-red-600">{error || 'Payment not found'}</p>
          ) : (
            <>
              <div>
                <p className="text-lg text-gray-800">
                  Welcome <span className="font-semibold">{payment.name || payment.username}</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  To activate your account, pay the subscription below.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-600">
                  {payment.versionName}
                  {payment.specialOffer ? (
                    <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Special offer
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-gray-700">Amount to pay</div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatEuroAmount(payment.amountEur)}
                </div>
                {localText ? <div className="text-base text-gray-700">= {localText}</div> : null}
              </div>

              {noProvider ? (
                <p className="text-amber-700 text-sm">
                  Online payment is not available at the moment. Please try again later.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Payment method</div>
                  {payment.providers.paypal ? (
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="provider"
                        checked={provider === 'paypal'}
                        onChange={() => setProvider('paypal')}
                        disabled={busy}
                      />
                      <span className="font-bold text-[#003087]">
                        Pay<span className="text-[#009cde]">Pal</span>
                      </span>
                    </label>
                  ) : null}
                  {payment.providers.stripe ? (
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="provider"
                        checked={provider === 'stripe'}
                        onChange={() => setProvider('stripe')}
                        disabled={busy}
                      />
                      <CreditCard className="w-5 h-5 text-gray-700" />
                      <span className="font-medium text-gray-800">Credit / debit card</span>
                    </label>
                  ) : null}
                </div>
              )}

              {notice ? <p className="text-sm text-gray-700">{notice}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              {!noProvider ? (
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={busy || !provider}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Pay {formatEuroAmount(payment.amountEur)}
                  {localText ? ` (${localText})` : ''}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
