import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  fetchCountryCodeById,
  fetchFlagImageByCountryId,
  fetchLegacyUsersByIds,
  getLegacyUsersTable,
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getSubscriptionSettingsTable,
} from './legacyDb';
import { fetchModernUserCountries, findModernUserCountry } from './modernUserCountry';
import { attachEntityLogos } from './promocodeAvatars';
import type { PaginatedResult, PromocodeUserRow } from './types';

function formatDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const s = String(value).trim();
    return s.length >= 10 ? s.slice(0, 10) : s || null;
  }
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const s = String(value).trim();
    return s || null;
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const ROLE_NAMES: Record<number, string> = {
  1: 'Super Admin',
  2: 'Admin',
  5: 'Single User',
  6: 'Coach',
  7: 'Team',
  8: 'Club',
  9: 'Group',
};

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function blankDate(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'null' || text.startsWith('0000-00-00')) return '';
  return text;
}

/** Registered people are usernames; dates and cost come from the apply row or the user subscription. */
async function annotateRegisteredPeople(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;
  const ids = new Set<number>();
  for (const row of rows) {
    const senderId = Number(row.sender_id ?? 0);
    const receiverId = Number(row.receiver_id ?? 0);
    if (senderId > 0) ids.add(senderId);
    if (receiverId > 0) ids.add(receiverId);
  }
  const users = await fetchLegacyUsersByIds(Array.from(ids));
  await attachEntityLogos(users);
  return rows.map((row) => {
    const sender = users.get(Number(row.sender_id ?? 0));
    const receiverId = Number(row.receiver_id ?? 0);
    const receiver = receiverId > 0 ? users.get(receiverId) : undefined;
    const registered = Boolean(receiver);
    return {
      ...row,
      sender_username: sender?.username ?? '',
      sender_email: sender?.email || row.sender_email || '',
      sender_image: sender?.image ?? '',
      sender_logo: sender?.logoUrl ?? '',
      sender_role_id: sender?.roleId ?? null,
      receiver_username: registered ? receiver?.username ?? '' : '',
      receiver_email: receiver?.email || row.receiver_email || '',
      receiver_image: receiver?.image ?? '',
      receiver_logo: receiver?.logoUrl ?? '',
      receiver_role_id: receiver?.roleId ?? null,
      registration_date:
        blankDate(row.registration_date) ||
        (registered ? receiver?.subscriptionStartDate ?? '' : ''),
      subscription_start_date:
        blankDate(row.subscription_start_date) ||
        (registered ? receiver?.subscriptionStartDate ?? '' : ''),
      subscription_end_date:
        blankDate(row.subscription_end_date) ||
        (registered ? receiver?.subscriptionEndDate ?? '' : ''),
      cost_paid: blankDate(row.cost_paid) || blankDate(row.total_payment),
    };
  });
}

