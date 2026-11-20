import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  FAQ_CURRENT_PAGE_SETTING_KEY,
  FAQ_DEFAULT_VIEW_MODE,
  FAQ_LANGUAGE_CODES,
  FAQ_SECTION_PAIRS,
  faqPairKey,
  isFaqDocType,
  isFaqLanguage,
  isFaqViewMode,
  isValidFaqPair,
  normalizeFaqPagePath,
  type FaqAdminRowDto,
  type FaqChapterDto,
  type FaqDocType,
  type FaqLanguageCode,
  type FaqListEntryDto,
  type FaqPairDto,
  type FaqPublicItemDto,
  type FaqSectionKey,
  type FaqSubsectionKey,
  type FaqTranslationDto,
  type FaqViewMode,
} from '@/lib/faqs/faqConstants';

/**
 * FAQ storage. Tables are created at runtime (same pattern as movesbook_deadlines) so no
 * `prisma db push` is needed; they are listed as external tables in prisma.config.ts.
 *
 * Names are prefixed `faq_entry*` / `faq_list_items` / `faq_view_settings` so they never collide
 * with the legacy PHP tables (faqs, faqs_links, faq_pages, faq_related_pages, faq_settings).
 */

let ensured = false;

export async function ensureFaqTables(): Promise<void> {
  if (ensured) return;
  const charset = 'DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_entries (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      code VARCHAR(100) NOT NULL DEFAULT '',
      icon_path VARCHAR(500) NULL,
      doc_type VARCHAR(16) NOT NULL DEFAULT 'document',
      url VARCHAR(1000) NOT NULL DEFAULT '',
      title VARCHAR(500) NOT NULL DEFAULT '',
      subtitle VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_faq_code (code)
    ) ${charset}
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_entry_sections (
      faq_id VARCHAR(36) NOT NULL,
      section VARCHAR(20) NOT NULL,
      subsection VARCHAR(20) NOT NULL,
      PRIMARY KEY (faq_id, section, subsection),
      KEY idx_faq_sec_pair (section, subsection)
    ) ${charset}
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_entry_translations (
      faq_id VARCHAR(36) NOT NULL,
      lang VARCHAR(8) NOT NULL,
      title VARCHAR(500) NOT NULL DEFAULT '',
      subtitle VARCHAR(500) NOT NULL DEFAULT '',
      content MEDIUMTEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (faq_id, lang)
    ) ${charset}
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_entry_pages (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      faq_id VARCHAR(36) NOT NULL,
      page_url VARCHAR(1000) NOT NULL DEFAULT '',
      page_path VARCHAR(500) NOT NULL DEFAULT '',
      position INT NOT NULL DEFAULT 0,
      KEY idx_faq_pages_faq (faq_id),
      KEY idx_faq_pages_path (page_path(191))
    ) ${charset}
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_list_items (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      kind VARCHAR(10) NOT NULL,
      faq_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      bg_color CHAR(7) NOT NULL DEFAULT '#f1c40f',
      fg_color CHAR(7) NOT NULL DEFAULT '#000000',
      position INT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_faq_list_faq (faq_id),
      KEY idx_faq_list_pos (position)
    ) ${charset}
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS faq_view_settings (
      setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
      view_mode VARCHAR(16) NOT NULL DEFAULT 'cascade',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ${charset}
  `);
  ensured = true;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type EntryRow = {
  id: string;
  code: string;
  icon_path: string | null;
  doc_type: string;
  url: string;
  title: string;
  subtitle: string;
  created_at: Date;
};

type SectionRow = { faq_id: string; section: string; subsection: string };

type TranslationRow = {
  faq_id: string;
  lang: string;
  title: string;
  subtitle: string;
  content: string | null;
};

type ListItemRow = {
  id: string;
  kind: string;
  faq_id: string | null;
  title: string;
  bg_color: string;
  fg_color: string;
  position: number;
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export type FaqMetaInput = {
  code: string;
  pairs: FaqPairDto[];
  iconPath: string | null;
  docType: FaqDocType;
  url: string;
  title: string;
  subtitle: string;
};

const MAX_TEXT = 500;

function str(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Only images written by our own upload route are accepted as icons. */
function sanitizeIconPath(value: unknown): string | null {
  const s = str(value, 500);
  if (!s) return null;
  return /^\/uploads\/faqs\/[\w.-]+$/.test(s) ? s : null;
}

function sanitizeUrl(value: unknown): string {
  const s = str(value, 1000);
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
  return '';
}

export function parseFaqMetaInput(
  body: unknown,
): { ok: true; value: FaqMetaInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = str(b.code, 100);
  if (!code) return { ok: false, error: 'Code is required' };

  const rawPairs = Array.isArray(b.pairs) ? b.pairs : [];
  const seen = new Set<string>();
  const pairs: FaqPairDto[] = [];
  for (const p of rawPairs) {
    const section = (p as Record<string, unknown>)?.section;
    const subsection = (p as Record<string, unknown>)?.subsection;
    if (!isValidFaqPair(section, subsection)) continue;
    const key = faqPairKey(String(section), String(subsection));
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ section: section as FaqSectionKey, subsection: subsection as FaqSubsectionKey });
  }
  if (!pairs.length) return { ok: false, error: 'Select a Section - SubSection' };
  // One Section - SubSection per FAQ (dropdown, as in PHP).
  pairs.splice(1);

  const docType = isFaqDocType(b.docType) ? b.docType : 'document';
  const url = sanitizeUrl(b.url);
  if (str(b.url, 1000) && !url) {
    return { ok: false, error: 'Url must start with http://, https:// or /' };
  }

  return {
    ok: true,
    value: {
      code,
      pairs,
      iconPath: sanitizeIconPath(b.iconPath),
      docType,
      url,
      title: str(b.title),
      subtitle: str(b.subtitle),
    },
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function hasText(t: Pick<TranslationRow, 'title' | 'content'>): boolean {
  const contentText = (t.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const hasMedia = /<(img|iframe|video|embed|object|oembed)\b/i.test(t.content ?? '');
  return contentText.length > 0 || hasMedia || t.title.trim().length > 0;
}

async function loadAll(): Promise<{
  entries: EntryRow[];
  sections: SectionRow[];
  translations: TranslationRow[];
}> {
  await ensureFaqTables();
  const [entries, sections, translations] = await Promise.all([
    prisma.$queryRaw<EntryRow[]>`
      SELECT id, code, icon_path, doc_type, url, title, subtitle, created_at FROM faq_entries`,
    prisma.$queryRaw<SectionRow[]>`SELECT faq_id, section, subsection FROM faq_entry_sections`,
    prisma.$queryRaw<TranslationRow[]>`
      SELECT faq_id, lang, title, subtitle, NULL AS content FROM faq_entry_translations`,
  ]);
  return { entries, sections, translations };
}

/** Languages with something saved, per FAQ (needs the content column, unlike loadAll). */
async function loadFilledLangs(): Promise<Map<string, Set<FaqLanguageCode>>> {
  const rows = await prisma.$queryRaw<TranslationRow[]>`
    SELECT faq_id, lang, title, subtitle, content FROM faq_entry_translations`;
  const map = new Map<string, Set<FaqLanguageCode>>();
  for (const r of rows) {
    if (!isFaqLanguage(r.lang) || !hasText(r)) continue;
    const set = map.get(r.faq_id) ?? new Set<FaqLanguageCode>();
    set.add(r.lang);
    map.set(r.faq_id, set);
  }
  return map;
}

function toAdminRow(
  e: EntryRow,
  sections: SectionRow[],
  translations: TranslationRow[],
  filled: Set<FaqLanguageCode> | undefined,
): FaqAdminRowDto {
  const titles: FaqAdminRowDto['titles'] = {};
  for (const t of translations) {
    if (isFaqLanguage(t.lang) && (t.title || t.subtitle)) {
      titles[t.lang] = { title: t.title, subtitle: t.subtitle };
    }
  }
  return {
    id: e.id,
    code: e.code,
    iconPath: e.icon_path,
    docType: isFaqDocType(e.doc_type) ? e.doc_type : 'document',
    url: e.url,
    createdAt: new Date(e.created_at).toISOString(),
    title: e.title,
    subtitle: e.subtitle,
    pairs: sections
      .filter((s) => isValidFaqPair(s.section, s.subsection))
      .map((s) => ({ section: s.section as FaqSectionKey, subsection: s.subsection as FaqSubsectionKey }))
      .sort(
        (a, b) =>
          FAQ_SECTION_PAIRS.findIndex((p) => p.section === a.section && p.subsection === a.subsection) -
          FAQ_SECTION_PAIRS.findIndex((p) => p.section === b.section && p.subsection === b.subsection),
      ),
    filledLangs: FAQ_LANGUAGE_CODES.filter((c) => filled?.has(c)),
    titles,
  };
}

function groupBy<T extends { faq_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.faq_id) ?? [];
    list.push(r);
    map.set(r.faq_id, list);
  }
  return map;
}

/** Make sure every FAQ has exactly one list item (appended at the end) and return items in order. */
async function loadListItems(entryIds: string[]): Promise<ListItemRow[]> {
  const items = await prisma.$queryRaw<ListItemRow[]>`
    SELECT id, kind, faq_id, title, bg_color, fg_color, position FROM faq_list_items ORDER BY position ASC, id ASC`;
  const present = new Set(items.filter((i) => i.kind === 'faq').map((i) => i.faq_id));
  const missing = entryIds.filter((id) => !present.has(id));
  if (missing.length) {
    let pos = items.reduce((m, i) => Math.max(m, i.position), 0);
    for (const faqId of missing) {
      pos += 1;
      const id = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT IGNORE INTO faq_list_items (id, kind, faq_id, position) VALUES (${id}, 'faq', ${faqId}, ${pos})`;
      items.push({ id, kind: 'faq', faq_id: faqId, title: '', bg_color: '', fg_color: '', position: pos });
    }
  }
  return items;
}

