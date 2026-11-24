import { prisma } from '@/lib/prisma';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import {
  fetchCountryCodeById,
  fetchFlagImageByCountryId,
  fetchLegacyUserByEmail,
  fetchLegacyUserByUsername,
  fetchLegacyUsersByIds,
  getAppliesColumns,
  getHelpHtmlPagesTable,
  getLanguageValuesTable,
  getLegacyUsersTable,
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getSettingsColumns,
  getSubscriptionSettingsTable,
  legacyUserExistsByEmail,
} from '@/lib/promocodes/legacyDb';
import type { LegacyUserSnippet } from '@/lib/promocodes/types';
import {
  buildInviteEmailHtml,
  buildRegisterUrl,
} from '@/lib/promocodes/sendInviteService';
import { buildPromocodeSettingsSelectSql } from '@/lib/promocodes/promocodeSettingsQuery';
import { loadPromocodeInviteLanguageParagraph } from '@/lib/promocodes/promocodeInviteLanguage';
import { getChildPromoRights, resolveInviteExpiryDate, userOwnsOrReceivedPromocode, type ChildPromoRights } from '@/lib/promocodes/childPromocode';
import { loadSenderIntroMessage } from '@/lib/promocodes/promocodeInviteLinks';
import { attachEntityLogos } from '@/lib/promocodes/promocodeAvatars';
import { incrementInviteStat } from '@/lib/promocodes/promocodeMonthlyStatsService';
import {
  isMovesbookLegacyUser,
  languageIdForLegacyUser,
} from '@/lib/promocodes/promocodeSenderLanguage';

const ROLE_NAMES: Record<number, string> = {
  1: 'Super Admin',
  2: 'Admin',
  5: 'Single User',
  6: 'Coach',
  7: 'Team',
  8: 'Club',
  9: 'Group',
};

const SUGGEST_TAB_ROLES = new Set([5, 6, 7, 8, 9]);
const ADMIN_ROLES = new Set([1, 2]);

export type PromocodeOption = {
  id: number;
  code: string;
  validTo: string;
  helpHtmlPagesId: number | null;
  languageId: number | null;
};

export type InvitationRow = {
  applyId: number;
  promocodeId: number;
  promocodeCode: string;
  usableBy: string;
  recipient: string;
  enable: string;
  emailCount: number;
  emailList: string;
  /** Invites sent by the current user with this promocode (not global promocode email blob). */
  inviteEntries: Array<{
    email: string;
    username: string | null;
    registered: boolean;
    inviteDate: string | null;
    registrationDate: string | null;
    subscriptionName: string | null;
  }>;
  created: string;
  status: 'Registered' | 'Pending';
  senderUsername: string;
  senderEmail: string;
  senderImage: string | null;
  countryCode: string;
  senderFlagImg: string | null;
  version: string;
};

/** Outbound invite/registration rows for "Recipients record selected". */
export type SentRecipientRow = {
  applyId: number;
  promocodeId: number;
  promocodeCode: string;
  senderUsername: string;
  receiverLabel: string;
  receiverEmail: string;
  registered: boolean;
  inviteDate: string;
  registrationDate: string;
  version: string;
  status: 'Pending' | 'Registered' | 'Expire' | 'Current' | '--';
  credits: number;
};

export type RegisteredUserRow = {
  senderUsername: string;
  senderId: number | null;
  username: string;
  roleId: number | null;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  subscriptionSettingId: number | null;
  /** Registration date from apply or subscription start. */
  registrationDate: string;
  /** Version chosen at registration (receiver_version / subscription name). */
  versionChosen: string;
  promocodeCode: string;
  promocodeValidTo: string;
  mailDate: string;
  status: 'Expire' | 'Current' | '--';
  credits: number;
};

export type CreditRecordRow = {
  senderUsername: string;
  creditsThanksTo: string;
  secondarySenderUsername: string;
  secondarySenderFlagImg: string | null;
  secondarySenderCountryCode: string | null;
  receiverUsername: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  versionName: string;
  credits: number;
};

export type ConnectionChartData = {
  currentUserUsername: string;
  currentUserRoleName: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  /** Credits earned when this user registered themselves (receiver_credit / credit2). */
  personalRegistrationCredits: number;
  allowsCurrentUserToEarn: {
    username: string;
    roleName: string;
    roleId: number | null;
  } | null;
  directRecipients: Array<{
    username: string;
    roleName: string;
    credits: number;
    receiverId: number;
    image?: string | null;
    logoUrl?: string | null;
    roleId?: number | null;
  }>;
  indirectRecipients: Array<{
    username: string;
    roleName: string;
    credits: number;
    senderUsername: string;
    senderRoleName: string;
    image?: string | null;
    logoUrl?: string | null;
    roleId?: number | null;
  }>;
};

export type NotificationByPromocodeDashboard = {
  isAdmin: boolean;
  showSuggestTab: boolean;
  defaultTab: 'suggest' | 'invitations';
  promocode: PromocodeOption;
  promocodesList: PromocodeOption[];
  totalInviteCount: number;
  regCount: Record<string, number>;
  lastEmailSentDate: string;
  returnIndex: string;
  invitationsData: InvitationRow[];
  /** Outbound invites for the highlighted "Recipients record selected" grid. */
  sentRecipients: SentRecipientRow[];
  registeredUsers: RegisteredUserRow[];
  creditRecords: CreditRecordRow[];
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  connectionChart: ConnectionChartData;
  roles: Record<number, string>;
  subscriptionsData: Record<number, string>;
  childPromo: ChildPromoRights;
  generatedPromocodes: PromocodeOption[];
  savedIntro: string;
};

type ApplyRow = Record<string, unknown>;
type PromoRow = Record<string, unknown>;

function rowNum(row: ApplyRow | PromoRow | undefined, ...keys: string[]): number {
  if (!row) return 0;
  for (const key of keys) {
    const val = row[key];
    if (val != null && val !== '') return Number(val);
  }
  return 0;
}

