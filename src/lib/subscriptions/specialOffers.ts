import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSubscriptionById } from '@/lib/admin/subscriptionSettingsMock';

/** Language codes follow the user's site language (`SUPPORTED_LANGUAGES`). */
export type SpecialOfferLangMap = Record<string, string>;

export type SpecialOfferSettings = {
  versionId: number;
  enabled: boolean;
  titleByLang: SpecialOfferLangMap;
  descriptionByLang: SpecialOfferLangMap;
  /** Languages where the "Still free" counter is shown. */
  counterLangs: string[];
  validFrom: string;
  validTo: string;
  costEuro: number;
  /** 0 = unlimited */
  maxSubscriptions: number;
  counterStart: number;
  logoUrl: string;
};

export type SpecialOfferAdminView = SpecialOfferSettings & {
  id: number | null;
  versionName: string;
  registeredCount: number;
  stillFree: number | null;
  isActiveNow: boolean;
};

export type SpecialOfferPublicView = {
  versionId: number;
  versionName: string;
  title: string;
  description: string;
  costEuro: number;
  validTo: string;
  maxSubscriptions: number;
  stillFree: number | null;
  showCounter: boolean;
  logoUrl: string;
};

export type SpecialOfferRegistration = {
  offerId: number;
  versionId: number;
  versionName: string;
  offerTitle: string;
  costEuro: number;
  dateStart: string;
  dateEnd: string | null;
};

export const TITLE_MAX = 30;
export const DESCRIPTION_MAX = 255;

let tablesEnsured = false;

