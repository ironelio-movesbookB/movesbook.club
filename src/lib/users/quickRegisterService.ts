import { prisma } from '@/lib/prisma';
import {
  mergeNetworkSubscriptionHistory,
  periodDisplayStatus,
  readNetworkSubscriptionHistory,
  type NetworkSubscriptionPeriod,
} from '@/lib/admin/networkSubscriptionHistory';
import { hashPasswordCakePHP } from '@/lib/auth';
import { UserType } from '@prisma/client';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { getSiteOrigin, coercePublicOrigin } from '@/lib/siteUrl';
import { findExistingTable, getTableColumns } from '@/lib/outcomeSettingsDb';
import { COUNTRY_SELECT_OPTIONS } from '@/constants/countries.constants';
import { countryCodeFromName } from '@/lib/admin/countryFlag';
import { ensurePromocodeMetaTables } from '@/lib/promocodes/ensureMetaTables';
import { ensureUserSettingsColumns } from '@/lib/userSettingsDb';
import {
  buildPromocodeSettingsSelectSql,
  sanitizeLegacyDateString,
} from '@/lib/promocodes/promocodeSettingsQuery';
import {
  ensureQuickRegisterSubscriptionSettings,
} from '@/lib/users/quickRegisterSubscriptionSeed';
import { getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import { hydrateVersionSettings } from '@/lib/subscriptions/versionSettingsStore';
import {
  getScenarioPricing,
  getTripleSubscriptionPricing,
  type SubscriptionPricingScenario,
} from '@/lib/admin/subscriptionPricingPresentation';
import {
  fetchLegacyUserByEmail,
  getCountriesTable,
  getLegacyUsersTable,
  getPromocodeAppliesTable,
  getPromocodeSettingsTable,
  getSubscriptionSettingsTable,
} from '@/lib/promocodes/legacyDb';
import { QUICK_REGISTER_SUCCESS_MESSAGE, type RegistrationStatus } from '@/lib/users/quickRegisterShared';
import { getCountryPriceCoefficient } from '@/lib/countries/countryPricingServer';
import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';
import { localAmount } from '@/lib/countries/countryPriceFormula';
import { encryptPrivateData, getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import {
  createRegistrationPayment,
  ensureRegistrationPaymentTables,
} from '@/lib/registration/registrationPayments';
import { incrementRegistrationStat } from '@/lib/promocodes/promocodeMonthlyStatsService';

export { QUICK_REGISTER_SUCCESS_MESSAGE, type RegistrationStatus };

export type QuickRegisterInit = {
  movesbookOfficialEmail: string;
  inviterUsername: string;
  inviterReadonly: boolean;
  promocodeAllowedVersionIds: string;
  countries: { id: string; name: string }[];
  sports: { id: string; name: string }[];
};

type PromocodeRow = {
  id: number;
  code: string;
  discount: string;
  valid_from: string | null;
  valid_to: string | null;
  usable_by: string | null;
  used: number;
  version_id: string | null;
  creater_id: string | number | null;
};

const SPORT_FALLBACK = [
  'Swimming',
  'Cycling',
  'Running',
  'Triathlon',
  'Football',
  'Basketball',
  'Tennis',
  'Body Building',
  'Other',
];

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function rowString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) return String(val);
  }
  return '';
}

function rowNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== '') {
      const n = Number(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Normalize Dashboard-Version credit/credit1/credit2 values for apply rows. */
function parseSubscriptionCredit(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  if (raw === undefined || raw === null || raw === '') return '';
  const n = Number(raw);
  if (Number.isFinite(n)) return String(n);
  const asText = String(raw).trim();
  return asText;
}

function rowCreatorId(row: Record<string, unknown>): string | number | null {
  const val = row.creater_id ?? row.creator_id;
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' || typeof val === 'number') return val;
  return null;
}

async function fetchPromocodeByCode(code: string, requireDates = true): Promise<PromocodeRow | null> {
  await ensurePromocodeMetaTables();
  const table = await getPromocodeSettingsTable();
  if (!table || !code.trim()) return null;

  const today = todayYmd();
  const dateClause = requireDates ? ' AND valid_from <= ? AND valid_to >= ?' : '';
  const params: unknown[] = [code.trim()];
  if (requireDates) params.push(today, today);

  const selectSql = await buildPromocodeSettingsSelectSql(table);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${selectSql}
     FROM \`${table}\`
     WHERE code = ? AND enable = 'Enable'${dateClause}
     LIMIT 1`,
    ...params
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    code: String(row.code ?? code),
    discount: row.discount != null ? String(row.discount) : '0',
    valid_from: sanitizeLegacyDateString(row.valid_from),
    valid_to: sanitizeLegacyDateString(row.valid_to),
    usable_by: row.usable_by != null ? String(row.usable_by) : null,
    used: Number(row.used ?? 0),
    version_id: row.version_id != null ? String(row.version_id) : null,
    creater_id: rowCreatorId(row),
  };
}

async function fetchLegacyUserByUsername(username: string): Promise<{
  id: number;
  username: string | null;
  email: string | null;
} | null> {
  const usersTable = await getLegacyUsersTable();
  if (!usersTable || !username.trim()) return null;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, username, email FROM \`${usersTable}\`
     WHERE LOWER(username) = ?
     LIMIT 1`,
    username.trim().toLowerCase()
  );
  const row = rows[0];
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    username: row.username != null ? String(row.username) : null,
    email: row.email != null ? String(row.email) : null,
  };
}

async function fetchLegacyUserIdByEmail(email: string): Promise<number | null> {
  const user = await fetchLegacyUserByEmail(email);
  return user?.id ?? null;
}

export async function inviterAuthorizedForPromocode(
  userId: number,
  promocode: PromocodeRow
): Promise<boolean> {
  if (userId < 1 || !promocode.id) return false;

  const creatorId = promocode.creater_id != null ? Number(promocode.creater_id) : 0;
  if (creatorId === userId) return true;

  const appliesTable = await getPromocodeAppliesTable();
  if (!appliesTable) return false;

  const rows = await prisma.$queryRawUnsafe<{ n: number | bigint }[]>(
    `SELECT COUNT(*) AS n FROM \`${appliesTable}\`
     WHERE promocode_id = ? AND sender_id = ? AND delete_status = 2`,
    promocode.id,
    userId
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function buildRegistrationStatus(email: string): Promise<RegistrationStatus> {
  const status: RegistrationStatus = {
    type: 'new',
    detail: 'new',
    label: 'New registration',
    has_active_subscription: false,
  };

  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.includes(',')) return status;

  const usersTable = await getLegacyUsersTable();
  if (!usersTable) return status;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, username,
            CAST(subscription_start_date AS CHAR) AS subscription_start_date,
            CAST(subscription_end_date AS CHAR) AS subscription_end_date
     FROM \`${usersTable}\`
     WHERE LOWER(email) = ?
     LIMIT 1`,
    normalized
  );
  const row = rows[0];
  if (!row?.id) return status;

  status.type = 'renewal';
  status.detail = 'renewal_expired';
  status.label = 'Renewal (no active subscription)';
  status.existing_username = rowString(row, 'username') || undefined;
  status.subscription_end_date =
    sanitizeLegacyDateString(row.subscription_end_date) ??
    (rowString(row, 'subscription_end_date') || undefined);

  const subEnd = status.subscription_end_date;
  if (subEnd && subEnd >= todayYmd()) {
    status.detail = 'renewal_active';
    status.label = 'Renewal (active subscription)';
    status.has_active_subscription = true;
  }

  return status;
}

