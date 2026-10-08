import type { ClubPurchaseAccountsSettings } from '@/types/clubPurchaseAccounts';

function calcTotals(pack: ClubPurchaseAccountsSettings['accountPacks'][0]) {
  return pack.packSizes.map((size, i) => {
    const unit = pack.unitPrices[i] ?? 0;
    return Math.round(size * unit * 100) / 100;
  });
}

const DEFAULT_SETTINGS: ClubPurchaseAccountsSettings = {
  paymentWithoutCreditCard: true,
  sendMoneyLaterDays: 30,
  activationMessageEnabled: true,
  activationDaysAfterAssignment: 30,
  activationMessageByLang: { en: '' },
  accountPacks: [
    {
      versionKey: 'base',
      versionLabel: 'Version Base',
      headerColor: '#5cb85c',
      packSizes: [200, 300, 500, 1000],
      packEnabled: [true, true, true, true],
      unitPrices: [7, 3, 5, 4],
      totalPrices: [1400, 900, 2000, 4000],
      standardPrice: 4.9,
      resellingSuggestion: 14.9,
      durationDays: 10,
    },
    {
      versionKey: 'premium',
      versionLabel: 'Version Premium',
      headerColor: '#9b59b6',
      packSizes: [200, 300, 500, 1000],
      packEnabled: [true, true, true, true],
      unitPrices: [5, 6, 2, 8],
      totalPrices: [1000, 1800, 1000, 8000],
      standardPrice: 9.9,
      resellingSuggestion: 6,
      durationDays: 20,
    },
    {
      versionKey: 'pro',
      versionLabel: 'Version Professional',
      headerColor: '#c0392b',
      packSizes: [200, 300, 500, 1000],
      packEnabled: [true, true, true, true],
      unitPrices: [2, 5, 6, 2],
      totalPrices: [400, 1500, 3000, 2000],
      standardPrice: 19.9,
      resellingSuggestion: 29.9,
      durationDays: 40,
    },
  ],
};

let cachedSettings: ClubPurchaseAccountsSettings = structuredClone(DEFAULT_SETTINGS);

export function getClubPurchaseAccountsSettings(): ClubPurchaseAccountsSettings {
  return structuredClone(cachedSettings);
}

/** Async alias used by club settings / registration purchase UI. */
export async function fetchClubPurchaseAccountsSettings(): Promise<ClubPurchaseAccountsSettings> {
  return getClubPurchaseAccountsSettings();
}

export function saveClubPurchaseAccountsSettings(
  settings: ClubPurchaseAccountsSettings,
): ClubPurchaseAccountsSettings {
  const next = structuredClone(settings);
  next.accountPacks = next.accountPacks.map((pack) => ({
    ...pack,
    totalPrices: calcTotals(pack),
  }));
  cachedSettings = next;
  return cachedSettings;
}

export function recalcPackTotals(
  pack: ClubPurchaseAccountsSettings['accountPacks'][0],
): ClubPurchaseAccountsSettings['accountPacks'][0] {
  return {
    ...pack,
    totalPrices: calcTotals(pack),
  };
}
