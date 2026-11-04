/**
 * Seeds Archive of Users slot long texts (Settings → Language → Long texts → Management).
 *
 *   npm run db:seed-member-archive-slots-info            # insert missing languages only
 *   npm run db:seed-member-archive-slots-info -- --force # also overwrite existing EN + IT text
 */
import { PrismaClient } from '@prisma/client';
import {
  ADD_AVAILABLE_SLOTS_FORM_EN,
  ADD_AVAILABLE_SLOTS_FORM_IT,
  ADD_AVAILABLE_SLOTS_FORM_KEY,
  ARCHIVE_LOW_SLOTS_NOTICE_EN,
  ARCHIVE_LOW_SLOTS_NOTICE_IT,
  ARCHIVE_LOW_SLOTS_NOTICE_KEY,
  MEMBER_REMOVE_SLOTS_INFO_EN,
  MEMBER_REMOVE_SLOTS_INFO_IT,
  MEMBER_REMOVE_SLOTS_INFO_KEY,
} from '../src/constants/memberArchiveSlotsLongText';
import {
  MEMBER_RENAME_INFO_EN,
  MEMBER_RENAME_INFO_IT,
  MEMBER_RENAME_INFO_KEY,
} from '../src/constants/memberRenameQuotaLongText';

const prisma = new PrismaClient();
const CATEGORY = 'management';

const ENTRIES: Array<{ key: string; language: string; value: string }> = [
  { key: MEMBER_REMOVE_SLOTS_INFO_KEY, language: 'en', value: MEMBER_REMOVE_SLOTS_INFO_EN },
  { key: MEMBER_REMOVE_SLOTS_INFO_KEY, language: 'it', value: MEMBER_REMOVE_SLOTS_INFO_IT },
  { key: ARCHIVE_LOW_SLOTS_NOTICE_KEY, language: 'en', value: ARCHIVE_LOW_SLOTS_NOTICE_EN },
  { key: ARCHIVE_LOW_SLOTS_NOTICE_KEY, language: 'it', value: ARCHIVE_LOW_SLOTS_NOTICE_IT },
  { key: ADD_AVAILABLE_SLOTS_FORM_KEY, language: 'en', value: ADD_AVAILABLE_SLOTS_FORM_EN },
  { key: ADD_AVAILABLE_SLOTS_FORM_KEY, language: 'it', value: ADD_AVAILABLE_SLOTS_FORM_IT },
  { key: MEMBER_RENAME_INFO_KEY, language: 'en', value: MEMBER_RENAME_INFO_EN },
  { key: MEMBER_RENAME_INFO_KEY, language: 'it', value: MEMBER_RENAME_INFO_IT },
];

async function upsertLocale(
  key: string,
  language: string,
  value: string,
  force: boolean,
) {
  const existing = await prisma.translation.findUnique({
    where: { key_language: { key, language } },
    select: { id: true, category: true, isDeleted: true },
  });

  if (!existing) {
    await prisma.translation.create({
      data: {
        key,
        language,
        value,
        category: CATEGORY,
        isDeleted: false,
      },
    });
    console.log(`✅ Created ${key} (${language}) in category "${CATEGORY}".`);
    return;
  }

  if (force) {
    await prisma.translation.update({
      where: { id: existing.id },
      data: { value, category: CATEGORY, isDeleted: false },
    });
    console.log(`✅ Overwrote ${key} (${language}).`);
    return;
  }

  if (existing.isDeleted || existing.category !== CATEGORY) {
    await prisma.translation.update({
      where: { id: existing.id },
      data: {
        category: CATEGORY,
        isDeleted: false,
        ...(existing.isDeleted ? { value } : {}),
      },
    });
    console.log(`✅ Restored ${key} (${language}) to category "${CATEGORY}".`);
    return;
  }

  console.log(
    `ℹ️  ${key} (${language}) already exists — left unchanged. Use --force to overwrite.`,
  );
}

async function main() {
  const force = process.argv.includes('--force');
  for (const entry of ENTRIES) {
    await upsertLocale(entry.key, entry.language, entry.value, force);
  }

  const rows = await prisma.translation.findMany({
    where: {
      key: {
        in: [
          MEMBER_REMOVE_SLOTS_INFO_KEY,
          ARCHIVE_LOW_SLOTS_NOTICE_KEY,
          ADD_AVAILABLE_SLOTS_FORM_KEY,
          MEMBER_RENAME_INFO_KEY,
        ],
      },
    },
    select: { key: true, language: true, category: true, isDeleted: true },
    orderBy: [{ key: 'asc' }, { language: 'asc' }],
  });
  console.log('Current rows:', rows);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