export async function checkQuickRegisterUsername(
  username: string,
  email: string
): Promise<{ success: true; available: boolean; message?: string }> {
  const trimmed = username.trim();
  if (!trimmed) {
    return { success: true, available: false, message: 'Please enter a username.' };
  }

  const existing = await fetchLegacyUserByUsername(trimmed);
  if (!existing) {
    return { success: true, available: true };
  }

  const emailNorm = email.trim().toLowerCase();
  if (emailNorm) {
    const emailUserId = await fetchLegacyUserIdByEmail(emailNorm);
    if (emailUserId != null && emailUserId === existing.id) {
      return { success: true, available: true };
    }
  }

  return {
    success: true,
    available: false,
    message:
      'This username is already in use. Each invite must use a unique username and email. Log in with your existing account or choose another username. If this is your account, register using the same email address as on your profile.',
  };
}

export async function validateQuickRegisterPromocode(params: {
  promocode: string;
  inviteEmail?: string;
  inviterUsername?: string;
}): Promise<{
  success: boolean;
  message: string;
  data: { discount?: string; valid_from?: string | null; valid_to?: string | null; version_id?: string | null };
}> {
  const code = params.promocode.trim();
  if (!code) {
    return { success: false, message: 'Please enter a promocode.', data: {} };
  }

  const record = await fetchPromocodeByCode(code, true);
  if (!record) {
    return { success: false, message: 'This promocode is invalid or has expired.', data: {} };
  }

  const inviterUsername = params.inviterUsername?.trim() ?? '';
  const inviteEmail = params.inviteEmail?.trim().toLowerCase() ?? '';

  if (inviterUsername) {
    const invUser = await fetchLegacyUserByUsername(inviterUsername);
    if (!invUser) {
      return {
        success: false,
        message: 'No user found with that username. Check the username of who invited you.',
        data: {},
      };
    }
    if (!(await inviterAuthorizedForPromocode(invUser.id, record))) {
      return {
        success: false,
        message: 'This promocode does not match that inviter username.',
        data: {},
      };
    }
  } else if (inviteEmail) {
    const appliesTable = await getPromocodeAppliesTable();
    if (!appliesTable) {
      return { success: false, message: 'Promocode apply records not available.', data: {} };
    }

    const emails = Array.from(
      new Set(
        inviteEmail
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const applies = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT sender_email, receiver_email FROM \`${appliesTable}\`
       WHERE promocode_id = ?`,
      record.id
    );

    let matched = false;
    for (const apply of applies) {
      const sender = rowString(apply, 'sender_email').toLowerCase();
      const receiver = rowString(apply, 'receiver_email').toLowerCase();
      for (const one of emails) {
        if (one && (sender === one || receiver === one)) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      return {
        success: false,
        message: 'This promocode is not valid for the specified invite email.',
        data: {},
      };
    }
  }

  const usableOnce = record.usable_by?.toLowerCase() === 'once';
  if (usableOnce && record.used >= 1) {
    return { success: false, message: 'This promocode has already been used.', data: {} };
  }

  return {
    success: true,
    message: `Promocode applied. Discount: ${record.discount}%`,
    data: {
      discount: record.discount,
      valid_from: record.valid_from,
      valid_to: record.valid_to,
      version_id: record.version_id,
    },
  };
}

export async function getQuickRegisterVersions(
  userType: string,
  promocodeVersionIds: string
): Promise<Record<string, string>> {
  await ensureQuickRegisterSubscriptionSettings();

  const table = await getSubscriptionSettingsTable();
  if (!table || !userType) return {};

  const roleId = Number(userType);
  const conditions: string[] = ['role_id = ?'];
  const params: unknown[] = [roleId];

  const allowedRaw = promocodeVersionIds.trim();
  if (allowedRaw) {
    const allowedIds = allowedRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (allowedIds.length > 0) {
      conditions.push(`id IN (${allowedIds.map(() => '?').join(',')})`);
      params.push(...allowedIds.map((id) => Number(id)));
    }
  }

  let rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, subscription_name FROM \`${table}\`
     WHERE ${conditions.join(' AND ')}
       AND subscription_name IS NOT NULL
       AND subscription_name != ''
     ORDER BY id ASC`,
    ...params
  );

  // Promocode may list version ids from another role — fall back to all versions for this user type.
  if (rows.length === 0 && allowedRaw) {
    rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, subscription_name FROM \`${table}\`
       WHERE role_id = ?
         AND subscription_name IS NOT NULL
         AND subscription_name != ''
       ORDER BY id ASC`,
      roleId
    );
  }

  const result: Record<string, string> = {};
  for (const row of rows) {
    const id = rowNumber(row, 'id');
    const name = rowString(row, 'subscription_name');
    if (id != null && name) result[String(id)] = name;
  }
  return result;
}

export async function getQuickRegisterSubscriptionData(params: {
  userType: string;
  versionId: string;
  promocode?: string;
  country?: string;
  registrationType?: SubscriptionPricingScenario;
}): Promise<Record<string, unknown>> {
  await ensureQuickRegisterSubscriptionSettings();

  const table = await getSubscriptionSettingsTable();
  if (!table || !params.userType || !params.versionId) return {};

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${table}\`
     WHERE role_id = ? AND id = ?
     LIMIT 1`,
    Number(params.userType),
    Number(params.versionId)
  );
  const subscriptionData: Record<string, unknown> = { ...(rows[0] ?? {}) };

  const scenario: SubscriptionPricingScenario =
    params.registrationType === 'renewal' ? 'renewal' : 'first';
  await hydrateVersionSettings();
  const editData = getSubscriptionEditData(Number(params.versionId), false);
  if (editData) {
    const standard = getScenarioPricing(editData.general, scenario);
    const triple = getTripleSubscriptionPricing(editData.general, scenario);

    subscriptionData.days_duration = standard.days;
    subscriptionData.price = standard.price;
    subscriptionData.discount_with_promocode = standard.promoDiscount;
    subscriptionData.pricing_scenario = scenario;
    subscriptionData.triple_duration_days = triple.days;
    subscriptionData.triple_duration_price = triple.price;
    subscriptionData.triple_duration_discount = triple.discountPercent;
    subscriptionData.triple_price_after_promo = triple.priceAfterPromo;
  }

  const promoCode = params.promocode?.trim() ?? '';
  if (promoCode) {
    const promo = await fetchPromocodeByCode(promoCode, false);
    if (promo) {
      const allowedVersions = promo.version_id
        ? promo.version_id.split(',').map((v) => v.trim()).filter(Boolean)
        : [];
      if (allowedVersions.length === 0 || allowedVersions.includes(String(params.versionId))) {
        subscriptionData.discount_with_promocode = promo.discount;
      }
    }
  }

  const country = params.country?.trim() ?? '';
  if (country) {
    const coeff = await getCountryPriceCoefficient(country);
    subscriptionData.price_coefficient = coeff;
    if (coeff > 0 && coeff !== 1) {
      for (const key of ['price', 'triple_duration_price'] as const) {
        const raw = Number(subscriptionData[key]);
        if (Number.isFinite(raw) && raw > 0) subscriptionData[key] = Number((raw * coeff).toFixed(2));
      }
    }
  }

  return subscriptionData;
}

async function resolveSuperAdminEmail(): Promise<string> {
  const usersTable = await getLegacyUsersTable();
  if (usersTable) {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT email FROM \`${usersTable}\`
       WHERE role_id = 1 AND delete_status = 'N'
       ORDER BY id ASC
       LIMIT 1`
    );
    const email = rowString(rows[0] ?? {}, 'email');
    if (email) return email;
  }

  const superAdmin = await prisma.superAdmin.findFirst({
    where: { isActive: true },
    select: { email: true },
    orderBy: { createdAt: 'asc' },
  });
  return superAdmin?.email ?? 'admin@movesbook.com';
}

