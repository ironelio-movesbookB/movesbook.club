import { serialize, unserialize } from 'php-serialize';
import {
  PROMOCODE_FORM_LANGUAGES,
  formatPromocodeLanguageLabel,
} from './promocodeLanguages';
import { getLanguageListForHelpPage } from './promocodeInviteLanguage';
export { getLanguageListForHelpPage };
import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  ensurePromocodeMetaTables,
  getDefaultPromocodeMeta,
  loadHelpHtmlPagesFromTable,
  loadLanguagesFromTable,
  loadSubscriptionsFromTable,
  withLegacyConnection,
} from './ensureMetaTables';
import {
  fetchCountryCodeById,
  fetchFlagImageByCountryId,
  fetchLegacyUsersByIds,
  fetchLegacyUserByEmail,
  fetchLegacyUserByUsername,
  findLegacyUsersByKeyword,
  findLegacyUsersByUsernameOrFirstname,
  getAppliesColumns,
  getHelpHtmlPagesTable,
  getLanguageValuesTable,
  getLegacyUsersTable,
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getSettingsColumns,
  getSubscriptionSettingsTable,
  legacyUserExistsByEmail,
} from './legacyDb';
import {
  buildPromocodeSettingsSelectSql,
  sanitizeLegacyDateString,
} from './promocodeSettingsQuery';
import { attachEntityLogos } from './promocodeAvatars';
import { fetchModernUserCountries, findModernUserCountry } from './modernUserCountry';
import { userExistedAtApplyTime } from './promocodeApplyDisplay';
import type {
  LegacyUserSnippet,
  PaginatedResult,
  PromocodeApplyRow,
  PromocodeInviteEntry,
  PromocodeListFilters,
  PromocodeMeta,
  PromocodeSettingFormData,
  PromocodeSettingRow,
} from './types';

function formatDate(value: unknown): string | null {
  return sanitizeLegacyDateString(value);
}

function formatDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function formatInviteRegistrationDate(value: unknown): string {
  if (value == null || value === '') return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function loadSubscriptionNameByIdMap(): Promise<Record<number, string>> {
  const table = await getSubscriptionSettingsTable();
  const map: Record<number, string> = {};
  if (!table) return map;

  const columns = await getTableColumns(table);
  const nameCol = columns.has('subscription_name')
    ? 'subscription_name'
    : columns.has('name')
      ? 'name'
      : null;
  if (!nameCol) return map;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, \`${nameCol}\` AS subscription_name FROM \`${table}\``
  );
  for (const row of rows) {
    const id = Number(row.id);
    const name = row.subscription_name != null ? String(row.subscription_name).trim() : '';
    if (Number.isFinite(id) && name) map[id] = name;
  }
  return map;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildPromocodeInviteEntries(
  applyRows: PromocodeApplyRow[],
  subscriptionNames: Record<number, string>,
  receiversByEmail: Map<string, LegacyUserSnippet>
): PromocodeInviteEntry[] {
  const entries: PromocodeInviteEntry[] = [];

  for (const row of applyRows) {
    const rawReceiver = row.receiverEmail?.trim() ?? '';
    if (!rawReceiver) continue;

    const resolvedReceiver =
      row.receiver ??
      receiversByEmail.get(rawReceiver.toLowerCase()) ??
      null;

    const registered =
      (row.receiverId != null && row.receiverId > 0) ||
      row.isRegistered === 1 ||
      row.isRegistered === '1' ||
      Boolean(String(row.registrationDate ?? '').trim());

    const username =
      resolvedReceiver?.username?.trim() ||
      (!looksLikeEmail(rawReceiver) ? rawReceiver : null) ||
      null;
    const email =
      resolvedReceiver?.email?.trim() ||
      (looksLikeEmail(rawReceiver) ? rawReceiver : '') ||
      '';

    const inviteDate = formatInviteRegistrationDate(row.created) || null;

    if (!registered) {
      entries.push({
        email: email || rawReceiver,
        username: null,
        registered: false,
        inviteDate,
        registrationDate: null,
        subscriptionName: null,
      });
      continue;
    }

    const subscriptionSettingId = resolvedReceiver?.subscriptionSettingId ?? null;
    const subscriptionName =
      subscriptionSettingId != null
        ? subscriptionNames[subscriptionSettingId] ?? row.receiverVersion ?? null
        : row.receiverVersion ?? null;

    const registrationDate = formatInviteRegistrationDate(
      row.registrationDate ??
        resolvedReceiver?.subscriptionStartDate ??
        resolvedReceiver?.created ??
        row.created
    );

    entries.push({
      email: email || rawReceiver,
      username,
      registered: true,
      inviteDate,
      registrationDate: registrationDate || null,
      subscriptionName,
    });
  }

  return entries;
}

async function loadReceiversByEmail(emails: string[]): Promise<Map<string, LegacyUserSnippet>> {
  const map = new Map<string, LegacyUserSnippet>();
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || map.has(email)) continue;
    const user = await fetchLegacyUserByEmail(email);
    if (user) map.set(email, user);
  }
  return map;
}

function pickOrder(orderBy: string | undefined, defaultField: string): { field: string; dir: 'ASC' | 'DESC' } {
  if (orderBy === 'created_asc') return { field: defaultField, dir: 'ASC' };
  if (orderBy === 'created_desc' || orderBy === 'created') return { field: defaultField, dir: 'DESC' };
  if (orderBy === 'usable_by') return { field: 'usable_by', dir: 'DESC' };
  if (orderBy === 'valid_from') return { field: 'valid_from', dir: 'DESC' };
  if (orderBy === 'version_id') return { field: 'version_id', dir: 'DESC' };
  return { field: defaultField, dir: 'DESC' };
}

