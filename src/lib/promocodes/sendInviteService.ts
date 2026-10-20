import { prisma } from '@/lib/prisma';
import type { Connection } from 'mysql2/promise';
import { getTableColumns } from '@/lib/outcomeSettingsDb';
import { ensurePromocodeMetaTables, withLegacyConnection } from './ensureMetaTables';
import { ensurePromocodeInviteLocalizedContent } from './promocodeInviteLocale';
import {
  loadPromocodeInviteLanguageParagraph,
} from './promocodeInviteLanguage';
import {
  resolveInviteOtherInfoAndAdvPage,
  saveInviteOtherInfoAndAdvPageToUserSettings,
} from './promocodeInviteLinks';
import {
  fetchLegacyUserByEmail,
  getHelpHtmlPagesTable,
  getLanguageValuesTable,
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getLegacyUsersTable,
} from './legacyDb';
import {
  legacyFlagImageUrl,
  legacyLanguageCodeFromId,
  normalizeLegacyLanguageCode,
} from './legacyLanguageCode';
import { languageIdForLegacyUser } from './promocodeSenderLanguage';
import { coercePublicOrigin } from '@/lib/siteUrl';
import { resolveInviteExpiryDate, userOwnsOrReceivedPromocode } from './childPromocode';
import { incrementInviteStat } from './promocodeMonthlyStatsService';

export type SendInvitePreview = {
  emailAddress: string;
  promocode: string;
  languageId: string;
  htmlPageId: string;
  languageName: string;
  flagImageUrl: string;
  emailBodyHtml: string;
  otherInfo: string;
  advPage: string;
  registerUrl: string;
  inviteSenderUsername: string | null;
};

type QueryFn = <T>(sql: string, params?: unknown[]) => Promise<T>;

async function runQuery<T>(sql: string, params: unknown[] = []): Promise<T> {
  return prisma.$queryRawUnsafe<T>(sql, ...params);
}

function connectionQuery(connection: Connection): QueryFn {
  return async <T>(sql: string, params: unknown[] = []): Promise<T> => {
    const [rows] = await connection.query(sql, params);
    return rows as T;
  };
}

function isBlankHtml(value: string): boolean {
  const text = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}

async function getLegacyLanguageCode(languageId: string): Promise<string> {
  const table = await getLanguageValuesTable();
  if (!table) return legacyLanguageCodeFromId(languageId);

  const columns = await getTableColumns(table);
  const nameCol = columns.has('lang_name') ? 'lang_name' : columns.has('name') ? 'name' : null;
  if (!nameCol) return legacyLanguageCodeFromId(languageId);

  const rows = await runQuery<{ lang_name: string | null }[]>(
    `SELECT \`${nameCol}\` AS lang_name FROM \`${table}\` WHERE id = ? LIMIT 1`,
    [Number(languageId) || languageId]
  );
  const name = rows[0]?.lang_name;
  if (name) return normalizeLegacyLanguageCode(String(name));
  return legacyLanguageCodeFromId(languageId);
}