export async function ensureSpecialOfferTables(): Promise<void> {
  if (tablesEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_special_offers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      versionId INT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      titlesJson TEXT NULL,
      descriptionsJson MEDIUMTEXT NULL,
      counterLangsJson TEXT NULL,
      validFrom DATE NULL,
      validTo DATE NULL,
      costEuro DECIMAL(10,2) NOT NULL DEFAULT 0,
      maxSubscriptions INT NOT NULL DEFAULT 0,
      counterStart INT NOT NULL DEFAULT 0,
      logoUrl VARCHAR(512) NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_special_offer_version (versionId)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_special_offer_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      offerId INT NOT NULL,
      versionId INT NOT NULL,
      versionName VARCHAR(255) NOT NULL,
      offerTitle VARCHAR(255) NULL,
      userId VARCHAR(191) NOT NULL,
      costEuro DECIMAL(10,2) NOT NULL DEFAULT 0,
      dateStart DATE NOT NULL,
      dateEnd DATE NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_sor_offer (offerId),
      KEY idx_sor_user (userId)
    )
  `);
  tablesEnsured = true;
}

type OfferRow = {
  id: number;
  versionId: number;
  enabled: number | boolean;
  titlesJson: string | null;
  descriptionsJson: string | null;
  counterLangsJson: string | null;
  validFrom: Date | string | null;
  validTo: Date | string | null;
  costEuro: Prisma.Decimal | number | string;
  maxSubscriptions: number;
  counterStart: number;
  logoUrl: string | null;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toYmd(value: Date | string | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function todayYmd(): string {
  return toYmd(new Date());
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toYmd(dt);
}

function cleanLangMap(input: unknown, max: number): SpecialOfferLangMap {
  if (!input || typeof input !== 'object') return {};
  const out: SpecialOfferLangMap = {};
  for (const [lang, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const text = value.trim().slice(0, max);
    if (text) out[lang] = text;
  }
  return out;
}

function rowToSettings(row: OfferRow): SpecialOfferSettings {
  return {
    versionId: Number(row.versionId),
    enabled: Boolean(Number(row.enabled)),
    titleByLang: parseJson<SpecialOfferLangMap>(row.titlesJson, {}),
    descriptionByLang: parseJson<SpecialOfferLangMap>(row.descriptionsJson, {}),
    counterLangs: parseJson<string[]>(row.counterLangsJson, []),
    validFrom: toYmd(row.validFrom),
    validTo: toYmd(row.validTo),
    costEuro: Number(row.costEuro) || 0,
    maxSubscriptions: Number(row.maxSubscriptions) || 0,
    counterStart: Number(row.counterStart) || 0,
    logoUrl: row.logoUrl || '',
  };
}

function emptySettings(versionId: number): SpecialOfferSettings {
  return {
    versionId,
    enabled: false,
    titleByLang: {},
    descriptionByLang: {},
    counterLangs: [],
    validFrom: '',
    validTo: '',
    costEuro: 0,
    maxSubscriptions: 0,
    counterStart: 0,
    logoUrl: '',
  };
}

export function versionNameFor(versionId: number): string {
  return getSubscriptionById(versionId)?.name || `Version ${versionId}`;
}

export function versionDurationDays(versionId: number): number {
  const row = getSubscriptionById(versionId);
  return row?.days1 || row?.days2 || 365;
}

function pickLang(map: SpecialOfferLangMap, lang: string): string {
  return map[lang]?.trim() || map.en?.trim() || Object.values(map).find((v) => v?.trim()) || '';
}

function isWithinValidity(settings: SpecialOfferSettings, today = todayYmd()): boolean {
  if (!settings.enabled) return false;
  if (settings.validFrom && today < settings.validFrom) return false;
  if (settings.validTo && today > settings.validTo) return false;
  return true;
}

function computeStillFree(settings: SpecialOfferSettings, registeredCount: number): number | null {
  if (settings.maxSubscriptions <= 0) return null;
  return Math.max(0, settings.maxSubscriptions - settings.counterStart - registeredCount);
}

async function loadOfferRow(versionId: number): Promise<OfferRow | null> {
  await ensureSpecialOfferTables();
  const rows = await prisma.$queryRawUnsafe<OfferRow[]>(
    `SELECT * FROM subscription_special_offers WHERE versionId = ? LIMIT 1`,
    versionId,
  );
  return rows[0] ?? null;
}

async function countRegistrations(offerId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total FROM subscription_special_offer_registrations WHERE offerId = ?`,
    offerId,
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getSpecialOfferAdmin(versionId: number): Promise<SpecialOfferAdminView> {
  const row = await loadOfferRow(versionId);
  const settings = row ? rowToSettings(row) : emptySettings(versionId);
  const registeredCount = row ? await countRegistrations(row.id) : 0;
  return {
    ...settings,
    id: row ? Number(row.id) : null,
    versionName: versionNameFor(versionId),
    registeredCount,
    stillFree: computeStillFree(settings, registeredCount),
    isActiveNow: isWithinValidity(settings),
  };
}

export async function saveSpecialOffer(input: Partial<SpecialOfferSettings> & { versionId: number }) {
  await ensureSpecialOfferTables();
  const titleByLang = cleanLangMap(input.titleByLang, TITLE_MAX);
  const descriptionByLang = cleanLangMap(input.descriptionByLang, DESCRIPTION_MAX);
  const counterLangs = Array.isArray(input.counterLangs)
    ? input.counterLangs.filter((l): l is string => typeof l === 'string')
    : [];
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(input.validFrom || '') ? input.validFrom! : null;
  const validTo = /^\d{4}-\d{2}-\d{2}$/.test(input.validTo || '') ? input.validTo! : null;
  if (validFrom && validTo && validFrom > validTo) {
    throw new Error('The validity start date must be before the end date');
  }
  const costEuro = Math.max(0, Number(input.costEuro) || 0);
  const maxSubscriptions = Math.max(0, Math.floor(Number(input.maxSubscriptions) || 0));
  const counterStart = Math.max(0, Math.floor(Number(input.counterStart) || 0));
  const logoUrl = typeof input.logoUrl === 'string' ? input.logoUrl.trim().slice(0, 512) : '';

  await prisma.$executeRawUnsafe(
    `INSERT INTO subscription_special_offers
       (versionId, enabled, titlesJson, descriptionsJson, counterLangsJson, validFrom, validTo,
        costEuro, maxSubscriptions, counterStart, logoUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled), titlesJson = VALUES(titlesJson),
       descriptionsJson = VALUES(descriptionsJson), counterLangsJson = VALUES(counterLangsJson),
       validFrom = VALUES(validFrom), validTo = VALUES(validTo), costEuro = VALUES(costEuro),
       maxSubscriptions = VALUES(maxSubscriptions), counterStart = VALUES(counterStart),
       logoUrl = VALUES(logoUrl)`,
    input.versionId,
    input.enabled ? 1 : 0,
    JSON.stringify(titleByLang),
    JSON.stringify(descriptionByLang),
    JSON.stringify(counterLangs),
    validFrom,
    validTo,
    costEuro,
    maxSubscriptions,
    counterStart,
    logoUrl || null,
  );
  return getSpecialOfferAdmin(input.versionId);
}

/** Offer shown on /register — null when disabled, expired or not configured. */
export async function getPublicSpecialOffer(
  versionId: number,
  lang: string,
): Promise<SpecialOfferPublicView | null> {
  const row = await loadOfferRow(versionId);
  if (!row) return null;
  const settings = rowToSettings(row);
  if (!isWithinValidity(settings)) return null;
  const registeredCount = await countRegistrations(row.id);
  const stillFree = computeStillFree(settings, registeredCount);
  return {
    versionId,
    versionName: versionNameFor(versionId),
    title: pickLang(settings.titleByLang, lang) || 'Special Offer',
    description: pickLang(settings.descriptionByLang, lang),
    costEuro: settings.costEuro,
    validTo: settings.validTo,
    maxSubscriptions: settings.maxSubscriptions,
    stillFree,
    showCounter: settings.counterLangs.includes(lang),
    logoUrl: settings.logoUrl,
  };
}

/**
 * Reserve a special-offer slot inside the registration transaction (locks the offer row).
 * Throws when the offer is no longer available.
 */
export async function reserveSpecialOfferSlot(
  tx: Prisma.TransactionClient,
  params: { versionId: number; userId: string },
): Promise<SpecialOfferRegistration> {
  const rows = await tx.$queryRawUnsafe<OfferRow[]>(
    `SELECT * FROM subscription_special_offers WHERE versionId = ? LIMIT 1 FOR UPDATE`,
    params.versionId,
  );
  const row = rows[0];
  if (!row) throw new SpecialOfferUnavailableError('This special offer is not available');
  const settings = rowToSettings(row);
  if (!isWithinValidity(settings)) {
    throw new SpecialOfferUnavailableError('This special offer has expired');
  }
  const countRows = await tx.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total FROM subscription_special_offer_registrations WHERE offerId = ?`,
    row.id,
  );
  const stillFree = computeStillFree(settings, Number(countRows[0]?.total ?? 0));
  if (stillFree !== null && stillFree <= 0) {
    throw new SpecialOfferUnavailableError('This special offer is sold out');
  }

  const dateStart = todayYmd();
  const dateEnd = addDaysYmd(dateStart, versionDurationDays(params.versionId));
  const registration: SpecialOfferRegistration = {
    offerId: Number(row.id),
    versionId: params.versionId,
    versionName: versionNameFor(params.versionId),
    offerTitle: pickLang(settings.titleByLang, 'en') || 'Special Offer',
    costEuro: settings.costEuro,
    dateStart,
    dateEnd,
  };
  await tx.$executeRawUnsafe(
    `INSERT INTO subscription_special_offer_registrations
       (offerId, versionId, versionName, offerTitle, userId, costEuro, dateStart, dateEnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    registration.offerId,
    registration.versionId,
    registration.versionName,
    registration.offerTitle,
    params.userId,
    registration.costEuro,
    registration.dateStart,
    registration.dateEnd,
  );
  return registration;
}

export class SpecialOfferUnavailableError extends Error {}

export type SpecialOfferUserRegistration = {
  userId: string;
  offerId: number;
  versionId: number;
  versionName: string;
  offerTitle: string;
  costEuro: number;
  dateStart: string;
  dateEnd: string | null;
};

/** Special-offer registrations, optionally limited to one version or a set of users. */
export async function listSpecialOfferRegistrations(filter: {
  versionId?: number | null;
  userIds?: string[];
} = {}): Promise<SpecialOfferUserRegistration[]> {
  await ensureSpecialOfferTables();
  const conditions: string[] = [];
  const args: unknown[] = [];
  if (filter.versionId) {
    conditions.push('versionId = ?');
    args.push(filter.versionId);
  }
  if (filter.userIds) {
    if (filter.userIds.length === 0) return [];
    conditions.push(`userId IN (${filter.userIds.map(() => '?').join(',')})`);
    args.push(...filter.userIds);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      userId: string;
      offerId: number;
      versionId: number;
      versionName: string;
      offerTitle: string | null;
      costEuro: Prisma.Decimal | number | string;
      dateStart: Date | string;
      dateEnd: Date | string | null;
    }>
  >(
    `SELECT userId, offerId, versionId, versionName, offerTitle, costEuro, dateStart, dateEnd
     FROM subscription_special_offer_registrations ${where}
     ORDER BY createdAt DESC`,
    ...args,
  );
  return rows.map((r) => ({
    userId: String(r.userId),
    offerId: Number(r.offerId),
    versionId: Number(r.versionId),
    versionName: r.versionName,
    offerTitle: r.offerTitle || '',
    costEuro: Number(r.costEuro) || 0,
    dateStart: toYmd(r.dateStart),
    dateEnd: r.dateEnd ? toYmd(r.dateEnd) : null,
  }));
}
