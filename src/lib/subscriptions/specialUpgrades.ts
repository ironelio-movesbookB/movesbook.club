import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hydrateVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import {
  addDaysYmd,
  todayYmd,
  versionNameFor,
  type SpecialOfferLangMap,
} from '@/lib/subscriptions/specialOffers';

export type SpecialUpgradeSettings = {
  versionId: number;
  enabled: boolean;
  titleByLang: SpecialOfferLangMap;
  descriptionByLang: SpecialOfferLangMap;
  buttonLabelByLang: SpecialOfferLangMap;
  validFrom: string;
  validTo: string;
  costEuro: number;
  /** Days added to start date for the paid subscription end. */
  daysOfSubscription: number;
  /** Days from start until blocking Check deadline. */
  analyzeWithinDays: number;
  logoUrl: string;
};

export type SpecialUpgradeAdminView = SpecialUpgradeSettings & {
  id: number | null;
  versionName: string;
  registeredCount: number;
  isActiveNow: boolean;
};

export type SpecialUpgradePublicView = {
  versionId: number;
  versionName: string;
  title: string;
  description: string;
  buttonLabel: string;
  costEuro: number;
  validTo: string;
  daysOfSubscription: number;
  analyzeWithinDays: number;
  /** Expiration date if registering today. */
  expirationYmd: string;
  logoUrl: string;
};

export type SpecialUpgradeRegistration = {
  upgradeId: number;
  versionId: number;
  versionName: string;
  upgradeTitle: string;
  costEuro: number;
  dateStart: string;
  dateEnd: string;
  checkDeadline: string;
  softwareCompany: string;
  softwareVersion: string;
  softwareExpiration: string;
};

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const BUTTON_MAX = 40;

let tablesReady = false;

export async function ensureSpecialUpgradeTables(): Promise<void> {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_special_upgrades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      versionId INT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      titlesJson TEXT NULL,
      descriptionsJson MEDIUMTEXT NULL,
      buttonLabelsJson TEXT NULL,
      validFrom DATE NULL,
      validTo DATE NULL,
      costEuro DECIMAL(10,2) NOT NULL DEFAULT 0,
      daysOfSubscription INT NOT NULL DEFAULT 365,
      analyzeWithinDays INT NOT NULL DEFAULT 60,
      logoUrl VARCHAR(512) NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_special_upgrade_version (versionId)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_special_upgrade_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      upgradeId INT NOT NULL,
      versionId INT NOT NULL,
      versionName VARCHAR(255) NOT NULL,
      upgradeTitle VARCHAR(255) NULL,
      userId VARCHAR(191) NOT NULL,
      costEuro DECIMAL(10,2) NOT NULL DEFAULT 0,
      dateStart DATE NOT NULL,
      dateEnd DATE NULL,
      checkDeadline DATE NULL,
      checkCleared TINYINT(1) NOT NULL DEFAULT 0,
      softwareCompany VARCHAR(255) NOT NULL DEFAULT '',
      softwareVersion VARCHAR(255) NOT NULL DEFAULT '',
      softwareExpiration VARCHAR(32) NOT NULL DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_sur_upgrade (upgradeId),
      KEY idx_sur_user (userId)
    )
  `);
  tablesReady = true;
}

type UpgradeRow = {
  id: number;
  versionId: number;
  enabled: number | boolean;
  titlesJson: string | null;
  descriptionsJson: string | null;
  buttonLabelsJson: string | null;
  validFrom: Date | string | null;
  validTo: Date | string | null;
  costEuro: Prisma.Decimal | number | string;
  daysOfSubscription: number;
  analyzeWithinDays: number;
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

function pickLang(map: SpecialOfferLangMap, lang: string): string {
  return map[lang]?.trim() || map.en?.trim() || Object.values(map).find((v) => v?.trim()) || '';
}

function emptySettings(versionId: number): SpecialUpgradeSettings {
  return {
    versionId,
    enabled: false,
    titleByLang: {},
    descriptionByLang: {},
    buttonLabelByLang: { en: 'CLICK HERE' },
    validFrom: '',
    validTo: '',
    costEuro: 0,
    daysOfSubscription: 1095,
    analyzeWithinDays: 60,
    logoUrl: '',
  };
}

function rowToSettings(row: UpgradeRow): SpecialUpgradeSettings {
  return {
    versionId: Number(row.versionId),
    enabled: Boolean(Number(row.enabled)),
    titleByLang: parseJson(row.titlesJson, {}),
    descriptionByLang: parseJson(row.descriptionsJson, {}),
    buttonLabelByLang: parseJson(row.buttonLabelsJson, { en: 'CLICK HERE' }),
    validFrom: toYmd(row.validFrom),
    validTo: toYmd(row.validTo),
    costEuro: Number(row.costEuro) || 0,
    daysOfSubscription: Number(row.daysOfSubscription) || 365,
    analyzeWithinDays: Number(row.analyzeWithinDays) || 60,
    logoUrl: row.logoUrl || '',
  };
}

function isWithinValidity(settings: SpecialUpgradeSettings, today = todayYmd()): boolean {
  if (!settings.enabled) return false;
  if (settings.validFrom && today < settings.validFrom) return false;
  if (settings.validTo && today > settings.validTo) return false;
  return true;
}

async function loadRow(versionId: number): Promise<UpgradeRow | null> {
  await ensureSpecialUpgradeTables();
  const rows = await prisma.$queryRawUnsafe<UpgradeRow[]>(
    `SELECT * FROM subscription_special_upgrades WHERE versionId = ? LIMIT 1`,
    versionId,
  );
  return rows[0] ?? null;
}

async function countRegs(upgradeId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total FROM subscription_special_upgrade_registrations WHERE upgradeId = ?`,
    upgradeId,
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getSpecialUpgradeAdmin(versionId: number): Promise<SpecialUpgradeAdminView> {
  await hydrateVersionSettings();
  const row = await loadRow(versionId);
  const settings = row ? rowToSettings(row) : emptySettings(versionId);
  return {
    ...settings,
    id: row ? Number(row.id) : null,
    versionName: versionNameFor(versionId),
    registeredCount: row ? await countRegs(row.id) : 0,
    isActiveNow: isWithinValidity(settings),
  };
}