export type FaqAdminListQuery = {
  section: FaqSectionKey | null;
  subsection: FaqSubsectionKey | null;
  lang: FaqLanguageCode | null;
  search: string;
  searchField: 'code' | 'title';
  sort: 'manual' | 'date' | 'code' | 'title';
};

/**
 * Admin list. In `manual` sort the operator's order is returned with chapters in place;
 * any other sort returns FAQs only (no dragging, no chapters — PHP "red dot" state).
 */
export async function listFaqsForAdmin(q: FaqAdminListQuery): Promise<FaqListEntryDto[]> {
  const { entries, sections, translations } = await loadAll();
  const filledMap = await loadFilledLangs();
  const secBy = groupBy(sections);
  const trBy = groupBy(translations);
  const search = q.search.trim().toLowerCase();

  const rows = new Map<string, FaqAdminRowDto>();
  for (const e of entries) {
    const secs = secBy.get(e.id) ?? [];
    const trs = trBy.get(e.id) ?? [];
    if (q.section && !secs.some((s) => s.section === q.section && (!q.subsection || s.subsection === q.subsection))) {
      continue;
    }
    if (!q.section && q.subsection && !secs.some((s) => s.subsection === q.subsection)) continue;
    if (q.lang && !filledMap.get(e.id)?.has(q.lang)) continue;
    if (search) {
      const haystack =
        q.searchField === 'code'
          ? [e.code]
          : [e.title, e.subtitle, ...trs.flatMap((t) => [t.title, t.subtitle])];
      if (!haystack.some((h) => (h || '').toLowerCase().includes(search))) continue;
    }
    rows.set(e.id, toAdminRow(e, secs, trs, filledMap.get(e.id)));
  }

  if (q.sort !== 'manual') {
    const list = [...rows.values()];
    const title = (r: FaqAdminRowDto) => (r.title || '').toLowerCase();
    list.sort((a, b) => {
      if (q.sort === 'date') return b.createdAt.localeCompare(a.createdAt);
      if (q.sort === 'code') return a.code.localeCompare(b.code, undefined, { sensitivity: 'base' });
      return title(a).localeCompare(title(b));
    });
    return list.map((faq) => ({ kind: 'faq', itemId: `faq-${faq.id}`, faq }));
  }

  const items = await loadListItems(entries.map((e) => e.id));
  const out: FaqListEntryDto[] = [];
  for (const item of items) {
    if (item.kind === 'chapter') {
      out.push({
        kind: 'chapter',
        itemId: item.id,
        chapter: { id: item.id, title: item.title, bg: item.bg_color, fg: item.fg_color },
      });
    } else if (item.faq_id && rows.has(item.faq_id)) {
      out.push({ kind: 'faq', itemId: item.id, faq: rows.get(item.faq_id)! });
    }
  }
  return out;
}