async function resolveSecondarySender(
  apply: Record<string, unknown>,
  senderUser: LegacyUserSnippet | null,
  registeredUser: LegacyUserSnippet | null,
  appliesTable: string
): Promise<{ apply: Record<string, unknown>; secondarySender: LegacyUserSnippet | null }> {
  const applyCreated = apply.created != null ? String(apply.created) : null;
  let secondarySenderUsername =
    apply.secondary_sender_username != null ? String(apply.secondary_sender_username) : '';
  let secondarySenderCredit = apply.secondary_sender_credit;
  let secondarySender: LegacyUserSnippet | null = null;

  const secondarySenderId =
    apply.secondary_sender_id != null ? Number(apply.secondary_sender_id) : 0;
  if (secondarySenderId > 0) {
    const users = await fetchLegacyUsersByIds([secondarySenderId]);
    const candidate = users.get(secondarySenderId) ?? null;
    if (userExistedAtApplyTime(candidate, applyCreated)) {
      secondarySender = candidate;
    }
  }

  const senderId = apply.sender_id != null ? Number(apply.sender_id) : senderUser?.id ?? 0;
  let senderEmail =
    apply.sender_email != null ? String(apply.sender_email).trim().toLowerCase() : '';
  let senderUsername = senderUser?.username?.trim().toLowerCase() ?? '';

  if (senderId > 0 && (!senderEmail || !senderUsername)) {
    const users = await fetchLegacyUsersByIds([senderId]);
    const sender = users.get(senderId);
    if (sender) {
      if (!senderEmail && sender.email) senderEmail = sender.email.toLowerCase();
      if (!senderUsername && sender.username) senderUsername = sender.username.toLowerCase();
    }
  }

  const senderValid = userExistedAtApplyTime(senderUser, applyCreated);

  if (!secondarySender && senderValid && (senderId > 0 || senderEmail || senderUsername)) {
    const orParts: string[] = [];
    const params: unknown[] = [];
    if (senderId > 0) {
      orParts.push('receiver_id = ?');
      params.push(senderId);
    }
    if (senderEmail) {
      orParts.push('LOWER(receiver_email) = ?');
      params.push(senderEmail);
    }
    if (senderUsername) {
      orParts.push('LOWER(receiver_email) = ?');
      params.push(senderUsername);
    }

    if (orParts.length > 0) {
      const secondaryRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT sender_id, sender_email FROM \`${appliesTable}\`
         WHERE delete_status = 2 AND receiver_id > 0 AND (${orParts.join(' OR ')})
         ORDER BY id DESC LIMIT 1`,
        ...params
      );
      const sec = secondaryRows[0];
      if (sec) {
        const secSenderId = sec.sender_id != null ? Number(sec.sender_id) : 0;
        if (secSenderId > 0) {
          const users = await fetchLegacyUsersByIds([secSenderId]);
          const candidate = users.get(secSenderId) ?? null;
          if (userExistedAtApplyTime(candidate, applyCreated)) {
            secondarySender = candidate;
          }
        } else if (sec.sender_email) {
          const candidate = await fetchLegacyUserByEmail(String(sec.sender_email));
          if (userExistedAtApplyTime(candidate, applyCreated)) {
            secondarySender = candidate;
          }
        }
      }
    }
  }

  if (!secondarySenderUsername && secondarySender?.username) {
    secondarySenderUsername = secondarySender.username;
    apply = { ...apply, secondary_sender_username: secondarySenderUsername };
  }

  const creditMissing = ['', '0', '0.00', '00'].includes(String(secondarySenderCredit ?? ''));
  if (creditMissing && secondarySenderUsername && registeredUser?.subscriptionSettingId) {
    const subTable = await getSubscriptionSettingsTable();
    if (subTable) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT credit1 FROM \`${subTable}\` WHERE id = ? LIMIT 1`,
        registeredUser.subscriptionSettingId
      );
      if (rows[0]?.credit1 != null) {
        secondarySenderCredit = rows[0].credit1;
        apply = { ...apply, secondary_sender_credit: secondarySenderCredit };
      }
    }
  }

  return { apply, secondarySender };
}