function rowStr(row: ApplyRow | PromoRow | undefined, ...keys: string[]): string {
  if (!row) return '';
  for (const key of keys) {
    const val = row[key];
    if (val != null && val !== '') return String(val);
  }
  return '';
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard-Version credit1 (friend-of-a-friend) for a registered receiver.
 * Used when promocode_applies.secondary_sender_credit was left empty at registration.
 */
async function resolveCredit1ForReceiver(params: {
  receiverId: number;
  receiverVersionName?: string;
}): Promise<number> {
  const subTable = await getSubscriptionSettingsTable();
  const usersTable = await getLegacyUsersTable();
  if (!subTable) return 0;

  if (params.receiverId > 0 && usersTable) {
    const userRows = await prisma.$queryRawUnsafe<{ subscription_setting_id: number | null }[]>(
      `SELECT subscription_setting_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
      params.receiverId
    );
    const settingId = userRows[0]?.subscription_setting_id != null
      ? Number(userRows[0].subscription_setting_id)
      : 0;
    if (settingId > 0) {
      const creditRows = await prisma.$queryRawUnsafe<{ credit1: unknown }[]>(
        `SELECT credit1 FROM \`${subTable}\` WHERE id = ? LIMIT 1`,
        settingId
      );
      const n = Number(creditRows[0]?.credit1 ?? 0);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  const versionName = (params.receiverVersionName || '').trim();
  if (versionName) {
    const creditRows = await prisma.$queryRawUnsafe<{ credit1: unknown }[]>(
      `SELECT credit1 FROM \`${subTable}\` WHERE subscription_name = ? LIMIT 1`,
      versionName
    );
    const n = Number(creditRows[0]?.credit1 ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

async function resolveSecondaryCreditAmount(params: {
  storedCredit: number;
  receiverId: number;
  receiverVersionName?: string;
}): Promise<number> {
  if (params.storedCredit > 0) return params.storedCredit;
  return resolveCredit1ForReceiver({
    receiverId: params.receiverId,
    receiverVersionName: params.receiverVersionName,
  });
}

async function loadSubscriptionMaps(): Promise<{
  byName: Record<number, string>;
  byCodeNo: Record<number, string>;
}> {
  const table = await getSubscriptionSettingsTable();
  const byName: Record<number, string> = {};
  const byCodeNo: Record<number, string> = {};
  if (!table) return { byName, byCodeNo };

  const columns = await getTableColumns(table);
  const nameCol = columns.has('subscription_name') ? 'subscription_name' : null;
  const codeCol = columns.has('code_no') ? 'code_no' : null;
  if (!nameCol && !codeCol) return { byName, byCodeNo };

  const selectCols = ['id'];
  if (nameCol) selectCols.push(nameCol);
  if (codeCol) selectCols.push(codeCol);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectCols.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\``
  );

  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (nameCol && row[nameCol] != null) byName[id] = String(row[nameCol]);
    if (codeCol && row[codeCol] != null) byCodeNo[id] = String(row[codeCol]);
  }
  return { byName, byCodeNo };
}

function versionFromIds(versionId: string, codeMap: Record<number, string>): string {
  if (!versionId.trim()) return '';
  const ids = versionId.split(',').map((v) => Number(v.trim())).filter((id) => id > 0);
  if (ids.length === 0) return '';
  return ids.map((id) => codeMap[id] ?? String(id)).join(',');
}

async function resolveHelpHtmlContent(htmlPageId: string): Promise<string> {
  const table = await getHelpHtmlPagesTable();
  if (!table || !htmlPageId) return '';
  const rows = await prisma.$queryRawUnsafe<{ content: string | null }[]>(
    `SELECT content FROM \`${table}\` WHERE id = ? LIMIT 1`,
    htmlPageId
  );
  return rows[0]?.content ?? '';
}

async function resolveLanguageColumn(languageId: number): Promise<string> {
  const table = await getLanguageValuesTable();
  if (!table) return 'English';
  const columns = await getTableColumns(table);
  const nameCol = columns.has('lang_name') ? 'lang_name' : columns.has('name') ? 'name' : null;
  if (!nameCol) return 'English';
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT \`${nameCol}\` AS lang_name FROM \`${table}\` WHERE id = ? LIMIT 1`,
    languageId
  );
  return rows[0]?.lang_name != null ? String(rows[0].lang_name) : 'English';
}

async function fetchUserNameParts(userId: number): Promise<{ firstname: string; lastname: string }> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return { firstname: '', lastname: '' };
  const rows = await prisma.$queryRawUnsafe<{ firstname: string | null; lastname: string | null }[]>(
    `SELECT firstname, lastname FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
    userId
  );
  return {
    firstname: rows[0]?.firstname?.trim() ?? '',
    lastname: rows[0]?.lastname?.trim() ?? '',
  };
}

export async function getNotificationByPromocodeDashboard(params: {
  legacyUserId: number;
  email: string;
  roleId: number | null;
}): Promise<NotificationByPromocodeDashboard> {
  const { legacyUserId, email } = params;
  const roleId = params.roleId ?? 0;
  const isAdmin = ADMIN_ROLES.has(roleId);
  const showSuggestTab = SUGGEST_TAB_ROLES.has(roleId);

  const appliesTable = await getPromocodeAppliesTable();
  const settingsTable = await getPromocodeSettingsTable();
  const usersTable = await getLegacyUsersTable();

  const promocodesList: PromocodeOption[] = [];
  const generatedPromocodes: PromocodeOption[] = [];
  let promocode: PromocodeOption = {
    id: 0,
    code: '',
    validTo: '',
    helpHtmlPagesId: null,
    languageId: null,
  };

  if (appliesTable && settingsTable) {
    const emailNorm = email.trim().toLowerCase();
    const receivedRows = await prisma.$queryRawUnsafe<{ promocode_id: number | null }[]>(
      `SELECT DISTINCT promocode_id FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND receiver_id > 0 AND delete_status = 2
         AND LOWER(TRIM(COALESCE(receiver_email, ''))) = ?`,
      legacyUserId,
      emailNorm
    );
    const promoIds = Array.from(
      new Set(receivedRows.map((r) => Number(r.promocode_id)).filter((id) => id > 0))
    );

    if (promoIds.length > 0) {
      const placeholders = promoIds.map(() => '?').join(',');
      const promoSelectSql = await buildPromocodeSettingsSelectSql(settingsTable);
      const promoRows = await prisma.$queryRawUnsafe<PromoRow[]>(
        `SELECT ${promoSelectSql} FROM \`${settingsTable}\` WHERE id IN (${placeholders})`,
        ...promoIds
      );
      for (const p of promoRows) {
        const helpHtmlPagesIdRaw = rowStr(p, 'help_html_pages_id', 'help_html_page_id');
        const languageIdRaw = rowNum(p, 'language_id');
        const option: PromocodeOption = {
          id: Number(p.id),
          code: rowStr(p, 'code'),
          validTo: formatDate(p.valid_to),
          helpHtmlPagesId: helpHtmlPagesIdRaw ? Number(helpHtmlPagesIdRaw) : null,
          languageId: languageIdRaw > 0 ? languageIdRaw : null,
        };
        promocodesList.push(option);
        if (promocode.id === 0) promocode = option;
      }
    }

    const settingsCols = await getSettingsColumns();
    const creatorCol = settingsCols.has('creator_id')
      ? 'creator_id'
      : settingsCols.has('creater_id')
        ? 'creater_id'
        : null;
    if (creatorCol) {
      const generatedRows = await prisma.$queryRawUnsafe<PromoRow[]>(
        `SELECT ${await buildPromocodeSettingsSelectSql(settingsTable)}
         FROM \`${settingsTable}\`
         WHERE \`${creatorCol}\` = ? AND delete_status = 2
         ORDER BY id DESC`,
        legacyUserId
      );
      for (const p of generatedRows) {
        const option: PromocodeOption = {
          id: Number(p.id),
          code: rowStr(p, 'code'),
          validTo: formatDate(p.valid_to),
          helpHtmlPagesId: rowStr(p, 'help_html_pages_id') ? Number(rowStr(p, 'help_html_pages_id')) : null,
          languageId: rowNum(p, 'language_id') || null,
        };
        generatedPromocodes.push(option);
        if (!promocodesList.some((existing) => existing.id === option.id)) {
          promocodesList.push(option);
        }
      }
      // Dedupe by code, keep highest id (rows already ORDER BY id DESC).
      const seenCodes = new Set<string>();
      const dedupedGenerated: PromocodeOption[] = [];
      for (const option of generatedPromocodes) {
        const codeKey = option.code.trim().toLowerCase();
        if (!codeKey) {
          dedupedGenerated.push(option);
          continue;
        }
        if (seenCodes.has(codeKey)) continue;
        seenCodes.add(codeKey);
        dedupedGenerated.push(option);
      }
      generatedPromocodes.length = 0;
      generatedPromocodes.push(...dedupedGenerated);
    }
  }

  let totalInviteCount = 0;
  const regCount: Record<string, number> = { '5': 0, '6': 0, '7': 0, '8': 0, '9': 0 };
  let lastEmailSentDate = '';

  if (appliesTable && usersTable) {
    const sentInvites = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT receiver_id, created FROM \`${appliesTable}\`
       WHERE LOWER(sender_email) = ? AND delete_status = 2`,
      email.trim().toLowerCase()
    );
    totalInviteCount = sentInvites.length;

    for (const invite of sentInvites) {
      const receiverId = rowNum(invite, 'receiver_id');
      if (receiverId > 0) {
        const userRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
          `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          receiverId
        );
        const rid = userRows[0]?.role_id != null ? Number(userRows[0].role_id) : 0;
        if (rid > 0) {
          const key = String(rid);
          regCount[key] = (regCount[key] ?? 0) + 1;
        }
      }
      lastEmailSentDate = formatDate(invite.created);
    }
  }

  const registeredSum = Object.values(regCount).reduce((a, b) => a + b, 0);
  const returnIndex =
    totalInviteCount === 0 ? '0' : ((registeredSum / totalInviteCount) * 100).toFixed(1);

  const { byName: subscriptionsData, byCodeNo: subscriptionCodeMap } = await loadSubscriptionMaps();
  const roles = ROLE_NAMES;

  const invitationsData: InvitationRow[] = [];
  const sentRecipients: SentRecipientRow[] = [];
  if (appliesTable && settingsTable) {
    // Match PHP: promocodes the current user received (receiver_id only).
    const receivedInvitations = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT * FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND receiver_id > 0 AND delete_status = 2
       ORDER BY created DESC`,
      legacyUserId
    );

    const promoSelectSql = await buildPromocodeSettingsSelectSql(settingsTable);
    const seenPromocodeIds = new Set<number>();

    // Invites THIS user sent, keyed by promocode — used for Users column + recipients grid.
    const sentByMe = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT * FROM \`${appliesTable}\`
       WHERE sender_id = ? AND delete_status = 2
       ORDER BY created DESC`,
      legacyUserId
    );
    const sentByPromo = new Map<number, ApplyRow[]>();
    for (const row of sentByMe) {
      const pid = rowNum(row, 'promocode_id');
      if (pid <= 0) continue;
      const list = sentByPromo.get(pid) ?? [];
      list.push(row);
      sentByPromo.set(pid, list);
    }

    for (const applyRecord of receivedInvitations) {
      const promocodeId = rowNum(applyRecord, 'promocode_id');
      if (promocodeId <= 0 || seenPromocodeIds.has(promocodeId)) continue;
      seenPromocodeIds.add(promocodeId);

      const promoRows = await prisma.$queryRawUnsafe<PromoRow[]>(
        `SELECT ${promoSelectSql} FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
        promocodeId
      );
      const promocodeData = promoRows[0];
      if (!promocodeData) continue;

      const senderId = rowNum(applyRecord, 'sender_id');
      let senderUser = senderId > 0 ? (await fetchLegacyUsersByIds([senderId])).get(senderId) : null;
      if (!senderUser) {
        const senderEmail = rowStr(applyRecord, 'sender_email');
        if (senderEmail) senderUser = await fetchLegacyUserByEmail(senderEmail);
      }

      const countryCode = senderUser?.countryId
        ? (await fetchCountryCodeById(senderUser.countryId)) ?? ''
        : '';
      const senderFlagImg = senderUser?.countryId
        ? await fetchFlagImageByCountryId(senderUser.countryId)
        : null;

      const version = versionFromIds(rowStr(promocodeData, 'version_id'), subscriptionCodeMap);

      const mySent = sentByPromo.get(promocodeId) ?? [];
      const inviteEntries: InvitationRow['inviteEntries'] = [];
      for (const sent of mySent) {
        const rid = rowNum(sent, 'receiver_id');
        const receiverEmail = rowStr(sent, 'receiver_email');
        let username: string | null = null;
        let subscriptionName: string | null = null;
        let registrationDate: string | null = null;
        if (rid > 0) {
          const ru = (await fetchLegacyUsersByIds([rid])).get(rid);
          username = ru?.username ?? null;
          registrationDate =
            formatDate(rowStr(sent, 'registration_date')) ||
            formatDate(ru?.subscriptionStartDate) ||
            formatDate(ru?.created) ||
            null;
          if (ru?.subscriptionSettingId && subscriptionsData[ru.subscriptionSettingId]) {
            subscriptionName = subscriptionsData[ru.subscriptionSettingId];
          } else {
            subscriptionName = rowStr(sent, 'receiver_version') || null;
          }
        }
        inviteEntries.push({
          email: receiverEmail,
          username,
          registered: rid > 0,
          inviteDate: formatDate(sent.created) || null,
          registrationDate,
          subscriptionName,
        });
      }

      const emailList = inviteEntries
        .map((e) => (e.registered ? e.username || e.email : e.email))
        .filter(Boolean)
        .join(', ');

      const receiverId = rowNum(applyRecord, 'receiver_id');
      invitationsData.push({
        applyId: rowNum(applyRecord, 'id'),
        promocodeId,
        promocodeCode: rowStr(promocodeData, 'code'),
        usableBy: rowStr(promocodeData, 'usable_by'),
        recipient: rowStr(promocodeData, 'recipient'),
        enable: rowStr(promocodeData, 'enable'),
        emailCount: inviteEntries.length,
        emailList,
        inviteEntries,
        created: formatDate(applyRecord.created),
        status: receiverId > 0 ? 'Registered' : 'Pending',
        senderUsername: senderUser?.username ?? rowStr(applyRecord, 'sender_email'),
        senderEmail: senderUser?.email ?? rowStr(applyRecord, 'sender_email'),
        senderImage: senderUser?.image ?? null,
        countryCode,
        senderFlagImg,
        version,
      });
    }

    // Recipients record selected: all outbound invites by current user (pending + registered).
    for (const sent of sentByMe) {
      const promocodeId = rowNum(sent, 'promocode_id');
      if (promocodeId <= 0) continue;
      const promoRows = await prisma.$queryRawUnsafe<PromoRow[]>(
        `SELECT ${promoSelectSql} FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
        promocodeId
      );
      const promocodeData = promoRows[0];
      if (!promocodeData) continue;

      const rid = rowNum(sent, 'receiver_id');
      const receiverEmail = rowStr(sent, 'receiver_email');
      let receiverLabel = receiverEmail;
      let registrationDate = '';
      let versionName = rowStr(sent, 'receiver_version');
      if (rid > 0) {
        const ru = (await fetchLegacyUsersByIds([rid])).get(rid);
        receiverLabel = ru?.username || receiverEmail;
        registrationDate =
          formatDate(rowStr(sent, 'registration_date')) ||
          formatDate(ru?.subscriptionStartDate) ||
          '';
        if (!versionName && ru?.subscriptionSettingId && subscriptionsData[ru.subscriptionSettingId]) {
          versionName = subscriptionsData[ru.subscriptionSettingId];
        }
      }

      const validTo = formatDate(promocodeData.valid_to);
      const today = new Date().toISOString().slice(0, 10);
      let status: SentRecipientRow['status'] = rid > 0 ? 'Registered' : 'Pending';
      if (rid > 0 && validTo) status = validTo < today ? 'Expire' : 'Current';

      sentRecipients.push({
        applyId: rowNum(sent, 'id'),
        promocodeId,
        promocodeCode: rowStr(promocodeData, 'code'),
        senderUsername: email.split('@')[0] || 'me',
        receiverLabel,
        receiverEmail,
        registered: rid > 0,
        inviteDate: formatDate(sent.created),
        registrationDate,
        version: versionName || '--',
        status,
        credits: rid > 0 ? rowNum(sent, 'sender_credit') : 0,
      });
    }

    // Fill sender username for recipients from current user
    if (sentRecipients.length > 0) {
      const me = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
      const myName = me?.username || email;
      for (const row of sentRecipients) {
        row.senderUsername = myName;
      }
    }
  }

  // Repair friend-of-a-friend (secondary) credits first so "User who registered",
  // Credits earned, and Connections chart all see the same values.
  // Direct recipients of the current user invited others → current user is secondary_sender.
  if (appliesTable && usersTable) {
    const applyColumns = await getAppliesColumns();
    const userColumns = await getTableColumns(usersTable);
    const currentUserSnippet = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
    const repairUsername = currentUserSnippet?.username ?? '';

    const directInviteRows = await prisma.$queryRawUnsafe<{ receiver_id: number | null }[]>(
      `SELECT DISTINCT receiver_id FROM \`${appliesTable}\`
       WHERE sender_id = ? AND receiver_id > 0 AND delete_status = 2`,
      legacyUserId
    );
    const directIds = directInviteRows
      .map((r) => Number(r.receiver_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (directIds.length > 0) {
      const placeholders = directIds.map(() => '?').join(',');
      const friendOfFriendApplies = await prisma.$queryRawUnsafe<ApplyRow[]>(
        `SELECT id, receiver_id, secondary_sender_id, secondary_sender_credit, receiver_version
         FROM \`${appliesTable}\`
         WHERE sender_id IN (${placeholders}) AND receiver_id > 0 AND delete_status = 2`,
        ...directIds
      );

      for (const applyRow of friendOfFriendApplies) {
        const applyId = rowNum(applyRow, 'id');
        const receiverId = rowNum(applyRow, 'receiver_id');
        if (applyId <= 0 || receiverId <= 0) continue;

        const storedSecondaryId = rowNum(applyRow, 'secondary_sender_id');
        const storedSecondaryCredit = rowNum(applyRow, 'secondary_sender_credit');
        const resolvedCredit = await resolveSecondaryCreditAmount({
          storedCredit: storedSecondaryCredit,
          receiverId,
          receiverVersionName: rowStr(applyRow, 'receiver_version'),
        });

        const needsId = storedSecondaryId <= 0;
        const needsCredit = storedSecondaryCredit <= 0 && resolvedCredit > 0;
        if (!needsId && !needsCredit) continue;

        const repair: string[] = [];
        const repairVals: unknown[] = [];
        if (needsId && applyColumns.has('secondary_sender_id')) {
          repair.push('secondary_sender_id = ?');
          repairVals.push(legacyUserId);
        }
        if (needsId && applyColumns.has('secondary_sender_username') && repairUsername) {
          repair.push('secondary_sender_username = ?');
          repairVals.push(repairUsername);
        }
        if (needsCredit && applyColumns.has('secondary_sender_credit')) {
          repair.push('secondary_sender_credit = ?');
          repairVals.push(resolvedCredit);
        }
        if (repair.length === 0) continue;

        await prisma.$executeRawUnsafe(
          `UPDATE \`${appliesTable}\` SET ${repair.join(', ')} WHERE id = ?`,
          ...repairVals,
          applyId
        ).catch(() => undefined);

        // Award secondary credit once when credit1 becomes available after an earlier empty assign.
        if (needsCredit && userColumns.has('credits')) {
          const creditRows = await prisma.$queryRawUnsafe<{ credits: unknown }[]>(
            `SELECT credits FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
            legacyUserId
          );
          const current = Number(creditRows[0]?.credits ?? 0) || 0;
          await prisma.$executeRawUnsafe(
            `UPDATE \`${usersTable}\` SET credits = ? WHERE id = ?`,
            current + resolvedCredit,
            legacyUserId
          ).catch(() => undefined);
        }
      }
    }
  }

  const registeredUsers: RegisteredUserRow[] = [];
  if (appliesTable && settingsTable && usersTable) {
    const promoSelectSql = await buildPromocodeSettingsSelectSql(settingsTable);
    const friendRows = await prisma.$queryRawUnsafe<{ receiver_id: number | null }[]>(
      `SELECT receiver_id FROM \`${appliesTable}\`
       WHERE sender_id = ? AND delete_status = 2`,
      legacyUserId
    );
    const friendIds = new Set<number>([legacyUserId]);
    const directFriendIds = new Set<number>();
    for (const row of friendRows) {
      const rid = row.receiver_id != null ? Number(row.receiver_id) : 0;
      if (rid > 0) {
        friendIds.add(rid);
        directFriendIds.add(rid);
      }
    }

    const friendIdList = Array.from(friendIds);
    const placeholders = friendIdList.map(() => '?').join(',');
    // Only actual registrations (pending invites belong in Recipients record selected).
    const registeredApplies = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT * FROM \`${appliesTable}\`
       WHERE sender_id IN (${placeholders}) AND receiver_id > 0 AND delete_status = 2
       ORDER BY created DESC`,
      ...friendIdList
    );

    const seenRegistrationKeys = new Set<string>();

    for (const applyData of registeredApplies) {
      const promocodeId = rowNum(applyData, 'promocode_id');
      if (promocodeId <= 0) continue;

      const receiverId = rowNum(applyData, 'receiver_id');
      if (receiverId <= 0) continue;

      // Deduplicate: one row per receiver (+ promocode) so a single registration is not tracked twice.
      const dedupeKey = `${receiverId}:${promocodeId}`;
      if (seenRegistrationKeys.has(dedupeKey)) continue;
      seenRegistrationKeys.add(dedupeKey);

      const promoRows = await prisma.$queryRawUnsafe<PromoRow[]>(
        `SELECT ${promoSelectSql} FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
        promocodeId
      );
      const promocodeData = promoRows[0];
      if (!promocodeData) continue;

      let receiverUser: {
        username: string;
        roleId: number | null;
        subscriptionStartDate: string;
        subscriptionEndDate: string;
        subscriptionSettingId: number | null;
      };

      {
        const ru = (await fetchLegacyUsersByIds([receiverId])).get(receiverId);
        receiverUser = {
          username: ru?.username ?? '',
          roleId: null,
          subscriptionStartDate: ru?.subscriptionStartDate ?? '',
          subscriptionEndDate: ru?.subscriptionEndDate ?? '',
          subscriptionSettingId: ru?.subscriptionSettingId ?? null,
        };
        const roleRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
          `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          receiverId
        );
        receiverUser.roleId = roleRows[0]?.role_id != null ? Number(roleRows[0].role_id) : null;
      }

      const senderId = rowNum(applyData, 'sender_id');
      let senderUsername = '';
      let senderIdOut: number | null = senderId > 0 ? senderId : null;
      if (senderId > 0) {
        const su = (await fetchLegacyUsersByIds([senderId])).get(senderId);
        senderUsername = su?.username ?? '';
      } else {
        const senderEmail = rowStr(applyData, 'sender_email');
        if (senderEmail) {
          const su = await fetchLegacyUserByEmail(senderEmail);
          senderUsername = su?.username ?? senderEmail;
          senderIdOut = su?.id ?? null;
        }
      }

      let credits = 0;
      if (senderId === legacyUserId) {
        credits = rowNum(applyData, 'sender_credit');
      } else if (receiverId === legacyUserId) {
        credits = rowNum(applyData, 'receiver_credit');
      } else if (
        rowNum(applyData, 'secondary_sender_id') === legacyUserId ||
        // Friend-of-a-friend: a direct invitee of the current user sent this invite
        (senderId > 0 && directFriendIds.has(senderId))
      ) {
        credits = await resolveSecondaryCreditAmount({
          storedCredit: rowNum(applyData, 'secondary_sender_credit'),
          receiverId,
          receiverVersionName: rowStr(applyData, 'receiver_version'),
        });
      }

      const validTo = formatDate(promocodeData.valid_to);
      const today = new Date().toISOString().slice(0, 10);
      let status: RegisteredUserRow['status'] = '--';
      if (validTo) status = validTo < today ? 'Expire' : 'Current';

      const registrationDate =
        formatDate(rowStr(applyData, 'registration_date')) ||
        formatDate(receiverUser.subscriptionStartDate) ||
        '';

      let versionChosen = rowStr(applyData, 'receiver_version');
      if (
        !versionChosen &&
        receiverUser.subscriptionSettingId &&
        subscriptionsData[receiverUser.subscriptionSettingId]
      ) {
        versionChosen = subscriptionsData[receiverUser.subscriptionSettingId];
      }

      registeredUsers.push({
        senderUsername,
        senderId: senderIdOut,
        username: receiverUser.username,
        roleId: receiverUser.roleId,
        subscriptionStartDate: receiverUser.subscriptionStartDate,
        subscriptionEndDate:
          receiverUser.subscriptionEndDate && receiverUser.subscriptionEndDate !== '1970-01-01'
            ? receiverUser.subscriptionEndDate
            : '',
        subscriptionSettingId: receiverUser.subscriptionSettingId,
        registrationDate,
        versionChosen: versionChosen || '--',
        promocodeCode: rowStr(promocodeData, 'code'),
        promocodeValidTo: validTo,
        mailDate: formatDate(applyData.created),
        status,
        credits,
      });
    }
  }

  const creditRecords: CreditRecordRow[] = [];
  let totalCredits = 0;

  if (appliesTable && usersTable) {
    const creditsApplies = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT * FROM \`${appliesTable}\`
       WHERE delete_status = 2
         AND (sender_id = ? OR receiver_id = ? OR secondary_sender_id = ?)
       ORDER BY created DESC`,
      legacyUserId,
      legacyUserId,
      legacyUserId
    );

    const seenCreditKeys = new Set<string>();

    for (const applyData of creditsApplies) {
      const receiverId = rowNum(applyData, 'receiver_id');
      const senderId = rowNum(applyData, 'sender_id');
      const secondarySenderId = rowNum(applyData, 'secondary_sender_id');
      const applyId = rowNum(applyData, 'id');
      const promocodeId = rowNum(applyData, 'promocode_id');

      let creditsToShow = 0;
      let creditRole: 'receiver' | 'sender' | 'secondary' | null = null;
      if (receiverId === legacyUserId) {
        creditsToShow = rowNum(applyData, 'receiver_credit');
        if (creditsToShow <= 0) continue;
        creditRole = 'receiver';
      } else if (senderId === legacyUserId) {
        creditsToShow = rowNum(applyData, 'sender_credit');
        if (creditsToShow <= 0) continue;
        creditRole = 'sender';
      } else if (secondarySenderId === legacyUserId) {
        creditsToShow = await resolveSecondaryCreditAmount({
          storedCredit: rowNum(applyData, 'secondary_sender_credit'),
          receiverId,
          receiverVersionName: rowStr(applyData, 'receiver_version'),
        });
        if (creditsToShow <= 0) continue;
        creditRole = 'secondary';
      } else {
        continue;
      }

      // Avoid double-counting the same registration / invite credit rows.
      const dedupeKey =
        creditRole === 'receiver'
          ? `receiver:${promocodeId || applyId}`
          : creditRole === 'sender'
            ? `sender:${receiverId || applyId}:${promocodeId || 0}`
            : `secondary:${applyId}`;
      if (seenCreditKeys.has(dedupeKey)) continue;
      seenCreditKeys.add(dedupeKey);

      let creditsThanksTo = '-';
      let secondarySenderUsername = '';
      let secondarySenderFlagImg: string | null = null;
      let secondarySenderCountryCode: string | null = null;

      let ssu: LegacyUserSnippet | null = null;
      if (secondarySenderId > 0) {
        ssu = (await fetchLegacyUsersByIds([secondarySenderId])).get(secondarySenderId) ?? null;
      }
      if (!ssu?.username) {
        const secondaryEmail = rowStr(applyData, 'secondary_sender_email');
        if (secondaryEmail) ssu = await fetchLegacyUserByEmail(secondaryEmail);
      }
      // Registration stores the username on the apply row itself; use it when
      // the id/email lookups cannot resolve the secondary sender anymore.
      const storedSecondaryUsername = rowStr(applyData, 'secondary_sender_username');
      if (!ssu?.username && storedSecondaryUsername) {
        ssu = await fetchLegacyUserByUsername(storedSecondaryUsername);
      }

      if (ssu?.username) {
        secondarySenderUsername = ssu.username;
        creditsThanksTo = ssu.username;
        if (ssu.countryId) {
          secondarySenderFlagImg = await fetchFlagImageByCountryId(ssu.countryId);
          secondarySenderCountryCode = await fetchCountryCodeById(ssu.countryId);
        }
      } else if (storedSecondaryUsername) {
        secondarySenderUsername = storedSecondaryUsername;
        creditsThanksTo = storedSecondaryUsername;
      }

      let senderUsername = '-';
      if (senderId > 0) {
        const su = (await fetchLegacyUsersByIds([senderId])).get(senderId);
        if (su?.username) senderUsername = su.username;
      } else {
        const senderEmail = rowStr(applyData, 'sender_email');
        if (senderEmail) {
          const su = await fetchLegacyUserByEmail(senderEmail);
          senderUsername = su?.username ?? senderEmail;
        }
      }

      let receiverUsername = '';
      let subscriptionStartDate = '';
      let subscriptionEndDate = '';
      if (receiverId > 0) {
        const ru = (await fetchLegacyUsersByIds([receiverId])).get(receiverId);
        receiverUsername = ru?.username ?? '';
        subscriptionStartDate = ru?.subscriptionStartDate ?? '';
        subscriptionEndDate =
          ru?.subscriptionEndDate && ru.subscriptionEndDate !== '1970-01-01'
            ? ru.subscriptionEndDate
            : '';
      }

      totalCredits += creditsToShow;
      creditRecords.push({
        senderUsername,
        creditsThanksTo,
        secondarySenderUsername,
        secondarySenderFlagImg,
        secondarySenderCountryCode,
        receiverUsername,
        subscriptionStartDate,
        subscriptionEndDate,
        versionName: rowStr(applyData, 'receiver_version'),
        credits: creditsToShow,
      });
    }
  }

  let allowsCurrentUserToEarn: ConnectionChartData['allowsCurrentUserToEarn'] = null;
  const directRecipients: ConnectionChartData['directRecipients'] = [];
  const indirectRecipients: ConnectionChartData['indirectRecipients'] = [];
  let personalRegistrationCredits = 0;

  let currentUserUsername = '';
  let currentUserRoleName = '';

  if (usersTable) {
    const currentUser = (await fetchLegacyUsersByIds([legacyUserId])).get(legacyUserId);
    currentUserUsername = currentUser?.username ?? '';
    if (roleId > 0) currentUserRoleName = ROLE_NAMES[roleId] ?? '';
  }

  if (appliesTable && usersTable) {
    const selfCreditRows = await prisma.$queryRawUnsafe<{ credit: unknown }[]>(
      `SELECT MAX(CAST(receiver_credit AS DECIMAL(12,2))) AS credit
       FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND delete_status = 2`,
      legacyUserId
    ).catch(() => [] as { credit: unknown }[]);
    personalRegistrationCredits = Number(selfCreditRows[0]?.credit ?? 0) || 0;

    const allowsRecord = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT sender_id FROM \`${appliesTable}\`
       WHERE receiver_id = ? AND delete_status = 2
       ORDER BY created DESC LIMIT 1`,
      legacyUserId
    );
    const allowsSenderId = rowNum(allowsRecord[0], 'sender_id');
    if (allowsSenderId > 0) {
      const su = (await fetchLegacyUsersByIds([allowsSenderId])).get(allowsSenderId);
      if (su) {
        const senderRoleRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
          `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          allowsSenderId
        );
        const senderRoleId = senderRoleRows[0]?.role_id != null ? Number(senderRoleRows[0].role_id) : null;
        allowsCurrentUserToEarn = {
          username: su.username ?? '',
          roleName: senderRoleId != null ? ROLE_NAMES[senderRoleId] ?? '' : '',
          roleId: senderRoleId,
        };
      }
    }

    const directRows = await prisma.$queryRawUnsafe<ApplyRow[]>(
      `SELECT receiver_id, sender_credit, promocode_id FROM \`${appliesTable}\`
       WHERE sender_id = ? AND receiver_id > 0 AND delete_status = 2
       ORDER BY created DESC`,
      legacyUserId
    );

    const seenDirect = new Set<number>();
    for (const row of directRows) {
      const receiverId = rowNum(row, 'receiver_id');
      if (!receiverId || seenDirect.has(receiverId)) continue;
      seenDirect.add(receiverId);
      const ru = (await fetchLegacyUsersByIds([receiverId])).get(receiverId);
      if (!ru) continue;
      const roleRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
        `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
        receiverId
      );
      const rid = roleRows[0]?.role_id != null ? Number(roleRows[0].role_id) : null;
      const directUsers = new Map([[receiverId, ru]]);
      await attachEntityLogos(directUsers);
      directRecipients.push({
        username: ru.username ?? '',
        roleName: rid != null ? ROLE_NAMES[rid] ?? '' : '',
        credits: rowNum(row, 'sender_credit'),
        receiverId,
        image: ru.image,
        logoUrl: ru.logoUrl ?? null,
        roleId: rid,
      });
    }

    const directRecipientIds = directRecipients.map((d) => d.receiverId).filter((id) => id > 0);
    if (directRecipientIds.length > 0) {
      const placeholders = directRecipientIds.map(() => '?').join(',');
      const indirectRows = await prisma.$queryRawUnsafe<ApplyRow[]>(
        `SELECT sender_id, receiver_id, secondary_sender_credit, receiver_version, promocode_id
         FROM \`${appliesTable}\`
         WHERE sender_id IN (${placeholders}) AND receiver_id > 0 AND delete_status = 2
         ORDER BY created DESC`,
        ...directRecipientIds
      );

      const seenIndirect = new Set<string>();
      for (const row of indirectRows) {
        const receiverId = rowNum(row, 'receiver_id');
        const senderId = rowNum(row, 'sender_id');
        const promocodeId = rowNum(row, 'promocode_id');
        const key = `${receiverId}:${promocodeId}`;
        if (!receiverId || seenIndirect.has(key)) continue;
        seenIndirect.add(key);
        const ru = (await fetchLegacyUsersByIds([receiverId])).get(receiverId);
        const su = (await fetchLegacyUsersByIds([senderId])).get(senderId);
        if (!ru || !su) continue;

        const receiverRoleRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
          `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          receiverId
        );
        const senderRoleRows = await prisma.$queryRawUnsafe<{ role_id: number | null }[]>(
          `SELECT role_id FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          senderId
        );
        const receiverRoleId = receiverRoleRows[0]?.role_id != null ? Number(receiverRoleRows[0].role_id) : null;
        const senderRoleId = senderRoleRows[0]?.role_id != null ? Number(senderRoleRows[0].role_id) : null;

        const secondaryCredit = await resolveSecondaryCreditAmount({
          storedCredit: rowNum(row, 'secondary_sender_credit'),
          receiverId,
          receiverVersionName: rowStr(row, 'receiver_version'),
        });

        const indirectUsers = new Map([[receiverId, ru]]);
        await attachEntityLogos(indirectUsers);
        indirectRecipients.push({
          username: ru.username ?? '',
          roleName: receiverRoleId != null ? ROLE_NAMES[receiverRoleId] ?? '' : '',
          credits: secondaryCredit,
          senderUsername: su.username ?? '',
          senderRoleName: senderRoleId != null ? ROLE_NAMES[senderRoleId] ?? '' : '',
          image: ru.image,
          logoUrl: ru.logoUrl ?? null,
          roleId: receiverRoleId,
        });
      }
    }
  }

  // Connection chart total = personal + direct + indirect (client expected layout).
  const connectionTotal =
    personalRegistrationCredits +
    directRecipients.reduce((s, d) => s + d.credits, 0) +
    indirectRecipients.reduce((s, d) => s + d.credits, 0);
  // Prefer credit-ledger sum when present; otherwise connection breakdown.
  const finalTotalCredits = totalCredits > 0 ? totalCredits : connectionTotal;
  const usedCreditsFinal = 0;
  const availableCreditsFinal = finalTotalCredits;
  const childPromo = await getChildPromoRights(legacyUserId);

  return {
    isAdmin,
    showSuggestTab,
    defaultTab: isAdmin ? 'invitations' : 'suggest',
    promocode,
    promocodesList,
    totalInviteCount,
    regCount,
    lastEmailSentDate,
    returnIndex,
    invitationsData,
    sentRecipients,
    registeredUsers,
    creditRecords,
    totalCredits: finalTotalCredits,
    usedCredits: usedCreditsFinal,
    availableCredits: availableCreditsFinal,
    connectionChart: {
      currentUserUsername,
      currentUserRoleName,
      totalCredits: connectionTotal,
      usedCredits: usedCreditsFinal,
      availableCredits: connectionTotal,
      personalRegistrationCredits,
      allowsCurrentUserToEarn,
      directRecipients,
      indirectRecipients,
    },
    roles,
    subscriptionsData,
    childPromo,
    generatedPromocodes,
    savedIntro: await loadSenderIntroMessage(legacyUserId),
  };
}