export type FaqDetailDto = FaqAdminRowDto & {
  translations: FaqTranslationDto[];
  pages: { id: string; url: string }[];
};

export async function getFaqDetail(id: string): Promise<FaqDetailDto | null> {
  await ensureFaqTables();
  const [entry] = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, code, icon_path, doc_type, url, title, subtitle, created_at FROM faq_entries WHERE id = ${id}`;
  if (!entry) return null;
  const [sections, translations, pages] = await Promise.all([
    prisma.$queryRaw<SectionRow[]>`SELECT faq_id, section, subsection FROM faq_entry_sections WHERE faq_id = ${id}`,
    prisma.$queryRaw<TranslationRow[]>`
      SELECT faq_id, lang, title, subtitle, content FROM faq_entry_translations WHERE faq_id = ${id}`,
    prisma.$queryRaw<{ id: string; page_url: string }[]>`
      SELECT id, page_url FROM faq_entry_pages WHERE faq_id = ${id} ORDER BY position ASC, id ASC`,
  ]);
  const filled = new Set<FaqLanguageCode>(
    translations.filter((t) => isFaqLanguage(t.lang) && hasText(t)).map((t) => t.lang as FaqLanguageCode),
  );
  const row = toAdminRow(entry, sections, translations, filled);
  return {
    ...row,
    translations: translations
      .filter((t) => isFaqLanguage(t.lang))
      .map((t) => ({
        lang: t.lang as FaqLanguageCode,
        title: t.title,
        subtitle: t.subtitle,
        content: t.content ?? '',
      })),
    pages: pages.map((p) => ({ id: p.id, url: p.page_url })),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function writePairs(tx: Prisma.TransactionClient, faqId: string, pairs: FaqPairDto[]) {
  await tx.$executeRaw`DELETE FROM faq_entry_sections WHERE faq_id = ${faqId}`;
  for (const p of pairs) {
    await tx.$executeRaw`
      INSERT INTO faq_entry_sections (faq_id, section, subsection) VALUES (${faqId}, ${p.section}, ${p.subsection})`;
  }
}

export async function createFaq(input: FaqMetaInput): Promise<string> {
  await ensureFaqTables();
  const id = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO faq_entries (id, code, icon_path, doc_type, url, title, subtitle)
      VALUES (${id}, ${input.code}, ${input.iconPath}, ${input.docType}, ${input.url}, ${input.title}, ${input.subtitle})`;
    await writePairs(tx, id, input.pairs);
    const [{ maxPos }] = await tx.$queryRaw<{ maxPos: number | null }[]>`
      SELECT MAX(position) AS maxPos FROM faq_list_items`;
    const listId = crypto.randomUUID();
    await tx.$executeRaw`
      INSERT INTO faq_list_items (id, kind, faq_id, position) VALUES (${listId}, 'faq', ${id}, ${Number(maxPos ?? 0) + 1})`;
  });
  return id;
}

