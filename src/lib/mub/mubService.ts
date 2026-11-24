import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { roleTemplateFromUserType } from '@/lib/mub/constants';
import {
  MUB_EXTENDED_TEXT_MAX,
  MUB_SHORT_TEXT_MAX,
  sanitizeMubBackground,
  sanitizeMubButtonColor,
  sanitizeMubIconPath,
  sanitizeMubIconSource,
  sanitizeMubLang,
  sanitizeMubPageToOpen,
  sanitizeMubText,
  sanitizeMubTextColor,
  sanitizeMubTextFont,
  sanitizeMubUrl,
} from '@/lib/mub/mubSanitize';
import type {
  MubButtonDto,
  MubCategory,
  MubPageDto,
  MubPageQuery,
  MubRoleTemplate,
  MubScope,
  SaveMubButtonInput,
} from '@/lib/mub/types';

/** Raised when a button id does not belong to the page the caller is editing. */
export class MubButtonNotFoundError extends Error {
  constructor() {
    super('Button not found on this page');
    this.name = 'MubButtonNotFoundError';
  }
}

/** A reorder request may not carry more ids than a page could plausibly hold. */
const MAX_REORDER_IDS = 500;

/** Translations are bounded per button so one request cannot create unbounded rows. */
const MAX_TRANSLATIONS_PER_BUTTON = 32;

/**
 * Interactive transactions default to a 5s budget. Import walks every button in a
 * staff template one row at a time, which can exceed that on a slow connection.
 */
const MUB_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

function normalizeLang(code: string): string {
  return sanitizeMubLang(code);
}

/**
 * Deterministic primary key for a page's (scope, ownerId, roleTemplate, category).
 *
 * The `@@unique` index on those columns is inert on MySQL: every MUB page row has a
 * NULL in the key (`ownerId` for STAFF, `roleTemplate` for USER) and MySQL treats
 * NULLs as distinct, so it never rejects a duplicate. Deriving the id from the key
 * instead makes the primary key do that job, without a schema migration.
 */
