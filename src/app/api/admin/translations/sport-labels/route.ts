import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { ALL_LANGUAGES } from '@/constants/language.constants';
import { SPORT_I18N_CATEGORY } from '@/lib/sport/sportI18n';
import { sportI18nCatalog } from '@/lib/sport/sportI18nCatalog';
import { sportNameTranslation } from '@/lib/sport/sportNameTranslations';
import { translateTexts } from '@/lib/translation/translateBatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TARGET_LANGUAGES = ALL_LANGUAGES.map((l) => l.code).filter((c) => c !== 'en');

async function missingByLanguage(keys: string[]) {
  const rows = await prisma.translation.findMany({
    where: { key: { in: keys } },
    select: { key: true, language: true, value: true },
  });
  const have = new Set(rows.filter((r) => r.value.trim()).map((r) => `${r.language}\u0000${r.key}`));
  const missing: Record<string, string[]> = {};
  for (const lang of ['en', ...TARGET_LANGUAGES]) {
    missing[lang] = keys.filter((k) => !have.has(`${lang}\u0000${k}`));
  }
  return missing;
}

/** How many sport labels are still missing per language. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const catalog = sportI18nCatalog();
  const missing = await missingByLanguage(Object.keys(catalog));
  return NextResponse.json({
    total: Object.keys(catalog).length,
    missing: Object.fromEntries(Object.entries(missing).map(([l, k]) => [l, k.length])),
  });
}

/**
 * Registers every sport label in the Section languages (category "sports") and
 * auto-translates the missing ones. Values already present are never overwritten.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as { languages?: string[] };
  const languages = Array.isArray(body.languages)
    ? TARGET_LANGUAGES.filter((l) => body.languages!.includes(l))
    : TARGET_LANGUAGES;

  const catalog = sportI18nCatalog();
  const missing = await missingByLanguage(Object.keys(catalog));
  const created: Record<string, number> = {};
  const failed: Record<string, number> = {};

  const write = async (lang: string, entries: [string, string][]) => {
    if (entries.length === 0) return;
    await prisma.translation.deleteMany({
      where: { language: lang, key: { in: entries.map(([k]) => k) }, value: '' },
    });
    await prisma.translation.createMany({
      data: entries.map(([key, value]) => ({
        key,
        language: lang,
        value,
        category: SPORT_I18N_CATEGORY,
      })),
      skipDuplicates: true,
    });
  };

  await write('en', missing.en.map((k) => [k, catalog[k]]));
  created.en = missing.en.length;

  for (const lang of languages) {
    const keys = missing[lang];
    if (keys.length === 0) {
      created[lang] = 0;
      continue;
    }
    const curated = new Map(
      keys.flatMap((k) => {
        const value = sportNameTranslation(catalog[k], lang);
        return value ? [[k, value] as const] : [];
      }),
    );
    const toTranslate = keys.filter((k) => !curated.has(k));
    const translated = await translateTexts(
      toTranslate.map((k) => catalog[k]),
      lang,
    );
    const entries = [
      ...curated.entries(),
      ...toTranslate.map((k, i) => [k, translated[i]] as const),
    ].filter((e): e is readonly [string, string] => Boolean(e[1]));
    await write(lang, entries.map(([k, v]) => [k, v]));
    created[lang] = entries.length;
    failed[lang] = keys.length - entries.length;
  }

  return NextResponse.json({ total: Object.keys(catalog).length, created, failed });
}
