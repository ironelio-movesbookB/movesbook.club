import { prisma } from '@/lib/prisma';
import { getSubscriptionById, getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import { loadVersionSettings, saveVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import {
  normalizePaymentModalities,
  type PaymentModalitySettings,
} from '@/lib/subscriptions/paymentModalities';

/** Single preset edited in "Modality of subscription available" (Global settings → Versions). */
const TABLE = 'subscription_modality_presets';
const PRESET_KEY = 'default';

async function ensureTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      presetKey VARCHAR(32) NOT NULL PRIMARY KEY,
      dataJson MEDIUMTEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function getModalityPreset(): Promise<PaymentModalitySettings> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ dataJson: string }>>(
    `SELECT dataJson FROM ${TABLE} WHERE presetKey = ? LIMIT 1`,
    PRESET_KEY,
  );
  if (!rows[0]) return normalizePaymentModalities(null);
  try {
    return normalizePaymentModalities(JSON.parse(rows[0].dataJson));
  } catch {
    return normalizePaymentModalities(null);
  }
}

export async function saveModalityPreset(raw: unknown): Promise<PaymentModalitySettings> {
  const preset = normalizePaymentModalities(raw);
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${TABLE} (presetKey, dataJson) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE dataJson = VALUES(dataJson)`,
    PRESET_KEY,
    JSON.stringify(preset),
  );
  return preset;
}

/**
 * APPLY: copies the preset prices (D price, variances, renewal discount) into a version's settings.
 * The version keeps its own "enabled" checkboxes (Price list tab) when it already has them.
 */
export async function applyModalityPresetToVersion(versionId: number, raw: unknown) {
  const row = getSubscriptionById(versionId);
  if (!row) throw new Error('Unknown subscription version');
  await loadVersionSettings(true);
  const current = getSubscriptionEditData(versionId);
  if (!current) throw new Error('Unknown subscription version');

  const preset = normalizePaymentModalities(raw);
  const previous = current.general.paymentModalities;
  const paymentModalities = normalizePaymentModalities({
    ...preset,
    enabled: previous?.enabled ?? preset.enabled,
  });

  await saveVersionSettings({
    ...current,
    general: { ...current.general, paymentModalities },
  });
  return { versionId, versionName: row.name, paymentModalities };
}
