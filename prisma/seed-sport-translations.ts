/**
 * Seeds the site texts (category "sports") from prisma/data/sport-translations.json.
 *
 *   npm run db:seed-sport-translations            # insert only the missing key/language rows
 *   npm run db:seed-sport-translations -- --force # also overwrite existing values with the file's
 *
 * Without --force, translations already present in the database (e.g. edited by an admin
 * in Settings → Language) are never changed.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const CATEGORY = 'sports';
const DATA_FILE = path.join(__dirname, 'data', 'sport-translations.json');
const BATCH = 500;

async function main() {
  const force = process.argv.includes('--force');
  const data: Record<string, Record<string, string>> = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const wanted = Object.entries(data).flatMap(([key, values]) =>
    Object.entries(values)
      .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([language, value]) => ({ key, language, value }))
  );

  const existing = await prisma.translation.findMany({
    where: { key: { in: Object.keys(data) } },
    select: { id: true, key: true, language: true, value: true },
  });
  const existingByKey = new Map(existing.map((row) => [`${row.key}\u0000${row.language}`, row]));

  const toCreate = wanted.filter((row) => !existingByKey.has(`${row.key}\u0000${row.language}`));
  for (let i = 0; i < toCreate.length; i += BATCH) {
    await prisma.translation.createMany({
      data: toCreate.slice(i, i + BATCH).map((row) => ({ ...row, category: CATEGORY, isDeleted: false })),
      skipDuplicates: true,
    });
  }

  let updated = 0;
  if (force) {
    for (const row of wanted) {
      const current = existingByKey.get(`${row.key}\u0000${row.language}`);
      if (!current || current.value === row.value) continue;
      await prisma.translation.update({
        where: { id: current.id },
        data: { value: row.value, category: CATEGORY, isDeleted: false },
      });
      updated++;
    }
  }

  console.log(`✅ Site texts: ${toCreate.length} created, ${updated} updated, ${wanted.length - toCreate.length - updated} unchanged.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