async function buildApplyRows(
  applyRecords: Record<string, unknown>[],
  includePromocodeMeta: boolean
): Promise<PromocodeApplyRow[]> {
  const userIds: number[] = [];
  const promocodeIds: number[] = [];
  const receiverEmails: string[] = [];
  const receiverUsernames: string[] = [];

  for (const row of applyRecords) {
    if (row.sender_id) userIds.push(Number(row.sender_id));
    if (row.receiver_id) userIds.push(Number(row.receiver_id));
    if (row.promocode_id) promocodeIds.push(Number(row.promocode_id));
    if (row.receiver_email) {
      const value = String(row.receiver_email).trim().toLowerCase();
      // receiver_email sometimes holds a username instead of an email
      if (value.includes('@')) receiverEmails.push(value);
      else if (value) receiverUsernames.push(value);
    }
  }

  const users = await fetchLegacyUsersByIds(userIds);
  await attachEntityLogos(users);

  // Modern-user country lookup: include the apply's receiver_email (which may
  // actually hold a username) and the resolved legacy receiver identities.
  const receiverIdentities: { email?: string | null; username?: string | null }[] = [
    ...Array.from(new Set(receiverEmails)).map((email) => ({ email })),
    ...Array.from(new Set(receiverUsernames)).map((username) => ({ username })),
  ];
  for (const user of Array.from(users.values())) {
    receiverIdentities.push({ email: user.email, username: user.username });
  }
  const modernReceiverCountries = await fetchModernUserCountries(receiverIdentities);
  const promocodeCodeMap = new Map<number, string>();
  const promocodeValidToMap = new Map<number, string>();

  if (includePromocodeMeta && promocodeIds.length > 0) {
    const settingsTable = await getPromocodeSettingsTable();
    if (settingsTable) {
      const uniquePromocodeIds = Array.from(new Set(promocodeIds));
      const placeholders = uniquePromocodeIds.map(() => '?').join(',');
      const settings = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, code, CAST(valid_to AS CHAR) AS valid_to FROM \`${settingsTable}\` WHERE id IN (${placeholders})`,
        ...uniquePromocodeIds
      );
      for (const s of settings) {
        const id = Number(s.id);
        promocodeCodeMap.set(id, s.code != null ? String(s.code) : '');
        promocodeValidToMap.set(id, formatDate(s.valid_to) ?? '');
      }
    }
  }

  const appliesTable = (await getPromocodeAppliesTable()) ?? '';
  const results: PromocodeApplyRow[] = [];

  for (const raw of applyRecords) {
    const sender = raw.sender_id ? users.get(Number(raw.sender_id)) ?? null : null;
    const receiver =
      raw.receiver_id && Number(raw.receiver_id) > 0
        ? users.get(Number(raw.receiver_id)) ?? null
        : null;

    const receiverEmail = raw.receiver_email != null ? String(raw.receiver_email).trim() : '';
    const existReceiverMatch = receiverEmail ? await legacyUserExistsByEmail(receiverEmail) : false;

    const resolved = await resolveSecondarySender(raw, sender, receiver, appliesTable);
    const apply = resolved.apply;
    const promocodeId = apply.promocode_id != null ? Number(apply.promocode_id) : null;
    const modernReceiverCountry =
      findModernUserCountry(modernReceiverCountries, {
        email: receiverEmail.includes('@') ? receiverEmail : null,
        username: receiver?.username ?? (receiverEmail.includes('@') ? null : receiverEmail),
      }) ??
      (receiver
        ? findModernUserCountry(modernReceiverCountries, {
            email: receiver.email,
            username: receiver.username,
          })
        : null);
    const flagCountryId = receiver?.countryId ?? null;
    const receiverCountryCode =
      modernReceiverCountry?.countryCode ?? (await fetchCountryCodeById(flagCountryId));
    const receiverCountryName = modernReceiverCountry?.country ?? null;
    const senderModern = sender
      ? findModernUserCountry(modernReceiverCountries, {
          email: sender.email,
          username: sender.username,
        })
      : null;
    const senderCountryCode =
      senderModern?.countryCode ?? (await fetchCountryCodeById(sender?.countryId ?? null));
    const senderCountryName = senderModern?.country ?? null;
    const senderFlagImage =
      !senderCountryCode && sender?.countryId
        ? await fetchFlagImageByCountryId(sender.countryId)
        : null;
    const secondaryModern = resolved.secondarySender
      ? findModernUserCountry(modernReceiverCountries, {
          email: resolved.secondarySender.email,
          username: resolved.secondarySender.username,
        })
      : null;
    const secondaryCountryCode =
      secondaryModern?.countryCode ??
      (await fetchCountryCodeById(resolved.secondarySender?.countryId ?? null));
    const secondaryCountryName = secondaryModern?.country ?? null;
    const secondaryFlagImage =
      !secondaryCountryCode && resolved.secondarySender?.countryId
        ? await fetchFlagImageByCountryId(resolved.secondarySender.countryId)
        : null;
    // Only fall back to the legacy flag image when no ISO code could be resolved;
    // legacy rows created by quick-register point at a placeholder flag.
    const flagImage =
      !receiverCountryCode && flagCountryId ? await fetchFlagImageByCountryId(flagCountryId) : null;

    results.push({
      id: Number(apply.id),
      promocodeId,
      created: formatDateTime(apply.created),
      receiverEmail: receiverEmail || null,
      receiverId: apply.receiver_id != null ? Number(apply.receiver_id) : null,
      senderId: apply.sender_id != null ? Number(apply.sender_id) : null,
      senderEmail: apply.sender_email != null ? String(apply.sender_email).trim() : null,
      registrationDate:
        apply.registration_date != null ? formatDateTime(apply.registration_date) : null,
      isRegistered: apply.is_registered != null ? (apply.is_registered as string | number) : null,
      senderCredit: apply.sender_credit != null ? String(apply.sender_credit) : null,
      receiverCredit: apply.receiver_credit != null ? String(apply.receiver_credit) : null,
      receiverVersion: apply.receiver_version != null ? String(apply.receiver_version) : null,
      secondarySenderUsername:
        apply.secondary_sender_username != null ? String(apply.secondary_sender_username) : null,
      secondarySenderCredit:
        apply.secondary_sender_credit != null ? String(apply.secondary_sender_credit) : null,
      newReceiver: apply.new_receiver != null ? String(apply.new_receiver) : null,
      sender,
      receiver,
      secondarySender: resolved.secondarySender,
      existReceiverMatch,
      promocodeCode: promocodeId != null ? promocodeCodeMap.get(promocodeId) ?? '' : '',
      promocodeValidTo: promocodeId != null ? promocodeValidToMap.get(promocodeId) ?? '' : '',
      flagImage,
      receiverCountryCode,
      receiverCountryName,
      senderFlagImage,
      senderCountryCode,
      senderCountryName,
      secondaryFlagImage,
      secondaryCountryCode,
      secondaryCountryName,
      inviteMode: apply.invite_mode != null ? String(apply.invite_mode) : null,
      inviteExpiresAt: formatDate(apply.invite_expires_at),
    });
  }

  return results;
}

