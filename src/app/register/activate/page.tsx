'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

type PageProps = { searchParams: { token?: string } };

/** Target of the "Activate account" button in the registration email. */
export default function ActivateAccountPage({ searchParams }: PageProps) {
  const token = searchParams.token ?? '';
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not activate the account');
        setMessage(
          data.alreadyActive
            ? 'Your account is already active. You can log in.'
            : 'Your account is now active. You can log in.',
        );
        setState('done');
      })
      .catch((e: unknown) => {
        setMessage(e instanceof Error ? e.message : 'Could not activate the account');
        setState('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-12 relative">
      <div className="fixed inset-0 z-0">
        <Image src="/images/licensed-image.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black bg-opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl p-6 space-y-4 text-center">
        {state === 'loading' ? (
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Activating your account…
          </div>
        ) : (
          <>
            {state === 'done' ? (
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-red-600 mx-auto" />
            )}
            <p className="text-gray-800">{message}</p>
            <Link
              href="/?showLogin=true"
              className="inline-block rounded-lg bg-[#8b2942] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6f1f34]"
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
