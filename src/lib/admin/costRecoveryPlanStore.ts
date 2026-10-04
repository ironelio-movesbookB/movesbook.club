import { prisma } from '@/lib/prisma';
import {
  COST_RECOVERY_VERSIONS,
  emptyCostRecoveryPlan,
  sanitizeCostRecoveryPlan,
  type CostRecoveryPlan,
  type CostRecoveryVersion,
} from '@/lib/admin/costRecoveryTypes';

let tableEnsured = false;

/** Same table as the `CostRecoveryPlan` Prisma model, so it works before `prisma db push` is run. */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`cost_recovery_plans\` (
      \`version\` VARCHAR(20) NOT NULL,
      \`data\` LONGTEXT NOT NULL,
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`version\`)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  tableEnsured = true;
}

export async function loadCostRecoveryPlans(): Promise<Record<CostRecoveryVersion, CostRecoveryPlan>> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ version: string; data: string }>>(
    'SELECT `version`, `data` FROM `cost_recovery_plans`',
  );
  const byVersion = new Map(rows.map((r) => [r.version, r.data]));
  return Object.fromEntries(
    COST_RECOVERY_VERSIONS.map((v) => {
      const raw = byVersion.get(v.id);
      if (!raw) return [v.id, emptyCostRecoveryPlan()];
      try {
        return [v.id, sanitizeCostRecoveryPlan(JSON.parse(raw))];
      } catch {
        return [v.id, emptyCostRecoveryPlan()];
      }
    }),
  ) as Record<CostRecoveryVersion, CostRecoveryPlan>;
}

export async function saveCostRecoveryPlan(
  version: CostRecoveryVersion,
  plan: unknown,
): Promise<CostRecoveryPlan> {
  await ensureTable();
  const clean = sanitizeCostRecoveryPlan(plan);
  await prisma.$executeRawUnsafe(
    'INSERT INTO `cost_recovery_plans` (`version`, `data`, `updatedAt`) VALUES (?, ?, NOW(3)) ' +
      'ON DUPLICATE KEY UPDATE `data` = VALUES(`data`), `updatedAt` = NOW(3)',
    version,
    JSON.stringify(clean),
  );
  return clean;
}
