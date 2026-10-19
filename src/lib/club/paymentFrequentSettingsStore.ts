import { prisma } from '@/lib/prisma';
import {
  factoryPaymentFrequentSettings,
  normalizePaymentFrequentSettings,
  type PaymentFrequentSettings,
} from '@/lib/club/paymentFrequentSettings';

const TABLE_NAME = 'club_payment_frequent_settings';

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      club_id VARCHAR(191) NOT NULL PRIMARY KEY,
      settings_json LONGTEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function loadPaymentFrequentSettings(clubId: string): Promise<PaymentFrequentSettings> {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ settings_json: string }[]>`
    SELECT settings_json
    FROM club_payment_frequent_settings
    WHERE club_id = ${clubId}
    LIMIT 1
  `;
  const raw = rows[0]?.settings_json;
  if (!raw) return factoryPaymentFrequentSettings();
  try {
    return normalizePaymentFrequentSettings(JSON.parse(raw));
  } catch {
    return factoryPaymentFrequentSettings();
  }
}

export async function savePaymentFrequentSettings(
  clubId: string,
  input: unknown,
): Promise<PaymentFrequentSettings> {
  await ensureTable();
  const settings = normalizePaymentFrequentSettings(input);
  const json = JSON.stringify(settings);
  await prisma.$executeRaw`
    INSERT INTO club_payment_frequent_settings (club_id, settings_json)
    VALUES (${clubId}, ${json})
    ON DUPLICATE KEY UPDATE settings_json = ${json}
  `;
  return settings;
}
