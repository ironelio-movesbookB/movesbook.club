import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { resolveSecondaryCreditAmount } from './resolveSecondaryCreditAmount';

/** Registered apply row this user earns a friend-of-friend credit on. */
export type FriendOfFriendApply = Record<string, unknown> & {
  friend_of_friend_credit: number;
};

function ids(values: unknown[]): number[] {
  return Array.from(
    new Set(values.map((v) => Number(v ?? 0)).filter((id) => Number.isFinite(id) && id > 0))
  );
}

async function directFriendIds(appliesTable: string, legacyUserId: number): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<{ receiver_id: number | bigint | null }[]>(
    `SELECT DISTINCT receiver_id FROM \`${appliesTable}\`
     WHERE sender_id = ? AND receiver_id > 0 AND delete_status = 2`,
    legacyUserId
  );
  return ids(rows.map((r) => r.receiver_id)).filter((id) => id !== legacyUserId);
}

/**
 * Direct friends whose latest inviter is this user. Registration gives the
 * friend-of-friend credit to the latest inviter of the direct sender.
 */
export async function ownedDirectFriendIds(
  appliesTable: string,
  legacyUserId: number
): Promise<number[]> {
  const friends = await directFriendIds(appliesTable, legacyUserId);
  if (friends.length === 0) return [];
  const placeholders = friends.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<
    { receiver_id: number | bigint | null; sender_id: number | bigint | null }[]
  >(
    `SELECT receiver_id, sender_id FROM \`${appliesTable}\`
     WHERE receiver_id IN (${placeholders}) AND delete_status = 2
     ORDER BY id DESC`,
    ...friends
  );
  const latestInviter = new Map<number, number>();
  for (const row of rows) {
    const receiverId = Number(row.receiver_id ?? 0);
    if (receiverId > 0 && !latestInviter.has(receiverId)) {
      latestInviter.set(receiverId, Number(row.sender_id ?? 0));
    }
  }
  return friends.filter((id) => latestInviter.get(id) === legacyUserId);
}

/**
 * Registrations made through this user's direct friends that earn this user the
 * friend-of-friend credit, with the credit resolved from the admin version settings
 * when it was not stored.
 */
export async function listFriendOfFriendApplies(
  appliesTable: string,
  legacyUserId: number,
  selectSql = `SELECT pa.* FROM \`${appliesTable}\` pa`
): Promise<FriendOfFriendApply[]> {
  if (legacyUserId <= 0) return [];
  const cols = await getTableColumns(appliesTable);
  const hasSecondaryId = cols.has('secondary_sender_id');

  const rows: Record<string, unknown>[] = [];
  if (hasSecondaryId) {
    rows.push(
      ...(await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `${selectSql}
         WHERE pa.secondary_sender_id = ? AND pa.receiver_id > 0 AND pa.delete_status = 2`,
        legacyUserId
      ))
    );
  }

  const owned = await ownedDirectFriendIds(appliesTable, legacyUserId);
  if (owned.length > 0) {
    const placeholders = owned.map(() => '?').join(',');
    const unassigned = hasSecondaryId
      ? ' AND (pa.secondary_sender_id IS NULL OR pa.secondary_sender_id <= 0)'
      : '';
    rows.push(
      ...(await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `${selectSql}
         WHERE pa.sender_id IN (${placeholders}) AND pa.receiver_id > 0 AND pa.delete_status = 2${unassigned}`,
        ...owned
      ))
    );
  }

  const seen = new Set<number>();
  const out: FriendOfFriendApply[] = [];
  for (const row of rows) {
    const rowId = Number(row.id ?? 0);
    if (rowId > 0 && seen.has(rowId)) continue;
    if (rowId > 0) seen.add(rowId);
    if (Number(row.receiver_id ?? 0) === legacyUserId) continue;
    if (Number(row.sender_id ?? 0) === legacyUserId) continue;
    const credit = await resolveSecondaryCreditAmount({
      storedCredit: Number(row.secondary_sender_credit ?? 0) || 0,
      receiverId: Number(row.receiver_id ?? 0),
      receiverVersionName: String(row.receiver_version ?? ''),
      promocodeId: Number(row.promocode_id ?? 0) || undefined,
    });
    out.push({ ...row, friend_of_friend_credit: credit });
  }

  out.sort(
    (a, b) => new Date(String(b.created ?? 0)).getTime() - new Date(String(a.created ?? 0)).getTime()
  );
  return out;
}
