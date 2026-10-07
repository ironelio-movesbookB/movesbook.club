'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Loader2 } from 'lucide-react';

const FALLBACK_TEXT =
  'You have successfully registered. Open your email and activate your account.';

type PageProps = { searchParams: { p?: string } };

/** After payment (or test/free registration): `Payment_successfully` long text in the user's language. */
export default function RegistrationSuccessPage({ searchParams }: PageProps) {
  const paymentId = searchParams.p ?? '';
  const [html, setHtml] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!paymentId) {
      setHtml('');
      return;
    }
    let cancelled = false;
    fetch(`/api/registration-payments/${encodeURIComponent(paymentId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { status?: string; successHtml?: string | null } | null) => {
        if (cancelled) return;
        if (data?.status === 'pending') setPending(true);
        setHtml(data?.successHtml ?? '');
      })
      .catch(() => !cancelled && setHtml(''));
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-12 relative">
      <div className="fixed inset-0 z-0">
        <Image src="/images/licensed-image.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black bg-opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-xl bg-white rounded-xl shadow-2xl p-6 space-y-4">
        {html === null ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : pending ? (
          <p className="text-gray-800">
            The payment is not completed yet.{' '}
            <Link href={`/register/payment/${encodeURIComponent(paymentId)}`} className="text-[#8b2942] underline">
              Go to the payment page
            </Link>
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 className="w-8 h-8 shrink-0" />
              <span className="text-xl font-bold">Movesbook</span>
            </div>
            {html ? (
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="text-gray-800">{FALLBACK_TEXT}</p>
            )}
            <Link
              href="/"
              className="inline-block rounded-lg bg-[#8b2942] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6f1f34]"
            >
              Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
