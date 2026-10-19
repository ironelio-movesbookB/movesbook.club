import { prisma } from '@/lib/prisma';
import {
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getSettingsColumns,
} from './legacyDb';
import { createPromocodeSetting } from './promocodeService';
import { generatePromocode } from './generatePromocode';
import { buildPromocodeSettingsSelectSql } from './promocodeSettingsQuery';
import type { PromocodeSettingFormData } from './types';

export type ChildPromoRights = {
  allowed: boolean;
  parentPromocodeId: number | null;
  parentCode: string;
  limit: number | null;
  generatedCount: number;
  remaining: number | null;
  until: string | null;
  versionIds: number[];
  durationDays: number | null;
  helpHtmlPagesId: number | null;
  languageId: number | null;
  discount: string;
  blockedReason: string | null;
  /** Latest promocode the user generated (for Suggest Movesbook regenerate control). */
  currentGeneratedCode: string;
  currentGeneratedValidTo: string | null;
  /** True when there is no generated code yet, or its valid_to is in the past. */
  currentGeneratedExpired: boolean;
};

function rowStr(row: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!row) return '';
  for (const key of keys) {
    const val = row[key];
    if (val != null && val !== '') return String(val);
  }
  return '';
}

function rowNum(row: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!row) return 0;
  for (const key of keys) {
    const val = row[key];
    if (val != null && val !== '') {
      const n = Number(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function addDays(days: number): { toDay: string; toMonth: string; toYear: string } {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, days));
  return {
    toDay: String(d.getDate()).padStart(2, '0'),
    toMonth: String(d.getMonth() + 1).padStart(2, '0'),
    toYear: String(d.getFullYear()),
  };
}

export async function getChildPromoRights(legacyUserId: number): Promise<ChildPromoRights> {
  const empty: ChildPromoRights = {
    allowed: false,
    parentPromocodeId: null,
    parentCode: '',
    limit: null,
    generatedCount: 0,
    remaining: null,
    until: null,
    versionIds: [],
    durationDays: null,
    helpHtmlPagesId: null,
    languageId: null,
    discount: '',
    blockedReason: null,
    currentGeneratedCode: '',
    currentGeneratedValidTo: null,
    currentGeneratedExpired: true,
  };

  const appliesTable = await getPromocodeAppliesTable();
  const settingsTable = await getPromocodeSettingsTable();
  if (!appliesTable || !settingsTable || legacyUserId <= 0) return empty;

  const received = await prisma.$queryRawUnsafe<{ promocode_id: number | bigint }[]>(
    `SELECT promocode_id FROM \`${appliesTable}\`
     WHERE receiver_id = ? AND receiver_id > 0 AND delete_status = 2
     ORDER BY id DESC LIMIT 20`,
    legacyUserId
  );
  const promoIds = Array.from(
    new Set(received.map((r) => Number(r.promocode_id)).filter((id) => id > 0))
  );
  if (promoIds.length === 0) {
    return { ...empty, blockedReason: 'No received promocode found.' };
  }

  const selectSql = await buildPromocodeSettingsSelectSql(settingsTable);
  const placeholders = promoIds.map(() => '?').join(',');
  const promoRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectSql} FROM \`${settingsTable}\` WHERE id IN (${placeholders}) AND delete_status = 2`,
    ...promoIds
  );

  const parent =
    promoRows.find((row) => Number(row.allow_child_promocodes ?? 0) === 1) ?? null;
  if (!parent) {
    return { ...empty, blockedReason: 'Your promocode does not allow creating other promocodes.' };
  }

  const settingsCols = await getSettingsColumns();
  const creatorCol = settingsCols.has('creator_id')
    ? 'creator_id'
    : settingsCols.has('creater_id')
      ? 'creater_id'
      : null;
  let generatedCount = 0;
  let currentGeneratedCode = '';
  let currentGeneratedValidTo: string | null = null;
  let currentGeneratedExpired = true;
  const today = new Date().toISOString().slice(0, 10);

  if (creatorCol) {
    const countRows = await prisma.$queryRawUnsafe<{ c: number | bigint }[]>(
      `SELECT COUNT(DISTINCT code) AS c FROM \`${settingsTable}\`
       WHERE \`${creatorCol}\` = ? AND delete_status = 2`,
      legacyUserId
    );
    generatedCount = Number(countRows[0]?.c ?? 0);

    const latestRows = await prisma.$queryRawUnsafe<
      { code: string | null; valid_to: unknown }[]
    >(
      `SELECT code, CAST(valid_to AS CHAR) AS valid_to FROM \`${settingsTable}\`
       WHERE \`${creatorCol}\` = ? AND delete_status = 2
       ORDER BY id DESC LIMIT 1`,
      legacyUserId
    );
    if (latestRows[0]) {
      currentGeneratedCode = latestRows[0].code != null ? String(latestRows[0].code) : '';
      currentGeneratedValidTo = latestRows[0].valid_to
        ? String(latestRows[0].valid_to).slice(0, 10)
        : null;
      // Expired only when a real end date is already in the past.
      currentGeneratedExpired = Boolean(
        currentGeneratedValidTo && currentGeneratedValidTo < today
      );
    }
  }

  const limitRaw = rowNum(parent, 'child_promo_limit');
  const limit = limitRaw > 0 ? limitRaw : null;
  const until = rowStr(parent, 'child_promo_until').slice(0, 10) || null;
  const durationDays = rowNum(parent, 'child_duration_days') || null;
  const versionIds = rowStr(parent, 'child_version_ids')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  let blockedReason: string | null = null;
  if (until && until < today) {
    blockedReason = 'The date to create new promocodes has expired.';
  }
  if (!blockedReason && limit != null && generatedCount >= limit) {
    blockedReason = `You already generated the maximum number of promocodes (${limit}).`;
  }

  return {
    allowed: !blockedReason,
    parentPromocodeId: Number(parent.id),
    parentCode: rowStr(parent, 'code'),
    limit,
    generatedCount,
    remaining: limit != null ? Math.max(0, limit - generatedCount) : null,
    until,
    versionIds,
    durationDays,
    helpHtmlPagesId: rowNum(parent, 'help_html_pages_id') || null,
    languageId: rowNum(parent, 'language_id') || null,
    discount: rowStr(parent, 'discount'),
    blockedReason,
    currentGeneratedCode,
    currentGeneratedValidTo,
    currentGeneratedExpired,
  };
}