export async function getQuickRegisterInit(params: {
  userEmail?: string;
  promocode?: string;
  inviteBy?: string;
  inviter?: string;
}): Promise<QuickRegisterInit> {
  await ensureQuickRegisterSubscriptionSettings();

  const inviteByMovesbook = params.inviteBy === 'movesbook';
  const movesbookOfficialEmail = inviteByMovesbook ? await resolveSuperAdminEmail() : '';

  let inviterUsername = params.inviter?.trim() ?? '';
  let inviterReadonly = Boolean(inviterUsername);

  const acceptEmail = params.userEmail?.trim() ?? '';
  const promocode = params.promocode?.trim() ?? '';

  if (!inviteByMovesbook && !inviterUsername && acceptEmail && !acceptEmail.includes(',') && promocode) {
    const promo = await fetchPromocodeByCode(promocode, false);
    const appliesTable = await getPromocodeAppliesTable();
    if (promo && appliesTable) {
      const applyRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT sender_id, sender_email FROM \`${appliesTable}\`
         WHERE LOWER(receiver_email) = ? AND promocode_id = ? AND delete_status = 2
         ORDER BY id DESC
         LIMIT 1`,
        acceptEmail.toLowerCase(),
        promo.id
      );
      const apply = applyRows[0];
      if (apply) {
        const senderId = rowNumber(apply, 'sender_id');
        if (senderId && senderId > 0) {
          const usersTable = await getLegacyUsersTable();
          if (usersTable) {
            const su = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
              `SELECT username FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
              senderId
            );
            const uname = rowString(su[0] ?? {}, 'username');
            if (uname) {
              inviterUsername = uname;
              inviterReadonly = true;
            }
          }
        } else {
          const senderEmail = rowString(apply, 'sender_email');
          if (senderEmail) {
            const su = await fetchLegacyUserByEmail(senderEmail);
            if (su?.username) {
              inviterUsername = su.username;
              inviterReadonly = true;
            }
          }
        }
      }
    }
  }

  let promocodeAllowedVersionIds = '';
  if (promocode) {
    const promo = await fetchPromocodeByCode(promocode, true);
    if (promo?.version_id) {
      promocodeAllowedVersionIds = promo.version_id
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .join(',');
    }
  }

  const countries = COUNTRY_SELECT_OPTIONS.map((c) => ({ id: c.name, name: c.name }));

  const sports: { id: string; name: string }[] = [];
  const sportsTable = await findExistingTable(['sports', 'sport']);
  if (sportsTable) {
    const columns = await getTableColumns(sportsTable);
    const nameCol = columns.has('sport_name') ? 'sport_name' : columns.has('name') ? 'name' : null;
    if (nameCol) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, \`${nameCol}\` AS sport_name FROM \`${sportsTable}\` ORDER BY \`${nameCol}\` ASC`
      );
      for (const row of rows) {
        const id = rowNumber(row, 'id');
        const name = rowString(row, 'sport_name');
        if (id != null && name) sports.push({ id: String(id), name });
      }
    }
  }
  if (sports.length === 0) {
    SPORT_FALLBACK.forEach((name, idx) => sports.push({ id: String(idx + 1), name }));
  }

  return {
    movesbookOfficialEmail,
    inviterUsername,
    inviterReadonly,
    promocodeAllowedVersionIds,
    countries,
    sports,
  };
}

async function resolveCountryId(countryValue: string): Promise<number> {
  const trimmed = countryValue.trim();
  if (!trimmed) return 0;

  const countriesTable = await getCountriesTable();
  if (!countriesTable) return 0;

  if (/^\d+$/.test(trimmed)) {
    const byId = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${countriesTable}\` WHERE id = ? LIMIT 1`,
      Number(trimmed)
    );
    if (byId[0]) return Number(byId[0].id);
  }

  const byName = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${countriesTable}\` WHERE name = ? LIMIT 1`,
    trimmed
  );
  if (byName[0]) return Number(byName[0].id);

  const columns = await getTableColumns(countriesTable);
  const fields = ['name'];
  const values: unknown[] = [trimmed];
  if (columns.has('code')) {
    fields.push('code');
    values.push(countryCodeFromName(trimmed));
  }
  if (columns.has('flag_id')) {
    fields.push('flag_id');
    values.push(1);
  }
  if (columns.has('created')) {
    fields.push('created');
    values.push(new Date());
  }
  if (columns.has('modified')) {
    fields.push('modified');
    values.push(new Date());
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${countriesTable}\` (${fields.map((f) => `\`${f}\``).join(', ')})
     VALUES (${fields.map(() => '?').join(', ')})`,
    ...values
  );
  const idRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT LAST_INSERT_ID() AS id`
  );
  return Number(idRows[0]?.id ?? 0);
}

async function resolveSportId(sportValue: string): Promise<string | number> {
  if (/^\d+$/.test(sportValue.trim())) return Number(sportValue);
  const sportsTable = await findExistingTable(['sports', 'sport']);
  if (!sportsTable) return sportValue;
  const columns = await getTableColumns(sportsTable);
  const nameCol = columns.has('sport_name') ? 'sport_name' : columns.has('name') ? 'name' : null;
  if (!nameCol) return sportValue;
  const rows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
    `SELECT id FROM \`${sportsTable}\` WHERE \`${nameCol}\` = ? LIMIT 1`,
    sportValue.trim()
  );
  return rows[0] ? Number(rows[0].id) : sportValue;
}

