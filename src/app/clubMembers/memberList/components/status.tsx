'use client';

import { Info } from 'lucide-react';
import type { ClubMemberCapacityStats } from '@/lib/club/clubMemberCapacity';

type ClubMemberArchiveHeaderProps = {
  capacity: ClubMemberCapacityStats;
  onPurchaseMembers?: () => void;
  onStatusAccounts?: () => void;
};

function StatCard({
  title,
  value,
  gradient,
}: {
  title: string;
  value: string;
  gradient: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl bg-gradient-to-r ${gradient} p-5 text-white shadow-md`}
    >
      <p className="truncate text-sm font-medium opacity-95">{title}</p>
      <p className="mt-2 text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

export default function ClubMemberArchiveHeader({
  capacity,
  onPurchaseMembers,
  onStatusAccounts,
}: ClubMemberArchiveHeaderProps) {
  const availableLabel = capacity.unlimited
    ? 'Unlimited'
    : String(capacity.availableSlots ?? 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Archive of Users</h1>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Current Members"
            value={String(capacity.currentMembers)}
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatCard
            title="Members purchased"
            value={String(capacity.membersPurchased)}
            gradient="from-sky-500 to-blue-600"
          />
          <StatCard
            title="Members added"
            value={String(capacity.membersAdded)}
            gradient="from-violet-500 to-purple-600"
          />
          <StatCard
            title="Available Slots"
            value={availableLabel}
            gradient="from-fuchsia-400 to-purple-500"
          />
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3">
          <div className="flex flex-wrap items-stretch gap-3">
            <button
              type="button"
              onClick={onPurchaseMembers}
              className="rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800"
            >
              Purchase members
            </button>
            <button
              type="button"
              onClick={onStatusAccounts}
              className="rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800"
            >
              Status accounts
            </button>
          </div>
          <p className="flex items-start gap-1 text-sm font-semibold text-red-600">
            <span>
              Expiration date of the Subscription:{' '}
              {capacity.subscriptionExpirationLabel || '—'}
            </span>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          </p>
        </div>
      </div>
    </div>
  );
}