/** PHP promocodes/promoDetail: current user + registered direct invitees (as senders). */
async function resolvePromoDetailSenderScope(
  appliesTable: string,
  promocodeId: number,
  currentUserId: number
): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<{ receiver_id: number | bigint | null }[]>(
    `SELECT DISTINCT receiver_id FROM \`${appliesTable}\`
     WHERE sender_id = ? AND promocode_id = ? AND receiver_id > 0 AND delete_status = 2`,
    currentUserId,
    promocodeId
  );
  const directRecipientIds = rows
    .map((row) => Number(row.receiver_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  return Array.from(new Set([currentUserId, ...directRecipientIds]));
}

export async function listPromocodeApplies(
  filters: PromocodeListFilters & { promocodeId?: number; senderScopeUserId?: number }
): Promise<PaginatedResult<PromocodeApplyRow>> {
  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable) {
    return { items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 25 };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const applyColsForOrder = await getAppliesColumns();
  const orderFallback = applyColsForOrder.has('created') ? 'created' : 'id';
  const picked = pickOrder(filters.orderBy, orderFallback);
  const field = applyColsForOrder.has(picked.field) ? picked.field : orderFallback;
  const dir = picked.dir;

  const where: string[] = ['delete_status = 2'];
  const params: unknown[] = [];

  if (filters.registeredOnly) {
    where.push('receiver_id > 0');
  }

  if (filters.promocodeId) {
    where.push('promocode_id = ?');
    params.push(filters.promocodeId);
  }

  if (filters.senderScopeUserId && filters.promocodeId) {
    const allowedSenderIds = await resolvePromoDetailSenderScope(
      appliesTable,
      filters.promocodeId,
      filters.senderScopeUserId
    );
    const senderPlaceholders = allowedSenderIds.map(() => '?').join(',');
    const applyCols = await getAppliesColumns();
    if (applyCols.has('receiver_id')) {
      where.push(`(sender_id IN (${senderPlaceholders}) OR receiver_id = ?)`);
      params.push(...allowedSenderIds, filters.senderScopeUserId);
    } else {
      where.push(`sender_id IN (${senderPlaceholders})`);
      params.push(...allowedSenderIds);
    }
  }

  if (applyColsForOrder.has('created')) {
    if (filters.fromDate?.trim()) {
      where.push('DATE(`created`) >= ?');
      params.push(filters.fromDate.trim().slice(0, 10));
    }
    if (filters.toDate?.trim()) {
      where.push('DATE(`created`) <= ?');
      params.push(filters.toDate.trim().slice(0, 10));
    }
  }

  const clickFilters: Array<{ username?: string; cols: string[] }> = [
    { username: filters.senderUsername, cols: ['sender_id'] },
    { username: filters.secondaryUsername, cols: ['secondary_sender_id'] },
    {
      username: filters.recipientUsername,
      cols: ['receiver_id', 'sender_id', 'secondary_sender_id'],
    },
  ];
  for (const click of clickFilters) {
    const name = click.username?.trim();
    if (!name) continue;
    const ids = await findLegacyUsersByUsernameOrFirstname(name);
    const applyCols = await getAppliesColumns();
    const parts: string[] = [];
    const extra: unknown[] = [];
    for (const col of click.cols) {
      if (!applyCols.has(col) || ids.length === 0) continue;
      const placeholders = ids.map(() => '?').join(',');
      parts.push(`\`${col}\` IN (${placeholders})`);
      extra.push(...ids);
    }
    if (click.cols.includes('receiver_id') && applyCols.has('receiver_email')) {
      parts.push('LOWER(`receiver_email`) = ?');
      extra.push(name.toLowerCase());
    }
    if (click.cols.includes('secondary_sender_id') && applyCols.has('secondary_sender_username')) {
      parts.push('LOWER(`secondary_sender_username`) = ?');
      extra.push(name.toLowerCase());
    }
    if (parts.length === 0) {
      where.push('1 = 0');
    } else {
      where.push(`(${parts.join(' OR ')})`);
      params.push(...extra);
    }
  }

  if (filters.search?.trim()) {
    const keyword = filters.search.trim();
    const like = `%${keyword}%`;
    const matchingIds = await findLegacyUsersByKeyword(keyword);
    const orParts: string[] = ['receiver_email LIKE ?'];
    params.push(like);
    if (matchingIds.length > 0) {
      const placeholders = matchingIds.map(() => '?').join(',');
      orParts.push(`sender_id IN (${placeholders})`, `receiver_id IN (${placeholders})`);
      params.push(...matchingIds, ...matchingIds);
    }

    // Also match by promocode code (e.g. searching "gvvl44ccg" in Username/email box)
    const settingsTable = await getPromocodeSettingsTable();
    if (settingsTable) {
      const codeRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
        `SELECT id FROM \`${settingsTable}\`
         WHERE delete_status = 2 AND LOWER(\`code\`) LIKE LOWER(?)`,
        like
      );
      const promoIds = codeRows
        .map((r) => Number(r.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (promoIds.length > 0) {
        const promoPlaceholders = promoIds.map(() => '?').join(',');
        orParts.push(`promocode_id IN (${promoPlaceholders})`);
        params.push(...promoIds);
      }
    }

    where.push(`(${orParts.join(' OR ')})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRows = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
    `SELECT COUNT(*) AS total FROM \`${appliesTable}\` ${whereSql}`,
    ...params
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${appliesTable}\` ${whereSql}
     ORDER BY \`${field}\` ${dir}
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  );

  const items = await buildApplyRows(rows, true);
  return { items, total, page, pageSize };
}

/** Username search lists promocodes created by that user, plus an exact code match. */
async function resolvePromocodeSettingIdsForUserSearch(
  keyword: string,
  settingsTable: string,
  _appliesTable: string | null
): Promise<number[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const like = `%${trimmed}%`;
  const promoIdSet = new Set<number>();

  // Direct match on promocode code (search box may contain a code, not only a username).
  {
    const codeRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${settingsTable}\`
       WHERE delete_status = 2 AND LOWER(\`code\`) LIKE LOWER(?)`,
      like
    );
    for (const row of codeRows) {
      const id = Number(row.id);
      if (Number.isFinite(id) && id > 0) promoIdSet.add(id);
    }
  }

  // Match promocode creators shown in the list (creater_id / creator_id).
  const creatorMatchIds = await findLegacyUsersByUsernameOrFirstname(trimmed);
  if (creatorMatchIds.length > 0) {
    const settingsCols = await getSettingsColumns();
    const creatorConds: string[] = [];
    const creatorParams: unknown[] = [];
    const creatorPlaceholders = creatorMatchIds.map(() => '?').join(',');

    if (settingsCols.has('creater_id')) {
      creatorConds.push(`CAST(\`creater_id\` AS UNSIGNED) IN (${creatorPlaceholders})`);
      creatorParams.push(...creatorMatchIds);
    }
    if (settingsCols.has('creator_id')) {
      creatorConds.push(`\`creator_id\` IN (${creatorPlaceholders})`);
      creatorParams.push(...creatorMatchIds);
    }

    if (creatorConds.length > 0) {
      const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
        `SELECT id FROM \`${settingsTable}\`
         WHERE delete_status = 2 AND (${creatorConds.join(' OR ')})`,
        ...creatorParams
      );
      for (const row of rows) {
        const id = Number(row.id);
        if (Number.isFinite(id) && id > 0) promoIdSet.add(id);
      }
    }
  }

  return Array.from(promoIdSet);
}

export async function listPromocodeSettings(
  filters: PromocodeListFilters
): Promise<PaginatedResult<PromocodeSettingRow>> {
  await ensurePromocodeMetaTables();

  const settingsTable = await getPromocodeSettingsTable();
  const appliesTable = await getPromocodeAppliesTable();
  if (!settingsTable) {
    return { items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 5 };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 5));
  const offset = (page - 1) * pageSize;
  const { field, dir } = pickOrder(filters.orderBy, 'created');

  const where: string[] = ['delete_status = 2'];
  const params: unknown[] = [];

  if (filters.usableBy) {
    where.push('usable_by = ?');
    params.push(filters.usableBy);
  }

  if (filters.creatorSource === 'movesbook' || filters.creatorSource === 'other') {
    const usersTable = await getLegacyUsersTable();
    let staffIds: number[] = [1];
    if (usersTable) {
      try {
        const staffRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
          `SELECT id FROM \`${usersTable}\` WHERE role_id IN (1, 2) AND delete_status = 'N'`
        );
        staffIds = staffRows.map((r) => Number(r.id)).filter((id) => id > 0);
        if (staffIds.length === 0) staffIds = [1];
      } catch {
        staffIds = [1];
      }
    }
    const placeholders = staffIds.map(() => '?').join(',');
    const settingsCols = await getSettingsColumns();
    const creatorExpr = settingsCols.has('creator_id')
      ? 'CAST(COALESCE(`creator_id`, `creater_id`) AS UNSIGNED)'
      : 'CAST(`creater_id` AS UNSIGNED)';
    if (filters.creatorSource === 'movesbook') {
      where.push(`${creatorExpr} IN (${placeholders})`);
      params.push(...staffIds);
    } else {
      where.push(`(${creatorExpr} NOT IN (${placeholders}) OR ${creatorExpr} IS NULL OR ${creatorExpr} = 0)`);
      params.push(...staffIds);
    }
  }

  if (filters.versionId) {
    where.push('version_id LIKE ?');
    params.push(`%${filters.versionId}%`);
  }

  if (filters.available === 'current') {
    where.push('valid_to > CURDATE()');
  } else if (filters.available === 'expired') {
    where.push('valid_to < CURDATE()');
  }

  if (filters.search?.trim()) {
    const promoIds = await resolvePromocodeSettingIdsForUserSearch(
      filters.search,
      settingsTable,
      appliesTable
    );
    if (promoIds.length > 0) {
      where.push(`id IN (${promoIds.map(() => '?').join(',')})`);
      params.push(...promoIds);
    } else {
      where.push('1 = 0');
    }
  } else if (appliesTable) {
    const deletedPromoRows = await prisma.$queryRawUnsafe<{ promocode_id: number | bigint }[]>(
      `SELECT promocode_id FROM \`${appliesTable}\` WHERE delete_status = 1`
    );
    const deletedIds = Array.from(new Set(deletedPromoRows.map((r) => Number(r.promocode_id))));
    const allRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${settingsTable}\` WHERE delete_status = 2`
    );
    const allIds = allRows.map((r) => Number(r.id));
    const filteredIds = allIds.filter((id) => !deletedIds.includes(id));
    if (filteredIds.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    where.push(`id IN (${filteredIds.map(() => '?').join(',')})`);
    params.push(...filteredIds);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRows = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(
    `SELECT COUNT(*) AS total FROM \`${settingsTable}\` ${whereSql}`,
    ...params
  );
  const total = Number(countRows[0]?.total ?? 0);

  const selectSql = await buildPromocodeSettingsSelectSql(settingsTable);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectSql} FROM \`${settingsTable}\` ${whereSql}
     ORDER BY \`${field}\` ${dir}
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  );

  const creatorIds = rows
    .map((r) => Number(r.creater_id ?? r.creator_id ?? 0))
    .filter((id) => id > 0);
  const creators = await fetchLegacyUsersByIds(creatorIds);
  const modernCreatorCountries = await fetchModernUserCountries(
    Array.from(creators.values()).map((creator) => ({
      legacyId: creator.id,
      email: creator.email,
      username: creator.username,
    }))
  );
  const settingEmailCountries = await fetchModernUserCountries(
    rows.map((row) => ({
      email: row.email != null ? String(row.email) : null,
    }))
  );
  const subscriptionNames = await loadSubscriptionNameByIdMap();

  const items: PromocodeSettingRow[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    const creatorId = Number(row.creater_id ?? row.creator_id ?? 0);
    const creator = creatorId > 0 ? creators.get(creatorId) ?? null : null;
    let creatorFlagImage: string | null = null;
    let creatorCountryCode: string | null = null;
    try {
      creatorFlagImage = await fetchFlagImageByCountryId(creator?.countryId ?? null);
      creatorCountryCode = await fetchCountryCodeById(creator?.countryId ?? null);
      const modernCountry = findModernUserCountry(modernCreatorCountries, {
        legacyId: creator?.id,
        email: creator?.email,
        username: creator?.username,
      });
      if (modernCountry) {
        creatorCountryCode = modernCountry.countryCode;
      }
    } catch (err) {
      console.warn('promocode list creator flag/country lookup failed:', err);
    }

    let inviteEmails: string[] = [];
    let inviteEntries: PromocodeInviteEntry[] = [];
    let inviteFlagImage: string | null = null;
    let inviteCountryCode: string | null = null;
    let applyRows: PromocodeApplyRow[] = [];
    const settingEmailCountry = findModernUserCountry(settingEmailCountries, {
      email: row.email != null ? String(row.email) : null,
    });
    if (settingEmailCountry) {
      inviteCountryCode = settingEmailCountry.countryCode;
    }
    if (appliesTable) {
      const applyList = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${appliesTable}\`
         WHERE promocode_id = ? AND delete_status = 2
         ORDER BY id DESC`,
        id
      );
      applyRows = await buildApplyRows(applyList, false);
      const inviteEmailsList = applyRows
        .map((row) => row.receiverEmail?.trim() ?? '')
        .filter(Boolean);
      const receiversByEmail = await loadReceiversByEmail(inviteEmailsList);
      // After registration, receiver_email is often changed to username — resolve those too.
      for (const applyRow of applyRows) {
        const raw = applyRow.receiverEmail?.trim() ?? '';
        if (!raw || raw.includes('@') || receiversByEmail.has(raw.toLowerCase())) continue;
        if (applyRow.receiver) {
          receiversByEmail.set(raw.toLowerCase(), applyRow.receiver);
          continue;
        }
        const byUsername = await fetchLegacyUserByUsername(raw).catch(() => null);
        if (byUsername) receiversByEmail.set(raw.toLowerCase(), byUsername);
      }
      inviteEntries = buildPromocodeInviteEntries(applyRows, subscriptionNames, receiversByEmail);
      inviteEmails = inviteEntries.map((entry) => entry.email);

      const inviteFlagRow = applyRows.find((a) => a.receiverCountryCode || a.flagImage);
      inviteFlagImage = inviteFlagRow?.flagImage ?? inviteFlagImage;
      inviteCountryCode = inviteCountryCode ?? inviteFlagRow?.receiverCountryCode ?? null;
    }

    const lastInviteDate = applyRows[0]?.created ?? null;
    const lastRegistered = applyRows.find((a) => (a.receiverId ?? 0) > 0);
    const lastRegistrationDate = lastRegistered?.created ?? lastRegistered?.registrationDate ?? null;

    const versionId = row.version_id != null ? String(row.version_id) : '';
    const versionCount = versionId ? versionId.split(',').filter(Boolean).length : 0;

    items.push({
      id,
      code: row.code != null ? String(row.code) : null,
      createrId: creatorId || null,
      validFrom: formatDate(row.valid_from),
      validTo: formatDate(row.valid_to),
      enable: row.enable != null ? String(row.enable) : null,
      usableBy: row.usable_by != null ? String(row.usable_by) : null,
      versionId: versionId || null,
      discount: row.discount != null ? String(row.discount) : null,
      enableExtension: row.enable_extension != null ? String(row.enable_extension) : null,
      subscriptionExtends: row.subscription_extends != null ? String(row.subscription_extends) : null,
      managementSection: row.management_section != null ? String(row.management_section) : null,
      socialOptions: row.social_options != null ? String(row.social_options) : null,
      enableFreeAccounts: row.enable_free_accounts != null ? String(row.enable_free_accounts) : null,
      basicVersion: row.basic_version != null ? String(row.basic_version) : null,
      premiumVersion: row.premium_version != null ? String(row.premium_version) : null,
      professionalVersion: row.professional_version != null ? String(row.professional_version) : null,
      languageId: row.language_id != null ? Number(row.language_id) : null,
      helpHtmlPagesId: row.help_html_pages_id != null ? Number(row.help_html_pages_id) : null,
      email: row.email != null ? String(row.email) : null,
      recipient: row.recipient != null ? String(row.recipient) : null,
      used: row.used != null ? Number(row.used) : null,
      created: formatDateTime(row.created),
      inviteCount: inviteEntries.length,
      inviteEmails,
      inviteEntries,
      creator,
      creatorFlagImage,
      creatorCountryCode,
      inviteFlagImage,
      inviteCountryCode,
      versionCount,
      lastInviteDate,
      lastRegistrationDate,
      allowChildPromocodes: Number(row.allow_child_promocodes ?? 0) === 1,
      childPromoLimit: row.child_promo_limit != null ? Number(row.child_promo_limit) : null,
      childPromoUntil: formatDate(row.child_promo_until),
      childVersionIds: row.child_version_ids != null ? String(row.child_version_ids) : null,
      childDurationDays: row.child_duration_days != null ? Number(row.child_duration_days) : null,
      parentPromocodeId: row.parent_promocode_id != null ? Number(row.parent_promocode_id) : null,
    });
  }

  return { items, total, page, pageSize };
}

