/**
 * Seeds the `Payment_info` long text (Settings → Language → Language Long Texts → Management).
 *
 *   npm run db:seed-payment-info            # insert English only if the key is missing
 *   npm run db:seed-payment-info -- --force # also overwrite the existing English text
 *
 * Translations in other languages are never touched.
 */
import { PrismaClient } from '@prisma/client';
import {
  PAYMENT_INFO_DEFAULT_EN,
  PAYMENT_INFO_TRANSLATION_KEY,
} from '../src/constants/paymentInfoLongText';

const prisma = new PrismaClient();
const CATEGORY = 'management';

async function main() {
  const force = process.argv.includes('--force');
  const existing = await prisma.translation.findUnique({
    where: { key_language: { key: PAYMENT_INFO_TRANSLATION_KEY, language: 'en' } },
    select: { id: true, category: true, isDeleted: true },
  });

  if (!existing) {
    await prisma.translation.create({
      data: {
        key: PAYMENT_INFO_TRANSLATION_KEY,
        language: 'en',
        value: PAYMENT_INFO_DEFAULT_EN,
        category: CATEGORY,
        isDeleted: false,
      },
    });
    console.log(`✅ Created ${PAYMENT_INFO_TRANSLATION_KEY} (en) in category "${CATEGORY}".`);
  } else if (force) {
    await prisma.translation.update({
      where: { id: existing.id },
      data: { value: PAYMENT_INFO_DEFAULT_EN, category: CATEGORY, isDeleted: false },
    });
    console.log(`✅ Overwrote ${PAYMENT_INFO_TRANSLATION_KEY} (en) with the default text (--force).`);
  } else {
    console.log(
      `ℹ️  ${PAYMENT_INFO_TRANSLATION_KEY} (en) already exists (category "${existing.category}"${
        existing.isDeleted ? ', deleted' : ''
      }) — left unchanged. Use --force to overwrite the English text.`,
    );
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
