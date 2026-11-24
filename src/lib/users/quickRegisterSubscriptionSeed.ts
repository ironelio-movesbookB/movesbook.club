import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { ensurePromocodeMetaTables } from '@/lib/promocodes/ensureMetaTables';
import { getSubscriptionSettingsTable } from '@/lib/promocodes/legacyDb';

/** Rows used by quick register (Single User role 5, Club role 8). */
export const QUICK_REGISTER_SUBSCRIPTION_ROWS: {
  id: number;
  role_id: number;
  subscription_name: string;
  short_name: string;
  days_duration: number;
  price: number;
  credit: number;
  credit2: number;
  members_number1: number;
  members_number2: number;
  discount: number;
}[] = [
  {
    id: 2,
    role_id: 5,
    subscription_name: 'Single User — Base',
    short_name: 'Base',
    days_duration: 365,
    price: 100,
    credit: 30,
    credit2: 8,
    members_number1: 0,
    members_number2: 0,
    discount: 0,
  },
  {
    id: 3,
    role_id: 5,
    subscription_name: 'Single User — Premium',
    short_name: 'Premium',
    days_duration: 365,
    price: 123,
    credit: 2,
    credit2: 5,
    members_number1: 0,
    members_number2: 0,
    discount: 0,
  },
  {
    id: 4,
    role_id: 5,
    subscription_name: 'Single User — Professional',
    short_name: 'Professional',
    days_duration: 365,
    price: 100,
    credit: 0,
    credit2: 0,
    members_number1: 0,
    members_number2: 0,
    discount: 0,
  },
  {
    id: 9,
    role_id: 8,
    subscription_name: 'Club — Base',
    short_name: 'Base',
    days_duration: 365,
    price: 10,
    credit: 3,
    credit2: 3,
    members_number1: 700,
    members_number2: 0,
    discount: 0,
  },
  {
    id: 10,
    role_id: 8,
    subscription_name: 'Club — Premium',
    short_name: 'Premium',
    days_duration: 180,
    price: 10,
    credit: 3,
    credit2: 3,
    members_number1: 8,
    members_number2: 0,
    discount: 0,
  },
];

const OPTIONAL_COLUMNS: [string, string][] = [
  ['role_id', 'INT NULL'],
  ['short_name', "VARCHAR(64) NULL"],
  ['days_duration', 'INT NULL DEFAULT 365'],
  ['price', 'DECIMAL(10,2) NULL DEFAULT 0'],
  ['credit', "VARCHAR(32) NULL DEFAULT '0'"],
  ['credit2', "VARCHAR(32) NULL DEFAULT '0'"],
  ['credit1', "VARCHAR(32) NULL DEFAULT '0'"],
  ['members_number1', 'INT NULL DEFAULT 0'],
  ['members_number2', 'INT NULL DEFAULT 0'],
  ['discount', "VARCHAR(32) NULL DEFAULT '0'"],
  ['delete_status', 'TINYINT NULL DEFAULT 2'],
];

let quickRegisterSubscriptionsEnsured = false;

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const columns = await getTableColumns(table);
  if (columns.has(column)) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
  );
}

/** Ensures subscription_settings has quick-register rows with role_id and pricing fields. */
export async function ensureQuickRegisterSubscriptionSettings(): Promise<void> {
  if (quickRegisterSubscriptionsEnsured) return;

  await ensurePromocodeMetaTables();
  const table = await getSubscriptionSettingsTable();
  if (!table) return;

  for (const [column, definition] of OPTIONAL_COLUMNS) {
    await ensureColumn(table, column, definition);
  }

  const columns = await getTableColumns(table);

  for (const row of QUICK_REGISTER_SUBSCRIPTION_ROWS) {
    const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`,
      row.id
    );

    if (existing.length === 0) {
      const fields = ['id', 'subscription_name'];
      const values: unknown[] = [row.id, row.subscription_name];

      const optional: [string, unknown][] = [
        ['role_id', row.role_id],
        ['short_name', row.short_name],
        ['days_duration', row.days_duration],
        ['price', row.price],
        ['credit', String(row.credit)],
        ['credit2', String(row.credit2)],
        ['members_number1', row.members_number1],
        ['members_number2', row.members_number2],
        ['discount', String(row.discount)],
        ['delete_status', 2],
      ];

      for (const [key, val] of optional) {
        if (columns.has(key)) {
          fields.push(key);
          values.push(val);
        }
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${table}\` (${fields.map((f) => `\`${f}\``).join(', ')})
         VALUES (${fields.map(() => '?').join(', ')})`,
        ...values
      );
      continue;
    }

    const sets: string[] = ['`subscription_name` = ?'];
    const vals: unknown[] = [row.subscription_name];

    const updates: [string, unknown][] = [
      ['role_id', row.role_id],
      ['short_name', row.short_name],
      ['days_duration', row.days_duration],
      ['price', row.price],
      ['credit', String(row.credit)],
      ['credit2', String(row.credit2)],
      ['members_number1', row.members_number1],
      ['members_number2', row.members_number2],
      ['discount', String(row.discount)],
      ['delete_status', 2],
    ];

    for (const [key, val] of updates) {
      if (columns.has(key)) {
        sets.push(`\`${key}\` = ?`);
        vals.push(val);
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE \`${table}\` SET ${sets.join(', ')} WHERE id = ?`,
      ...vals,
      row.id
    );
  }

  quickRegisterSubscriptionsEnsured = true;
}

export function resetQuickRegisterSubscriptionSeedCache(): void {
  quickRegisterSubscriptionsEnsured = false;
}
