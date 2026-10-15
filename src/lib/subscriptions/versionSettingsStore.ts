import { prisma } from '@/lib/prisma';
import {
  applySubscriptionEditDataSnapshot,
  getSubscriptionById,
} from '@/lib/admin/subscriptionSettingsMock';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';

/** Server cache lifetime — admin saves update it immediately on this instance. */
const CACHE_TTL_MS = 30_000;

let tableEnsured = false;
let loadedAt = 0;
let loading: Promise<Record<string, SubscriptionEditData>> | null = null;
let snapshot: Record<string, SubscriptionEditData> = {};

async function ensureVersionSettingsTable(): Promise<void> {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_version_settings (
      versionId INT NOT NULL PRIMARY KEY,
      dataJson MEDIUMTEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  tableEnsured = true;
}

async function readAllFromDb(): Promise<Record<string, SubscriptionEditData>> {
  await ensureVersionSettingsTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ versionId: number; dataJson: string }>>(
    `SELECT versionId, dataJson FROM subscription_version_settings`,
  );
  const out: Record<string, SubscriptionEditData> = {};
  for (const row of rows) {
    try {
      const data = JSON.parse(row.dataJson) as SubscriptionEditData;
      if (data && typeof data === 'object') {
        out[String(row.versionId)] = { ...data, id: Number(row.versionId) };
      }
    } catch {
      // Skip corrupt rows.
    }
  }
  return out;
}

/** All saved version settings keyed by version id (cached for a short time). */
export async function loadVersionSettings(force = false): Promise<Record<string, SubscriptionEditData>> {
  if (!force && loadedAt && Date.now() - loadedAt < CACHE_TTL_MS) return snapshot;
  if (!loading) {
    loading = readAllFromDb()
      .then((data) => {
        snapshot = data;
        loadedAt = Date.now();
        applySubscriptionEditDataSnapshot(data);
        return data;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/**
 * Load saved version settings into the shared settings module so server code
 * (pricing, registration, special offers) sees the admin's values.
 */
export async function hydrateVersionSettings(): Promise<void> {
  try {
    await loadVersionSettings();
  } catch (e) {
    console.error('hydrateVersionSettings', e);
  }
}

export async function saveVersionSettings(data: SubscriptionEditData): Promise<void> {
  const versionId = Number(data.id);
  if (!Number.isInteger(versionId) || versionId <= 0 || !getSubscriptionById(versionId)) {
    throw new Error('Unknown subscription version');
  }
  await ensureVersionSettingsTable();
  const payload = { ...data, id: versionId };
  await prisma.$executeRawUnsafe(
    `INSERT INTO subscription_version_settings (versionId, dataJson) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE dataJson = VALUES(dataJson)`,
    versionId,
    JSON.stringify(payload),
  );
  snapshot = { ...snapshot, [String(versionId)]: payload };
  loadedAt = Date.now();
  applySubscriptionEditDataSnapshot({ [String(versionId)]: payload });
}