async function resolveHelpHtmlPage(
  query: QueryFn,
  htmlPageId: string,
  languageId: string
): Promise<{ id: string; content: string } | null> {
  const table = await getHelpHtmlPagesTable();
  if (!table || !htmlPageId) return null;

  const columns = await getTableColumns(table);
  const idCol = columns.has('id') ? 'id' : null;
  const langCol = columns.has('lang_id') ? 'lang_id' : columns.has('language_id') ? 'language_id' : null;
  const contentCol = columns.has('content') ? 'content' : null;
  const uniqueCol = columns.has('uniqueid') ? 'uniqueid' : null;
  const titleCol = columns.has('page_title') ? 'page_title' : columns.has('title') ? 'title' : null;

  if (!idCol || !contentCol) return null;

  const langIdNum = Number(languageId) || 1;

  let helpRow: Record<string, unknown> | null = null;

  if (langCol) {
    const rows = await query<Record<string, unknown>[]>(
      `SELECT * FROM \`${table}\` WHERE \`${idCol}\` = ? AND \`${langCol}\` = ? LIMIT 1`,
      [htmlPageId, langIdNum]
    );
    helpRow = rows[0] ?? null;
  }

  if (!helpRow) {
    const baseRows = await query<Record<string, unknown>[]>(
      `SELECT * FROM \`${table}\` WHERE \`${idCol}\` = ? LIMIT 1`,
      [htmlPageId]
    );
    const base = baseRows[0];
    if (!base) return null;

    let resolved: Record<string, unknown> | null = null;
    const baseUnique = uniqueCol && base[uniqueCol] != null ? String(base[uniqueCol]) : '';
    const baseTitle = titleCol && base[titleCol] != null ? String(base[titleCol]) : '';

    if (langCol && baseUnique) {
      const byUnique = await query<Record<string, unknown>[]>(
        `SELECT * FROM \`${table}\` WHERE \`${uniqueCol}\` = ? AND \`${langCol}\` = ? ORDER BY \`${idCol}\` DESC LIMIT 1`,
        [baseUnique, langIdNum]
      );
      resolved = byUnique[0] ?? null;
    }

    if (!resolved && langCol && baseTitle) {
      const byTitle = await query<Record<string, unknown>[]>(
        `SELECT * FROM \`${table}\` WHERE \`${titleCol}\` = ? AND \`${langCol}\` = ? ORDER BY \`${idCol}\` DESC LIMIT 1`,
        [baseTitle, langIdNum]
      );
      resolved = byTitle[0] ?? null;
    }

    helpRow = resolved ?? base;
  }

  const resolvedId = helpRow[idCol] != null ? String(helpRow[idCol]) : htmlPageId;
  const content = helpRow[contentCol] != null ? String(helpRow[contentCol]) : '';
  return { id: resolvedId, content };
}

