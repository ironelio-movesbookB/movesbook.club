'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const AUDIENCE: Record<string, string> = {
  coach: "Coach's Members Accounts",
  team: "Team Member's Accounts",
  club: "Club Members' Accounts",
};

function AccountSection({ kind }: { kind: 'price-list' | 'requests' }) {
  const searchParams = useSearchParams();
  const audienceKey = searchParams?.get('audience') ?? '';
  const audience = AUDIENCE[audienceKey] ?? "Club Members' Accounts";
  const title = kind === 'price-list' ? 'Price list' : 'Requests of accounts';
  return (
    <div className="min-h-full bg-[#ececec] p-6">
      <div className="border border-gray-400 bg-[#b8b8b8] px-4 py-3">
        <h1 className="text-xl font-semibold text-gray-800">
          {audience} — <span className="text-red-600">{title}</span>
        </h1>
      </div>
      <div className="border border-t-0 border-gray-300 bg-white px-4 py-6 text-sm text-gray-700">
        {kind === 'price-list' ? `Price list for ${audience}.` : `Requests of accounts for ${audience}.`}
      </div>
    </div>
  );
}

export function AccountSectionPage({ kind }: { kind: 'price-list' | 'requests' }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#666]">Loading…</div>}>
      <AccountSection kind={kind} />
    </Suspense>
  );
}