function addDays(baseYmd: string, days: number): string {
  const d = new Date(`${baseYmd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function quickRegisterUserType(roleId: string): UserType {
  return roleId === '8' ? UserType.CLUB : UserType.ATHLETE;
}

async function upsertQuickRegisterSubscriptionVersion(params: {
  userId: string;
  versionName: string;
  dateStart: string;
  dateEnd: string;
  paymentMethod?: string;
  amountPaid?: string;
  amountLocal?: string;
  discountPercent?: string;
}) {
  const versionName = params.versionName.trim();
  if (!versionName) return;

  await ensureUserSettingsColumns();

  const existing = await prisma.userSettings.findUnique({
    where: { userId: params.userId },
    select: { adminSettings: true },
  });

  const history = readNetworkSubscriptionHistory(existing?.adminSettings);
  const period: NetworkSubscriptionPeriod = {
    id: `quick-register-${Date.now()}`,
    dateStart: params.dateStart.slice(0, 10),
    dateEnd: params.dateEnd.slice(0, 10) || null,
    version: versionName,
    status: periodDisplayStatus(params.dateEnd),
    paymentMethod: params.paymentMethod,
    amountPaid: params.amountPaid,
    amountLocal: params.amountLocal || undefined,
    discountPercent: params.discountPercent,
  };

  // Replace any previous active quick-register period with the new one; keep archived history.
  const kept = history.filter((p) => {
    if (!p.version?.trim()) return true;
    return !(p.id.startsWith('quick-register-') && p.dateEnd === period.dateEnd && p.dateStart === period.dateStart);
  });
  const withoutSameWindow = kept.filter(
    (p) => !(p.dateStart === period.dateStart && (p.dateEnd ?? '') === (period.dateEnd ?? '')),
  );
  const adminSettings = mergeNetworkSubscriptionHistory(existing?.adminSettings, [
    ...withoutSameWindow,
    period,
  ]);

  if (existing) {
    await prisma.userSettings.update({
      where: { userId: params.userId },
      data: { adminSettings },
    });
    return;
  }

  await prisma.userSettings.create({
    data: {
      userId: params.userId,
      widgetArrangement: '{}',
      colorSettings: '{}',
      adminSettings,
      favouritesSettings: '{}',
      myBestSettings: '{}',
      notificationSettings: '{}',
      socialSettings: '{}',
      toolsSettings: '{}',
      workoutPreferences: '{}',
    },
  });
}

async function syncQuickRegisterUserNew(params: {
  legacyUserId: number;
  username: string;
  email: string;
  password: string;
  usertype: string;
  country: string;
  gender: string;
  createdAt?: Date;
  /** Selected subscription_settings.subscription_name from quick register. */
  versionName?: string;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  paymentMethod?: string;
  amountPaid?: string;
  amountLocal?: string;
  discountPercent?: string;
}): Promise<string> {
  const username = params.username.trim();
  const email = params.email.trim();
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    },
    select: { id: true },
  });

  const data = {
    email,
    username,
    password: params.password,
    name: username,
    userType: quickRegisterUserType(params.usertype),
    country: params.country,
    gender: params.gender,
    updatedAt: new Date(),
  };

  let userId: string;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data,
    });
    userId = existing.id;
  } else {
    // `legacy_<id>` may already be taken by an older row whose legacy id no longer
    // matches (stale sync data). Fall back to the default generated id in that case.
    const desiredId = `legacy_${params.legacyUserId}`;
    const idTaken = await prisma.user.findUnique({
      where: { id: desiredId },
      select: { id: true },
    });

    const created = await prisma.user.create({
      data: {
        ...(idTaken ? {} : { id: desiredId }),
        ...data,
        createdAt: params.createdAt ?? new Date(),
      },
      select: { id: true },
    });
    userId = created.id;
  }

  if (params.versionName?.trim() && params.subscriptionStart && params.subscriptionEnd) {
    await upsertQuickRegisterSubscriptionVersion({
      userId,
      versionName: params.versionName,
      dateStart: params.subscriptionStart,
      dateEnd: params.subscriptionEnd,
      paymentMethod: params.paymentMethod,
      amountPaid: params.amountPaid,
      amountLocal: params.amountLocal,
      discountPercent: params.discountPercent,
    });
  }
  return userId;
}

export type QuickRegisterPayload = {
  username: string;
  email: string;
  re_email: string;
  password: string;
  confim_password: string;
  country: string;
  usertype: string;
  version_id: string;
  gender: string;
  sport: string;
  promocode: string;
  inviter_username?: string;
  confirm_inviter_username?: string;
  invite_by_movesbook?: boolean;
  origin_email?: string;
  disccount_hidden?: string;
  origin?: string;
  payment_method?: string;
  total_payment?: string;
  /** Triple-duration subscription chosen in the form. */
  use_triple?: boolean;
  language?: string;
};

export type QuickRegisterResult = {
  success: boolean;
  message: string;
  /** Set when the user must pay first: the account is created after payment. */
  paymentId?: string;
  userId?: string;
};

/** Verified online payment that completes a pending quick register. */
export type QuickRegisterPaidInfo = {
  provider: string;
  amountEur: number;
  amountLocal: string;
};

type QuickRegisterQuote = {
  basePriceEur: number;
  amountEur: number;
  currencyCode: string;
  eurToLocal: number | null;
  amountLocal: number | null;
  tripleDays: number;
};

/** Price computed on the server (country, promocode discount, triple option); the form value is display only. */
async function quoteQuickRegisterPrice(
  payload: QuickRegisterPayload,
  renewal: boolean,
): Promise<QuickRegisterQuote> {
  const data = await getQuickRegisterSubscriptionData({
    userType: payload.usertype,
    versionId: payload.version_id,
    promocode: payload.promocode,
    country: payload.country,
    registrationType: renewal ? 'renewal' : 'first',
  });
  const useTriple = Boolean(payload.use_triple) && Number(data.triple_duration_price) > 0;
  const basePriceEur = Number(useTriple ? data.triple_duration_price : data.price) || 0;
  const discount = Number(data.discount_with_promocode) || 0;
  const amountEur = Math.max(0, Number((basePriceEur * (1 - discount / 100)).toFixed(2)));

  let currencyCode = 'EUR';
  let eurToLocal: number | null = null;
  try {
    const info = await getCountryPriceInfo(payload.country);
    currencyCode = info.currencyCode || 'EUR';
    eurToLocal = info.eurToLocal;
  } catch (e) {
    console.error('Quick register: country pricing unavailable', e);
  }
  return {
    basePriceEur,
    amountEur,
    currencyCode,
    eurToLocal,
    amountLocal: currencyCode !== 'EUR' ? localAmount(amountEur, eurToLocal) : null,
    tripleDays: useTriple ? Number(data.triple_duration_days) || 0 : 0,
  };
}

async function createQuickRegisterPayment(
  payload: QuickRegisterPayload,
  quote: QuickRegisterQuote,
  versionName: string,
): Promise<string> {
  await ensureRegistrationPaymentTables();
  return createRegistrationPayment(
    prisma,
    {
      userId: `quick:${payload.email.trim().toLowerCase()}`.slice(0, 191),
      status: 'pending',
      versionId: Number(payload.version_id) || null,
      versionName,
      specialOffer: false,
      basePriceEur: quote.basePriceEur,
      amountEur: quote.amountEur,
      country: payload.country,
      currencyCode: quote.currencyCode,
      eurToLocal: quote.eurToLocal,
      amountLocal: quote.amountLocal,
      language: payload.language?.trim() || 'en',
      periodId: null,
    },
    { kind: 'quick_register', pendingData: encryptPrivateData(JSON.stringify(payload)) },
  );
}

function buildQuickRegisterConfirmationHtml(params: {
  username: string;
  password: string;
  siteUrl: string;
  confirmationUrl: string;
}): string {
  const siteLink = escapeHtml(params.siteUrl.replace(/\/$/, ''));
  return `
<p>Welcome to Movesbook ${escapeHtml(params.username)}!</p>
<p>Your account has been created successfully.</p>
<p><strong>Username:</strong> ${escapeHtml(params.username)}</p>
<p><strong>Password:</strong> ${escapeHtml(params.password)}</p>
<p>Visit Movesbook at <a href="${siteLink}">${siteLink}</a></p>
<p>Please click on the link below within 7 days to confirm your email address and Movesbook account.</p>
<p><a href="${escapeHtml(params.confirmationUrl)}">CONFIRM MY ACCOUNT</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendQuickRegisterConfirmationEmail(params: {
  userId: number;
  roleId: string;
  username: string;
  email: string;
  password: string;
  origin?: string;
}): Promise<void> {
  const origin = coercePublicOrigin(params.origin);
  const siteUrl = origin.replace(/\/$/, '') || getSiteOrigin();
  const userToken = Buffer.from(String(params.userId), 'utf8').toString('base64');
  const roleToken = Buffer.from(String(params.roleId), 'utf8').toString('base64');
  const confirmationUrl = `${siteUrl}/confirm_register_link/${encodeURIComponent(userToken)}/${encodeURIComponent(roleToken)}`;

  await sendIonosEmail({
    to: params.email,
    subject: 'Welcome to Movesbook',
    html: buildQuickRegisterConfirmationHtml({
      username: params.username,
      password: params.password,
      siteUrl,
      confirmationUrl,
    }),
  });
}

async function completeAlreadyRegisteredPromocodeRetry(params: {
  appliesTable: string;
  promocodeId: number;
  originEmail: string;
  userId: number;
  payload: QuickRegisterPayload;
  hashedPassword: string;
}): Promise<{ success: boolean; message: string }> {
  let versionName = '';
  let subscriptionStart = todayYmd();
  let subscriptionEnd = addDays(subscriptionStart, 365);
  try {
    const subTable = await getSubscriptionSettingsTable();
    const versionId = params.payload.version_id?.trim();
    if (subTable && versionId) {
      const subRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM \`${subTable}\` WHERE id = ? LIMIT 1`,
        Number(versionId)
      );
      const sub = subRows[0];
      if (sub) {
        versionName = rowString(sub, 'subscription_name') || rowString(sub, 'short_name');
        const durationDays = rowNumber(sub, 'days_duration') ?? 365;
        subscriptionEnd = addDays(subscriptionStart, durationDays);
      }
    }
  } catch {
    /* optional enrichment */
  }

  await syncQuickRegisterUserNew({
    legacyUserId: params.userId,
    username: params.payload.username,
    email: params.payload.email,
    password: params.hashedPassword,
    usertype: params.payload.usertype,
    country: params.payload.country,
    gender: params.payload.gender,
    versionName: versionName || undefined,
    subscriptionStart: versionName ? subscriptionStart : undefined,
    subscriptionEnd: versionName ? subscriptionEnd : undefined,
  });

  const applyColumns = await getTableColumns(params.appliesTable);
  const activeInvites = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id FROM \`${params.appliesTable}\`
     WHERE promocode_id = ? AND delete_status = 2 AND LOWER(receiver_email) = ?
     ORDER BY id ASC`,
    params.promocodeId,
    params.originEmail
  );

  if (activeInvites.length > 0) {
    const lastInviteId = Number(activeInvites[activeInvites.length - 1].id);
    const updates: Record<string, unknown> = {};
    if (applyColumns.has('invites_count')) updates.invites_count = activeInvites.length;
    // Keep receiver_email as the invite email (never rewrite to username).

    const updateKeys = Object.keys(updates);
    if (updateKeys.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE \`${params.appliesTable}\`
         SET ${updateKeys.map((key) => `\`${key}\` = ?`).join(', ')}
         WHERE id = ?`,
        ...updateKeys.map((key) => updates[key]),
        lastInviteId
      );
    }

    const idsToDelete = activeInvites
      .map((row) => Number(row.id))
      .filter((id) => id && id !== lastInviteId);
    if (idsToDelete.length > 0) {
      const deleteUpdates: Record<string, unknown> = { delete_status: 1 };
      if (applyColumns.has('delete_date')) deleteUpdates.delete_date = new Date();
      const deleteKeys = Object.keys(deleteUpdates);
      await prisma.$executeRawUnsafe(
        `UPDATE \`${params.appliesTable}\`
         SET ${deleteKeys.map((key) => `\`${key}\` = ?`).join(', ')}
         WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`,
        ...deleteKeys.map((key) => deleteUpdates[key]),
        ...idsToDelete
      );
    }
  }

  try {
    await sendQuickRegisterConfirmationEmail({
      userId: params.userId,
      roleId: params.payload.usertype,
      username: params.payload.username.trim(),
      email: params.payload.email.trim(),
      password: params.payload.password,
      origin: params.payload.origin,
    });
  } catch (err) {
    console.error('quickRegister confirmation email:', err);
    return {
      success: true,
      message:
        'You have successfully registered, but the welcome email could not be sent. Please contact support if you do not receive your credentials.',
    };
  }

  return { success: true, message: QUICK_REGISTER_SUCCESS_MESSAGE };
}

export async function quickRegisterUser(
  payload: QuickRegisterPayload,
  options: { paid?: QuickRegisterPaidInfo } = {}
): Promise<QuickRegisterResult> {
  const validationError = validateQuickRegisterPayload(payload);
  if (validationError) return { success: false, message: validationError };

  const promocode = await fetchPromocodeByCode(payload.promocode.trim(), true);
  if (!promocode) {
    return { success: false, message: 'Please input valid promocode.' };
  }

  const usersTable = await getLegacyUsersTable();
  if (!usersTable) {
    return { success: false, message: 'User database not available.' };
  }

  const versionId = payload.version_id.trim();
  if (promocode.version_id) {
    const allowed = promocode.version_id.split(',').map((v) => v.trim());
    if (allowed.length > 0 && !allowed.includes(versionId)) {
      return { success: false, message: 'The selected version is not allowed for this promocode.' };
    }
  }

  const subTable = await getSubscriptionSettingsTable();
  if (!subTable || !versionId) {
    return { success: false, message: 'Please select a subscription version.' };
  }

  const subRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM \`${subTable}\` WHERE id = ? LIMIT 1`,
    Number(versionId)
  );
  const subSettings = subRows[0];
  if (!subSettings) {
    return { success: false, message: 'Invalid subscription version.' };
  }

  const durationDays = rowNumber(subSettings, 'days_duration') ?? 365;
  let currentDate = todayYmd();
  let endDate = addDays(currentDate, durationDays);

  const emailNorm = payload.email.trim().toLowerCase();
  const existingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, username, CAST(subscription_end_date AS CHAR) AS subscription_end_date
     FROM \`${usersTable}\`
     WHERE LOWER(email) = ?
     LIMIT 1`,
    emailNorm
  );
  const existingUser = existingRows[0];
  let existingUserId: number | null = existingUser?.id ? Number(existingUser.id) : null;

  if (existingUserId) {
    const existingUsername = rowString(existingUser, 'username');
    if (existingUsername.toLowerCase() !== payload.username.trim().toLowerCase()) {
      return {
        success: false,
        message: `The username cannot be changed for an existing account. Please use your existing username: ${existingUsername}`,
      };
    }
    const subEnd =
      sanitizeLegacyDateString(existingUser.subscription_end_date) ??
      rowString(existingUser, 'subscription_end_date');
    if (subEnd && subEnd >= todayYmd()) {
      currentDate = addDays(subEnd, 1);
      endDate = addDays(currentDate, durationDays);
    }
  }

  let originEmail = payload.origin_email?.trim().toLowerCase() ?? '';
  const inviteByMovesbook = Boolean(payload.invite_by_movesbook);
  const inviterUname = payload.inviter_username?.trim() ?? '';

  if (inviteByMovesbook) {
    if (!originEmail) originEmail = emailNorm;
  } else if (inviterUname) {
    const invUser = await fetchLegacyUserByUsername(inviterUname);
    if (!invUser) {
      return { success: false, message: 'username typed doesn\'t exist' };
    }
    if (!(await inviterAuthorizedForPromocode(invUser.id, promocode))) {
      return { success: false, message: 'That username is not valid for this promocode.' };
    }

    const appliesForExpiry = await getPromocodeAppliesTable();
    if (appliesForExpiry) {
      try {
        const expireRows = await prisma.$queryRawUnsafe<{ invite_expires_at: unknown }[]>(
          `SELECT CAST(invite_expires_at AS CHAR) AS invite_expires_at
           FROM \`${appliesForExpiry}\`
           WHERE promocode_id = ? AND sender_id = ? AND delete_status = 2
             AND (LOWER(receiver_email) = ? OR receiver_id = 0)
           ORDER BY id DESC LIMIT 1`,
          promocode.id,
          invUser.id,
          emailNorm
        );
        const expires = expireRows[0]?.invite_expires_at
          ? String(expireRows[0].invite_expires_at).slice(0, 10)
          : '';
        if (expires && expires < todayYmd()) {
          return {
            success: false,
            message: 'This invite has expired. Ask the sender for a new promocode invitation.',
          };
        }
      } catch {
        /* invite_expires_at column may not exist yet */
      }
    }

    const appliesTable = await getPromocodeAppliesTable();
    if (appliesTable) {
      const existingApply = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT id, sender_id, delete_status FROM \`${appliesTable}\`
         WHERE promocode_id = ?
           AND (
             LOWER(receiver_email) = ?
             OR LOWER(receiver_email) = ?
           )
         ORDER BY (delete_status = 2) DESC, id DESC LIMIT 1`,
        promocode.id,
        emailNorm,
        payload.username.trim().toLowerCase()
      );
      const apply = existingApply[0];
      if (apply) {
        const exSid = rowNumber(apply, 'sender_id') ?? 0;
        if (exSid > 0 && exSid !== invUser.id) {
          return {
            success: false,
            message:
              'This email already has a pending or completed invite for this promocode from another user.',
          };
        }
      } else {
        const columns = await getTableColumns(appliesTable);
        const fields = ['promocode_id', 'sender_id', 'receiver_email', 'delete_status'];
        const values: unknown[] = [promocode.id, invUser.id, emailNorm, 2];
        if (columns.has('sender_email') && invUser.email) {
          fields.push('sender_email');
          values.push(invUser.email);
        }
        if (columns.has('level')) {
          fields.push('level');
          values.push('2');
        }
        if (columns.has('invite_mode')) {
          fields.push('invite_mode');
          values.push('Link sent');
        }
        if (columns.has('created')) {
          fields.push('created');
          values.push(new Date());
        }
        if (columns.has('modified')) {
          fields.push('modified');
          values.push(new Date());
        }

        // Copy Other Info / Visit Also from the inviter's received apply for this promocode.
        try {
          const { resolveInviteOtherInfoAndAdvPage } = await import(
            '@/lib/promocodes/promocodeInviteLinks'
          );
          const links = await resolveInviteOtherInfoAndAdvPage({
            senderLegacyUserId: invUser.id,
            senderEmail: invUser.email,
            promocodeId: promocode.id,
          });
          if (columns.has('other_info') && links.otherInfo) {
            fields.push('other_info');
            values.push(links.otherInfo);
          }
          if (columns.has('adv_page') && links.advPage) {
            fields.push('adv_page');
            values.push(links.advPage);
          }
        } catch {
          /* optional enrichment */
        }

        await prisma.$executeRawUnsafe(
          `INSERT INTO \`${appliesTable}\` (${fields.map((f) => `\`${f}\``).join(', ')})
           VALUES (${fields.map(() => '?').join(', ')})`,
          ...values
        );
      }
    }
    originEmail = emailNorm;
  } else if (originEmail) {
    originEmail = originEmail.toLowerCase();
  } else {
    return {
      success: false,
      message:
        'Enter the username of who invited you, or open the registration link from your invitation email or message.',
    };
  }

  const appliesTable = await getPromocodeAppliesTable();
  const hashedPassword = hashPasswordCakePHP(payload.password);
  if (appliesTable) {
    const usernameNorm = payload.username.trim().toLowerCase();
    const usedParams: unknown[] = [promocode.id, originEmail, usernameNorm];
    let usedSql = `SELECT id, receiver_id FROM \`${appliesTable}\`
       WHERE delete_status = 2 AND receiver_id > 0 AND promocode_id = ?
         AND (
           LOWER(receiver_email) = ?
           OR LOWER(receiver_email) = ?
         )`;
    if (existingUserId) {
      usedSql = `SELECT id, receiver_id FROM \`${appliesTable}\`
       WHERE delete_status = 2 AND promocode_id = ?
         AND (
           (receiver_id > 0 AND (LOWER(receiver_email) = ? OR LOWER(receiver_email) = ?))
           OR receiver_id = ?
         )`;
      usedParams.push(existingUserId);
    }
    usedSql += ` ORDER BY id DESC LIMIT 1`;
    const usedRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(usedSql, ...usedParams);
    if (usedRows[0]) {
      const usedReceiverId = rowNumber(usedRows[0], 'receiver_id');
      if (existingUserId && usedReceiverId === existingUserId) {
        return completeAlreadyRegisteredPromocodeRetry({
          appliesTable,
          promocodeId: promocode.id,
          originEmail,
          userId: existingUserId,
          payload,
          hashedPassword,
        });
      }
      return { success: false, message: 'This promocode has already been used for this email address.' };
    }
  }

  const versionName =
    rowString(subSettings, 'subscription_name') || rowString(subSettings, 'short_name');
  const quote = await quoteQuickRegisterPrice(payload, existingUserId !== null);
  if (quote.tripleDays > 0) endDate = addDays(currentDate, quote.tripleDays);

  let paymentMethod: string;
  let amountPaid: string;
  let amountLocal = '';
  if (options.paid) {
    paymentMethod = options.paid.provider;
    amountPaid = String(options.paid.amountEur);
    amountLocal = options.paid.amountLocal;
  } else if (quote.amountEur <= 0) {
    paymentMethod = 'free';
    amountPaid = '0';
  } else {
    const credentials = await getActivePaymentCredentials();
    if (credentials.testMode) {
      paymentMethod = 'test';
      amountPaid = '0';
    } else if (!credentials.stripe && !credentials.paypal) {
      return {
        success: false,
        message: 'Online payment is not available at the moment. Please try again later.',
      };
    } else {
      const paymentId = await createQuickRegisterPayment(payload, quote, versionName);
      return { success: true, message: '', paymentId };
    }
  }

  const countryId = await resolveCountryId(payload.country);
  const sportId = await resolveSportId(payload.sport);
  const userColumns = await getTableColumns(usersTable);

  const userData: Record<string, unknown> = {
    username: payload.username.trim(),
    role_id: Number(payload.usertype),
    email: payload.email.trim(),
    password: hashedPassword,
    country_id: countryId,
    gender: payload.gender,
    sport_id: sportId,
    verification_status: 'T',
    register_yourself: 1,
    block: 'N',
    subscription_setting_id: Number(versionId),
    subscription_start_date: currentDate,
    subscription_end_date: endDate,
    subscription_status: 'S',
    subscription_mail_status: 'SM',
    credits: parseSubscriptionCredit(subSettings, 'credit2') || 0,
    delete_status: 'N',
    modified: new Date(),
  };

  if (userColumns.has('alternateEmail')) userData.alternateEmail = payload.re_email.trim();

  if (payload.usertype === '8' && userColumns.has('alternate_club_pass')) {
    const clubPass = hashPasswordCakePHP(`${payload.password}_club`);
    const altPass = hashPasswordCakePHP(`${payload.password}_alternative`);
    userData.alternate_club_pass = clubPass;
    if (userColumns.has('alternate_pass')) userData.alternate_pass = altPass;
  }

  let userId = existingUserId;
  const filteredUserData = Object.fromEntries(
    Object.entries(userData).filter(([key]) => userColumns.has(key))
  );

  if (userId) {
    const sets = Object.entries(filteredUserData)
      .filter(([key]) => key !== 'created')
      .map(([key]) => `\`${key}\` = ?`);
    const vals = Object.entries(filteredUserData)
      .filter(([key]) => key !== 'created')
      .map(([, val]) => val);
    await prisma.$executeRawUnsafe(
      `UPDATE \`${usersTable}\` SET ${sets.join(', ')} WHERE id = ?`,
      ...vals,
      userId
    );
  } else {
    if (userColumns.has('created') && !('created' in filteredUserData)) {
      filteredUserData.created = new Date();
    }
    const fields = Object.keys(filteredUserData);
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${usersTable}\` (${fields.map((f) => `\`${f}\``).join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`,
      ...fields.map((f) => filteredUserData[f])
    );
    const idRows = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT LAST_INSERT_ID() AS id`
    );
    userId = Number(idRows[0]?.id ?? 0);
  }

  if (!userId) {
    return { success: false, message: 'The user could not be saved. Please, try again.' };
  }

  const nextUserId = await syncQuickRegisterUserNew({
    legacyUserId: userId,
    username: payload.username,
    email: payload.email,
    password: hashedPassword,
    usertype: payload.usertype,
    country: payload.country,
    gender: payload.gender,
    versionName,
    subscriptionStart: currentDate,
    subscriptionEnd: endDate,
    paymentMethod,
    amountPaid,
    amountLocal,
    discountPercent: payload.disccount_hidden,
  });

  const profileTable =
    payload.usertype === '8'
      ? await findExistingTable(['clubs', 'club'])
      : await findExistingTable(['athletes', 'athlete']);

  if (profileTable) {
    const profileColumns = await getTableColumns(profileTable);
    const profileFields: Record<string, unknown> = { user_id: userId };
    if (profileColumns.has('country_id')) profileFields.country_id = countryId;
    if (profileColumns.has('gender')) profileFields.gender = payload.gender;

    const existingProfile = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${profileTable}\` WHERE user_id = ? LIMIT 1`,
      userId
    );
    if (existingProfile[0]) {
      const sets = Object.keys(profileFields).map((k) => `\`${k}\` = ?`);
      await prisma.$executeRawUnsafe(
        `UPDATE \`${profileTable}\` SET ${sets.join(', ')} WHERE user_id = ?`,
        ...Object.values(profileFields),
        userId
      );
    } else {
      const fields = Object.keys(profileFields);
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${profileTable}\` (${fields.map((f) => `\`${f}\``).join(', ')})
         VALUES (${fields.map(() => '?').join(', ')})`,
        ...fields.map((f) => profileFields[f])
      );
    }
  }

  if (appliesTable) {
    const receiverApplyRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, sender_id, sender_email FROM \`${appliesTable}\`
       WHERE promocode_id = ? AND delete_status = 2
         AND (
           LOWER(receiver_email) = ?
           OR LOWER(receiver_email) = ?
           OR (receiver_id > 0 AND receiver_id = ?)
         )
       ORDER BY id DESC LIMIT 1`,
      promocode.id,
      originEmail,
      payload.username.trim().toLowerCase(),
      userId
    );
    const receiverApply = receiverApplyRows[0];
    if (receiverApply?.id) {
      const applyColumns = await getTableColumns(appliesTable);
      // Dashboard-Version settings: credit=direct sender, credit1=friend-of-friend (secondary), credit2=new user
      const credit = parseSubscriptionCredit(subSettings, 'credit2');
      const creditSender = parseSubscriptionCredit(subSettings, 'credit');
      const creditSecondarySender = parseSubscriptionCredit(subSettings, 'credit1');
      const registrationDate = new Date();
      const updates: Record<string, unknown> = {
        sender_credit: creditSender,
        receiver_credit: credit,
        receiver_id: userId,
        receiver_version: rowString(subSettings, 'subscription_name'),
        registration_date: registrationDate,
        subscription_start_date: currentDate,
        subscription_end_date: endDate,
        is_registered: 1,
        modified: registrationDate,
        new_receiver: existingUserId ? 'N' : 'Y',
        cost_paid: amountPaid,
        total_payment: amountPaid,
      };

      if (inviteByMovesbook) {
        const superRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT id, email FROM \`${usersTable}\`
           WHERE role_id = 1 AND delete_status = 'N'
           ORDER BY id ASC LIMIT 1`
        );
        const superId = rowNumber(superRows[0] ?? {}, 'id');
        if (superId) {
          updates.sender_id = superId;
          if (applyColumns.has('sender_email')) {
            updates.sender_email = rowString(superRows[0] ?? {}, 'email') || movesbookFallbackEmail();
          }
        }
      }

      const setParts = Object.keys(updates)
        .filter((k) => applyColumns.has(k))
        .map((k) => `\`${k}\` = ?`);
      const setVals = Object.keys(updates)
        .filter((k) => applyColumns.has(k))
        .map((k) => updates[k]);
      if (setParts.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE \`${appliesTable}\` SET ${setParts.join(', ')} WHERE id = ?`,
          ...setVals,
          Number(receiverApply.id)
        );
      }

      void incrementRegistrationStat(
        countryId,
        countryCodeFromName(payload.country) ?? payload.country
      ).catch(() => undefined);

      const senderId = rowNumber(updates, 'sender_id') || rowNumber(receiverApply, 'sender_id');
      const senderCredit = Number(creditSender) || 0;
      let senderEmail = rowString(receiverApply, 'sender_email');
      let senderUsername = '';
      if (senderId) {
        const userSelectCols = userColumns.has('credits')
          ? 'id, email, username, credits'
          : 'id, email, username';
        const senderRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT ${userSelectCols} FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
          senderId
        );
        senderEmail = senderEmail || rowString(senderRows[0] ?? {}, 'email');
        senderUsername = rowString(senderRows[0] ?? {}, 'username');
        if (senderCredit > 0 && userColumns.has('credits')) {
          const currentCredits = Number(senderRows[0]?.credits ?? 0);
          await prisma.$executeRawUnsafe(
            `UPDATE \`${usersTable}\` SET credits = ? WHERE id = ?`,
            currentCredits + senderCredit,
            senderId
          );
        }
      } else if (senderEmail) {
        const senderRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT id, email, username FROM \`${usersTable}\`
           WHERE LOWER(email) = ? AND delete_status = 'N' LIMIT 1`,
          senderEmail.toLowerCase()
        );
        senderUsername = rowString(senderRows[0] ?? {}, 'username');
      }

      // Friend-of-a-friend: assign secondary_sender_* from the person who invited the direct sender
      const secondaryCredit = Number(creditSecondarySender) || 0;
      const canWriteSecondary =
        applyColumns.has('secondary_sender_id') ||
        applyColumns.has('secondary_sender_credit') ||
        applyColumns.has('secondary_sender_username');
      if (canWriteSecondary && (senderId || senderEmail || senderUsername)) {
        const secondaryOr: string[] = [];
        const secondaryParams: unknown[] = [];
        if (senderId) {
          secondaryOr.push('receiver_id = ?');
          secondaryParams.push(senderId);
        }
        if (senderEmail) {
          secondaryOr.push('LOWER(receiver_email) = ?');
          secondaryParams.push(senderEmail.toLowerCase());
        }
        if (senderUsername) {
          secondaryOr.push('LOWER(receiver_email) = ?');
          secondaryParams.push(senderUsername.toLowerCase());
        }

        if (secondaryOr.length > 0) {
          const secondaryRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT id, sender_id, sender_email FROM \`${appliesTable}\`
             WHERE delete_status = 2 AND receiver_id > 0
               AND (${secondaryOr.join(' OR ')})
             ORDER BY id DESC LIMIT 1`,
            ...secondaryParams
          );
          const secondaryApply = secondaryRows[0];
          let secondarySenderId = rowNumber(secondaryApply ?? {}, 'sender_id');
          let secondarySenderEmail = '';
          let secondarySenderUsername = '';
          let secondarySenderCredits = 0;

          if (secondaryApply) {
            const userSelectCols = userColumns.has('credits')
              ? 'id, email, username, credits'
              : 'id, email, username';
            if (secondarySenderId && secondarySenderId > 0) {
              const secondaryUserRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
                `SELECT ${userSelectCols} FROM \`${usersTable}\` WHERE id = ? LIMIT 1`,
                secondarySenderId
              );
              const secondaryUser = secondaryUserRows[0] ?? {};
              secondarySenderEmail = rowString(secondaryUser, 'email');
              secondarySenderUsername = rowString(secondaryUser, 'username');
              secondarySenderCredits = Number(secondaryUser.credits ?? 0);
            } else {
              const secondaryApplySenderEmail = rowString(secondaryApply, 'sender_email');
              if (secondaryApplySenderEmail) {
                const secondaryUserRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
                  `SELECT ${userSelectCols} FROM \`${usersTable}\`
                   WHERE LOWER(email) = ? AND delete_status = 'N' LIMIT 1`,
                  secondaryApplySenderEmail.toLowerCase()
                );
                const secondaryUser = secondaryUserRows[0] ?? {};
                secondarySenderId = rowNumber(secondaryUser, 'id');
                secondarySenderEmail = rowString(secondaryUser, 'email');
                secondarySenderUsername = rowString(secondaryUser, 'username');
                secondarySenderCredits = Number(secondaryUser.credits ?? 0);
              }
            }
          }

          if (secondarySenderId || secondarySenderEmail || secondarySenderUsername) {
            const secondaryUpdates: Record<string, unknown> = {
              secondary_sender_id: secondarySenderId || null,
              secondary_sender_email: secondarySenderEmail,
              secondary_sender_username: secondarySenderUsername,
              // Always write credit1 (friend-of-a-friend) from Dashboard-Version settings
              secondary_sender_credit: creditSecondarySender === '' ? 0 : creditSecondarySender,
            };
            const secondarySetParts = Object.keys(secondaryUpdates)
              .filter((k) => applyColumns.has(k))
              .map((k) => `\`${k}\` = ?`);
            const secondarySetVals = Object.keys(secondaryUpdates)
              .filter((k) => applyColumns.has(k))
              .map((k) => secondaryUpdates[k]);
            if (secondarySetParts.length > 0) {
              await prisma.$executeRawUnsafe(
                `UPDATE \`${appliesTable}\` SET ${secondarySetParts.join(', ')} WHERE id = ?`,
                ...secondarySetVals,
                Number(receiverApply.id)
              );
            }

            if (secondarySenderId && secondaryCredit > 0 && userColumns.has('credits')) {
              await prisma.$executeRawUnsafe(
                `UPDATE \`${usersTable}\` SET credits = ? WHERE id = ?`,
                secondarySenderCredits + secondaryCredit,
                secondarySenderId
              );
            }
          }
        }
      }

      if (originEmail) {
        const allInvites = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT id FROM \`${appliesTable}\`
           WHERE promocode_id = ? AND delete_status = 2 AND LOWER(receiver_email) = ?
           ORDER BY id ASC`,
          promocode.id,
          originEmail
        );
        const invitesTotal = allInvites.length;
        if (invitesTotal > 0) {
          const lastInviteId = Number(allInvites[invitesTotal - 1].id);
          const consolidateUpdates: Record<string, unknown> = {};
          if (applyColumns.has('invites_count')) consolidateUpdates.invites_count = invitesTotal;
          // Keep receiver_email as the invite email so later uniqueness / used checks still match.
          // Do NOT rewrite it to username (that caused duplicate apply rows).

          const consolidateSetParts = Object.keys(consolidateUpdates).map((k) => `\`${k}\` = ?`);
          if (consolidateSetParts.length > 0) {
            await prisma.$executeRawUnsafe(
              `UPDATE \`${appliesTable}\` SET ${consolidateSetParts.join(', ')} WHERE id = ?`,
              ...Object.values(consolidateUpdates),
              lastInviteId
            );
          }

          const idsToDelete = allInvites
            .map((row) => Number(row.id))
            .filter((id) => id && id !== lastInviteId);
          if (idsToDelete.length > 0) {
            const deleteUpdates: Record<string, unknown> = { delete_status: 1 };
            if (applyColumns.has('delete_date')) deleteUpdates.delete_date = new Date();
            const deleteSetParts = Object.keys(deleteUpdates).map((k) => `\`${k}\` = ?`);
            await prisma.$executeRawUnsafe(
              `UPDATE \`${appliesTable}\` SET ${deleteSetParts.join(', ')}
               WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`,
              ...Object.values(deleteUpdates),
              ...idsToDelete
            );
          }
        }
      }

      // Soft-delete any other active applies for same promocode + registered receiver (stops double credits).
      if (Number(receiverApply.id) > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE \`${appliesTable}\` SET delete_status = 1
           WHERE promocode_id = ? AND receiver_id = ? AND delete_status = 2 AND id <> ?`,
          promocode.id,
          userId,
          Number(receiverApply.id)
        ).catch(() => undefined);
      }
    }
  }

  const settingsTable = await getPromocodeSettingsTable();
  if (settingsTable && promocode.usable_by?.toLowerCase() === 'once') {
    await prisma.$executeRawUnsafe(
      `UPDATE \`${settingsTable}\` SET used = used + 1, modified = NOW() WHERE id = ?`,
      promocode.id
    );
  }

  try {
    await sendQuickRegisterConfirmationEmail({
      userId,
      roleId: payload.usertype,
      username: payload.username.trim(),
      email: payload.email.trim(),
      password: payload.password,
      origin: payload.origin,
    });
  } catch (err) {
    console.error('quickRegister confirmation email:', err);
    return {
      success: true,
      message:
        'You have successfully registered, but the welcome email could not be sent. Please contact support if you do not receive your credentials.',
      userId: nextUserId,
    };
  }

  return { success: true, message: QUICK_REGISTER_SUCCESS_MESSAGE, userId: nextUserId };
}