/**
 * Update FAQ parameters (⋮ → Edit). `keepIconWhenEmpty`: the edit popup sends no icon when the
 * operator did not choose a new file.
 */
export async function updateFaqMeta(id: string, input: FaqMetaInput, keepIconWhenEmpty = true): Promise<boolean> {
  await ensureFaqTables();
  const [exists] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM faq_entries WHERE id = ${id}`;
  if (!exists) return false;
  await prisma.$transaction(async (tx) => {
    if (input.iconPath || !keepIconWhenEmpty) {
      await tx.$executeRaw`
        UPDATE faq_entries SET code = ${input.code}, icon_path = ${input.iconPath}, doc_type = ${input.docType},
          url = ${input.url}, title = ${input.title}, subtitle = ${input.subtitle} WHERE id = ${id}`;
    } else {
      await tx.$executeRaw`
        UPDATE faq_entries SET code = ${input.code}, doc_type = ${input.docType},
          url = ${input.url}, title = ${input.title}, subtitle = ${input.subtitle} WHERE id = ${id}`;
    }
    await writePairs(tx, id, input.pairs);
  });
  return true;
}

const MAX_CONTENT = 2_000_000;

/** Save ALL languages at once (PHP: the editing of a FAQ always includes every language). */
export async function saveFaqTranslations(id: string, body: unknown): Promise<boolean> {
  await ensureFaqTables();
  const [exists] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM faq_entries WHERE id = ${id}`;
  if (!exists) return false;

  const list = Array.isArray((body as { translations?: unknown })?.translations)
    ? ((body as { translations: unknown[] }).translations as Record<string, unknown>[])
    : [];
  const byLang = new Map<FaqLanguageCode, { title: string; subtitle: string; content: string }>();
  for (const t of list) {
    if (!isFaqLanguage(t?.lang)) continue;
    byLang.set(t.lang, {
      title: str(t.title),
      subtitle: str(t.subtitle),
      content: typeof t.content === 'string' ? t.content.slice(0, MAX_CONTENT) : '',
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const lang of FAQ_LANGUAGE_CODES) {
      const t = byLang.get(lang);
      if (!t) continue;
      if (!t.title && !t.subtitle && !t.content.trim()) {
        await tx.$executeRaw`DELETE FROM faq_entry_translations WHERE faq_id = ${id} AND lang = ${lang}`;
        continue;
      }
      await tx.$executeRaw`
        INSERT INTO faq_entry_translations (faq_id, lang, title, subtitle, content)
        VALUES (${id}, ${lang}, ${t.title}, ${t.subtitle}, ${t.content})
        ON DUPLICATE KEY UPDATE title = VALUES(title), subtitle = VALUES(subtitle), content = VALUES(content)`;
    }
  });
  return true;
}