/** Strip CKEditor/legacy artifacts that appear as a lone "?" before invite text. */
export function sanitizeInviteEmailBodyHtml(html: string): string {
  let out = String(html ?? '').trim();
  out = out.replace(/^(\s*<p[^>]*>\s*\?\s*<\/p>\s*)+/i, '');
  out = out.replace(/^(\s*<p[^>]*>\s*&nbsp;\?\s*<\/p>\s*)+/i, '');
  out = out.replace(/^(\s*\?\s*)+/, '');
  out = out.replace(
    /^(\s*<img\b[^>]*(?:src\s*=\s*["']\s*["']|alt\s*=\s*["']\?["'])[^>]*>\s*)+/i,
    ''
  );
  return out;
}

async function loadInviteBodyFromQuery(
  query: QueryFn,
  params: { htmlPageId: string; languageId: string }
): Promise<{ body: string; resolvedHtmlPageId: string }> {
  const paragraphText = await loadPromocodeInviteLanguageParagraph(params.languageId, query);
  const helpPage = await resolveHelpHtmlPage(query, params.htmlPageId, params.languageId);
  const helpContent = helpPage?.content ?? '';
  return {
    body: sanitizeInviteEmailBodyHtml(`${paragraphText}${helpContent}`),
    resolvedHtmlPageId: helpPage?.id ?? params.htmlPageId,
  };
}

async function fetchHelpPageLangId(helpPageId: string, query: QueryFn = runQuery): Promise<number | null> {
  const table = await getHelpHtmlPagesTable();
  if (!table) return null;
  const columns = await getTableColumns(table);
  const langCol = columns.has('lang_id') ? 'lang_id' : columns.has('language_id') ? 'language_id' : null;
  if (!langCol) return null;
  const rows = await query<{ lang_id: number | bigint | null }[]>(
    `SELECT \`${langCol}\` AS lang_id FROM \`${table}\` WHERE id = ? LIMIT 1`,
    [helpPageId]
  );
  const langId = rows[0]?.lang_id;
  return langId != null ? Number(langId) : null;
}

/** PHP: LanguageParagraph[lang_name] + help_html_pages content (no separator). */
async function buildPromocodeInviteEmailBody(params: {
  htmlPageId: string;
  languageId: string;
}): Promise<{ body: string; resolvedHtmlPageId: string }> {
  const built = await loadInviteBodyFromQuery(runQuery, params);
  const langNum = Number(params.languageId) || 1;
  if (langNum === 1) return built;

  const paragraphText = await loadPromocodeInviteLanguageParagraph(params.languageId);
  const helpPage = await resolveHelpHtmlPage(runQuery, params.htmlPageId, params.languageId);
  const helpLangId = helpPage ? await fetchHelpPageLangId(helpPage.id) : null;
  const needsLegacy = isBlankHtml(paragraphText) || helpLangId === 1;

  if (!needsLegacy) return built;

  const legacyBuilt = await withLegacyConnection(async (connection) =>
    loadInviteBodyFromQuery(connectionQuery(connection), params)
  );
  return legacyBuilt?.body.trim() ? legacyBuilt : built;
}

export function buildRegisterUrl(
  origin: string,
  email: string,
  promocode: string,
  languageName: string,
  options: { isStaff: boolean; inviterUsername?: string | null }
): string {
  const publicOrigin = coercePublicOrigin(origin);
  const params = new URLSearchParams({
    user_email: email,
    promocode,
  });
  if (options.isStaff) {
    params.set('invite_by', 'movesbook');
  } else if (options.inviterUsername) {
    params.set('inviter', options.inviterUsername);
  }
  if (languageName) {
    params.set('lang', languageName);
  }
  return `${publicOrigin}/users/quickRegister?${params.toString()}`;
}

export function buildInviteEmailHtml(data: {
  senderName: string;
  message: string;
  promocode: string;
  otherInfo: string;
  advPage: string;
  registrationUrl: string;
  expiresAt?: string | null;
}): string {
  const otherInfoLink = (() => {
    const url = data.otherInfo.trim();
    if (!url) return '';
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return `<a href="${href}" target="_blank">${escapeHtml(url)}</a>`;
  })();

  const advPageLink = (() => {
    const url = data.advPage.trim();
    if (!url) return '';
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return `<a href="${href}" target="_blank">${escapeHtml(url)}</a>`;
  })();

  return `
<div style="background-color:#fff;border:1px solid #E5E5E5;padding:10px;font-family:Arial,sans-serif;color:#333;">
  <p><span style="font-weight:bold;">This mail is sent from :</span> ${escapeHtml(data.senderName)}</p>
  <div style="margin-bottom:10px;">
    <span style="font-weight:bold;">Message :</span>
    <div style="margin-top:6px;">${data.message}</div>
  </div>
  <p><span style="font-weight:bold;">Regards, </span><b style="color:#861320">${escapeHtml(data.senderName)}</b></p>
  <div style="margin:20px 0;padding:15px;border:1px solid #818181;border-radius:4px;background:#fff">
    <div style="margin-bottom:15px;">
      <label style="font-weight:bold;display:inline-block;width:100px;">Promocode:</label>
      <span style="padding:5px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:3px;">${escapeHtml(data.promocode)}</span>
    </div>
    <div style="margin-bottom:15px;">
      <label style="font-weight:bold;display:inline-block;width:100px;">Other Info:</label>
      <span style="padding:5px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:3px;">${otherInfoLink || escapeHtml(data.otherInfo)}</span>
    </div>
    <div style="margin-bottom:15px;">
      <label style="font-weight:bold;display:inline-block;width:100px;">Visit Also:</label>
      <span style="padding:5px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:3px;">${advPageLink}</span>
    </div>
  </div>
  ${data.expiresAt ? `<p><span style="font-weight:bold;">Promocode expires on:</span> ${escapeHtml(data.expiresAt)}</p>` : ''}
  <p><a href="${data.registrationUrl}" target="_blank">Click here to register</a></p>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function loadSendInvitePreview(
  params: {
    emailAddress: string;
    promocode: string;
    htmlPageId: string;
    languageId: string;
    otherInfo?: string;
    advPage?: string;
    username?: string | null;
    origin: string;
    isStaff: boolean;
    inviterUsername?: string | null;
    senderLegacyUserId?: number | null;
    senderEmail?: string | null;
  }
): Promise<SendInvitePreview> {
  await ensurePromocodeMetaTables();
  await ensurePromocodeInviteLocalizedContent();

  const languageName = await getLegacyLanguageCode(params.languageId);
  const { body: emailBodyHtml, resolvedHtmlPageId } = await buildPromocodeInviteEmailBody({
    htmlPageId: params.htmlPageId,
    languageId: params.languageId,
  });

  const promocodeCheck = params.promocode.trim()
    ? await validateEnabledPromocode(params.promocode.trim())
    : null;
  const promocodeId = promocodeCheck && promocodeCheck.ok ? promocodeCheck.id : null;

  const { otherInfo, advPage } = await resolveInviteOtherInfoAndAdvPage({
    otherInfo: params.otherInfo,
    advPage: params.advPage,
    senderLegacyUserId: params.senderLegacyUserId,
    senderEmail: params.senderEmail,
    promocodeId,
  });

  const registerUrl = buildRegisterUrl(
    params.origin,
    params.emailAddress,
    params.promocode,
    languageName,
    { isStaff: params.isStaff, inviterUsername: params.inviterUsername }
  );

  return {
    emailAddress: params.emailAddress,
    promocode: params.promocode,
    languageId: params.languageId,
    htmlPageId: resolvedHtmlPageId,
    languageName,
    flagImageUrl: legacyFlagImageUrl(languageName),
    emailBodyHtml,
    otherInfo,
    advPage,
    registerUrl,
    inviteSenderUsername: params.inviterUsername ?? null,
  };
}

export async function validateEnabledPromocode(promocode: string): Promise<{
  ok: true;
  id: number;
} | {
  ok: false;
  message: string;
}> {
  await ensurePromocodeMetaTables();
  const table = await getPromocodeSettingsTable();
  if (!table) {
    return { ok: false, message: 'Promocode settings table not found.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = await runQuery<{ id: number | bigint; enable: string | null }[]>(
    `SELECT id, enable FROM \`${table}\`
     WHERE code = ? AND valid_from <= ? AND valid_to >= ? AND enable = 'Enable'
     LIMIT 1`,
    [promocode, today, today]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Promocode does not exist or is not currently enabled.' };
  }

  return { ok: true, id: Number(rows[0].id) };
}

async function resolveApplySender(params: {
  isStaff: boolean;
  senderLegacyUserId?: number | null;
  senderEmail?: string | null;
  senderName?: string | null;
}): Promise<{
  senderId: number;
  senderEmail: string;
  senderName: string;
}> {
  if (!params.isStaff && params.senderLegacyUserId) {
    return {
      senderId: params.senderLegacyUserId,
      senderEmail: params.senderEmail?.trim() || 'support@movesbook.net',
      senderName: params.senderName?.trim() || params.senderEmail?.trim() || 'Movesbook',
    };
  }

  const superAdmin = await prisma.superAdmin.findFirst({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  const staff = await prisma.staffAccount.findFirst({
    select: { id: true, email: true, name: true, surname: true },
    orderBy: { createdAt: 'asc' },
  });

  const senderEmail = staff?.email ?? superAdmin?.email ?? 'admin@movesbook.com';
  const senderName =
    [staff?.name, staff?.surname].filter(Boolean).join(' ').trim() ||
    superAdmin?.name?.trim() ||
    'Movesbook';

  let senderId = 0;
  const usersTable = await getLegacyUsersTable();
  if (usersTable) {
    if (params.isStaff) {
      const legacySuper = await runQuery<{ id: number | bigint }[]>(
        `SELECT id FROM \`${usersTable}\` WHERE role_id = 1 AND delete_status = 'N' ORDER BY id ASC LIMIT 1`
      );
      if (legacySuper[0]) senderId = Number(legacySuper[0].id);
    }
    if (senderId === 0 && senderEmail) {
      const byEmail = await fetchLegacyUserByEmail(senderEmail);
      if (byEmail) senderId = byEmail.id;
    }
    if (senderId === 0) senderId = 1;
  }

  if (params.isStaff && superAdmin) {
    const legacySuper = await runQuery<{ id: number | bigint; email: string | null }[]>(
      `SELECT id, email FROM \`${usersTable ?? 'legacy_users'}\` WHERE role_id = 1 AND delete_status = 'N' ORDER BY id ASC LIMIT 1`
    ).catch(() => []);
    if (legacySuper[0]) {
      return {
        senderId: Number(legacySuper[0].id),
        senderEmail: legacySuper[0].email ? String(legacySuper[0].email) : senderEmail,
        senderName,
      };
    }
  }

  return { senderId, senderEmail, senderName };
}

async function validateNonStaffInvite(params: {
  senderLegacyUserId: number;
  promocodeId: number;
  receiverEmail: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const usersTable = await getLegacyUsersTable();
  if (usersTable) {
    const existing = await runQuery<{ id: number | bigint }[]>(
      `SELECT id FROM \`${usersTable}\`
       WHERE LOWER(email) = ? AND delete_status = 'N' LIMIT 1`,
      [params.receiverEmail.toLowerCase()]
    );
    if (existing.length > 0) {
      return {
        ok: false,
        message: 'This email address is already registered. You can only invite new users.',
      };
    }
  }

  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable) {
    return { ok: false, message: 'Promocode applies table not found.' };
  }

  const allowed = await userOwnsOrReceivedPromocode(params.senderLegacyUserId, params.promocodeId);
  if (!allowed) {
    return {
      ok: false,
      message: 'You can only use a promocode you received or created. Please select a valid promocode.',
    };
  }

  const existingInvite = await runQuery<{ receiver_id: number | null }[]>(
    `SELECT receiver_id FROM \`${appliesTable}\`
     WHERE LOWER(receiver_email) = ? AND promocode_id = ? AND delete_status = 2
     ORDER BY id DESC LIMIT 1`,
    [params.receiverEmail.toLowerCase(), params.promocodeId]
  );
  if (existingInvite.length > 0) {
    const receiverId =
      existingInvite[0]?.receiver_id != null ? Number(existingInvite[0].receiver_id) : 0;
    if (receiverId > 0) {
      return { ok: false, message: 'This user already accepted the membership requesting.' };
    }
    return { ok: false, message: 'Requesting member is already pending state.' };
  }

  return { ok: true };
}

export async function sendPromocodeInvite(params: {
  emailAddress: string;
  promocode: string;
  languageId: string;
  htmlPageId: string;
  otherInfo: string;
  advPage: string;
  emailContent: string;
  origin: string;
  isStaff: boolean;
  inviterUsername?: string | null;
  senderLegacyUserId?: number | null;
  senderEmail?: string | null;
  senderName?: string | null;
  introMessage?: string | null;
  inviteMode?: string | null;
  sendEmail: (payload: { to: string; subject: string; html: string; replyTo?: string }) => Promise<void>;
}): Promise<{ status: 'success' | 'error'; message: string }> {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  const emails = params.emailAddress.split(',').map((e) => e.trim()).filter(Boolean);

  if (emails.length === 0) {
    return { status: 'error', message: 'Email address is required.' };
  }

  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return { status: 'error', message: `Invalid email format: ${email}` };
    }
  }

  if (!params.promocode.trim()) {
    return { status: 'error', message: 'Promocode is required.' };
  }
  if (!params.languageId) {
    return { status: 'error', message: 'Language is required.' };
  }
  if (!params.htmlPageId) {
    return { status: 'error', message: 'HTML document is required.' };
  }

  const promocodeCheck = await validateEnabledPromocode(params.promocode.trim());
  if (!promocodeCheck.ok) {
    return { status: 'error', message: promocodeCheck.message };
  }

  await ensurePromocodeInviteLocalizedContent();

  let languageId = params.languageId;
  if (!params.isStaff && params.senderLegacyUserId) {
    const senderLanguageId = await languageIdForLegacyUser(params.senderLegacyUserId);
    if (senderLanguageId) languageId = senderLanguageId;
  }

  const languageName = await getLegacyLanguageCode(languageId);

  const resolvedLinks = await resolveInviteOtherInfoAndAdvPage({
    otherInfo: params.otherInfo,
    advPage: params.advPage,
    senderLegacyUserId: params.senderLegacyUserId,
    senderEmail: params.senderEmail,
    promocodeId: promocodeCheck.id,
  });
  const otherInfo = resolvedLinks.otherInfo;
  const advPage = resolvedLinks.advPage;

  let finalMessage = params.emailContent.trim();
  if (!finalMessage) {
    const built = await buildPromocodeInviteEmailBody({
      htmlPageId: params.htmlPageId,
      languageId,
    });
    finalMessage = built.body;
  }
  const intro = params.introMessage?.trim() ?? '';
  if (intro) {
    finalMessage = `<p>${escapeHtml(intro).replace(/\n/g, '<br/>')}</p>${finalMessage}`;
  }
  const inviteExpiresAt = await resolveInviteExpiryDate(promocodeCheck.id);

  const { senderId, senderEmail, senderName } = await resolveApplySender({
    isStaff: params.isStaff,
    senderLegacyUserId: params.senderLegacyUserId,
    senderEmail: params.senderEmail,
    senderName: params.senderName,
  });
  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable) {
    return { status: 'error', message: 'Promocode applies table not found.' };
  }

  const applyColumns = await getTableColumns(appliesTable);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let successCount = 0;
  const errors: string[] = [];

  for (const email of emails) {
    if (!params.isStaff && params.senderLegacyUserId) {
      const inviteCheck = await validateNonStaffInvite({
        senderLegacyUserId: params.senderLegacyUserId,
        promocodeId: promocodeCheck.id,
        receiverEmail: email,
      });
      if (!inviteCheck.ok) {
        return { status: 'error', message: inviteCheck.message };
      }
    }

    try {
      const registrationUrl = buildRegisterUrl(
        params.origin,
        email,
        params.promocode.trim(),
        languageName,
        { isStaff: params.isStaff, inviterUsername: params.inviterUsername }
      );

      const html = buildInviteEmailHtml({
        senderName,
        message: finalMessage,
        promocode: params.promocode.trim(),
        otherInfo,
        advPage,
        registrationUrl,
        expiresAt: inviteExpiresAt,
      });

      await params.sendEmail({
        to: email,
        subject: 'Email Invitation',
        html,
        replyTo: senderEmail,
      });

      const fields: string[] = [];
      const values: unknown[] = [];

      const add = (col: string, val: unknown) => {
        if (applyColumns.has(col)) {
          fields.push(`\`${col}\``);
          values.push(val);
        }
      };

      add('user_id', 0);
      add('promocode_id', promocodeCheck.id);
      add('delete_status', 2);
      add('created', now);
      add('modified', now);
      add('sender_email', senderEmail);
      add('receiver_email', email);
      add('sender_id', senderId);
      add('level', '1');
      add('other_info', otherInfo);
      add('adv_page', advPage);
      add('invite_mode', params.inviteMode?.trim() || 'Mail');
      add('invite_intro', intro || null);
      add('invite_expires_at', inviteExpiresAt);

      if (fields.length > 0) {
        const placeholders = fields.map(() => '?').join(', ');
        await runQuery(
          `INSERT INTO \`${appliesTable}\` (${fields.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }

      successCount++;
      void incrementInviteStat(0, '').catch(() => undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Error sending email to ${email}: ${msg}`);
    }
  }

  if (successCount > 0) {
    await saveInviteOtherInfoAndAdvPageToUserSettings(senderId, otherInfo, advPage).catch(
      (err) => {
        console.warn('Failed to save promocode invite link settings:', err);
      }
    );

    let message = `${successCount} invitation(s) sent successfully.`;
    if (errors.length > 0) message += ` Errors: ${errors.join(', ')}`;
    return { status: 'success', message };
  }

  return { status: 'error', message: `Failed to send invitations. ${errors.join(', ')}` };
}
