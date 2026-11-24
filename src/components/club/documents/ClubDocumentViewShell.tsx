'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';

type Props = {
  clubName: string;
  logoUrl: string | null;
  title: string;
  children: ReactNode;
};

/** Public document chrome: club logo left, Movesbook logo right. */
export default function ClubDocumentViewShell({
  clubName,
  logoUrl,
  title,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={clubName || 'Club'}
                className="h-12 w-12 rounded object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-teal-800 text-xs font-bold text-white">
                {(clubName || 'C').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{clubName}</p>
              <p className="truncate text-xs text-gray-500">Document</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Image
              src="/img/logo.png"
              alt="Movesbook"
              width={140}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}