export async function saveFaqPages(id: string, body: unknown): Promise<boolean> {
  await ensureFaqTables();
  const [exists] = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM faq_entries WHERE id = ${id}`;
  if (!exists) return false;
  const raw = Array.isArray((body as { pages?: unknown })?.pages) ? (body as { pages: unknown[] }).pages : [];
  const seen = new Set<string>();
  const pages: { url: string; path: string }[] = [];
  for (const p of raw) {
    const url = str(typeof p === 'string' ? p : (p as { url?: unknown })?.url, 1000);
    const path = normalizeFaqPagePath(url);
    if (!url || !path || seen.has(path)) continue;
    seen.add(path);
    pages.push({ url, path });
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM faq_entry_pages WHERE faq_id = ${id}`;
    let pos = 0;
    for (const p of pages) {
      pos += 1;
      await tx.$executeRaw`
        INSERT INTO faq_entry_pages (id, faq_id, page_url, page_path, position)
        VALUES (${crypto.randomUUID()}, ${id}, ${p.url}, ${p.path}, ${pos})`;
    }
  });
  return true;
}

export async function deleteFaqs(ids: string[]): Promise<number> {
  await ensureFaqTables();
  const clean = [...new Set(ids.filter((i) => typeof i === 'string' && /^[\w-]{1,36}$/.test(i)))];
  if (!clean.length) return 0;
  const list = Prisma.join(clean);
  return prisma.$transaction(async (tx) => {
    const n = await tx.$executeRaw`DELETE FROM faq_entries WHERE id IN (${list})`;
    await tx.$executeRaw`DELETE FROM faq_entry_sections WHERE faq_id IN (${list})`;
    await tx.$executeRaw`DELETE FROM faq_entry_translations WHERE faq_id IN (${list})`;
    await tx.$executeRaw`DELETE FROM faq_entry_pages WHERE faq_id IN (${list})`;
    await tx.$executeRaw`DELETE FROM faq_list_items WHERE kind = 'faq' AND faq_id IN (${list})`;
    return n;
  });
}

/** Insert a chapter/separator right above the list item of `beforeFaqId` (or at the end). */
export async function createChapter(input: {
  title: string;
  bg: string;
  fg: string;
  beforeFaqId: string | null;
}): Promise<string> {
  await ensureFaqTables();
  const id = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    let position: number | null = null;
    if (input.beforeFaqId) {
      const [target] = await tx.$queryRaw<{ position: number }[]>`
        SELECT position FROM faq_list_items WHERE kind = 'faq' AND faq_id = ${input.beforeFaqId}`;
      if (target) {
        position = Number(target.position);
        await tx.$executeRaw`UPDATE faq_list_items SET position = position + 1 WHERE position >= ${position}`;
      }
    }
    if (position === null) {
      const [{ maxPos }] = await tx.$queryRaw<{ maxPos: number | null }[]>`
        SELECT MAX(position) AS maxPos FROM faq_list_items`;
      position = Number(maxPos ?? 0) + 1;
    }
    await tx.$executeRaw`
      INSERT INTO faq_list_items (id, kind, title, bg_color, fg_color, position)
      VALUES (${id}, 'chapter', ${input.title}, ${input.bg}, ${input.fg}, ${position})`;
  });
  return id;
}

export async function deleteChapter(id: string): Promise<boolean> {
  await ensureFaqTables();
  const n = await prisma.$executeRaw`DELETE FROM faq_list_items WHERE id = ${id} AND kind = 'chapter'`;
  return n > 0;
}