export async function getPromocodeSettingById(id: number): Promise<PromocodeSettingRow | null> {
  const settingsTable = await getPromocodeSettingsTable();
  if (!settingsTable) return null;

  const selectSql = await buildPromocodeSettingsSelectSql(settingsTable);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectSql} FROM \`${settingsTable}\` WHERE id = ? AND delete_status = 2 LIMIT 1`,
    id
  );
  if (!rows[0]) return null;

  const row = rows[0];
  const creatorId = Number(row.creater_id ?? row.creator_id ?? 0);
  const creators = await fetchLegacyUsersByIds(creatorId > 0 ? [creatorId] : []);
  const creator = creatorId > 0 ? creators.get(creatorId) ?? null : null;
  const modernCreatorCountries = await fetchModernUserCountries(
    creator ? [{ legacyId: creator.id, email: creator.email, username: creator.username }] : []
  );

  let creatorFlagImage: string | null = null;
  let creatorCountryCode: string | null = null;
  try {
    creatorFlagImage = await fetchFlagImageByCountryId(creator?.countryId ?? null);
    creatorCountryCode = await fetchCountryCodeById(creator?.countryId ?? null);
    const modernCountry = findModernUserCountry(modernCreatorCountries, {
      legacyId: creator?.id,
      email: creator?.email,
      username: creator?.username,
    });
    if (modernCountry) {
      creatorCountryCode = modernCountry.countryCode;
    }
  } catch (err) {
    console.warn('promocode creator flag/country lookup failed:', err);
  }

  return {
    id: Number(row.id),
    code: row.code != null ? String(row.code) : null,
    createrId: creatorId || null,
    validFrom: formatDate(row.valid_from),
    validTo: formatDate(row.valid_to),
    enable: row.enable != null ? String(row.enable) : null,
    usableBy: row.usable_by != null ? String(row.usable_by) : null,
    versionId: row.version_id != null ? String(row.version_id) : null,
    discount: row.discount != null ? String(row.discount) : null,
    enableExtension: row.enable_extension != null ? String(row.enable_extension) : null,
    subscriptionExtends: row.subscription_extends != null ? String(row.subscription_extends) : null,
    managementSection: row.management_section != null ? String(row.management_section) : null,
    socialOptions: row.social_options != null ? String(row.social_options) : null,
    enableFreeAccounts: row.enable_free_accounts != null ? String(row.enable_free_accounts) : null,
    basicVersion: row.basic_version != null ? String(row.basic_version) : null,
    premiumVersion: row.premium_version != null ? String(row.premium_version) : null,
    professionalVersion: row.professional_version != null ? String(row.professional_version) : null,
    languageId: row.language_id != null ? Number(row.language_id) : null,
    helpHtmlPagesId: row.help_html_pages_id != null ? Number(row.help_html_pages_id) : null,
    email: row.email != null ? String(row.email) : null,
    recipient: row.recipient != null ? String(row.recipient) : null,
    used: row.used != null ? Number(row.used) : null,
    created: formatDateTime(row.created),
    inviteCount: 0,
    inviteEmails: [],
    inviteEntries: [],
    creator,
    creatorFlagImage,
    creatorCountryCode,
    versionCount: row.version_id ? String(row.version_id).split(',').filter(Boolean).length : 0,
    allowChildPromocodes: Number(row.allow_child_promocodes ?? 0) === 1,
    childPromoLimit: row.child_promo_limit != null ? Number(row.child_promo_limit) : null,
    childPromoUntil: formatDate(row.child_promo_until),
    childVersionIds: row.child_version_ids != null ? String(row.child_version_ids) : null,
    childDurationDays: row.child_duration_days != null ? Number(row.child_duration_days) : null,
    parentPromocodeId: row.parent_promocode_id != null ? Number(row.parent_promocode_id) : null,
  };
}

