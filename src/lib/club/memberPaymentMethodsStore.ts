import { prisma } from '@/lib/prisma';
import {
  factoryStoredMemberPaymentMethods,
  normalizeStoredMemberPaymentMethods,
  type StoredMemberPaymentMethods,
} from '@/lib/club/memberPaymentMethods';

const TABLE_NAME = 'club_member_payment_methods';

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      entity_id VARCHAR(191) NOT NULL PRIMARY KEY,
      settings_json LONGTEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function loadStoredMemberPaymentMethods(
  entityId: string,
): Promise<StoredMemberPaymentMethods> {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ settings_json: string }[]>`
    SELECT settings_json
    FROM club_member_payment_methods
    WHERE entity_id = ${entityId}
    LIMIT 1
  `;
  const raw = rows[0]?.settings_json;
  if (!raw) return factoryStoredMemberPaymentMethods();
  try {
    return normalizeStoredMemberPaymentMethods(JSON.parse(raw));
  } catch {
    return factoryStoredMemberPaymentMethods();
  }
}

export async function saveStoredMemberPaymentMethods(
  entityId: string,
  input: unknown,
): Promise<StoredMemberPaymentMethods> {
  await ensureTable();
  const previous = await loadStoredMemberPaymentMethods(entityId);
  const settings = normalizeStoredMemberPaymentMethods(input, previous);
  const json = JSON.stringify(settings);
  await prisma.$executeRaw`
    INSERT INTO club_member_payment_methods (entity_id, settings_json)
    VALUES (${entityId}, ${json})
    ON DUPLICATE KEY UPDATE settings_json = ${json}
  `;
  return settings;
}