/**
 * Save the operator's manual order. `itemIds` is the visible order (possibly filtered); items not
 * in the list keep their relative place: the visible items are re-slotted into the positions they
 * already occupied, so hidden (filtered-out) rows don't move.
 */
export async function saveListOrder(itemIds: string[]): Promise<void> {
  await ensureFaqTables();
  const ids = [...new Set(itemIds.filter((i) => typeof i === 'string' && /^[\w-]{1,36}$/.test(i)))];
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; position: number }[]>`
      SELECT id, position FROM faq_list_items WHERE id IN (${Prisma.join(ids)})`;
    const known = new Set(rows.map((r) => r.id));
    const ordered = ids.filter((i) => known.has(i));
    if (!ordered.length) return;
    const slots = rows.map((r) => Number(r.position)).sort((a, b) => a - b);
    // Duplicate positions would make the order unstable: spread them first.
    const unique = slots.every((p, i) => i === 0 || p !== slots[i - 1]);
    if (!unique) {
      const all = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM faq_list_items ORDER BY position ASC, id ASC`;
      let pos = 0;
      for (const r of all) {
        pos += 10;
        await tx.$executeRaw`UPDATE faq_list_items SET position = ${pos} WHERE id = ${r.id}`;
      }
      const again = await tx.$queryRaw<{ position: number }[]>`
        SELECT position FROM faq_list_items WHERE id IN (${Prisma.join(ordered)}) ORDER BY position ASC`;
      slots.splice(0, slots.length, ...again.map((r) => Number(r.position)));
    }
    for (let i = 0; i < ordered.length; i++) {
      await tx.$executeRaw`UPDATE faq_list_items SET position = ${slots[i]} WHERE id = ${ordered[i]}`;
    }
  });
}

// ---------------------------------------------------------------------------
// View settings ("Modality Of View")
// ---------------------------------------------------------------------------

export async function getViewSettings(): Promise<Record<string, FaqViewMode>> {
  await ensureFaqTables();
  const rows = await prisma.$queryRaw<{ setting_key: string; view_mode: string }[]>`
    SELECT setting_key, view_mode FROM faq_view_settings`;
  const out: Record<string, FaqViewMode> = {};
  for (const p of FAQ_SECTION_PAIRS) out[faqPairKey(p.section, p.subsection)] = FAQ_DEFAULT_VIEW_MODE;
  out[FAQ_CURRENT_PAGE_SETTING_KEY] = FAQ_DEFAULT_VIEW_MODE;
  for (const r of rows) {
    if (r.setting_key in out && isFaqViewMode(r.view_mode)) out[r.setting_key] = r.view_mode;
  }
  return out;
}

export async function saveViewSettings(body: unknown): Promise<Record<string, FaqViewMode>> {
  const current = await getViewSettings();
  const input = ((body as { settings?: unknown })?.settings ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(current)) {
    const mode = input[key];
    if (!isFaqViewMode(mode)) continue;
    await prisma.$executeRaw`
      INSERT INTO faq_view_settings (setting_key, view_mode) VALUES (${key}, ${mode})
      ON DUPLICATE KEY UPDATE view_mode = VALUES(view_mode)`;
    current[key] = mode;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

async function publicItems(faqIds: string[], lang: FaqLanguageCode): Promise<FaqPublicItemDto[]> {
  if (!faqIds.length) return [];
  const list = Prisma.join(faqIds);
  const [entries, translations, items] = await Promise.all([
    prisma.$queryRaw<EntryRow[]>`
      SELECT id, code, icon_path, doc_type, url, title, subtitle, created_at FROM faq_entries WHERE id IN (${list})`,
    prisma.$queryRaw<TranslationRow[]>`
      SELECT faq_id, lang, title, subtitle, content FROM faq_entry_translations
      WHERE lang = ${lang} AND faq_id IN (${list})`,
    loadListItems(faqIds),
  ]);
  const trBy = new Map(translations.filter(hasText).map((t) => [t.faq_id, t]));
  const entryBy = new Map(entries.map((e) => [e.id, e]));
  const out: FaqPublicItemDto[] = [];
  for (const item of items) {
    if (item.kind !== 'faq' || !item.faq_id) continue;
    const e = entryBy.get(item.faq_id);
    const t = trBy.get(item.faq_id);
    if (!e || !t) continue;
    out.push({
      id: e.id,
      iconPath: e.icon_path,
      docType: isFaqDocType(e.doc_type) ? e.doc_type : 'document',
      url: e.url,
      title: t.title || e.title,
      subtitle: t.title ? t.subtitle : t.subtitle || e.subtitle,
      content: t.content ?? '',
    });
  }
  return out;
}

async function languagesWithContent(faqIds: string[]): Promise<FaqLanguageCode[]> {
  if (!faqIds.length) return [];
  const rows = await prisma.$queryRaw<TranslationRow[]>`
    SELECT faq_id, lang, title, subtitle, content FROM faq_entry_translations WHERE faq_id IN (${Prisma.join(faqIds)})`;
  const set = new Set(rows.filter((r) => isFaqLanguage(r.lang) && hasText(r)).map((r) => r.lang));
  return FAQ_LANGUAGE_CODES.filter((c) => set.has(c));
}

export type FaqPublicDetailDto = FaqPublicItemDto & {
  code: string;
  pairs: FaqPairDto[];
  /** False when the FAQ has no content in the requested language. */
  hasLang: boolean;
};

/** One FAQ at full page (PHP FaqPage/faq_doubleclick/{id}). */
export async function getPublicFaqById(
  id: string,
  lang: FaqLanguageCode,
): Promise<{ faq: FaqPublicDetailDto; languages: FaqLanguageCode[] } | null> {
  await ensureFaqTables();
  const [entry] = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, code, icon_path, doc_type, url, title, subtitle, created_at FROM faq_entries WHERE id = ${id}`;
  if (!entry) return null;
  const [sections, translations] = await Promise.all([
    prisma.$queryRaw<SectionRow[]>`SELECT faq_id, section, subsection FROM faq_entry_sections WHERE faq_id = ${id}`,
    prisma.$queryRaw<TranslationRow[]>`
      SELECT faq_id, lang, title, subtitle, content FROM faq_entry_translations WHERE faq_id = ${id}`,
  ]);
  const filled = translations.filter((t) => isFaqLanguage(t.lang) && hasText(t));
  const t = filled.find((x) => x.lang === lang);
  const row = toAdminRow(entry, sections, [], undefined);
  return {
    faq: {
      id: entry.id,
      code: entry.code,
      iconPath: entry.icon_path,
      docType: row.docType,
      url: entry.url,
      pairs: row.pairs,
      title: t?.title || entry.title,
      subtitle: t ? t.subtitle : entry.subtitle,
      content: t?.content ?? '',
      hasLang: !!t,
    },
    languages: FAQ_LANGUAGE_CODES.filter((c) => filled.some((x) => x.lang === c)),
  };
}

