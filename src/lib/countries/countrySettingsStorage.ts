import { getRegionsForCountry } from '@/constants/countryRegions.constants';
import { COUNTRIES } from '@/lib/news/countries';
import type {
  CountryExtendedSettings,
  CountryPartnerRecord,
  CountryRegionItem,
} from '@/app/countries/countryEditTypes';

const STORAGE_KEY = 'movesbook_country_settings_v1';
const GLOBAL_SETTINGS_KEY = 'movesbook_countries_global_v1';

type StoredMap = Record<string, CountryExtendedSettings>;

export type CountriesPageGlobalSettings = {
  annualIncomeEur: string;
  costVirtualProduct: string;
  usdEur: string;
};

const DEFAULT_COUNTRIES_PAGE_GLOBAL: CountriesPageGlobalSettings = {
  annualIncomeEur: '0.00',
  costVirtualProduct: '0.00',
  usdEur: '',
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function partnerRecords(names: string[]): CountryPartnerRecord[] {
  return names.map((name) => ({
    id: newId(),
    name,
    operative: true,
    description: '',
    extraRows: ['', '', ''],
  }));
}

function regionItems(names: string[]): CountryRegionItem[] {
  return names.map((name) => ({ id: newId(), name }));
}

const AFGHANISTAN_REGIONS = [
  'Badakhshan',
  'Badghis',
  'Baghlan',
  'Balkh',
  'Bamiyan',
  'Daikondi',
  'Faryab',
  'Farah',
  'Ghazni',
  'Ghor',
  'Helmand',
  'Herat',
  'Jowzjan',
  'Kabul',
  'Kandahar',
  'Kapisa',
  'Khost',
  'Kunar',
  'Kunduz',
  'Laghman',
  'Logar',
  'Nangarhar',
  'Nimroz',
  'Nuristan',
  'Paktia',
  'Paktika',
  'Panjshir',
  'Parwan',
  'Samangan',
  'Sar-e Pol',
  'Takhar',
  'Urozgan',
  'Wardak',
  'Zabul',
];

function defaultExtendedForCountry(countryId: number, countryName: string): CountryExtendedSettings {
  if (countryId === 1 && countryName === 'Afghanistan') {
    return {
      regions: regionItems(AFGHANISTAN_REGIONS),
      distributors: partnerRecords([
        'Pewandar Informatics',
        'Harsh Tester',
        'test',
        'dgfdgdf',
        'new one',
        'very good',
      ]),
      dealers: partnerRecords(['Prakash', 'Afgan dealer', 'sfdfsdfsdf', 'Test', 'Test123321']),
      annualIncome: '7000.00',
      incomeCurrency: 'EUR',
      ratioWithUs: '71.4',
      percentageOr: 45,
      virtualCost: '21.74',
      currencyDescription: 'Afghani',
      exchangeEurPerUnit: '0.0109',
      exchange1Eur: '91.350',
      exchangeUsdPerUnit: '0.0130',
      exchange1Usd: '77.200',
      countryPictureName: '',
    };
  }

  const regionNames = getRegionsForCountry(countryName).filter((r) => r !== 'Other' && r !== 'Whole country');
  return {
    regions: regionItems(regionNames),
    distributors: [],
    dealers: [],
    annualIncome: '7000.00',
    incomeCurrency: 'EUR',
    ratioWithUs: '71.4',
    percentageOr: 45,
    virtualCost: '21.74',
    currencyDescription: '',
    exchangeEurPerUnit: '1.0000',
    exchange1Eur: '1.000',
    exchangeUsdPerUnit: '1.0000',
    exchange1Usd: '1.080',
    countryPictureName: '',
  };
}

function readAll(): StoredMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: StoredMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCountryExtendedSettings(
  countryId: number,
  countryName: string,
): CountryExtendedSettings {
  const key = String(countryId);
  const stored = readAll()[key];
  if (stored) return stored;
  return defaultExtendedForCountry(countryId, countryName);
}

/**
 * Regions for a country dropdown: prefers Countries-admin saved list
 * (localStorage from /countries → Edit → Regions), else static defaults.
 */
export function resolveRegionsForCountryName(countryName: string): string[] {
  const trimmed = countryName.trim();
  if (!trimmed) return [];

  if (typeof window !== 'undefined') {
    const idx = COUNTRIES.findIndex(
      (name) => name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (idx >= 0) {
      const countryId = idx + 1;
      const stored = readAll()[String(countryId)];
      if (stored?.regions?.length) {
        const names = stored.regions
          .map((r) => String(r.name || '').trim())
          .filter(Boolean);
        if (names.length) {
          return Array.from(new Set([...names, 'Other']));
        }
      }
    }
  }

  return getRegionsForCountry(trimmed);
}

export function saveCountryExtendedSettings(
  countryId: number,
  settings: CountryExtendedSettings,
): void {
  const key = String(countryId);
  const all = readAll();
  all[key] = settings;
  writeAll(all);
}

export function createRegion(name: string): CountryRegionItem {
  return { id: newId(), name };
}

export function createPartner(name: string): CountryPartnerRecord {
  return {
    id: newId(),
    name,
    operative: true,
    description: '',
    extraRows: ['', '', ''],
  };
}

export function loadCountriesPageGlobalSettings(): CountriesPageGlobalSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_COUNTRIES_PAGE_GLOBAL };
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_COUNTRIES_PAGE_GLOBAL };
    const parsed = JSON.parse(raw) as Partial<CountriesPageGlobalSettings>;
    return {
      annualIncomeEur:
        typeof parsed.annualIncomeEur === 'string'
          ? parsed.annualIncomeEur
          : DEFAULT_COUNTRIES_PAGE_GLOBAL.annualIncomeEur,
      costVirtualProduct:
        typeof parsed.costVirtualProduct === 'string'
          ? parsed.costVirtualProduct
          : DEFAULT_COUNTRIES_PAGE_GLOBAL.costVirtualProduct,
      usdEur: typeof parsed.usdEur === 'string' ? parsed.usdEur : DEFAULT_COUNTRIES_PAGE_GLOBAL.usdEur,
    };
  } catch {
    return { ...DEFAULT_COUNTRIES_PAGE_GLOBAL };
  }
}

export function saveCountriesPageGlobalSettings(settings: CountriesPageGlobalSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
}