function mubPageKeyId(query: MubPageQuery): string {
  const key = [query.scope, query.ownerId ?? '', query.roleTemplate ?? '', query.category].join('|');
  return `mubp_${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
}

async function ensurePageSettings(query: MubPageQuery) {
  const { scope, ownerId = null, roleTemplate = null, category } = query;
  const where = {
    scope,
    ownerId: ownerId ?? null,
    roleTemplate: roleTemplate ?? null,
    category,
  };

  const existing = await prisma.mubPageSettings.findFirst({ where });
  if (existing) return existing;

  try {
    return await prisma.mubPageSettings.create({
      data: { id: mubPageKeyId(query), ...where },
    });
  } catch {
    // Lost a race against a concurrent create — the deterministic id collided.
    const raced = await prisma.mubPageSettings.findFirst({ where });
    if (raced) return raced;
    throw new Error('Could not create MUB page settings');
  }
}

function mapButton(
  row: Prisma.MubButtonItemGetPayload<{ include: { translations: true } }>,
  languageCode: string,
): MubButtonDto {
  const translations: Record<string, { shortText: string; extendedText: string }> = {};
  for (const tr of row.translations) {
    translations[normalizeLang(tr.languageCode)] = {
      shortText: tr.shortText,
      extendedText: tr.extendedText,
    };
  }
  const lang = normalizeLang(languageCode);
  const primary = translations[lang] ?? translations.en ?? { shortText: '', extendedText: '' };

  return {
    id: row.id,
    sortOrder: row.sortOrder,
    buttonColor: row.buttonColor,
    textFont: row.textFont,
    textColor: row.textColor,
    // Legacy rows predate sanitising, so clean on the way out as well as on the way in.
    iconPath: sanitizeMubIconPath(row.iconPath),
    iconSource: row.iconSource,
    urlToOpen: sanitizeMubUrl(row.urlToOpen),
    pageToOpen: row.pageToOpen,
    isImported: row.isImported,
    shortText: primary.shortText,
    extendedText: primary.extendedText,
    translations,
  };
}

export async function getMubPage(
  query: MubPageQuery,
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  const buttons = await prisma.mubButtonItem.findMany({
    where: { pageId: page.id },
    include: { translations: true },
    orderBy: { sortOrder: 'asc' },
  });

  return {
    id: page.id,
    scope: page.scope as MubScope,
    ownerId: page.ownerId,
    roleTemplate: page.roleTemplate as MubRoleTemplate | null,
    category: page.category as MubCategory,
    backgroundColor: page.backgroundColor,
    displayMode: page.displayMode,
    buttons: buttons.map((b) => mapButton(b, languageCode)),
  };
}

export async function updateMubPageSettings(
  query: MubPageQuery,
  patch: { backgroundColor?: string; displayMode?: number },
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  await prisma.mubPageSettings.update({
    where: { id: page.id },
    data: {
      ...(patch.backgroundColor != null
        ? { backgroundColor: sanitizeMubBackground(patch.backgroundColor) }
        : {}),
      ...(patch.displayMode != null ? { displayMode: patch.displayMode === 2 ? 2 : 1 } : {}),
    },
  });
  return getMubPage(query, languageCode);
}

function sanitizeTranslationEntries(
  translations: SaveMubButtonInput['translations'],
  fallbackLang: string,
): { languageCode: string; shortText: string; extendedText: string }[] {
  const byLang = new Map<string, { languageCode: string; shortText: string; extendedText: string }>();
  for (const [code, value] of Object.entries(translations ?? {})) {
    const languageCode = normalizeLang(code);
    byLang.set(languageCode, {
      languageCode,
      shortText: sanitizeMubText(value?.shortText, MUB_SHORT_TEXT_MAX),
      extendedText: sanitizeMubText(value?.extendedText, MUB_EXTENDED_TEXT_MAX),
    });
    if (byLang.size >= MAX_TRANSLATIONS_PER_BUTTON) break;
  }
  if (!byLang.size) {
    const languageCode = normalizeLang(fallbackLang);
    byLang.set(languageCode, { languageCode, shortText: '', extendedText: '' });
  }
  return [...byLang.values()];
}

export async function saveMubButton(
  query: MubPageQuery,
  input: SaveMubButtonInput,
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  const translationEntries = sanitizeTranslationEntries(input.translations, languageCode);

  const fields = {
    buttonColor: sanitizeMubButtonColor(input.buttonColor),
    textFont: sanitizeMubTextFont(input.textFont),
    textColor: sanitizeMubTextColor(input.textColor),
    iconPath: sanitizeMubIconPath(input.iconPath),
    iconSource: sanitizeMubIconSource(input.iconSource),
    urlToOpen: sanitizeMubUrl(input.urlToOpen),
    pageToOpen: sanitizeMubPageToOpen(input.pageToOpen),
  };

  await prisma.$transaction(async (tx) => {
    if (input.id) {
      // Scoped to `pageId` so a button id from another user's page cannot be edited.
      const updated = await tx.mubButtonItem.updateMany({
        where: { id: input.id, pageId: page.id },
        data: fields,
      });
      if (updated.count === 0) throw new MubButtonNotFoundError();

      for (const tr of translationEntries) {
        await tx.mubButtonTranslation.upsert({
          where: {
            buttonId_languageCode: { buttonId: input.id, languageCode: tr.languageCode },
          },
          create: { buttonId: input.id, ...tr },
          update: { shortText: tr.shortText, extendedText: tr.extendedText },
        });
      }
      return;
    }

    const maxOrder = await tx.mubButtonItem.aggregate({
      where: { pageId: page.id },
      _max: { sortOrder: true },
    });
    await tx.mubButtonItem.create({
      data: {
        pageId: page.id,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        ...fields,
        translations: { create: translationEntries },
      },
    });
  }, MUB_TRANSACTION_OPTIONS);

  return getMubPage(query, languageCode);
}

export async function deleteMubButton(
  query: MubPageQuery,
  buttonId: string,
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  const deleted = await prisma.mubButtonItem.deleteMany({
    where: { id: buttonId, pageId: page.id },
  });
  if (deleted.count === 0) throw new MubButtonNotFoundError();
  return getMubPage(query, languageCode);
}

export async function reorderMubButtons(
  query: MubPageQuery,
  orderedIds: unknown[],
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);

  const requested = [
    ...new Set(orderedIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ].slice(0, MAX_REORDER_IDS);

  // Only reorder buttons that actually live on this page.
  const owned = await prisma.mubButtonItem.findMany({
    where: { pageId: page.id, id: { in: requested } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((b) => b.id));
  const finalIds = requested.filter((id) => ownedIds.has(id));

  if (finalIds.length) {
    await prisma.$transaction(
      finalIds.map((id, index) =>
        prisma.mubButtonItem.updateMany({
          where: { id, pageId: page.id },
          data: { sortOrder: index },
        }),
      ),
    );
  }
  return getMubPage(query, languageCode);
}

export async function resetMubPage(
  query: MubPageQuery,
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  await prisma.mubButtonItem.deleteMany({ where: { pageId: page.id } });
  return getMubPage(query, languageCode);
}

export async function removeImportedMubButtons(
  query: MubPageQuery,
  languageCode = 'en',
): Promise<MubPageDto> {
  const page = await ensurePageSettings(query);
  await prisma.mubButtonItem.deleteMany({
    where: { pageId: page.id, isImported: true },
  });
  return getMubPage(query, languageCode);
}

type StaffButtonRow = Prisma.MubButtonItemGetPayload<{ include: { translations: true } }>;

/**
 * Client answer #3 asks for the current user's language. Falling back to `en` and
 * then to whatever the template does have keeps import from silently returning zero
 * buttons for every language the staff have not translated yet — and matches the
 * fallback `mapButton` already applies when reading.
 */
function pickImportTranslation(button: StaffButtonRow, lang: string) {
  return (
    button.translations.find((t) => normalizeLang(t.languageCode) === lang) ??
    button.translations.find((t) => normalizeLang(t.languageCode) === 'en') ??
    button.translations[0] ??
    null
  );
}

/**
 * Replace the imported set rather than appending to it, so pressing
 * "Import Movesbook MUB" twice does not duplicate every button. Buttons the user
 * created themselves (`isImported: false`) are untouched.
 */
async function copyStaffButtonsToPage(
  staffPageId: string,
  targetPageId: string,
  languageCode: string,
): Promise<number> {
  const staffButtons = await prisma.mubButtonItem.findMany({
    where: { pageId: staffPageId },
    include: { translations: true },
    orderBy: { sortOrder: 'asc' },
  });
  const lang = normalizeLang(languageCode);

  return prisma.$transaction(async (tx) => {
    await tx.mubButtonItem.deleteMany({ where: { pageId: targetPageId, isImported: true } });

    const maxOrder = await tx.mubButtonItem.aggregate({
      where: { pageId: targetPageId },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    let imported = 0;

    for (const btn of staffButtons) {
      const tr = pickImportTranslation(btn, lang);
      if (!tr) continue;

      await tx.mubButtonItem.create({
        data: {
          pageId: targetPageId,
          sortOrder: sortOrder++,
          buttonColor: sanitizeMubButtonColor(btn.buttonColor),
          textFont: sanitizeMubTextFont(btn.textFont),
          textColor: sanitizeMubTextColor(btn.textColor),
          iconPath: sanitizeMubIconPath(btn.iconPath),
          iconSource: sanitizeMubIconSource(btn.iconSource),
          urlToOpen: sanitizeMubUrl(btn.urlToOpen),
          pageToOpen: sanitizeMubPageToOpen(btn.pageToOpen),
          isImported: true,
          translations: {
            create: [
              {
                languageCode: lang,
                shortText: sanitizeMubText(tr.shortText, MUB_SHORT_TEXT_MAX),
                extendedText: sanitizeMubText(tr.extendedText, MUB_EXTENDED_TEXT_MAX),
              },
            ],
          },
        },
      });
      imported += 1;
    }

    return imported;
  }, MUB_TRANSACTION_OPTIONS);
}

export async function importStaffMubTemplate(
  targetQuery: MubPageQuery,
  roleTemplate: MubRoleTemplate,
  languageCode = 'en',
): Promise<{ page: MubPageDto; importedCount: number }> {
  const staffPage = await ensurePageSettings({
    scope: 'STAFF',
    ownerId: null,
    roleTemplate,
    category: targetQuery.category,
  });
  const targetPage = await ensurePageSettings(targetQuery);
  const importedCount = await copyStaffButtonsToPage(staffPage.id, targetPage.id, languageCode);
  const page = await getMubPage(targetQuery, languageCode);
  return { page, importedCount };
}

/**
 * Which staff template an account imports is decided by its stored `userType`,
 * not by a value the client sends with the request.
 */
export async function resolveImportRoleTemplate(userId: string): Promise<MubRoleTemplate> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { userType: true },
  });
  return roleTemplateFromUserType(String(user?.userType ?? 'ATHLETE'));
}

export function parseMubCategory(raw: string | null): MubCategory {
  const value = (raw ?? 'CLUB_MANAGEMENT').toUpperCase();
  if (value === 'WORKOUT' || value === 'WORKOUT_SECTION') return 'WORKOUT';
  if (value === 'SOCIAL' || value === 'SOCIAL_SECTION') return 'SOCIAL';
  return 'CLUB_MANAGEMENT';
}

export function parseMubScope(raw: string | null): MubScope {
  const value = (raw ?? 'USER').toUpperCase();
  if (value === 'STAFF') return 'STAFF';
  if (value === 'CLUB') return 'CLUB';
  return 'USER';
}

export function parseRoleTemplate(raw: string | null): MubRoleTemplate | null {
  if (!raw) return null;
  const value = raw.toUpperCase();
  if (value === 'SINGLE_USER' || value === 'ATHLETE' || value === '5') return 'SINGLE_USER';
  if (value === 'TEAM' || value === '7') return 'TEAM';
  if (value === 'COACH' || value === '6') return 'COACH';
  if (value === 'CLUB' || value === '8') return 'CLUB';
  if (value === 'GROUP' || value === '9') return 'GROUP';
  return null;
}
