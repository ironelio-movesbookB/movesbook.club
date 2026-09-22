import { prisma } from '@/lib/prisma';

const DISCOUNT_EVERY_100_KEY = 'discount_every_100';

export type DiscountEvery100Settings = {
  enabled: boolean;
  percent: number;
};

async function tableExists(tableName: string): Promise<boolean> {
  if (!(process.env.DATABASE_URL || '').startsWith('mysql')) return false;
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    tableName
  );
  return rows.length > 0;
}

export async function ensurePromocodeAppSettingsTable(): Promise<void> {
  if (!(process.env.DATABASE_URL || '').startsWith('mysql')) return;
  if (await tableExists('promocode_app_settings')) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE promocode_app_settings (
      setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function getDiscountEvery100Settings(): Promise<DiscountEvery100Settings> {
  await ensurePromocodeAppSettingsTable();
  if (!(await tableExists('promocode_app_settings'))) {
    return { enabled: true, percent: 0 };
  }

  const rows = await prisma.$queryRawUnsafe<{ setting_value: string | null }[]>(
    `SELECT setting_value FROM promocode_app_settings WHERE setting_key = ? LIMIT 1`,
    DISCOUNT_EVERY_100_KEY
  );
  const raw = rows[0]?.setting_value;
  if (!raw) return { enabled: true, percent: 0 };

  try {
    const parsed = JSON.parse(String(raw)) as { enabled?: boolean; percent?: number | string };
    const percent = Number(parsed.percent);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      percent: Number.isFinite(percent) ? percent : 0,
    };
  } catch {
    return { enabled: true, percent: 0 };
  }
}

export async function setDiscountEvery100Settings(
  settings: DiscountEvery100Settings
): Promise<DiscountEvery100Settings> {
  await ensurePromocodeAppSettingsTable();
  const normalized: DiscountEvery100Settings = {
    enabled: Boolean(settings.enabled),
    percent: Math.max(0, Math.min(100, Number(settings.percent) || 0)),
  };
  const value = JSON.stringify(normalized);

  if (!(await tableExists('promocode_app_settings'))) {
    return normalized;
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO promocode_app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    DISCOUNT_EVERY_100_KEY,
    value
  );
  return normalized;
}
