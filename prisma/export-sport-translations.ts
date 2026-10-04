/**
 * Exports the site texts (category "sports": section labels + auto-translated UI texts)
 * from the current DATABASE_URL into prisma/data/sport-translations.json,
 * so they can be seeded into another database with `npm run db:seed-sport-translations`.
 *
 *   npm run db:export-sport-translations
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const CATEGORY = 'sports';
const OUT_FILE = path.join(__dirname, 'data', 'sport-translations.json');

async function main() {
  const rows = await prisma.translation.findMany({
    where: { category: CATEGORY, isDeleted: false },
    select: { key: true, language: true, value: true },
    orderBy: [{ key: 'asc' }, { language: 'asc' }],
  });

  const byKey: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    (byKey[row.key] ??= {})[row.language] = row.value;
  }

  const perLanguage: Record<string, number> = {};
  for (const row of rows) perLanguage[row.language] = (perLanguage[row.language] ?? 0) + 1;

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(byKey, null, 1) + '\n', 'utf8');

  console.log(`✅ Exported ${Object.keys(byKey).length} keys (${rows.length} rows) to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log('   Rows per language:', perLanguage);
}

main()
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