export async function createChildPromocodeForUser(params: {
  legacyUserId: number;
  email?: string | null;
  username?: string | null;
}): Promise<{ ok: true; id: number; code: string } | { ok: false; message: string }> {
  const rights = await getChildPromoRights(params.legacyUserId);
  if (!rights.allowed) {
    return { ok: false, message: rights.blockedReason || 'A new promocode cannot be generated anymore.' };
  }
  if (!rights.durationDays || rights.durationDays <= 0) {
    return { ok: false, message: 'Duration days for the new promocode are not configured.' };
  }
  if (rights.versionIds.length === 0) {
    return { ok: false, message: 'No versions are enabled for promocodes you create.' };
  }

  let code = generatePromocode();
  const settingsTable = await getPromocodeSettingsTable();
  if (settingsTable) {
    for (let i = 0; i < 8; i++) {
      const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
        `SELECT id FROM \`${settingsTable}\` WHERE code = ? LIMIT 1`,
        code
      );
      if (existing.length === 0) break;
      code = generatePromocode();
    }
  }
  const dates = addDays(rights.durationDays);
  const form: PromocodeSettingFormData = {
    code,
    enable: true,
    toDay: dates.toDay,
    toMonth: dates.toMonth,
    toYear: dates.toYear,
    versionIds: rights.versionIds,
    discount: rights.discount || '0',
    usableBy: 'Always',
    enableExtension: false,
    subscriptionExtends: '',
    managementSection: '',
    socialOptions: [],
    enableFreeAccounts: false,
    basicVersion: '',
    premiumVersion: '',
    professionalVersion: '',
    helpHtmlPagesId: rights.helpHtmlPagesId,
    languageId: rights.languageId,
    email: params.email?.trim() || '',
    recipient: params.username?.trim() || '',
    allowChildPromocodes: false,
    parentPromocodeId: rights.parentPromocodeId,
    childDurationDays: String(rights.durationDays),
  };

  const id = await createPromocodeSetting(form, params.legacyUserId);
  if (!id) return { ok: false, message: 'Failed to create promocode.' };
  return { ok: true, id, code };
}

export async function resolveInviteExpiryDate(promocodeId: number): Promise<string | null> {
  const settingsTable = await getPromocodeSettingsTable();
  if (!settingsTable || promocodeId <= 0) return null;
  const columns = await getSettingsColumns();
  if (!columns.has('child_duration_days') && !columns.has('valid_to')) return null;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT child_duration_days, CAST(valid_to AS CHAR) AS valid_to
     FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
    promocodeId
  );
  const days = Number(rows[0]?.child_duration_days ?? 0);
  if (Number.isFinite(days) && days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const validTo = rows[0]?.valid_to != null ? String(rows[0].valid_to).slice(0, 10) : '';
  return validTo || null;
}

export async function userOwnsOrReceivedPromocode(
  legacyUserId: number,
  promocodeId: number
): Promise<boolean> {
  const appliesTable = await getPromocodeAppliesTable();
  const settingsTable = await getPromocodeSettingsTable();
  if (appliesTable) {
    const received = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND promocode_id = ? AND delete_status = 2 LIMIT 1`,
      legacyUserId,
      promocodeId
    );
    if (received.length > 0) return true;
  }
  if (settingsTable) {
    const cols = await getSettingsColumns();
    const creatorCol = cols.has('creator_id')
      ? 'creator_id'
      : cols.has('creater_id')
        ? 'creater_id'
        : null;
    if (creatorCol) {
      const owned = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
        `SELECT id FROM \`${settingsTable}\`
         WHERE id = ? AND \`${creatorCol}\` = ? AND delete_status = 2 LIMIT 1`,
        promocodeId,
        legacyUserId
      );
      if (owned.length > 0) return true;
    }
  }
  return false;
}