export async function saveSpecialUpgrade(
  input: Partial<SpecialUpgradeSettings> & { versionId: number },
): Promise<SpecialUpgradeAdminView> {
  await ensureSpecialUpgradeTables();
  const titleByLang = cleanLangMap(input.titleByLang, TITLE_MAX);
  const descriptionByLang = cleanLangMap(input.descriptionByLang, DESCRIPTION_MAX);
  const buttonLabelByLang = cleanLangMap(input.buttonLabelByLang, BUTTON_MAX);
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(input.validFrom || '') ? input.validFrom! : null;
  const validTo = /^\d{4}-\d{2}-\d{2}$/.test(input.validTo || '') ? input.validTo! : null;
  if (validFrom && validTo && validFrom > validTo) {
    throw new Error('The validity start date must be before the end date');
  }
  const costEuro = Math.max(0, Number(input.costEuro) || 0);
  const daysOfSubscription = Math.max(1, Math.floor(Number(input.daysOfSubscription) || 365));
  const analyzeWithinDays = Math.max(0, Math.floor(Number(input.analyzeWithinDays) || 0));
  const logoUrl = typeof input.logoUrl === 'string' ? input.logoUrl.trim().slice(0, 512) : '';

  await prisma.$executeRawUnsafe(
    `INSERT INTO subscription_special_upgrades
       (versionId, enabled, titlesJson, descriptionsJson, buttonLabelsJson, validFrom, validTo,
        costEuro, daysOfSubscription, analyzeWithinDays, logoUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled), titlesJson = VALUES(titlesJson),
       descriptionsJson = VALUES(descriptionsJson), buttonLabelsJson = VALUES(buttonLabelsJson),
       validFrom = VALUES(validFrom), validTo = VALUES(validTo), costEuro = VALUES(costEuro),
       daysOfSubscription = VALUES(daysOfSubscription), analyzeWithinDays = VALUES(analyzeWithinDays),
       logoUrl = VALUES(logoUrl)`,
    input.versionId,
    input.enabled ? 1 : 0,
    JSON.stringify(titleByLang),
    JSON.stringify(descriptionByLang),
    JSON.stringify(buttonLabelByLang),
    validFrom,
    validTo,
    costEuro,
    daysOfSubscription,
    analyzeWithinDays,
    logoUrl || null,
  );
  return getSpecialUpgradeAdmin(input.versionId);
}

export async function getPublicSpecialUpgrade(
  versionId: number,
  lang: string,
): Promise<SpecialUpgradePublicView | null> {
  await hydrateVersionSettings();
  const row = await loadRow(versionId);
  if (!row) return null;
  const settings = rowToSettings(row);
  if (!isWithinValidity(settings)) return null;
  const start = todayYmd();
  return {
    versionId,
    versionName: versionNameFor(versionId),
    title: pickLang(settings.titleByLang, lang) || 'Special Upgrade',
    description: pickLang(settings.descriptionByLang, lang),
    buttonLabel: pickLang(settings.buttonLabelByLang, lang) || 'CLICK HERE',
    costEuro: settings.costEuro,
    validTo: settings.validTo,
    daysOfSubscription: settings.daysOfSubscription,
    analyzeWithinDays: settings.analyzeWithinDays,
    expirationYmd: addDaysYmd(start, settings.daysOfSubscription),
    logoUrl: settings.logoUrl,
  };
}

export class SpecialUpgradeUnavailableError extends Error {}