export async function getPromocodeMeta(): Promise<PromocodeMeta> {
  try {
    await ensurePromocodeMetaTables();
  } catch (err) {
    console.warn('promocode meta bootstrap skipped:', err);
  }

  const legacyMeta = await withLegacyConnection(async (connection) => {
    const query = async <T>(sql: string, params: unknown[] = []): Promise<T> => {
      const [rows] = await connection.query(sql, params);
      return rows as T;
    };

    const tableExists = async (tableName: string): Promise<boolean> => {
      const rows = await query<{ TABLE_NAME: string }[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
        [tableName]
      );
      return rows.length > 0;
    };

    const tableColumns = async (tableName: string): Promise<Set<string>> => {
      const rows = await query<{ COLUMN_NAME: string }[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );
      return new Set(rows.map((row) => row.COLUMN_NAME));
    };

    const pickColumn = (columns: Set<string>, candidates: string[]): string | null =>
      candidates.find((column) => columns.has(column)) ?? null;

    const subscriptions = await (async () => {
      if (!(await tableExists('subscription_settings'))) return [];
      const columns = await tableColumns('subscription_settings');
      const idCol = pickColumn(columns, ['id']);
      const nameCol = pickColumn(columns, ['subscription_name', 'name']);
      if (!idCol || !nameCol) return [];
      return query<{ id: number | bigint; subscription_name: string | null }[]>(
        `SELECT \`${idCol}\` AS id, \`${nameCol}\` AS subscription_name
         FROM subscription_settings
         WHERE \`${nameCol}\` IS NOT NULL AND \`${nameCol}\` != ''
         ORDER BY \`${idCol}\` ASC`
      );
    })().catch(() => [] as { id: number | bigint; subscription_name: string | null }[]);

    const helpFallback = await (async () => {
      if (!(await tableExists('help_html_pages'))) return [];
      const columns = await tableColumns('help_html_pages');
      const idCol = pickColumn(columns, ['id']);
      const titleCol = pickColumn(columns, ['page_title', 'title']);
      const langCol = pickColumn(columns, ['lang_id', 'language_id']);
      if (!idCol || !titleCol) return [];

      if (langCol) {
        const rows = await query<{ id: number | bigint; page_title: string | null }[]>(
          `SELECT \`${idCol}\` AS id, \`${titleCol}\` AS page_title
           FROM help_html_pages
           WHERE \`${langCol}\` = 1 AND \`${titleCol}\` IS NOT NULL AND \`${titleCol}\` != ''
           ORDER BY \`${idCol}\` DESC`
        );
        if (rows.length > 0) return rows;
      }

      return query<{ id: number | bigint; page_title: string | null }[]>(
        `SELECT \`${idCol}\` AS id, \`${titleCol}\` AS page_title
         FROM help_html_pages
         WHERE \`${titleCol}\` IS NOT NULL AND \`${titleCol}\` != ''
         ORDER BY \`${idCol}\` DESC`
      );
    })().catch(() => [] as { id: number | bigint; page_title: string | null }[]);

    const languages = await (async () => {
      if (!(await tableExists('language_values'))) return [];
      const columns = await tableColumns('language_values');
      const idCol = pickColumn(columns, ['id']);
      const nameCol = pickColumn(columns, ['lang_name', 'name', 'lang_value']);
      if (!idCol || !nameCol) return [];
      return query<{ id: number | bigint; lang_name: string | null }[]>(
        `SELECT \`${idCol}\` AS id, \`${nameCol}\` AS lang_name
         FROM language_values
         ORDER BY \`${idCol}\` ASC`
      );
    })().catch(() => [] as { id: number | bigint; lang_name: string | null }[]);

    return {
      subscriptions: subscriptions.map((row) => ({
        id: Number(row.id),
        name: String(row.subscription_name),
      })),
      helpHtmlPages: helpFallback.map((row) => ({
        id: Number(row.id),
        title: String(row.page_title),
      })),
      languages: languages.map((row) => ({
        id: Number(row.id),
        name: row.lang_name ? String(row.lang_name) : `Lang ${row.id}`,
      })),
    };
  });

  if (legacyMeta && (legacyMeta.subscriptions.length > 0 || legacyMeta.helpHtmlPages.length > 0)) {
    return legacyMeta;
  }

  const prismaQuery = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
    prisma.$queryRawUnsafe<T>(sql, ...params);

  let meta: PromocodeMeta;
  try {
    meta = {
      subscriptions: await loadSubscriptionsFromTable(prismaQuery),
      helpHtmlPages: await loadHelpHtmlPagesFromTable(prismaQuery),
      languages: await loadLanguagesFromTable(prismaQuery),
    };
  } catch (err) {
    console.error('promocode meta prisma load failed:', err);
    meta = { subscriptions: [], helpHtmlPages: [], languages: [] };
  }

  if (
    meta.subscriptions.length === 0 &&
    meta.helpHtmlPages.length === 0 &&
    meta.languages.length === 0
  ) {
    return getDefaultPromocodeMeta();
  }

  return meta;
}