export async function getPublicFaqsBySection(
  section: FaqSectionKey,
  subsection: FaqSubsectionKey,
  lang: FaqLanguageCode,
): Promise<{ mode: FaqViewMode; items: FaqPublicItemDto[]; languages: FaqLanguageCode[] }> {
  await ensureFaqTables();
  const rows = await prisma.$queryRaw<{ faq_id: string }[]>`
    SELECT faq_id FROM faq_entry_sections WHERE section = ${section} AND subsection = ${subsection}`;
  const ids = rows.map((r) => r.faq_id);
  const settings = await getViewSettings();
  return {
    mode: settings[faqPairKey(section, subsection)] ?? FAQ_DEFAULT_VIEW_MODE,
    items: await publicItems(ids, lang),
    languages: await languagesWithContent(ids),
  };
}

export async function getPublicFaqsForPage(
  pageUrl: string,
  lang: FaqLanguageCode,
): Promise<{ mode: FaqViewMode; path: string; items: FaqPublicItemDto[]; languages: FaqLanguageCode[] }> {
  await ensureFaqTables();
  const path = normalizeFaqPagePath(pageUrl);
  const settings = await getViewSettings();
  const mode = settings[FAQ_CURRENT_PAGE_SETTING_KEY] ?? FAQ_DEFAULT_VIEW_MODE;
  if (!path) return { mode, path, items: [], languages: [] };
  const rows = await prisma.$queryRaw<{ faq_id: string }[]>`
    SELECT DISTINCT faq_id FROM faq_entry_pages WHERE page_path = ${path}`;
  const ids = rows.map((r) => r.faq_id);
  return {
    mode,
    path,
    items: await publicItems(ids, lang),
    languages: await languagesWithContent(ids),
  };
}
