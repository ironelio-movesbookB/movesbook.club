import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  fetchCountryCodeById,
  fetchFlagImageByCountryId,
  fetchLegacyUsersByIds,
  getCountriesTable,
  getLegacyUsersTable,
  getPromocodeAppliesTable,
  getSubscriptionSettingsTable,
} from '@/lib/promocodes/legacyDb';
import { fetchModernUserCountries, findModernUserCountry } from '@/lib/promocodes/modernUserCountry';

export type CreditsEarnedRow = {
  id: number;
  username: string;
  typeOfUser: string;
  country: string;
  countryCode: string | null;
  flagImg: string | null;
  creditsTotal: number;
  used: number;
  available: number;
  /** Who invited this user (earns sender_credit when they register). */
  primaryUsername: string;
  /**
   * Who invited the primary (friend-of-friend) — earns secondary_sender_credit
   * when this user registers.
   */
  secondaryUsername: string;
};

const ROLE_NAMES: Record<number, string> = {
  1: 'Super Admin',
  2: 'Admin',
  5: 'Single User',
  6: 'Coach',
  7: 'Team',
  8: 'Club',
  9: 'Group',
};

export async function listCreditsEarnedUsers(searchUsername = ''): Promise<CreditsEarnedRow[]> {
  const appliesTable = await getPromocodeAppliesTable();
  const usersTable = await getLegacyUsersTable();
  if (!appliesTable || !usersTable) return [];

  const applyColumns = await getTableColumns(appliesTable);
  const userColumns = await getTableColumns(usersTable);

  const senderRows = applyColumns.has('sender_id')
    ? await prisma.$queryRawUnsafe<{ sender_id: number | bigint }[]>(
        `SELECT DISTINCT sender_id FROM \`${appliesTable}\`
         WHERE delete_status = 2 AND sender_id > 0`
      )
    : [];
  const secondaryRows = applyColumns.has('secondary_sender_id')
    ? await prisma.$queryRawUnsafe<{ secondary_sender_id: number | bigint }[]>(
        `SELECT DISTINCT secondary_sender_id FROM \`${appliesTable}\`
         WHERE delete_status = 2 AND secondary_sender_id > 0`
      )
    : [];
  const receiverRows =
    applyColumns.has('receiver_id') && applyColumns.has('receiver_credit')
      ? await prisma.$queryRawUnsafe<{ receiver_id: number | bigint }[]>(
          `SELECT DISTINCT receiver_id FROM \`${appliesTable}\`
           WHERE delete_status = 2 AND receiver_id > 0
             AND CAST(COALESCE(receiver_credit, 0) AS DECIMAL(12,2)) > 0`
        )
      : [];

  const earningUserIds = Array.from(
    new Set([
      ...senderRows.map((r) => Number(r.sender_id)).filter((id) => id > 0),
      ...secondaryRows.map((r) => Number(r.secondary_sender_id)).filter((id) => id > 0),
      ...receiverRows.map((r) => Number(r.receiver_id)).filter((id) => id > 0),
    ])
  );

  if (earningUserIds.length === 0) return [];

  const placeholders = earningUserIds.map(() => '?').join(',');
  const creditsSelect = userColumns.has('credits') ? 'credits' : '0 AS credits';
  const emailSelect = userColumns.has('email') ? 'email' : "'' AS email";
  let userSql = `SELECT id, username, email, role_id, country_id, ${creditsSelect}
                 FROM \`${usersTable}\`
                 WHERE id IN (${placeholders}) AND delete_status = 'N'`;
  const userParams: unknown[] = [...earningUserIds];

  if (searchUsername.trim()) {
    userSql += ' AND username LIKE ?';
    userParams.push(`%${searchUsername.trim()}%`);
  }
  userSql += ' ORDER BY username ASC';

  const users = await prisma.$queryRawUnsafe<
    {
      id: number | bigint;
      username: string | null;
      email: string | null;
      role_id: number | null;
      country_id: number | null;
      credits: number | string | null;
    }[]
  >(userSql.replace('username, email,', `username, ${emailSelect},`), ...userParams);

  const modernUserCountries = await fetchModernUserCountries(
    users.map((u) => ({ legacyId: Number(u.id), email: u.email, username: u.username }))
  );

  const rows: CreditsEarnedRow[] = [];

  for (const u of users) {
    const uid = Number(u.id);
    const sumSender =
      applyColumns.has('sender_id') && applyColumns.has('sender_credit')
        ? await prisma.$queryRawUnsafe<{ total_sender: number | string | null }[]>(
            `SELECT COALESCE(SUM(t.credit), 0) AS total_sender FROM (
               SELECT MAX(CAST(sender_credit AS DECIMAL(12,2))) AS credit
               FROM \`${appliesTable}\`
               WHERE delete_status = 2 AND sender_id = ? AND receiver_id > 0
               GROUP BY receiver_id, promocode_id
             ) t`,
            uid
          )
        : [{ total_sender: 0 }];
    const sumSecondary =
      applyColumns.has('secondary_sender_id') && applyColumns.has('secondary_sender_credit')
        ? await prisma.$queryRawUnsafe<
            {
              receiver_id: number | bigint | null;
              promocode_id: number | bigint | null;
              secondary_sender_credit: unknown;
              receiver_version: string | null;
            }[]
          >(
            `SELECT receiver_id, promocode_id, secondary_sender_credit,
                    ${applyColumns.has('receiver_version') ? 'receiver_version' : "'' AS receiver_version"}
             FROM \`${appliesTable}\`
             WHERE delete_status = 2 AND secondary_sender_id = ? AND receiver_id > 0`,
            uid
          )
        : [];
    let secondaryEarned = 0;
    {
      const seenSec = new Set<string>();
      for (const row of sumSecondary) {
        const rid = Number(row.receiver_id ?? 0);
        const pid = Number(row.promocode_id ?? 0);
        const key = `${rid}:${pid}`;
        if (!rid || seenSec.has(key)) continue;
        seenSec.add(key);
        let credit = Number(row.secondary_sender_credit ?? 0) || 0;
        if (credit <= 0 && row.receiver_version) {
          const subTable = await getSubscriptionSettingsTable();
          if (subTable) {
            try {
              const creditRows = await prisma.$queryRawUnsafe<{ credit1: unknown }[]>(
                `SELECT credit1 FROM \`${subTable}\`
                 WHERE subscription_name = ? LIMIT 1`,
                String(row.receiver_version).trim()
              );
              const n = Number(creditRows[0]?.credit1 ?? 0);
              if (Number.isFinite(n) && n > 0) credit = n;
            } catch {
              /* ignore */
            }
          }
        }
        secondaryEarned += credit;
      }
    }

    const senderEarned = Number(sumSender[0]?.total_sender ?? 0);
    const sumReceiver =
      applyColumns.has('receiver_id') && applyColumns.has('receiver_credit')
        ? await prisma.$queryRawUnsafe<{ total_receiver: number | string | null }[]>(
            `SELECT COALESCE(SUM(t.credit), 0) AS total_receiver FROM (
               SELECT MAX(CAST(receiver_credit AS DECIMAL(12,2))) AS credit
               FROM \`${appliesTable}\`
               WHERE delete_status = 2 AND receiver_id = ?
               GROUP BY promocode_id
             ) t`,
            uid
          )
        : [{ total_receiver: 0 }];
    const receiverEarned = Number(sumReceiver[0]?.total_receiver ?? 0);
    const totalEarned = senderEarned + secondaryEarned + receiverEarned;

    // Spend/purchase feature is not implemented yet — used must stay 0.
    const available = totalEarned;
    const used = 0;

    const primaryApply =
      applyColumns.has('receiver_id') && applyColumns.has('sender_id')
        ? await prisma.$queryRawUnsafe<
            {
              sender_id: number | null;
              sender_email: string | null;
              secondary_sender_id: number | null;
              secondary_sender_username: string | null;
            }[]
          >(
            `SELECT sender_id, sender_email,
                    ${applyColumns.has('secondary_sender_id') ? 'secondary_sender_id' : 'NULL AS secondary_sender_id'},
                    ${applyColumns.has('secondary_sender_username') ? 'secondary_sender_username' : 'NULL AS secondary_sender_username'}
             FROM \`${appliesTable}\`
             WHERE delete_status = 2 AND receiver_id = ?
             ORDER BY id DESC LIMIT 1`,
            uid
          )
        : [];
    let primaryUsername = '';
    let secondaryUsername = '';
    const pa = primaryApply[0];
    const primarySenderId = pa?.sender_id != null ? Number(pa.sender_id) : 0;
    if (primarySenderId > 0) {
      const pu = await fetchLegacyUsersByIds([primarySenderId]);
      primaryUsername = pu.get(primarySenderId)?.username ?? '';
    } else if (pa?.sender_email) {
      const byEmail = await prisma.$queryRawUnsafe<{ username: string | null }[]>(
        `SELECT username FROM \`${usersTable}\` WHERE LOWER(email) = ? LIMIT 1`,
        pa.sender_email.trim().toLowerCase()
      );
      primaryUsername = byEmail[0]?.username ?? '';
    }

    // Secondary beneficiary = friend-of-friend who earns when this user registered.
    const storedSecondaryId =
      pa?.secondary_sender_id != null ? Number(pa.secondary_sender_id) : 0;
    const storedSecondaryUsername =
      pa?.secondary_sender_username != null ? String(pa.secondary_sender_username).trim() : '';
    if (storedSecondaryId > 0) {
      const su = await fetchLegacyUsersByIds([storedSecondaryId]);
      secondaryUsername = su.get(storedSecondaryId)?.username ?? storedSecondaryUsername;
    } else if (storedSecondaryUsername) {
      secondaryUsername = storedSecondaryUsername;
    } else if (primarySenderId > 0) {
      // Chain resolve: who invited the primary inviter?
      const primaryUpline = await prisma.$queryRawUnsafe<
        {
          sender_id: number | null;
          sender_email: string | null;
          secondary_sender_username: string | null;
        }[]
      >(
        `SELECT sender_id, sender_email,
                ${applyColumns.has('secondary_sender_username') ? 'secondary_sender_username' : 'NULL AS secondary_sender_username'}
         FROM \`${appliesTable}\`
         WHERE delete_status = 2 AND receiver_id = ?
         ORDER BY id DESC LIMIT 1`,
        primarySenderId
      );
      const up = primaryUpline[0];
      const uplineId = up?.sender_id != null ? Number(up.sender_id) : 0;
      if (uplineId > 0) {
        const uu = await fetchLegacyUsersByIds([uplineId]);
        secondaryUsername = uu.get(uplineId)?.username ?? '';
      } else if (up?.sender_email) {
        const byEmail = await prisma.$queryRawUnsafe<{ username: string | null }[]>(
          `SELECT username FROM \`${usersTable}\` WHERE LOWER(email) = ? LIMIT 1`,
          up.sender_email.trim().toLowerCase()
        );
        secondaryUsername = byEmail[0]?.username ?? '';
      }
    }

    const countryId = u.country_id != null ? Number(u.country_id) : null;
    const flagImg = await fetchFlagImageByCountryId(countryId);
    const legacyCountryCode = await fetchCountryCodeById(countryId);
    let countryName = '';
    const countriesTable = await getCountriesTable();
    if (countriesTable && countryId) {
      const cRows = await prisma.$queryRawUnsafe<{ name: string | null }[]>(
        `SELECT name FROM \`${countriesTable}\` WHERE id = ? LIMIT 1`,
        countryId
      );
      countryName = cRows[0]?.name ?? '';
    }
    const modernCountry = findModernUserCountry(modernUserCountries, {
      legacyId: uid,
      email: u.email,
      username: u.username,
    });
    const countryCode = modernCountry?.countryCode ?? legacyCountryCode;
    if (modernCountry?.country) {
      countryName = modernCountry.country;
    }
    const resolvedFlagImg = modernCountry ? null : flagImg;

    rows.push({
      id: uid,
      username: u.username ?? '',
      typeOfUser: u.role_id != null ? ROLE_NAMES[Number(u.role_id)] ?? String(u.role_id) : '',
      country: countryName,
      countryCode,
      flagImg: resolvedFlagImg,
      creditsTotal: totalEarned,
      used,
      available,
      primaryUsername,
      secondaryUsername,
    });
  }

  return rows;
}