export { generatePromocode } from '@/lib/promocodes/generatePromocode';

function buildValidTo(form: PromocodeSettingFormData): string {
  const year = parseInt(String(form.toYear), 10);
  const month = parseInt(String(form.toMonth), 10);
  let day = parseInt(String(form.toDay), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date().toISOString().slice(0, 10);
  }
  const lastDay = new Date(year, month, 0).getDate();
  if (!Number.isFinite(day) || day < 1) day = 1;
  if (day > lastDay) day = lastDay;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function createPromocodeSetting(
  form: PromocodeSettingFormData,
  creatorId: number
): Promise<number | null> {
  try {
    await ensurePromocodeMetaTables();
  } catch (err) {
    console.warn('promocode create bootstrap skipped:', err);
  }

  const settingsTable = await getPromocodeSettingsTable();
  if (!settingsTable) return null;

  const columns = await getSettingsColumns();
  const fields: string[] = [];
  const placeholders: string[] = [];
  const values: unknown[] = [];
  const now = new Date();
  const discountNum = parseInt(String(form.discount ?? '0'), 10);
  const subscriptionExtendsRaw = String(form.subscriptionExtends ?? '').trim();
  const subscriptionExtendsParsed =
    subscriptionExtendsRaw === '' ? null : parseInt(subscriptionExtendsRaw, 10);
  const subscriptionExtendsNum =
    subscriptionExtendsParsed != null && Number.isFinite(subscriptionExtendsParsed)
      ? subscriptionExtendsParsed
      : null;

  const addField = (col: string, value: unknown) => {
    if (!columns.has(col)) return;
    fields.push(col);
    placeholders.push('?');
    values.push(value);
  };

  addField('code', form.code);
  addField('creater_id', String(creatorId));
  addField('creator_id', creatorId);
  addField('valid_from', now.toISOString().slice(0, 10));
  addField('valid_to', buildValidTo(form));
  addField('enable', form.enable ? 'Enable' : 'Disable');
  addField('usable_by', form.usableBy);
  addField('version_id', form.versionIds.join(','));
  addField('discount', Number.isFinite(discountNum) ? discountNum : 0);
  addField('enable_extension', form.enableExtension ? 1 : 0);
  addField('subscription_extends', subscriptionExtendsNum);
  addField('management_section', form.managementSection);
  addField('social_options', serialize(form.socialOptions ?? []));
  addField('enable_free_accounts', form.enableFreeAccounts ? 1 : 0);
  addField('basic_version', form.basicVersion);
  addField('premium_version', form.premiumVersion);
  addField('professional_version', form.professionalVersion);
  addField('language_id', form.languageId != null ? String(form.languageId) : null);
  addField('help_html_pages_id', form.helpHtmlPagesId != null ? String(form.helpHtmlPagesId) : null);
  addField('email', form.email);
  addField('recipient', form.recipient);
  addField('allow_child_promocodes', form.allowChildPromocodes ? 1 : 0);
  addField(
    'child_promo_limit',
    form.childPromoLimit != null && String(form.childPromoLimit).trim() !== ''
      ? Number(form.childPromoLimit)
      : null
  );
  addField(
    'child_promo_until',
    form.childPromoUntil?.trim() ? form.childPromoUntil.trim().slice(0, 10) : null
  );
  addField(
    'child_version_ids',
    Array.isArray(form.childVersionIds) && form.childVersionIds.length > 0
      ? form.childVersionIds.join(',')
      : null
  );
  addField(
    'child_duration_days',
    form.childDurationDays != null && String(form.childDurationDays).trim() !== ''
      ? Number(form.childDurationDays)
      : null
  );
  addField('parent_promocode_id', form.parentPromocodeId ?? null);
  addField('delete_status', 2);
  addField('delete_date', null);
  addField('used', 0);
  addField('created', now);
  addField('modified', now);

  if (fields.length === 0) return null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${settingsTable}\` (${fields.map((f) => `\`${f}\``).join(', ')})
     VALUES (${placeholders.join(', ')})`,
    ...values
  );

  const idRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT LAST_INSERT_ID() AS id`
  );
  return Number(idRows[0]?.id ?? 0) || null;
}

