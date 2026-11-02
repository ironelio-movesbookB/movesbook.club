/**
 * Seeds the `Payment_info` long text (Settings → Language → Language Long Texts → Management).
 *
 *   npm run db:seed-payment-info            # insert missing languages only
 *   npm run db:seed-payment-info -- --force # also overwrite existing EN + IT text
 *
 * Other languages are never touched.
 */
import { PrismaClient } from '@prisma/client';
import {
  PAYMENT_INFO_DEFAULT_EN,
  PAYMENT_INFO_DEFAULT_IT,
  PAYMENT_INFO_TRANSLATION_KEY,
} from '../src/constants/paymentInfoLongText';

const prisma = new PrismaClient();
const CATEGORY = 'management';

const LOCALES: Array<{ language: string; value: string }> = [
  { language: 'en', value: PAYMENT_INFO_DEFAULT_EN },
  { language: 'it', value: PAYMENT_INFO_DEFAULT_IT },
];

async function upsertLocale(language: string, value: string, force: boolean) {
  const existing = await prisma.translation.findUnique({
    where: { key_language: { key: PAYMENT_INFO_TRANSLATION_KEY, language } },
    select: { id: true, category: true, isDeleted: true },
  });

  if (!existing) {
    await prisma.translation.create({
      data: {
        key: PAYMENT_INFO_TRANSLATION_KEY,
        language,
        value,
        category: CATEGORY,
        isDeleted: false,
      },
    });
    console.log(`✅ Created ${PAYMENT_INFO_TRANSLATION_KEY} (${language}) in category "${CATEGORY}".`);
    return;
  }

  if (force) {
    await prisma.translation.update({
      where: { id: existing.id },
      data: { value, category: CATEGORY, isDeleted: false },
    });
    console.log(`✅ Overwrote ${PAYMENT_INFO_TRANSLATION_KEY} (${language}).`);
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
    console.log(
      `✅ Restored ${PAYMENT_INFO_TRANSLATION_KEY} (${language}) to category "${CATEGORY}".`,
    );
    return;
  }

  console.log(
    `ℹ️  ${PAYMENT_INFO_TRANSLATION_KEY} (${language}) already exists — left unchanged. Use --force to overwrite.`,
  );
}

async function main() {
  const force = process.argv.includes('--force');
  for (const locale of LOCALES) {
    await upsertLocale(locale.language, locale.value, force);
  }

  const rows = await prisma.translation.findMany({
    where: { key: PAYMENT_INFO_TRANSLATION_KEY },
    select: { language: true, category: true, isDeleted: true },
    orderBy: { language: 'asc' },
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
