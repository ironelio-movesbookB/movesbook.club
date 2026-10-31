'use client';

import { Info } from 'lucide-react';
import type { ClubMemberCapacityStats } from '@/lib/club/clubMemberCapacity';
import { getAddAvailableSlotsButtonLabels } from '@/constants/memberArchiveSlotsLongText';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

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
  const { currentLanguage } = useLanguage();
  const language = normalizeToolsLanguage(currentLanguage);
  const addSlotsLabels = getAddAvailableSlotsButtonLabels(language);
  const residualLabel = capacity.unlimited
    ? language === 'it'
      ? 'Illimitati'
      : 'Unlimited'
    : String(capacity.availableSlots ?? 0);

  const cardTitles =
    language === 'it'
      ? {
          current: 'Membri attuali',
          total: 'Posti totali disponibili',
          added: 'Membri aggiunti',
          residual: 'Posti residuali',
          statusAccounts: 'Stato account',
          expiration: 'Data di scadenza dell’abbonamento:',
        }
      : {
          current: 'Current Members',
          total: 'Total available slots',
          added: 'Members added',
          residual: 'Residual slots',
          statusAccounts: 'Status accounts',
          expiration: 'Expiration date of the Subscription:',
        };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={cardTitles.current}
            value={String(capacity.currentMembers)}
            gradient="from-emerald-500 to-emerald-600"
          />
          <StatCard
            title={cardTitles.total}
            value={String(capacity.membersPurchased)}
            gradient="from-sky-500 to-blue-600"
          />
          <StatCard
            title={cardTitles.added}
            value={String(capacity.membersAdded)}
            gradient="from-violet-500 to-purple-600"
          />
          <StatCard
            title={cardTitles.residual}
            value={residualLabel}
            gradient="from-fuchsia-400 to-purple-500"
          />
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3">
          <div className="flex flex-wrap items-stretch gap-3">
            <button
              type="button"
              onClick={onPurchaseMembers}
              className="rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-left text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800"
            >
              <span className="block leading-tight">{addSlotsLabels.title}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-snug opacity-95">
                {addSlotsLabels.subtitle}
              </span>
            </button>
            <button
              type="button"
              onClick={onStatusAccounts}
              className="rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-sm font-bold text-white shadow hover:from-red-600 hover:to-red-800"
            >
              {cardTitles.statusAccounts}
            </button>
          </div>
          <p className="flex items-start gap-1 text-sm font-semibold text-red-600">
            <span>
              {cardTitles.expiration}{' '}
              {capacity.subscriptionExpirationLabel || '—'}
            </span>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          </p>
        </div>
      </div>
    </div>
  );
}