export async function sendNotificationByPromocodeInvite(params: {
  legacyUserId: number;
  senderEmail: string;
  senderUsername: string;
  receiverEmail: string;
  promocodeId: number;
  introMessage?: string;
  inviteMode?: string;
  origin: string;
  sendEmail: (payload: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }) => Promise<void>;
}): Promise<{ status: 'success' | 'error'; message: string }> {
  const receiverEmail = params.receiverEmail.trim();
  if (!receiverEmail) {
    return { status: 'error', message: 'Please enter the mail address for recipient.' };
  }

  const usersTable = await getLegacyUsersTable();
  if (usersTable) {
    const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${usersTable}\`
       WHERE LOWER(email) = ? AND delete_status = 'N' LIMIT 1`,
      receiverEmail.toLowerCase()
    );
    if (existing.length > 0) {
      return {
        status: 'error',
        message: 'This email address is already registered. You can only invite new users.',
      };
    }
  } else if (await legacyUserExistsByEmail(receiverEmail)) {
    return {
      status: 'error',
      message: 'This email address is already registered. You can only invite new users.',
    };
  }

  if (!params.promocodeId) {
    return { status: 'error', message: 'Please select a promocode to use for the invite.' };
  }

  const appliesTable = await getPromocodeAppliesTable();
  const settingsTable = await getPromocodeSettingsTable();
  if (!appliesTable || !settingsTable) {
    return { status: 'error', message: 'Promocode tables not found.' };
  }

  const allowed = await userOwnsOrReceivedPromocode(params.legacyUserId, params.promocodeId);
  if (!allowed) {
    return {
      status: 'error',
      message: 'You can only use a promocode you received or created. Please select a valid promocode.',
    };
  }

  const promoSelectSql = await buildPromocodeSettingsSelectSql(settingsTable);
  const promoRows = await prisma.$queryRawUnsafe<PromoRow[]>(
    `SELECT ${promoSelectSql} FROM \`${settingsTable}\` WHERE id = ? LIMIT 1`,
    params.promocodeId
  );
  const promocode = promoRows[0];
  if (!promocode) {
    return { status: 'error', message: 'Invalid promocode selected.' };
  }

  const existingInvite = await prisma.$queryRawUnsafe<ApplyRow[]>(
    `SELECT receiver_id FROM \`${appliesTable}\`
     WHERE LOWER(receiver_email) = ? AND promocode_id = ? AND delete_status = 2
     ORDER BY id DESC LIMIT 1`,
    receiverEmail.toLowerCase(),
    params.promocodeId
  );
  if (existingInvite.length > 0) {
    const receiverId = rowNum(existingInvite[0], 'receiver_id');
    if (receiverId > 0) {
      return {
        status: 'error',
        message: 'This user already accepted the membership requesting.',
      };
    }
    return { status: 'error', message: 'Requesting member is already pending state.' };
  }

  const receivedInvite = await prisma.$queryRawUnsafe<ApplyRow[]>(
    `SELECT other_info, adv_page FROM \`${appliesTable}\`
     WHERE promocode_id = ? AND delete_status = 2
       AND (LOWER(receiver_email) = ? OR receiver_id = ?)
     ORDER BY id DESC LIMIT 1`,
    params.promocodeId,
    params.senderEmail.trim().toLowerCase(),
    params.legacyUserId
  );
  const otherInfo = rowStr(receivedInvite[0], 'other_info');
  const advPage = rowStr(receivedInvite[0], 'adv_page');

  let languageId = rowNum(promocode, 'language_id') || 1;
  if (!(await isMovesbookLegacyUser(params.legacyUserId))) {
    const senderLanguageId = await languageIdForLegacyUser(params.legacyUserId);
    if (senderLanguageId) languageId = Number(senderLanguageId);
  }
  const langColumn = await resolveLanguageColumn(languageId);
  const inviteMessageParagraph = await loadPromocodeInviteLanguageParagraph(String(languageId));
  const helpHtmlPageId = rowStr(promocode, 'help_html_page_id');
  const helpContent = await resolveHelpHtmlContent(helpHtmlPageId);
  const intro = params.introMessage?.trim()
    ? `<p>${params.introMessage.trim().replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`
    : '';
  const message = `${intro}${inviteMessageParagraph}${helpContent}`;

  const nameParts = await fetchUserNameParts(params.legacyUserId);
  const senderName = [nameParts.firstname, nameParts.lastname].filter(Boolean).join(' ').trim() || params.senderUsername;

  const promocodeCode = rowStr(promocode, 'code');
  const registrationUrl = buildRegisterUrl(
    params.origin,
    receiverEmail,
    promocodeCode,
    langColumn,
    { isStaff: false, inviterUsername: params.senderUsername }
  );

  const html = buildInviteEmailHtml({
    senderName,
    message,
    promocode: promocodeCode,
    otherInfo,
    advPage,
    registrationUrl,
  });

  try {
    await params.sendEmail({
      to: receiverEmail,
      subject: 'Email Invitation',
      html,
      replyTo: params.senderEmail,
    });
  } catch {
    return {
      status: 'error',
      message: 'Unable to send the invitation email. Please try again later.',
    };
  }

  const applyColumns = await getAppliesColumns();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const fields: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, val: unknown) => {
    if (applyColumns.has(col)) {
      fields.push(`\`${col}\``);
      values.push(val);
    }
  };

  add('sender_id', params.legacyUserId);
  add('sender_email', params.senderEmail);
  add('receiver_email', receiverEmail);
  add('promocode_id', params.promocodeId);
  add('created', now);
  add('modified', now);
  add('delete_status', 2);
  add('level', '2');
  add('other_info', otherInfo);
  add('adv_page', advPage);
  add('invite_mode', params.inviteMode?.trim() || 'Mail');
  add('invite_intro', params.introMessage?.trim() || null);
  add('invite_expires_at', await resolveInviteExpiryDate(params.promocodeId));

  if (fields.length > 0) {
    const placeholders = fields.map(() => '?').join(', ');
    try {
      await prisma.$queryRawUnsafe(
        `INSERT INTO \`${appliesTable}\` (${fields.join(', ')}) VALUES (${placeholders})`,
        ...values
      );
    } catch {
      return {
        status: 'error',
        message: 'Invitation was sent but could not be recorded. Please try again.',
      };
    }
  }

  void incrementInviteStat(0, '').catch(() => undefined);
  return { status: 'success', message: 'Your invitation was sent successfully.' };
}