function creditOf(row: Record<string, unknown>, key: string): number {
  const n = Number(row[key] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isPendingInvite(row: Record<string, unknown>): boolean {
  return !(Number(row.receiver_id ?? 0) > 0);
}

/** Keep one row per receiver+promocode (prefer highest id / latest). */
function dedupeAppliesByReceiverPromocode(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const receiverId = Number(row.receiver_id ?? 0);
    const promocodeId = Number(row.promocode_id ?? 0);
    const email = String(row.receiver_email ?? '')
      .trim()
      .toLowerCase();
    const key =
      receiverId > 0
        ? `id:${receiverId}:${promocodeId}`
        : `email:${email}:${promocodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function resolveSecondaryCreditFromVersion(
  storedCredit: number,
  receiverVersionName: string
): Promise<number> {
  if (storedCredit > 0) return storedCredit;
  if (!receiverVersionName.trim()) return 0;
  const settingsTable = await getSubscriptionSettingsTable();
  if (!settingsTable) return 0;
  try {
    const rows = await prisma.$queryRawUnsafe<{ credit1: unknown }[]>(
      `SELECT credit1 FROM \`${settingsTable}\`
       WHERE subscription_name = ? LIMIT 1`,
      receiverVersionName.trim()
    );
    const n = Number(rows[0]?.credit1 ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function listUsersOfPromocodes(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<PromocodeUserRow>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const search = (params.search ?? '').trim();

  const appliesTable = await getPromocodeAppliesTable();
  const usersTable = await getLegacyUsersTable();
  const settingsTable = await getPromocodeSettingsTable();

  if (!appliesTable || !usersTable) {
    return { items: [], total: 0, page, pageSize };
  }

  const applyColumns = await getTableColumns(appliesTable);
  const userColumns = await getTableColumns(usersTable);
  if (!applyColumns.has('receiver_id')) {
    return { items: [], total: 0, page, pageSize };
  }

  const receiverRows = await prisma.$queryRawUnsafe<{ receiver_id: number | bigint }[]>(
    `SELECT DISTINCT receiver_id FROM \`${appliesTable}\`
     WHERE delete_status = 2 AND receiver_id > 0`
  );
  let receiverIds = Array.from(
    new Set(receiverRows.map((r) => Number(r.receiver_id)).filter((id) => id > 0))
  );

  if (receiverIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  if (search) {
    const like = `%${search}%`;
    const nameCols: string[] = [];
    if (userColumns.has('username')) nameCols.push('username LIKE ?');
    if (userColumns.has('email')) nameCols.push('email LIKE ?');
    if (userColumns.has('firstname')) nameCols.push('firstname LIKE ?');
    if (userColumns.has('lastname')) nameCols.push('lastname LIKE ?');
    if (nameCols.length > 0) {
      const placeholders = receiverIds.map(() => '?').join(',');
      const searchParams: unknown[] = [...receiverIds];
      for (let i = 0; i < nameCols.length; i++) searchParams.push(like);
      const matched = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
        `SELECT id FROM \`${usersTable}\`
         WHERE id IN (${placeholders}) AND (${nameCols.join(' OR ')})`,
        ...searchParams
      );
      receiverIds = matched.map((r) => Number(r.id)).filter((id) => id > 0);
    }
  }

  if (receiverIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  // Spec: list sorted by username (registered users only — already filtered by receiver_id > 0).
  if (userColumns.has('username')) {
    const placeholders = receiverIds.map(() => '?').join(',');
    const ordered = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${usersTable}\`
       WHERE id IN (${placeholders})
       ORDER BY LOWER(username) ASC, id ASC`,
      ...receiverIds
    );
    receiverIds = ordered.map((r) => Number(r.id)).filter((id) => id > 0);
  } else {
    receiverIds.sort((a, b) => a - b);
  }

  const total = receiverIds.length;
  if (total === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  const offset = (page - 1) * pageSize;
  const pageIds = receiverIds.slice(offset, offset + pageSize);
  const users = await fetchLegacyUsersByIds(pageIds);
  await attachEntityLogos(users);

  const modernCountries = await fetchModernUserCountries(
    pageIds.map((id) => {
      const u = users.get(id);
      return { legacyId: id, email: u?.email ?? null, username: u?.username ?? null };
    })
  );

  const subTable = await getSubscriptionSettingsTable();
  let subNames = new Map<number, string>();
  if (subTable) {
    try {
      const subCols = await getTableColumns(subTable);
      const nameCol = subCols.has('subscription_name')
        ? 'subscription_name'
        : subCols.has('name')
          ? 'name'
          : null;
      if (nameCol) {
        const rows = await prisma.$queryRawUnsafe<{ id: number | bigint; name: string | null }[]>(
          `SELECT id, \`${nameCol}\` AS name FROM \`${subTable}\``
        );
        subNames = new Map(rows.map((r) => [Number(r.id), r.name ? String(r.name) : '']));
      }
    } catch {
      /* ignore */
    }
  }

  const settingsColumns = settingsTable ? await getTableColumns(settingsTable) : new Set<string>();
  const creatorCol = settingsColumns.has('creator_id')
    ? 'creator_id'
    : settingsColumns.has('creater_id')
      ? 'creater_id'
      : null;

  const items: PromocodeUserRow[] = [];
  const now = new Date();

  for (const id of pageIds) {
    const user = users.get(id);
    if (!user) continue;

    const modern = findModernUserCountry(modernCountries, {
      email: user.email,
      username: user.username,
    });
    const countryCode =
      modern?.countryCode ?? (await fetchCountryCodeById(user.countryId)) ?? null;
    const flagImage =
      !countryCode && user.countryId ? await fetchFlagImageByCountryId(user.countryId) : null;

    let firstPromocode: string | null = null;
    try {
      const firstRows = await prisma.$queryRawUnsafe<
        { code: string | null; created: unknown }[]
      >(
        settingsTable
          ? `SELECT ps.code, pa.created
             FROM \`${appliesTable}\` pa
             LEFT JOIN \`${settingsTable}\` ps ON ps.id = pa.promocode_id
             WHERE pa.receiver_id = ? AND pa.delete_status = 2
             ORDER BY pa.created ASC LIMIT 1`
          : `SELECT NULL AS code, created FROM \`${appliesTable}\`
             WHERE receiver_id = ? AND delete_status = 2
             ORDER BY created ASC LIMIT 1`,
        id
      );
      firstPromocode = firstRows[0]?.code != null ? String(firstRows[0].code) : null;
    } catch {
      firstPromocode = null;
    }

    let promocodesGenerated = 0;
    if (settingsTable && creatorCol) {
      try {
        const countRows = await prisma.$queryRawUnsafe<{ c: number | bigint }[]>(
          `SELECT COUNT(*) AS c FROM \`${settingsTable}\`
           WHERE \`${creatorCol}\` = ? AND delete_status = 2`,
          id
        );
        promocodesGenerated = Number(countRows[0]?.c ?? 0);
      } catch {
        promocodesGenerated = 0;
      }
    }

    let creditsEarned = 0;
    // Purchase/spend feature is not implemented yet — always report used = 0.
    const creditsUsed = 0;
    try {
      // Deduped SUM of credits by role. Include receiver_credit (self-registration).
      if (applyColumns.has('sender_credit')) {
        const earnedRows = await prisma.$queryRawUnsafe<{ total: string | number | null }[]>(
          `SELECT COALESCE(SUM(t.credit), 0) AS total FROM (
             SELECT MAX(CAST(sender_credit AS DECIMAL(12,2))) AS credit
             FROM \`${appliesTable}\`
             WHERE sender_id = ? AND delete_status = 2 AND receiver_id > 0
             GROUP BY receiver_id, promocode_id
           ) t`,
          id
        );
        creditsEarned = Number(earnedRows[0]?.total ?? 0) || 0;
      }
      if (applyColumns.has('secondary_sender_credit') && applyColumns.has('secondary_sender_id')) {
        const secRows = await prisma.$queryRawUnsafe<
          {
            receiver_id: number | bigint | null;
            promocode_id: number | bigint | null;
            secondary_sender_credit: unknown;
            receiver_version: string | null;
          }[]
        >(
          `SELECT receiver_id, promocode_id, secondary_sender_credit, receiver_version
           FROM \`${appliesTable}\`
           WHERE secondary_sender_id = ? AND delete_status = 2 AND receiver_id > 0`,
          id
        );
        const seenSec = new Set<string>();
        for (const row of secRows) {
          const rid = Number(row.receiver_id ?? 0);
          const pid = Number(row.promocode_id ?? 0);
          const key = `${rid}:${pid}`;
          if (!rid || seenSec.has(key)) continue;
          seenSec.add(key);
          const resolved = await resolveSecondaryCreditFromVersion(
            Number(row.secondary_sender_credit ?? 0) || 0,
            row.receiver_version != null ? String(row.receiver_version) : ''
          );
          creditsEarned += resolved;
        }
      }
      if (applyColumns.has('receiver_credit')) {
        const recvRows = await prisma.$queryRawUnsafe<{ total: string | number | null }[]>(
          `SELECT COALESCE(SUM(t.credit), 0) AS total FROM (
             SELECT MAX(CAST(receiver_credit AS DECIMAL(12,2))) AS credit
             FROM \`${appliesTable}\`
             WHERE receiver_id = ? AND delete_status = 2 AND receiver_id > 0
             GROUP BY promocode_id
           ) t`,
          id
        );
        creditsEarned += Number(recvRows[0]?.total ?? 0) || 0;
      }
    } catch {
      /* ignore */
    }

    const creditsRemain = Math.max(0, creditsEarned - creditsUsed);

    let lastInviteDate: string | null = null;
    let daysSinceLastInvite: number | null = null;
    try {
      const inviteRows = await prisma.$queryRawUnsafe<{ created: unknown }[]>(
        `SELECT created FROM \`${appliesTable}\`
         WHERE sender_id = ? AND delete_status = 2
         ORDER BY created DESC LIMIT 1`,
        id
      );
      if (inviteRows[0]?.created) {
        lastInviteDate = formatDateTime(inviteRows[0].created);
        const d = new Date(String(inviteRows[0].created));
        if (!Number.isNaN(d.getTime())) {
          daysSinceLastInvite = daysBetween(d, now);
        }
      }
    } catch {
      /* ignore */
    }

    let lastRegistrationDate: string | null = null;
    let daysSinceLastRegistration: number | null = null;
    try {
      const regRows = await prisma.$queryRawUnsafe<{ created: unknown }[]>(
        `SELECT created FROM \`${appliesTable}\`
         WHERE sender_id = ? AND delete_status = 2 AND receiver_id > 0
         ORDER BY created DESC LIMIT 1`,
        id
      );
      if (regRows[0]?.created) {
        lastRegistrationDate = formatDateTime(regRows[0].created);
        const d = new Date(String(regRows[0].created));
        if (!Number.isNaN(d.getTime())) {
          daysSinceLastRegistration = daysBetween(d, now);
        }
      }
    } catch {
      /* ignore */
    }

    const roleId = user.roleId != null ? Number(user.roleId) : 0;
    const versionId = user.subscriptionSettingId != null ? Number(user.subscriptionSettingId) : 0;

    items.push({
      legacyUserId: id,
      username: user.username ?? '',
      wholeName: user.firstname?.trim() || (user.username ?? ''),
      country: modern?.country ?? countryCode,
      countryCode,
      flagImage,
      userType: ROLE_NAMES[roleId] ?? (roleId ? `Role ${roleId}` : ''),
      version: versionId > 0 ? subNames.get(versionId) ?? null : null,
      expiration: formatDate(user.subscriptionEndDate),
      firstPromocode,
      promocodesGenerated,
      creditsEarned,
      creditsUsed,
      creditsRemain: Number.isFinite(creditsRemain) ? creditsRemain : 0,
      lastInviteDate,
      daysSinceLastInvite,
      lastRegistrationDate,
      daysSinceLastRegistration,
      email: user.email,
      image: user.image,
      logoUrl: user.logoUrl ?? null,
      roleId: user.roleId ?? null,
    });
  }

  return { items, total, page, pageSize };
}

export async function listInvitesAndRegistrationsForUser(legacyUserId: number) {
  const appliesTable = await getPromocodeAppliesTable();
  const settingsTable = await getPromocodeSettingsTable();
  if (!appliesTable || legacyUserId <= 0) {
    return {
      invites: [],
      registrations: [],
      friendInvites: [],
      friendRegistrations: [],
      totals: {
        pendingInvites: 0,
        pendingFriendInvites: 0,
        connectedInvites: 0,
        friendRegistrations: 0,
        friendOfFriendRegistrations: 0,
        connectedRegistrations: 0,
        creditsEarned: 0,
      },
    };
  }

  const selectSql = settingsTable
    ? `SELECT pa.*, ps.code AS promocode_code
       FROM \`${appliesTable}\` pa
       LEFT JOIN \`${settingsTable}\` ps ON ps.id = pa.promocode_id`
    : `SELECT * FROM \`${appliesTable}\` pa`;

  const invitesRaw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `${selectSql}
     WHERE pa.sender_id = ? AND pa.delete_status = 2
     ORDER BY pa.created DESC
     LIMIT 200`,
    legacyUserId
  );
  const invites = dedupeAppliesByReceiverPromocode(invitesRaw);

  const registrations = invites.filter((row) => !isPendingInvite(row));
  const friendIds = Array.from(
    new Set(registrations.map((r) => Number(r.receiver_id)).filter((id) => id > 0))
  );

  let friendInvites: Record<string, unknown>[] = [];
  if (friendIds.length > 0) {
    const placeholders = friendIds.map(() => '?').join(',');
    const friendInvitesRaw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${selectSql}
       WHERE pa.sender_id IN (${placeholders}) AND pa.delete_status = 2
       ORDER BY pa.created DESC
       LIMIT 400`,
      ...friendIds
    );
    friendInvites = dedupeAppliesByReceiverPromocode(friendInvitesRaw);
  }

  const friendRegistrations = friendInvites.filter((row) => !isPendingInvite(row));
  const pendingInvites = invites.filter(isPendingInvite);
  const pendingFriendInvites = friendInvites.filter(isPendingInvite);

  // Self-registration credit for this user
  let selfRegistrationCredit = 0;
  try {
    const selfRows = await prisma.$queryRawUnsafe<{ credit: unknown }[]>(
      `SELECT MAX(CAST(receiver_credit AS DECIMAL(12,2))) AS credit
       FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND delete_status = 2`,
      legacyUserId
    );
    selfRegistrationCredit = Number(selfRows[0]?.credit ?? 0) || 0;
  } catch {
    selfRegistrationCredit = 0;
  }

  const creditsEarned =
    selfRegistrationCredit +
    registrations.reduce((sum, row) => sum + creditOf(row, 'sender_credit'), 0) +
    (
      await Promise.all(
        friendRegistrations.map((row) =>
          resolveSecondaryCreditFromVersion(
            creditOf(row, 'secondary_sender_credit'),
            String(row.receiver_version ?? '')
          )
        )
      )
    ).reduce((sum, n) => sum + n, 0);

  const annotatedInvites = await annotateRegisteredPeople([...invites, ...friendInvites]);

  return {
    invites: annotatedInvites,
    registrations,
    friendInvites,
    friendRegistrations,
    totals: {
      pendingInvites: pendingInvites.length,
      pendingFriendInvites: pendingFriendInvites.length,
      connectedInvites: pendingInvites.length + pendingFriendInvites.length,
      friendRegistrations: registrations.length,
      friendOfFriendRegistrations: friendRegistrations.length,
      connectedRegistrations: registrations.length + friendRegistrations.length,
      creditsEarned,
      // Spend feature not live yet
      creditsUsed: 0,
      creditsAvailable: creditsEarned,
      selfRegistrationCredit,
    },
  };
}

export async function listConnectionChartForUser(legacyUserId: number) {
  const appliesTable = await getPromocodeAppliesTable();
  const usersTable = await getLegacyUsersTable();
  if (!appliesTable || !usersTable || legacyUserId <= 0) {
    return {
      currentUserUsername: '',
      thanksTo: null as { username: string } | null,
      personalRegistrationCredits: 0,
      direct: [] as { username: string; credits: number }[],
      indirect: [] as { username: string; credits: number; senderUsername: string }[],
    };
  }

  const current = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
  const thanksRows = await prisma.$queryRawUnsafe<{ sender_id: number | bigint | null }[]>(
    `SELECT sender_id FROM \`${appliesTable}\`
     WHERE receiver_id = ? AND delete_status = 2
     ORDER BY created DESC LIMIT 1`,
    legacyUserId
  );
  const thanksId = thanksRows[0]?.sender_id != null ? Number(thanksRows[0].sender_id) : 0;
  const thanksUser = thanksId > 0 ? (await fetchLegacyUsersByIds([thanksId])).get(thanksId) : null;

  let personalRegistrationCredits = 0;
  try {
    const selfRows = await prisma.$queryRawUnsafe<{ credit: unknown }[]>(
      `SELECT MAX(CAST(receiver_credit AS DECIMAL(12,2))) AS credit
       FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND delete_status = 2`,
      legacyUserId
    );
    personalRegistrationCredits = Number(selfRows[0]?.credit ?? 0) || 0;
  } catch {
    personalRegistrationCredits = 0;
  }

  const directRows = await prisma.$queryRawUnsafe<
    { receiver_id: number | bigint | null; sender_credit: unknown; promocode_id: number | null }[]
  >(
    `SELECT receiver_id, sender_credit, promocode_id FROM \`${appliesTable}\`
     WHERE sender_id = ? AND receiver_id > 0 AND delete_status = 2
     ORDER BY created DESC`,
    legacyUserId
  );
  const seenDirect = new Set<number>();
  const directIds: number[] = [];
  const directCreditById = new Map<number, number>();
  for (const row of directRows) {
    const id = Number(row.receiver_id);
    if (!id || seenDirect.has(id)) continue;
    seenDirect.add(id);
    directIds.push(id);
    directCreditById.set(id, Number(row.sender_credit ?? 0) || 0);
  }
  const directUsers = await fetchLegacyUsersByIds(directIds);
  await attachEntityLogos(directUsers);
  const direct = directIds
    .map((id) => {
      const u = directUsers.get(id);
      if (!u) return null;
      return {
        username: u.username ?? '',
        credits: directCreditById.get(id) ?? 0,
        image: u.image,
        logoUrl: u.logoUrl ?? null,
        roleId: u.roleId ?? null,
      };
    })
    .filter((v): v is { username: string; credits: number; image: string | null; logoUrl: string | null; roleId: number | null } => v != null);

  let indirect: {
    username: string;
    credits: number;
    senderUsername: string;
    image?: string | null;
    logoUrl?: string | null;
    roleId?: number | null;
  }[] = [];
  if (directIds.length > 0) {
    const placeholders = directIds.map(() => '?').join(',');
    const indirectRows = await prisma.$queryRawUnsafe<
      {
        sender_id: number | bigint | null;
        receiver_id: number | bigint | null;
        secondary_sender_credit: unknown;
        receiver_version: string | null;
        promocode_id: number | null;
      }[]
    >(
      `SELECT sender_id, receiver_id, secondary_sender_credit, receiver_version, promocode_id
       FROM \`${appliesTable}\`
       WHERE sender_id IN (${placeholders}) AND receiver_id > 0 AND delete_status = 2
       ORDER BY created DESC`,
      ...directIds
    );
    const seenIndirect = new Set<string>();
    const allIds = Array.from(
      new Set(
        indirectRows.flatMap((r) => [Number(r.sender_id), Number(r.receiver_id)]).filter((id) => id > 0)
      )
    );
    const people = await fetchLegacyUsersByIds(allIds);
    await attachEntityLogos(people);
    for (const row of indirectRows) {
      const receiverId = Number(row.receiver_id);
      const senderId = Number(row.sender_id);
      const promocodeId = Number(row.promocode_id ?? 0);
      const key = `${receiverId}:${promocodeId}`;
      if (!receiverId || seenIndirect.has(key)) continue;
      seenIndirect.add(key);
      const ru = people.get(receiverId);
      const su = people.get(senderId);
      if (!ru || !su) continue;
      const credits = await resolveSecondaryCreditFromVersion(
        Number(row.secondary_sender_credit ?? 0) || 0,
        row.receiver_version != null ? String(row.receiver_version) : ''
      );
      indirect.push({
        username: ru.username ?? '',
        credits,
        senderUsername: su.username ?? '',
        image: ru.image,
        logoUrl: ru.logoUrl ?? null,
        roleId: ru.roleId ?? null,
      });
    }
  }

  return {
    currentUserUsername: current?.username ?? '',
    thanksTo: thanksUser ? { username: thanksUser.username ?? '' } : null,
    personalRegistrationCredits,
    direct,
    indirect,
  };
}

export async function listCreditsForUser(legacyUserId: number) {
  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable || legacyUserId <= 0) {
    return { asSender: [], asSecondary: [], asReceiver: [] as Record<string, unknown>[] };
  }
  const cols = await getTableColumns(appliesTable);

  const asSenderRaw = cols.has('sender_credit')
    ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${appliesTable}\`
         WHERE sender_id = ? AND delete_status = 2 AND receiver_id > 0
         ORDER BY created DESC LIMIT 200`,
        legacyUserId
      )
    : [];

  const asSecondaryRaw =
    cols.has('secondary_sender_id') && cols.has('secondary_sender_credit')
      ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM \`${appliesTable}\`
           WHERE secondary_sender_id = ? AND delete_status = 2 AND receiver_id > 0
           ORDER BY created DESC LIMIT 200`,
          legacyUserId
        )
      : [];

  const asReceiverRaw = cols.has('receiver_credit')
    ? await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${appliesTable}\`
         WHERE receiver_id = ? AND delete_status = 2 AND receiver_id > 0
           AND CAST(COALESCE(receiver_credit, 0) AS DECIMAL(12,2)) > 0
         ORDER BY created DESC LIMIT 50`,
        legacyUserId
      )
    : [];

  const asSecondary = [];
  for (const row of dedupeAppliesByReceiverPromocode(asSecondaryRaw)) {
    const resolved = await resolveSecondaryCreditFromVersion(
      creditOf(row, 'secondary_sender_credit'),
      String(row.receiver_version ?? '')
    );
    asSecondary.push({ ...row, secondary_sender_credit: resolved });
  }

  return {
    asSender: await annotateRegisteredPeople(dedupeAppliesByReceiverPromocode(asSenderRaw)),
    asSecondary: await annotateRegisteredPeople(asSecondary),
    asReceiver: await annotateRegisteredPeople(dedupeAppliesByReceiverPromocode(asReceiverRaw)),
  };
}
