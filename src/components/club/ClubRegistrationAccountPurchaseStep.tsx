'use client';

import { useEffect, useState } from 'react';
import { getClubAccountPackDisplayRows, packToDisplayRow } from '@/lib/admin/clubAccountPackPricing';
import { fetchClubPurchaseAccountsSettings } from '@/lib/admin/clubPurchaseAccountsMock';
import ClubAccountPackPricingSections from '@/components/club/ClubAccountPackPricingSections';

export type ClubRegistrationAccountSelection = Record<string, number | null>;

type ClubRegistrationAccountPurchaseStepProps = {
  selectedPacks: ClubRegistrationAccountSelection;
  onSelectPack: (versionKey: string, packIndex: number | null) => void;
};

export default function ClubRegistrationAccountPurchaseStep({
  selectedPacks,
  onSelectPack,
}: ClubRegistrationAccountPurchaseStepProps) {
  const [packs, setPacks] = useState(getClubAccountPackDisplayRows);
  useEffect(() => {
    let cancelled = false;
    void fetchClubPurchaseAccountsSettings().then((settings) => {
      if (!cancelled) setPacks(settings.accountPacks.map(packToDisplayRow));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="border-t border-gray-400 bg-white px-4 py-4">
      <h3 className="mb-3 text-sm font-bold text-gray-900">
        Purchase club member accounts (registration only)
      </h3>
      <p className="mb-4 text-xs text-gray-600">
        Select account packs for Base, Premium (Special), or Professional versions. This step is
        available only while creating the club — not after registration is complete.
      </p>
      <ClubAccountPackPricingSections
        packs={packs}
        mode="registration"
        selectedPacks={selectedPacks}
        onSelectPack={onSelectPack}
      />
    </div>
  );
}

export function useClubRegistrationAccountSelection() {
  const [selectedPacks, setSelectedPacks] = useState<ClubRegistrationAccountSelection>({
    base: null,
    premium: null,
    pro: null,
  });

  const onSelectPack = (versionKey: string, packIndex: number | null) => {
    setSelectedPacks((prev) => ({ ...prev, [versionKey]: packIndex }));
  };

  return { selectedPacks, onSelectPack };
}
