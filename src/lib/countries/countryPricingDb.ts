import { prisma } from '@/lib/prisma';
import { ensurePromocodeAppSettingsTable } from '@/lib/promocodes/promocodeAppSettings';
import { builtInCountryCurrency } from '@/constants/countriesDashboard.constants';
import {
  clampSliderPercent,
  computeCountryPrice,
  type CountryPriceInfo,
  type CountryPricingHeader,
  type CountryPricingSettings,
} from '@/lib/countries/countryPriceFormula';

const HEADER_KEY = 'country_pricing_header';

type PricingRow = {
  country_name: string;
  annual_income: unknown;
  income_currency: string | null;
  slider_percent: unknown;
  currency_code: string | null;
  currency_description: string | null;
  eur_to_local: unknown;
  usd_to_local: unknown;
};

function isMysql(): boolean {
  return (process.env.DATABASE_URL || '').startsWith('mysql');
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = num(value);
  return n != null && n > 0 ? n : null;
}

function keyOf(name: string): string {
  return name.trim().toLowerCase();
}

let tableReady = false;

export async function ensureCountryPricingTable(): Promise<void> {
  if (tableReady || !isMysql()) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS country_pricing (
      country_name VARCHAR(100) NOT NULL PRIMARY KEY,
      annual_income DECIMAL(14,2) NULL,
      income_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      slider_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
      currency_code VARCHAR(10) NULL,
      currency_description VARCHAR(100) NULL,
      eur_to_local DECIMAL(20,6) NULL,
      usd_to_local DECIMAL(20,6) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

async function tableColumns(table: string): Promise<Set<string>> {
  if (!isMysql()) return new Set();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      table,
    );
    return new Set(rows.map((r) => String(r.COLUMN_NAME)));
  } catch {
    return new Set();
  }
}