export async function updatePromocodeSetting(id: number, form: PromocodeSettingFormData): Promise<boolean> {
  try {
    await ensurePromocodeMetaTables();
  } catch (err) {
    console.warn('promocode update bootstrap skipped:', err);
  }

  const settingsTable = await getPromocodeSettingsTable();
  if (!settingsTable) return false;

  const columns = await getSettingsColumns();
  const sets: string[] = [];
  const values: unknown[] = [];
  const discountNum = parseInt(String(form.discount ?? '0'), 10);
  const subscriptionExtendsRaw = String(form.subscriptionExtends ?? '').trim();
  const subscriptionExtendsParsed =
    subscriptionExtendsRaw === '' ? null : parseInt(subscriptionExtendsRaw, 10);
  const subscriptionExtendsNum =
    subscriptionExtendsParsed != null && Number.isFinite(subscriptionExtendsParsed)
      ? subscriptionExtendsParsed
      : null;

  const addSet = (col: string, value: unknown) => {
    if (!columns.has(col)) return;
    sets.push(`\`${col}\` = ?`);
    values.push(value);
  };

  addSet('valid_to', buildValidTo(form));
  addSet('enable', form.enable ? 'Enable' : 'Disable');
  addSet('usable_by', form.usableBy);
  addSet('discount', Number.isFinite(discountNum) ? discountNum : 0);
  addSet('enable_extension', form.enableExtension ? 1 : 0);
  addSet('subscription_extends', subscriptionExtendsNum);
  addSet('management_section', form.managementSection);
  addSet(
    'social_options',
    serialize(Array.isArray(form.socialOptions) ? form.socialOptions : [])
  );
  addSet('enable_free_accounts', form.enableFreeAccounts ? 1 : 0);
  addSet('basic_version', form.basicVersion);
  addSet('premium_version', form.premiumVersion);
  addSet('professional_version', form.professionalVersion);
  addSet('help_html_pages_id', form.helpHtmlPagesId != null ? String(form.helpHtmlPagesId) : null);
  addSet('language_id', form.languageId != null ? String(form.languageId) : null);
  addSet('email', form.email);
  addSet('recipient', form.recipient);
  addSet('allow_child_promocodes', form.allowChildPromocodes ? 1 : 0);
  addSet(
    'child_promo_limit',
    form.childPromoLimit != null && String(form.childPromoLimit).trim() !== ''
      ? Number(form.childPromoLimit)
      : null
  );
  addSet(
    'child_promo_until',
    form.childPromoUntil?.trim() ? form.childPromoUntil.trim().slice(0, 10) : null
  );
  addSet(
    'child_version_ids',
    Array.isArray(form.childVersionIds) && form.childVersionIds.length > 0
      ? form.childVersionIds.join(',')
      : null
  );
  addSet(
    'child_duration_days',
    form.childDurationDays != null && String(form.childDurationDays).trim() !== ''
      ? Number(form.childDurationDays)
      : null
  );
  addSet('modified', new Date());

  if (sets.length === 0) return false;

  await prisma.$executeRawUnsafe(
    `UPDATE \`${settingsTable}\` SET ${sets.join(', ')} WHERE id = ?`,
    ...values,
    id
  );
  return true;
}

export async function softDeletePromocodeApplies(ids: number[]): Promise<number> {
  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable || ids.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const placeholders = ids.map(() => '?').join(',');
  const result = await prisma.$executeRawUnsafe(
    `UPDATE \`${appliesTable}\`
     SET delete_status = 1, delete_date = ?
     WHERE id IN (${placeholders})`,
    today,
    ...ids
  );
  return Number(result);
}

export async function softDeletePromocodeSettings(ids: number[]): Promise<number> {
  const settingsTable = await getPromocodeSettingsTable();
  if (!settingsTable || ids.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const placeholders = ids.map(() => '?').join(',');
  const result = await prisma.$executeRawUnsafe(
    `UPDATE \`${settingsTable}\`
     SET delete_status = 1, delete_date = ?
     WHERE id IN (${placeholders})`,
    today,
    ...ids
  );
  return Number(result);
}

export async function checkPromocodeByUser(input: {
  code: string;
  userid: number;
  amount: number;
}): Promise<{ status: 'success' | 'error'; message: string }> {
  const settingsTable = await getPromocodeSettingsTable();
  const appliesTable = await getPromocodeAppliesTable();
  if (!settingsTable || !appliesTable) {
    return { status: 'error', message: 'Promocode not valid.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const selectSql = await buildPromocodeSettingsSelectSql(settingsTable);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectSql} FROM \`${settingsTable}\`
     WHERE code = ? AND valid_from <= ? AND valid_to >= ? AND enable = 'Enable' AND delete_status = 2
     LIMIT 1`,
    input.code,
    today,
    today
  );
  const data = rows[0];
  if (!data) return { status: 'error', message: 'Promocode not valid.' };

  if (String(data.usable_by) === 'Once') {
    if (Number(data.used) !== 0) {
      return { status: 'error', message: 'You are not use again this code' };
    }
    await prisma.$executeRawUnsafe(
      `UPDATE \`${settingsTable}\` SET used = 1, enable = 'Disable' WHERE id = ?`,
      Number(data.id)
    );
  } else {
    const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${appliesTable}\` WHERE user_id = ? AND delete_status = 2 LIMIT 1`,
      input.userid
    );
    if (existing.length > 0) {
      return { status: 'error', message: 'This promo code already used.' };
    }
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${appliesTable}\` (user_id, promocode_id, delete_status, created)
     VALUES (?, ?, 2, NOW())`,
    input.userid,
    Number(data.id)
  );

  return { status: 'success', message: 'Promo code apply successfully!' };
}

export function parseSocialOptions(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return (unserialize(raw) as Record<string, unknown>) ?? {};
  } catch {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
