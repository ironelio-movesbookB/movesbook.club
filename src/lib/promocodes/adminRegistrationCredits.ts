import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  getSubscriptionEditData,
  getSubscriptionRowsByUserType,
} from '@/lib/admin/subscriptionSettingsMock';
import { hydrateVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import type { SubscriptionListRow, SubscriptionUserType } from '@/types/adminSubscriptionSettings';
import { getSubscriptionSettingsTable } from './legacyDb';

export type AdminRegistrationCredits = {
  adminVersionId: number;
  /** First "For the sender user" box. */
  directSender: number;
  /** Second "For the sender user" box. */
  friendOfFriend: number;
  /** First "For the user that receive the invitation" box. */
  newUser: number;
};

const ROLE_USER_TYPES: Record<number, SubscriptionUserType> = {
  5: 'athlete',
  6: 'coach',
  7: 'team',
  8: 'club',
  9: 'group',
};

type Tier = 'trial' | 'professional' | 'premium' | 'base';

function tierOf(text: string): Tier | null {
  const t = text.toLowerCase();
  if (t.includes('trial')) return 'trial';
  if (t.includes('professional') || /\bpro\b/.test(t)) return 'professional';
  if (t.includes('premium')) return 'premium';
  if (t.includes('base') || t.includes('standard')) return 'base';
  return null;
}

function findAdminRow(userType: SubscriptionUserType, tier: Tier): SubscriptionListRow | null {
  const candidates = getSubscriptionRowsByUserType(userType).filter(
    (row) => !row.isTemplate && row.name.trim() && tierOf(`${row.name} ${row.code}`) === tier
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.name.length - b.name.length);
  return candidates[0];
}

function nonNegative(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Registration versions live in the legacy `subscription_settings` table, while the admin
 * edits credits on its own version list. Versions are matched by user type and tier
 * (base / premium / professional / trial).
 */
export async function getAdminRegistrationCredits(
  legacySettingId: number
): Promise<AdminRegistrationCredits | null> {
  if (!Number.isFinite(legacySettingId) || legacySettingId <= 0) return null;
  const table = await getSubscriptionSettingsTable();
  if (!table) return null;

  const cols = await getTableColumns(table);
  const selectCols = ['id', 'role_id', 'subscription_name', 'short_name'].filter((c) => cols.has(c));
  if (!selectCols.includes('role_id')) return null;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\` WHERE id = ? LIMIT 1`,
    legacySettingId
  );
  const row = rows[0];
  if (!row) return null;

  const userType = ROLE_USER_TYPES[Number(row.role_id ?? 0)];
  if (!userType) return null;
  const tier =
    tierOf(String(row.short_name ?? '')) ?? tierOf(String(row.subscription_name ?? ''));
  if (!tier) return null;

  await hydrateVersionSettings();
  const adminRow = findAdminRow(userType, tier);
  if (!adminRow) return null;
  const editData = getSubscriptionEditData(adminRow.id, false);
  if (!editData) return null;

  return {
    adminVersionId: adminRow.id,
    directSender: nonNegative(editData.general.senderRegisterCredit1),
    friendOfFriend: nonNegative(editData.general.senderRegisterCredit2),
    newUser: nonNegative(editData.general.receiverRegisterCredit1),
  };
}