/** Pricing columns of the PHP `countries` table (movesbook.net), when they were imported. */
async function loadLegacyCountries(): Promise<Map<string, CountryPricingSettings>> {
  const result = new Map<string, CountryPricingSettings>();
  const cols = await tableColumns('countries');
  if (!cols.has('name')) return result;
  const pick = (col: string) => (cols.has(col) ? `\`${col}\`` : `NULL`);
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT name,
              ${pick('annual_income')} AS annual_income,
              ${pick('currency_type')} AS currency_type,
              ${pick('currency')} AS currency,
              ${pick('description')} AS description,
              ${pick('exchange_EUR')} AS exchange_eur,
              ${pick('exchange_EUR1')} AS exchange_eur1,
              ${pick('exchange_USD')} AS exchange_usd,
              ${pick('exchange_USD1')} AS exchange_usd1
       FROM countries`,
    );
    for (const row of rows) {
      const name = String(row.name ?? '').trim();
      if (!name) continue;
      const eurPerUnit = positive(row.exchange_eur);
      const usdPerUnit = positive(row.exchange_usd);
      result.set(keyOf(name), {
        countryName: name,
        annualIncome: positive(row.annual_income),
        incomeCurrency: String(row.currency_type ?? '').toUpperCase() === 'USD' ? 'USD' : 'EUR',
        sliderPercent: 0,
        currencyCode: String(row.currency ?? '').trim().toUpperCase(),
        currencyDescription: String(row.description ?? '').trim(),
        eurToLocal: positive(row.exchange_eur1) ?? (eurPerUnit ? 1 / eurPerUnit : null),
        usdToLocal: positive(row.exchange_usd1) ?? (usdPerUnit ? 1 / usdPerUnit : null),
      });
    }
  } catch (e) {
    console.error('Country pricing: cannot read legacy countries table', e);
  }
  return result;
}

async function loadLegacyHeader(): Promise<Partial<CountryPricingHeader>> {
  const cols = await tableColumns('income_virtual_costs');
  if (!cols.has('our_annual_income')) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM income_virtual_costs ORDER BY id DESC LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return {};
    return {
      ourAnnualIncomeEur: positive(row.our_annual_income) ?? undefined,
      costVirtualProduct: positive(row.cost_virtual_product) ?? undefined,
      usdToEur: positive(row.usd_to_eur_ratio) ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function getCountryPricingHeader(): Promise<CountryPricingHeader> {
  await ensurePromocodeAppSettingsTable();
  let stored: Partial<CountryPricingHeader> = {};
  if (isMysql()) {
    const rows = await prisma.$queryRawUnsafe<{ setting_value: string | null }[]>(
      `SELECT setting_value FROM promocode_app_settings WHERE setting_key = ? LIMIT 1`,
      HEADER_KEY,
    );
    try {
      stored = rows[0]?.setting_value ? JSON.parse(String(rows[0].setting_value)) : {};
    } catch {
      stored = {};
    }
  }
  const legacy = Object.keys(stored).length > 0 ? {} : await loadLegacyHeader();
  return {
    ourAnnualIncomeEur: positive(stored.ourAnnualIncomeEur) ?? legacy.ourAnnualIncomeEur ?? 0,
    costVirtualProduct: positive(stored.costVirtualProduct) ?? legacy.costVirtualProduct ?? 0,
    usdToEur: positive(stored.usdToEur) ?? legacy.usdToEur ?? 0,
  };
}

export async function saveCountryPricingHeader(
  header: Partial<CountryPricingHeader>,
): Promise<CountryPricingHeader> {
  const current = await getCountryPricingHeader();
  const next: CountryPricingHeader = {
    ourAnnualIncomeEur: num(header.ourAnnualIncomeEur) ?? current.ourAnnualIncomeEur,
    costVirtualProduct: num(header.costVirtualProduct) ?? current.costVirtualProduct,
    usdToEur: num(header.usdToEur) ?? current.usdToEur,
  };
  if (isMysql()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO promocode_app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      HEADER_KEY,
      JSON.stringify(next),
    );
  }
  return next;
}

function rowToSettings(row: PricingRow): CountryPricingSettings {
  return {
    countryName: row.country_name,
    annualIncome: positive(row.annual_income),
    incomeCurrency: String(row.income_currency ?? '').toUpperCase() === 'USD' ? 'USD' : 'EUR',
    sliderPercent: clampSliderPercent(num(row.slider_percent) ?? 0),
    currencyCode: String(row.currency_code ?? '').trim().toUpperCase(),
    currencyDescription: String(row.currency_description ?? '').trim(),
    eurToLocal: positive(row.eur_to_local),
    usdToLocal: positive(row.usd_to_local),
  };
}

function withBuiltInCurrency(settings: CountryPricingSettings): CountryPricingSettings {
  const builtIn = builtInCountryCurrency(settings.countryName);
  if (!builtIn) return settings;
  const sameCurrency = !settings.currencyCode || settings.currencyCode === builtIn.currencyCode;
  return {
    ...settings,
    currencyCode: settings.currencyCode || builtIn.currencyCode,
    eurToLocal: settings.eurToLocal ?? (sameCurrency ? builtIn.eurToLocal : null),
    usdToLocal: settings.usdToLocal ?? (sameCurrency ? builtIn.usdToLocal : null),
  };
}

function emptySettings(countryName: string): CountryPricingSettings {
  return {
    countryName,
    annualIncome: null,
    incomeCurrency: 'EUR',
    sliderPercent: 0,
    currencyCode: '',
    currencyDescription: '',
    eurToLocal: null,
    usdToLocal: null,
  };
}

/** All countries with saved or imported pricing, keyed by lower-case country name. */
export async function listCountryPricing(): Promise<Map<string, CountryPricingSettings>> {
  const merged = await loadLegacyCountries();
  if (isMysql()) {
    await ensureCountryPricingTable();
    const rows = await prisma.$queryRawUnsafe<PricingRow[]>(`SELECT * FROM country_pricing`);
    for (const row of rows) merged.set(keyOf(row.country_name), rowToSettings(row));
  }
  for (const [key, value] of merged) merged.set(key, withBuiltInCurrency(value));
  return merged;
}

export async function getCountryPricingSettings(countryName: string): Promise<CountryPricingSettings> {
  const name = countryName.trim();
  if (!name) return emptySettings('');
  if (isMysql()) {
    await ensureCountryPricingTable();
    const rows = await prisma.$queryRawUnsafe<PricingRow[]>(
      `SELECT * FROM country_pricing WHERE country_name = ? LIMIT 1`,
      name,
    );
    if (rows[0]) return withBuiltInCurrency(rowToSettings(rows[0]));
  }
  const legacy = (await loadLegacyCountries()).get(keyOf(name));
  return withBuiltInCurrency(legacy ?? emptySettings(name));
}

export async function saveCountryPricingSettings(
  input: CountryPricingSettings,
): Promise<CountryPricingSettings> {
  const name = input.countryName.trim().slice(0, 100);
  if (!name) throw new Error('Country name is required');
  await ensureCountryPricingTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO country_pricing
       (country_name, annual_income, income_currency, slider_percent, currency_code,
        currency_description, eur_to_local, usd_to_local)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       annual_income = VALUES(annual_income),
       income_currency = VALUES(income_currency),
       slider_percent = VALUES(slider_percent),
       currency_code = VALUES(currency_code),
       currency_description = VALUES(currency_description),
       eur_to_local = VALUES(eur_to_local),
       usd_to_local = VALUES(usd_to_local)`,
    name,
    positive(input.annualIncome),
    input.incomeCurrency === 'USD' ? 'USD' : 'EUR',
    clampSliderPercent(input.sliderPercent),
    input.currencyCode.trim().toUpperCase().slice(0, 10) || null,
    input.currencyDescription.trim().slice(0, 100) || null,
    positive(input.eurToLocal),
    positive(input.usdToLocal),
  );
  return getCountryPricingSettings(name);
}

/** Price multiplier + currency for a country (registration, payment). */
export async function getCountryPriceInfo(countryName: string): Promise<CountryPriceInfo> {
  const name = countryName.trim();
  const [header, settings] = await Promise.all([
    getCountryPricingHeader(),
    getCountryPricingSettings(name),
  ]);
  const { factor } = computeCountryPrice(header, settings);
  return {
    country: name,
    factor,
    currencyCode: settings.currencyCode || 'EUR',
    currencyDescription: settings.currencyDescription,
    eurToLocal: settings.currencyCode && settings.currencyCode !== 'EUR' ? settings.eurToLocal : 1,
  };
}