export async function reserveSpecialUpgradeSlot(
  tx: Prisma.TransactionClient,
  params: {
    versionId: number;
    userId: string;
    softwareCompany: string;
    softwareVersion?: string;
    softwareExpiration?: string;
  },
): Promise<SpecialUpgradeRegistration> {
  const rows = await tx.$queryRawUnsafe<UpgradeRow[]>(
    `SELECT * FROM subscription_special_upgrades WHERE versionId = ? LIMIT 1 FOR UPDATE`,
    params.versionId,
  );
  const row = rows[0];
  if (!row) throw new SpecialUpgradeUnavailableError('This special upgrade is not available');
  const settings = rowToSettings(row);
  if (!isWithinValidity(settings)) {
    throw new SpecialUpgradeUnavailableError('This special upgrade has expired');
  }
  const company = String(params.softwareCompany || '').trim();
  if (!company) throw new SpecialUpgradeUnavailableError('Software company name is required');

  const dateStart = todayYmd();
  const dateEnd = addDaysYmd(dateStart, settings.daysOfSubscription);
  const checkDeadline =
    settings.analyzeWithinDays > 0 ? addDaysYmd(dateStart, settings.analyzeWithinDays) : '';
  const registration: SpecialUpgradeRegistration = {
    upgradeId: Number(row.id),
    versionId: params.versionId,
    versionName: versionNameFor(params.versionId),
    upgradeTitle: pickLang(settings.titleByLang, 'en') || 'Special Upgrade',
    costEuro: settings.costEuro,
    dateStart,
    dateEnd,
    checkDeadline,
    softwareCompany: company.slice(0, 255),
    softwareVersion: String(params.softwareVersion || '').trim().slice(0, 255),
    softwareExpiration: String(params.softwareExpiration || '').trim().slice(0, 32),
  };
  await tx.$executeRawUnsafe(
    `INSERT INTO subscription_special_upgrade_registrations
       (upgradeId, versionId, versionName, upgradeTitle, userId, costEuro, dateStart, dateEnd,
        checkDeadline, softwareCompany, softwareVersion, softwareExpiration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    registration.upgradeId,
    registration.versionId,
    registration.versionName,
    registration.upgradeTitle,
    params.userId,
    registration.costEuro,
    registration.dateStart,
    registration.dateEnd,
    checkDeadline || null,
    registration.softwareCompany,
    registration.softwareVersion,
    registration.softwareExpiration,
  );
  return registration;
}

export type SpecialUpgradeUserRegistration = {
  userId: string;
  upgradeId: number;
  versionId: number;
  versionName: string;
  upgradeTitle: string;
  costEuro: number;
  dateStart: string;
  dateEnd: string | null;
  checkDeadline: string | null;
  checkCleared: boolean;
  softwareCompany: string;
  softwareVersion: string;
  softwareExpiration: string;
};

export async function listSpecialUpgradeRegistrations(filter: {
  versionId?: number | null;
  userIds?: string[];
} = {}): Promise<SpecialUpgradeUserRegistration[]> {
  await ensureSpecialUpgradeTables();
  const conditions: string[] = [];
  const args: unknown[] = [];
  if (filter.versionId) {
    conditions.push('versionId = ?');
    args.push(filter.versionId);
  }
  if (filter.userIds) {
    if (!filter.userIds.length) return [];
    conditions.push(`userId IN (${filter.userIds.map(() => '?').join(',')})`);
    args.push(...filter.userIds);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      userId: string;
      upgradeId: number;
      versionId: number;
      versionName: string;
      upgradeTitle: string | null;
      costEuro: Prisma.Decimal | number | string;
      dateStart: Date | string;
      dateEnd: Date | string | null;
      checkDeadline: Date | string | null;
      checkCleared: number | boolean;
      softwareCompany: string;
      softwareVersion: string;
      softwareExpiration: string;
    }>
  >(
    `SELECT userId, upgradeId, versionId, versionName, upgradeTitle, costEuro, dateStart, dateEnd,
            checkDeadline, checkCleared, softwareCompany, softwareVersion, softwareExpiration
     FROM subscription_special_upgrade_registrations ${where}
     ORDER BY createdAt DESC`,
    ...args,
  );
  return rows.map((r) => ({
    userId: String(r.userId),
    upgradeId: Number(r.upgradeId),
    versionId: Number(r.versionId),
    versionName: r.versionName,
    upgradeTitle: r.upgradeTitle || '',
    costEuro: Number(r.costEuro) || 0,
    dateStart: toYmd(r.dateStart),
    dateEnd: r.dateEnd ? toYmd(r.dateEnd) : null,
    checkDeadline: r.checkDeadline ? toYmd(r.checkDeadline) : null,
    checkCleared: Boolean(Number(r.checkCleared)),
    softwareCompany: r.softwareCompany || '',
    softwareVersion: r.softwareVersion || '',
    softwareExpiration: r.softwareExpiration || '',
  }));
}

export async function clearSpecialUpgradeCheck(
  userId: string,
  upgradeId: number,
): Promise<boolean> {
  await ensureSpecialUpgradeTables();
  const result = await prisma.$executeRawUnsafe(
    `UPDATE subscription_special_upgrade_registrations
     SET checkCleared = 1, checkDeadline = NULL
     WHERE userId = ? AND upgradeId = ?`,
    userId,
    upgradeId,
  );
  return Number(result) > 0;
}