function movesbookFallbackEmail(): string {
  return 'admin@movesbook.com';
}

function validateQuickRegisterPayload(payload: QuickRegisterPayload): string | null {
  if (!payload.username.trim()) return 'Please enter your username';
  if (payload.username.trim().length < 5) return 'Your username must be at least 5 characters long';
  if (!payload.email.trim()) return 'Please enter your email';
  if (!payload.re_email.trim()) return 'Please Retype your email';
  if (payload.email.trim().toLowerCase() !== payload.re_email.trim().toLowerCase()) {
    return 'Please Retype same email';
  }
  if (!payload.password) return 'Please enter your password';
  if (payload.password.length < 5) return 'Your password must be at least 5 characters long';
  if (payload.password !== payload.confim_password) return 'Please enter the same password as above';
  if (!payload.country) return 'Please select your country';
  if (!payload.usertype || !['5', '8'].includes(String(payload.usertype))) {
    return 'Please select your user type';
  }
  if (!payload.version_id) return 'Please select a subscription version';
  if (!payload.gender) return 'Please select gender';
  if (!payload.sport) return 'Please select your sport';
  if (!payload.promocode.trim()) return 'Please input valid promocode.';

  if (!payload.invite_by_movesbook && payload.promocode.trim()) {
    const originVal = payload.origin_email?.trim() ?? '';
    const invVal = payload.inviter_username?.trim() ?? '';
    const invConf = payload.confirm_inviter_username?.trim() ?? '';
    if (!originVal) {
      if (!invVal) return 'Enter the username of who invited you.';
      if (invVal.toLowerCase() !== invConf.toLowerCase()) {
        return 'Inviter username and confirmation must match.';
      }
    } else if (invVal && invVal.toLowerCase() !== invConf.toLowerCase()) {
      return 'Inviter username and confirmation must match.';
    }
  }

  return null;
}
