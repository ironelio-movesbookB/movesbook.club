import { NextRequest, NextResponse } from 'next/server';
import { serialize, unserialize } from 'php-serialize';
import { prisma } from '@/lib/prisma';
import { normalizeTypologyDateInput } from '@/lib/typologySubscriptionAudio.shared';
import { verifyToken } from '@/lib/auth';
import { fetchLanesForDays, saveLanesForDays } from '@/lib/lanesForDays.server';

export const dynamic = 'force-dynamic';

type TypologyRow = {
  id: string;
  area: string;
  blockAccess: boolean;
  image: string;
  activityName: string;
  room: string;
  cost: string;
  limit: string;
  limitEnabled: boolean;
  audioUrl: string | null;
  isDefault: boolean;
};

type BookingSettings = {
  applyCourseSetting: 'Y' | 'N';
  applyTemporarySetting: 'Y' | 'N';
  confirmationOption: 'no' | 'ask' | 'yes';
  selfBook: 'Y' | 'N';
  authorizeExpired: 'Y' | 'N';
};

type AreaOption = {
  id: string;
  name: string;
};

type AuthorizedContext = {
  userId: string;
  club: { id: string; name: string } | null;
  userIds: string[];
};

type TypologyValidationResult = {
  fieldErrors: Record<string, string>;
  areaActivity: string | null;
};

type LegacyTypologyRow = {
  id: string | number | bigint;
  userId?: string | number | bigint | null;
  area?: string | null;
  blockAccess?: string | null;
  activityName?: string | null;
  image?: string | null;
  room?: string | number | null;
  cost?: string | number | null;
  limitValue?: string | number | null;
  limitStatus?: string | null;
  song?: string | null;
  isDefault?: string | number | null;
  applyCourseSetting?: string | null;
  applyTemporarySetting?: string | null;
  confirmationOption?: string | null;
  selfBook?: string | null;
  authorizeExpired?: string | null;
};

const TYPOLOGY_TABLE_CANDIDATES = [
  'club_setting_subscription_typologies',
  'club_setting_subscription_typology'
];

const AREA_TABLE_CANDIDATES = [
  'club_setting_areas',
  'club_setting_area'
];

const DEFAULT_TABLE_CANDIDATES = [
  'club_setting_subscription_typology_defaults',
  'club_setting_subscription_typology_default'
];

const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  applyCourseSetting: 'Y',
  applyTemporarySetting: 'N',
  confirmationOption: 'no',
  selfBook: 'N',
  authorizeExpired: 'N'
};

const DEFAULT_AREAS: AreaOption[] = [
  { id: 'Fitness', name: 'Fitness' },
  { id: 'Swim', name: 'Swim' },
  { id: 'Aerobics', name: 'Aerobics' },
  { id: 'Pilates', name: 'Pilates' }
];

const ACCESS_KEYS = [
  'one',
  'three',
  'five',
  'seven',
  'ten',
  'twelve',
  'fifteen',
  'one_month',
  'two_month',
  'three_month',
  'six_month'
] as const;

function yesNo(value: unknown, fallback: 'Y' | 'N' = 'N'): 'Y' | 'N' {
  if (value === 'Y' || value === 'y' || value === true || value === 1 || value === '1') {
    return 'Y';
  }
  if (value === 'N' || value === 'n' || value === false || value === 0 || value === '0') {
    return 'N';
  }
  return fallback;
}

function normalizeConfirmation(value: unknown): 'no' | 'ask' | 'yes' {
  return value === 'ask' || value === 'yes' ? value : 'no';
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function isBlank(value: unknown): boolean {
  return text(value).length === 0;
}

function isNonNegativeNumberText(value: unknown): boolean {
  const next = text(value);
  if (next === '') return true;
  const parsed = Number(next.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0;
}

function isIntegerText(value: unknown): boolean {
  const next = text(value);
  return next === '' || /^-?\d+$/.test(next);
}

function isNonNegativeIntegerText(value: unknown): boolean {
  const next = text(value);
  if (next === '') return true;
  const parsed = Number(next);
  return Number.isInteger(parsed) && parsed >= 0;
}

function isDateText(value: unknown): boolean {
  const next = text(value);
  return next === '' || /^\d{4}-\d{2}-\d{2}$/.test(next);
}

function isClubAccountUserType(userType: string): boolean {
  return userType === 'CLUB' || userType === 'CLUB_TRAINER';
}

function getTokenPayload(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

async function findExistingTable(candidates: string[]): Promise<string | null> {
  const placeholders = candidates.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    ...candidates
  );

  const existing = new Set(rows.map((row) => row.TABLE_NAME));
  return candidates.find((candidate) => existing.has(candidate)) ?? null;
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    tableName
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function ensureLocalTypologyTable(): Promise<string> {
  const tableName = 'club_setting_subscription_typologies';
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      club_id VARCHAR(191) NULL,
      area_activity VARCHAR(191) NULL,
      activity_name VARCHAR(255) NOT NULL,
      code VARCHAR(80) NULL,
      color VARCHAR(30) NULL,
      image VARCHAR(255) NULL,
      multifactory VARCHAR(80) NULL,
      coaches VARCHAR(191) NULL,
      vendors VARCHAR(191) NULL,
      annotations TEXT NULL,
      room VARCHAR(191) NULL,
      cost_for_lesson VARCHAR(80) NULL,
      enabled_access_one CHAR(1) DEFAULT 'N',
      cost_access_one VARCHAR(80) NULL,
      usable_access_one VARCHAR(80) NULL,
      days_to_pay_access_one VARCHAR(80) NULL,
      enabled_access_three CHAR(1) DEFAULT 'N',
      cost_access_three VARCHAR(80) NULL,
      usable_access_three VARCHAR(80) NULL,
      days_to_pay_access_three VARCHAR(80) NULL,
      enabled_access_five CHAR(1) DEFAULT 'N',
      cost_access_five VARCHAR(80) NULL,
      usable_access_five VARCHAR(80) NULL,
      days_to_pay_access_five VARCHAR(80) NULL,
      enabled_access_seven CHAR(1) DEFAULT 'N',
      cost_access_seven VARCHAR(80) NULL,
      usable_access_seven VARCHAR(80) NULL,
      days_to_pay_access_seven VARCHAR(80) NULL,
      enabled_access_ten CHAR(1) DEFAULT 'N',
      cost_access_ten VARCHAR(80) NULL,
      usable_access_ten VARCHAR(80) NULL,
      days_to_pay_access_ten VARCHAR(80) NULL,
      enabled_access_twelve CHAR(1) DEFAULT 'N',
      cost_access_twelve VARCHAR(80) NULL,
      usable_access_twelve VARCHAR(80) NULL,
      days_to_pay_access_twelve VARCHAR(80) NULL,
      enabled_access_fifteen CHAR(1) DEFAULT 'N',
      cost_access_fifteen VARCHAR(80) NULL,
      usable_access_fifteen VARCHAR(80) NULL,
      days_to_pay_access_fifteen VARCHAR(80) NULL,
      enabled_access_one_month CHAR(1) DEFAULT 'N',
      cost_access_one_month VARCHAR(80) NULL,
      usable_access_one_month VARCHAR(80) NULL,
      days_to_pay_access_one_month VARCHAR(80) NULL,
      enabled_access_two_month CHAR(1) DEFAULT 'N',
      cost_access_two_month VARCHAR(80) NULL,
      usable_access_two_month VARCHAR(80) NULL,
      days_to_pay_access_two_month VARCHAR(80) NULL,
      enabled_access_three_month CHAR(1) DEFAULT 'N',
      cost_access_three_month VARCHAR(80) NULL,
      usable_access_three_month VARCHAR(80) NULL,
      days_to_pay_access_three_month VARCHAR(80) NULL,
      enabled_access_six_month CHAR(1) DEFAULT 'N',
      cost_access_six_month VARCHAR(80) NULL,
      usable_access_six_month VARCHAR(80) NULL,
      days_to_pay_access_six_month VARCHAR(80) NULL,
      allow_multiple_entrances_same_day CHAR(1) DEFAULT 'N',
      after_daccess_decrease_subsequent CHAR(1) DEFAULT 'N',
      max_limit_status CHAR(1) DEFAULT 'N',
      max_limit_value VARCHAR(80) NULL,
      subscription_process CHAR(1) DEFAULT 'N',
      enable_for_lanes_booths CHAR(1) DEFAULT 'N',
      availability_with_max_limit TEXT NULL,
      after_expire_lane_days VARCHAR(80) NULL,
      block_access CHAR(1) DEFAULT 'N',
      decrease_season CHAR(1) DEFAULT 'N',
      access_control_for_user CHAR(1) DEFAULT 'N',
      result_of_the_access_control CHAR(1) DEFAULT 'N',
      data_regarding_accesses CHAR(1) DEFAULT 'N',
      accesses_allow CHAR(1) DEFAULT 'N',
      accesses_not_allow CHAR(1) DEFAULT 'N',
      audio_message_status CHAR(1) DEFAULT 'N',
      audio_path VARCHAR(255) NULL,
      audio_message_start VARCHAR(80) NULL,
      audio_message_end VARCHAR(80) NULL,
      song VARCHAR(255) NULL,
      pop_up_status CHAR(1) DEFAULT 'N',
      pop_up_start VARCHAR(80) NULL,
      pop_up_end VARCHAR(80) NULL,
      notice TEXT NULL,
      header_size VARCHAR(80) NULL,
      default_set_status CHAR(1) DEFAULT 'N',
      attendance_limit_status CHAR(1) DEFAULT 'N',
      attendance_limit_value VARCHAR(80) NULL,
      allowed_in_club_min VARCHAR(80) NULL,
      allowed_in_club_max VARCHAR(80) NULL,
      typology_description MEDIUMTEXT NULL,
      enabled_for_booking CHAR(1) DEFAULT 'N',
      mandatory_booking CHAR(1) DEFAULT 'N',
      self_booking CHAR(1) DEFAULT 'N',
      self_subscription CHAR(1) DEFAULT 'N',
      payment_posteciped_or_credit_card CHAR(1) DEFAULT 'N',
      pay_within_days VARCHAR(80) NULL,
      apply_course_setting CHAR(1) DEFAULT 'Y',
      apply_temporary_setting CHAR(1) DEFAULT 'N',
      confirmation_option VARCHAR(20) DEFAULT 'no',
      allow_different_instructor CHAR(1) DEFAULT 'N',
      self_book CHAR(1) DEFAULT 'N',
      authorize_expired CHAR(1) DEFAULT 'N',
      created DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_typology_user_club (user_id, club_id)
    )
  `);

  return tableName;
}

async function ensureLocalAreaTable(userIds: string[], clubId: string | null): Promise<string> {
  const tableName = 'club_setting_areas';
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      club_id VARCHAR(191) NULL,
      area VARCHAR(191) NOT NULL,
      created DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_club_setting_areas_user_club (user_id, club_id),
      INDEX idx_club_setting_areas_area (area)
    )
  `);

  const userId = userIds[userIds.length - 1] ?? '';
  const userPlaceholders = userIds.map(() => '?').join(',');
  const existing = await prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
    `SELECT COUNT(*) AS count
     FROM \`${tableName}\`
     WHERE user_id IN (${userPlaceholders})`,
    ...userIds
  );

  if (Number(existing[0]?.count ?? 0) === 0 && userId) {
    for (const area of DEFAULT_AREAS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${tableName}\` (user_id, club_id, area)
         VALUES (?, ?, ?)`,
        userId,
        clubId,
        area.name
      );
    }
  }

  return tableName;
}

async function getTypologyTableForWrite(): Promise<string> {
  return await findExistingTable(TYPOLOGY_TABLE_CANDIDATES) ?? await ensureLocalTypologyTable();
}

async function getTypologyTableForRead(): Promise<string> {
  return await findExistingTable(TYPOLOGY_TABLE_CANDIDATES) ?? await ensureLocalTypologyTable();
}

async function getAreaTableForUser(userIds: string[], clubId: string | null): Promise<string> {
  return await findExistingTable(AREA_TABLE_CANDIDATES) ?? await ensureLocalAreaTable(userIds, clubId);
}

async function fetchAreaOptions(userIds: string[], clubId: string | null): Promise<AreaOption[]> {
  const areaTable = await getAreaTableForUser(userIds, clubId);

  const userPlaceholders = userIds.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<{ id: string | number; area: string | null }[]>(
    `SELECT id, area
     FROM \`${areaTable}\`
     WHERE user_id IN (${userPlaceholders})
     ORDER BY area ASC`,
    ...userIds
  );

  const areas = rows
    .filter((row) => row.area)
    .map((row) => ({ id: String(row.id), name: String(row.area) }));

  return areas.length > 0 ? areas : DEFAULT_AREAS;
}

async function normalizeTypologyAreaReferences(userIds: string[], clubId: string | null) {
  const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
  const areaTable = await findExistingTable(AREA_TABLE_CANDIDATES);
  if (!typologyTable || !areaTable) return;

  const columns = await getTableColumns(typologyTable);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const clubFilter = clubId && columns.has('club_id') ? ' AND t.club_id = ?' : '';

  await prisma.$executeRawUnsafe(
    `UPDATE \`${typologyTable}\` t
     INNER JOIN \`${areaTable}\` a
        ON a.area = t.area_activity
       AND a.user_id = t.user_id
     SET t.area_activity = CAST(a.id AS CHAR)
     WHERE t.user_id IN (${userPlaceholders})
       ${clubFilter}
       AND t.area_activity = a.area`,
    ...userIds,
    ...(clubFilter ? [clubId] : [])
  );
}

async function resolveAreaActivity(areaActivity: unknown, userIds: string[], clubId: string | null): Promise<string | null> {
  const rawArea = text(areaActivity);
  if (!rawArea) return null;

  const areaTable = await getAreaTableForUser(userIds, clubId);

  const userPlaceholders = userIds.map(() => '?').join(',');
  if (/^\d+$/.test(rawArea)) {
    const rows = await prisma.$queryRawUnsafe<{ id: string | number }[]>(
      `SELECT id
       FROM \`${areaTable}\`
       WHERE id = ?
         AND user_id IN (${userPlaceholders})
       LIMIT 1`,
      rawArea,
      ...userIds
    );

    return rows[0]?.id != null ? String(rows[0].id) : null;
  }

  const rows = await prisma.$queryRawUnsafe<{ id: string | number }[]>(
    `SELECT id
     FROM \`${areaTable}\`
     WHERE area = ?
       AND user_id IN (${userPlaceholders})
     ORDER BY id DESC
     LIMIT 1`,
    rawArea,
    ...userIds
  );

  return rows[0]?.id != null ? String(rows[0].id) : null;
}

function serializeLaneAvailability(lanes: any[]): string {
  const items = Array.from({ length: 10 }, (_, index) => {
    const lane = lanes[index] ?? {};
    const enabled = yesNo(lane?.available) === 'Y';
    const limit = text(lane?.limit);
    return enabled ? { Y: limit } : { N: limit };
  });

  return serialize(items);
}

function boolFromYesNo(value: unknown): boolean {
  return yesNo(value) === 'Y';
}

function parseLaneAvailability(raw: unknown): { available: boolean; limit: string }[] {
  const defaults = Array.from({ length: 10 }, () => ({ available: false, limit: '' }));
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return defaults;
  }

  try {
    const parsed = unserialize(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return defaults;
    }

    const items = Array.isArray(parsed)
      ? parsed
      : Array.from({ length: 10 }, (_, index) => (parsed as Record<number, unknown>)[index]);

    return Array.from({ length: 10 }, (_, index) => {
      const lane = items[index];
      if (!lane || typeof lane !== 'object') {
        return { available: false, limit: '' };
      }

      const record = lane as Record<string, string>;
      if ('Y' in record) {
        return { available: true, limit: text(record.Y) };
      }

      if ('N' in record) {
        return { available: false, limit: text(record.N) };
      }

      const [flag, limitValue] = Object.entries(record)[0] ?? [];
      if (flag === 'Y') {
        return { available: true, limit: text(limitValue) };
      }

      return { available: false, limit: text(limitValue) };
    });
  } catch {
    return defaults;
  }
}

function buildTypologyValues(body: any, areaActivity: string): Record<string, unknown> {
  const admissions = body.admissions && typeof body.admissions === 'object' ? body.admissions : {};
  const lanes = Array.isArray(body.lanes) ? body.lanes : [];

  const values: Record<string, unknown> = {
    area_activity: areaActivity,
    activity_name: String(body.activityName ?? '').trim(),
    code: String(body.code ?? '').trim(),
    color: String(body.color ?? '').trim(),
    image: String(body.image ?? 'Cat_1.png').trim(),
    multifactory: String(body.multifactory ?? '').trim(),
    coaches: String(body.coaches ?? '').trim(),
    vendors: String(body.vendors ?? '').trim(),
    annotations: String(body.annotations ?? '').trim(),
    room: String(body.room ?? '').trim(),
    cost_for_lesson: String(body.costForLesson ?? '').trim(),
    allow_multiple_entrances_same_day: yesNo(body.allowMultipleEntrancesSameDay),
    after_daccess_decrease_subsequent: yesNo(body.afterDailyAccessDecreaseSubsequent),
    max_limit_status: yesNo(body.maxLimitEnabled),
    max_limit_value: String(body.maxLimitValue ?? '').trim(),
    subscription_process: yesNo(body.preventSubscriptionProcess),
    enable_for_lanes_booths: yesNo(body.enableLanesBooths),
    availability_with_max_limit: serializeLaneAvailability(lanes),
    after_expire_lane_days: String(body.afterExpireLaneDays ?? '').trim(),
    block_access: yesNo(body.blockAccess),
    decrease_season: yesNo(body.decreaseSeason),
    access_control_for_user: yesNo(body.hideAccessControlData),
    result_of_the_access_control: yesNo(body.disableAccessVoiceMessage),
    data_regarding_accesses: yesNo(body.doNotStoreAccessData),
    accesses_allow: yesNo(body.doNotStoreAllowedAccesses),
    accesses_not_allow: yesNo(body.doNotStoreDeniedAccesses),
    audio_message_status: yesNo(body.audioMessageEnabled),
    audio_message_start: yesNo(body.audioMessageEnabled) === 'Y'
      ? String(body.audioMessageStart ?? '').trim()
      : '',
    audio_message_end: yesNo(body.audioMessageEnabled) === 'Y'
      ? String(body.audioMessageEnd ?? '').trim()
      : '',
    pop_up_status: yesNo(body.popupMessageEnabled),
    pop_up_start: String(body.popupMessageStart ?? '').trim(),
    pop_up_end: String(body.popupMessageEnd ?? '').trim(),
    notice: String(body.notice ?? '').trim(),
    header_size: String(body.headerSize ?? 'header_size-1').trim(),
    typology_description: String(body.description ?? '').trim(),
    enabled_for_booking: yesNo(body.enabledForBooking),
    mandatory_booking: yesNo(body.mandatoryBooking),
    self_booking: yesNo(body.selfBooking),
    self_subscription: yesNo(body.selfSubscription),
    payment_posteciped_or_credit_card: yesNo(body.paymentPostecipedOrCreditCard),
    pay_within_days: String(body.payWithinDays ?? '').trim()
  };

  for (const key of ACCESS_KEYS) {
    const admission = admissions[key] ?? {};
    values[`enabled_access_${key}`] = yesNo(admission.enabled);
    values[`cost_access_${key}`] = String(admission.price ?? '').trim();
    values[`usable_access_${key}`] = String(admission.accesses ?? '').trim();
    values[`days_to_pay_access_${key}`] = String(admission.daysToPay ?? '').trim();
  }

  return values;
}

function buildTypologyAudioUrl(row: Record<string, unknown>): string | null {
  const song = text(row.song);
  const userId = text(row.user_id);
  if (!song || !userId) return null;
  return `/subscription_file/playlist/User_${userId}/${song}`;
}

function mapDbRowToTypologyForm(row: Record<string, unknown>) {
  const admissions = ACCESS_KEYS.reduce((acc, key) => {
    acc[key] = {
      enabled: boolFromYesNo(row[`enabled_access_${key}`]),
      price: text(row[`cost_access_${key}`]),
      accesses: text(row[`usable_access_${key}`]),
      daysToPay: text(row[`days_to_pay_access_${key}`])
    };
    return acc;
  }, {} as Record<string, { enabled: boolean; price: string; accesses: string; daysToPay: string }>);

  return {
    areaActivity: text(row.area_activity),
    activityName: text(row.activity_name),
    code: text(row.code),
    color: text(row.color) || '#ffffff',
    image: text(row.image) || 'Cat_1.png',
    multifactory: text(row.multifactory) || '1',
    coaches: text(row.coaches) || '1',
    vendors: text(row.vendors) || '1',
    annotations: text(row.annotations),
    room: text(row.room),
    costForLesson: text(row.cost_for_lesson),
    admissions,
    allowMultipleEntrancesSameDay: boolFromYesNo(row.allow_multiple_entrances_same_day),
    afterDailyAccessDecreaseSubsequent: boolFromYesNo(row.after_daccess_decrease_subsequent),
    maxLimitEnabled: boolFromYesNo(row.max_limit_status),
    maxLimitValue: text(row.max_limit_value),
    preventSubscriptionProcess: boolFromYesNo(row.subscription_process),
    enableLanesBooths: boolFromYesNo(row.enable_for_lanes_booths),
    lanes: parseLaneAvailability(row.availability_with_max_limit),
    afterExpireLaneDays: text(row.after_expire_lane_days),
    blockAccess: boolFromYesNo(row.block_access),
    decreaseSeason: boolFromYesNo(row.decrease_season),
    hideAccessControlData: boolFromYesNo(row.access_control_for_user),
    disableAccessVoiceMessage: boolFromYesNo(row.result_of_the_access_control),
    doNotStoreAccessData: boolFromYesNo(row.data_regarding_accesses),
    doNotStoreAllowedAccesses: boolFromYesNo(row.accesses_allow),
    doNotStoreDeniedAccesses: boolFromYesNo(row.accesses_not_allow),
    audioMessageEnabled: boolFromYesNo(row.audio_message_status),
    audioMessageStart: boolFromYesNo(row.audio_message_status) === true
      ? normalizeTypologyDateInput(text(row.audio_message_start))
      : '',
    audioMessageEnd: boolFromYesNo(row.audio_message_status) === true
      ? normalizeTypologyDateInput(text(row.audio_message_end))
      : '',
    song: text(row.song) || null,
    audioUrl: buildTypologyAudioUrl(row),
    popupMessageEnabled: boolFromYesNo(row.pop_up_status),
    popupMessageStart: text(row.pop_up_start),
    popupMessageEnd: text(row.pop_up_end),
    notice: text(row.notice),
    headerSize: text(row.header_size) || 'header_size-1',
    description: text(row.typology_description),
    enabledForBooking: boolFromYesNo(row.enabled_for_booking),
    mandatoryBooking: boolFromYesNo(row.mandatory_booking),
    selfBooking: boolFromYesNo(row.self_booking),
    selfSubscription: boolFromYesNo(row.self_subscription),
    paymentPostecipedOrCreditCard: boolFromYesNo(row.payment_posteciped_or_credit_card),
    payWithinDays: text(row.pay_within_days)
  };
}

function validateScalarFields(body: any, fieldErrors: Record<string, string>) {
  if (isBlank(body.areaActivity)) {
    fieldErrors.areaActivity = 'Please select an area activity.';
  }

  if (isBlank(body.activityName)) {
    fieldErrors.activityName = 'Please enter the activity name.';
  }

  if (text(body.color) && !/^#[0-9a-f]{6}$/i.test(text(body.color))) {
    fieldErrors.color = 'Please select a valid color.';
  }

  if (text(body.image) && !/^([A-Za-z0-9_.-]+|img\/typology_image\/[A-Za-z0-9_.-]+)$/.test(text(body.image))) {
    fieldErrors.image = 'Please select or upload a valid icon.';
  }

  if (!isNonNegativeNumberText(body.costForLesson)) {
    fieldErrors.costForLesson = 'Cost for lesson must be a valid number.';
  }

  if (!isIntegerText(body.maxLimitValue) || (yesNo(body.maxLimitEnabled) === 'Y' && isBlank(body.maxLimitValue))) {
    fieldErrors.maxLimitValue = 'Max limit must be a whole number.';
  }

  if (!isNonNegativeIntegerText(body.afterExpireLaneDays)) {
    fieldErrors.afterExpireLaneDays = 'Days must be a whole number from 0 to 30.';
  } else if (text(body.afterExpireLaneDays) && Number(body.afterExpireLaneDays) > 30) {
    fieldErrors.afterExpireLaneDays = 'Days cannot be greater than 30.';
  }

  if (yesNo(body.audioMessageEnabled) === 'Y') {
    if (!text(body.audioMessageStart)) {
      fieldErrors.audioMessageStart = 'Please enter a start date.';
    } else if (!isDateText(body.audioMessageStart)) {
      fieldErrors.audioMessageStart = 'Please enter a valid start date.';
    }
    if (!text(body.audioMessageEnd)) {
      fieldErrors.audioMessageEnd = 'Please enter an expiration date.';
    } else if (!isDateText(body.audioMessageEnd)) {
      fieldErrors.audioMessageEnd = 'Please enter a valid expiration date.';
    }
    if (
      text(body.audioMessageStart) &&
      text(body.audioMessageEnd) &&
      text(body.audioMessageEnd) < text(body.audioMessageStart)
    ) {
      fieldErrors.audioMessageEnd = 'Expiration date must be on or after the start date.';
    }
  }

  if (!isDateText(body.popupMessageStart)) {
    fieldErrors.popupMessageStart = 'Please enter a valid start date.';
  }
  if (!isDateText(body.popupMessageEnd)) {
    fieldErrors.popupMessageEnd = 'Please enter a valid expiration date.';
  }
  if (text(body.popupMessageStart) && text(body.popupMessageEnd) && text(body.popupMessageEnd) < text(body.popupMessageStart)) {
    fieldErrors.popupMessageEnd = 'Expiration date must be after the start date.';
  }

  if (!isNonNegativeIntegerText(body.payWithinDays)) {
    fieldErrors.payWithinDays = 'Payment days must be a whole number.';
  }
}

function validateAdmissions(body: any, fieldErrors: Record<string, string>) {
  const admissions = body.admissions && typeof body.admissions === 'object' ? body.admissions : {};
  const accessKeys = [
    'one',
    'three',
    'five',
    'seven',
    'ten',
    'twelve',
    'fifteen',
    'one_month',
    'two_month',
    'three_month',
    'six_month'
  ];

  for (const key of accessKeys) {
    const admission = admissions[key] ?? {};
    const enabled = yesNo(admission.enabled) === 'Y';
    if (enabled && isBlank(admission.price)) {
      fieldErrors[`admissions.${key}.price`] = 'Price is required.';
    } else if (!isNonNegativeNumberText(admission.price)) {
      fieldErrors[`admissions.${key}.price`] = 'Price must be a valid number.';
    }

    if (enabled && isBlank(admission.accesses)) {
      fieldErrors[`admissions.${key}.accesses`] = 'No. of accesses is required.';
    } else if (!isNonNegativeIntegerText(admission.accesses)) {
      fieldErrors[`admissions.${key}.accesses`] = 'No. of accesses must be a whole number.';
    }

    if (!isNonNegativeIntegerText(admission.daysToPay)) {
      fieldErrors[`admissions.${key}.daysToPay`] = 'Days to pay must be a whole number.';
    }
  }
}

function validateLanes(body: any, fieldErrors: Record<string, string>) {
  const lanes = Array.isArray(body.lanes) ? body.lanes : [];
  let selectedLaneCount = 0;

  lanes.forEach((lane: any, index: number) => {
    if (yesNo(lane?.available) === 'Y') selectedLaneCount += 1;

    if (yesNo(lane?.available) === 'Y' && isBlank(lane?.limit)) {
      fieldErrors[`lanes.${index}.limit`] = 'Required.';
    } else if (!isNonNegativeIntegerText(lane?.limit)) {
      fieldErrors[`lanes.${index}.limit`] = 'Use a whole number.';
    }
  });

  if (yesNo(body.enableLanesBooths) === 'Y' && selectedLaneCount === 0) {
    fieldErrors.enableLanesBooths = 'Select at least one available lane or booth.';
  }
}

async function hasDuplicateTypology(
  tableName: string,
  activityName: string,
  areaActivity: string,
  userIds: string[],
  clubId: string | null,
  excludeId?: string
): Promise<boolean> {
  const columns = await getTableColumns(tableName);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const clubFilter = clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
  const excludeFilter = excludeId ? ' AND id <> ?' : '';
  const rows = await prisma.$queryRawUnsafe<{ id: string | number }[]>(
    `SELECT id
     FROM \`${tableName}\`
     WHERE user_id IN (${userPlaceholders})
       ${clubFilter}
       ${excludeFilter}
       AND area_activity = ?
       AND LOWER(activity_name) = LOWER(?)
     LIMIT 1`,
    ...userIds,
    ...(clubFilter ? [clubId] : []),
    ...(excludeId ? [excludeId] : []),
    areaActivity,
    activityName
  );

  return rows.length > 0;
}

async function resolveCopyActivityName(
  baseName: string,
  areaActivity: string,
  tableName: string,
  userIds: string[],
  clubId: string | null
): Promise<string> {
  const trimmed = baseName.trim() || 'Untitled course';
  const root = trimmed.replace(/\s+copy(?:\s+\d+)?$/i, '').trim() || trimmed;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? `${root} copy` : `${root} copy ${attempt + 1}`;
    const duplicate = await hasDuplicateTypology(
      tableName,
      candidate,
      areaActivity,
      userIds,
      clubId
    );
    if (!duplicate) {
      return candidate;
    }
  }

  return `${root} copy ${Date.now()}`;
}

async function validateTypologyPayload(
  body: any,
  tableName: string,
  context: AuthorizedContext,
  excludeTypologyId?: string
): Promise<TypologyValidationResult> {
  const fieldErrors: Record<string, string> = {};
  validateScalarFields(body, fieldErrors);
  validateAdmissions(body, fieldErrors);
  validateLanes(body, fieldErrors);

  const areaActivity = await resolveAreaActivity(body.areaActivity, context.userIds, context.club?.id ?? null);
  if (!areaActivity) {
    fieldErrors.areaActivity = 'Please select a valid area activity.';
  }

  const activityName = text(body.activityName);
  if (areaActivity && activityName && await hasDuplicateTypology(
    tableName,
    activityName,
    areaActivity,
    context.userIds,
    context.club?.id ?? null,
    excludeTypologyId
  )) {
    fieldErrors.activityName = 'This activity already exists in the selected area.';
  }

  return { fieldErrors, areaActivity };
}

async function insertTypology(tableName: string, body: any, userIds: string[], clubId: string | null, areaActivity: string) {
  const columns = await getTableColumns(tableName);
  const userId = userIds[userIds.length - 1] ?? '';
  const values: Record<string, unknown> = {
    user_id: userId,
    club_id: clubId,
    ...buildTypologyValues(body, areaActivity)
  };

  const insertColumns = Object.keys(values).filter((column) => columns.has(column));
  const params = insertColumns.map((column) => values[column]);
  const placeholders = insertColumns.map(() => '?').join(', ');

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${tableName}\`
       (${insertColumns.map((column) => `\`${column}\``).join(', ')})
     VALUES (${placeholders})`,
    ...params
  );

  const idRows = await prisma.$queryRawUnsafe<{ id: bigint | number | string }[]>(
    'SELECT LAST_INSERT_ID() AS id'
  );

  return idRows[0]?.id != null ? String(idRows[0].id) : null;
}

async function updateTypology(
  tableName: string,
  id: string,
  body: any,
  userIds: string[],
  areaActivity: string
): Promise<boolean> {
  const columns = await getTableColumns(tableName);
  const values = buildTypologyValues(body, areaActivity);
  const updateColumns = Object.keys(values).filter((column) => columns.has(column));

  if (updateColumns.length === 0) {
    return false;
  }

  const userPlaceholders = userIds.map(() => '?').join(',');
  await prisma.$executeRawUnsafe(
    `UPDATE \`${tableName}\`
     SET ${updateColumns.map((column) => `\`${column}\` = ?`).join(', ')}
     WHERE id = ?
       AND user_id IN (${userPlaceholders})`,
    ...updateColumns.map((column) => values[column]),
    id,
    ...userIds
  );

  return true;
}

async function fetchTypologyRowById(
  id: string,
  userIds: string[],
  clubId: string | null
): Promise<Record<string, unknown> | null> {
  if (id.startsWith('local-')) {
    return null;
  }

  const typologyTable = await getTypologyTableForRead();
  const userPlaceholders = userIds.map(() => '?').join(',');
  const columns = await getTableColumns(typologyTable);

  const queryTypology = async (withClubFilter: boolean) => {
    const filter = withClubFilter && clubId && columns.has('club_id') ? ' AND club_id = ?' : '';
    return prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT *
       FROM \`${typologyTable}\`
       WHERE id = ?
         AND user_id IN (${userPlaceholders})
         ${filter}
       LIMIT 1`,
      id,
      ...userIds,
      ...(filter ? [clubId] : [])
    );
  };

  const clubRows = clubId ? await queryTypology(true) : [];
  const rows = clubRows.length > 0 ? clubRows : await queryTypology(false);

  return rows[0] ?? null;
}

async function getLegacyUserId(userId: string): Promise<string | null> {
  const fromId = userId.match(/^legacy_(\d+)(?:_|$)/);
  if (fromId?.[1]) return fromId[1];

  const mappingTable = await findExistingTable(['legacy_id_mappings']);
  if (!mappingTable) return null;

  const rows = await prisma.$queryRawUnsafe<{ legacy_id: number | string }[]>(
    `SELECT legacy_id
     FROM \`${mappingTable}\`
     WHERE new_id = ?
       AND legacy_table = 'users'
     ORDER BY legacy_id DESC
     LIMIT 1`,
    userId
  );

  return rows[0]?.legacy_id != null ? String(rows[0].legacy_id) : null;
}

async function getOwnedClub(userId: string, requestedClubId: string | null) {
  if (requestedClubId) {
    const selected = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM clubs_new
      WHERE id = ${requestedClubId}
        AND adminId = ${userId}
      LIMIT 1
    `;
    if (selected[0]) return selected[0];
  }

  const fallback = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name
    FROM clubs_new
    WHERE adminId = ${userId}
    ORDER BY createdAt DESC
    LIMIT 1
  `;

  return fallback[0] ?? null;
}

function normalizeLegacyRow(row: LegacyTypologyRow): TypologyRow {
  const userId = row.userId != null ? String(row.userId) : '';
  const song = row.song?.trim();
  const limitEnabled = yesNo(row.limitStatus, 'Y') === 'Y';

  return {
    id: String(row.id),
    area: row.area?.trim() || 'Unassigned',
    blockAccess: yesNo(row.blockAccess) === 'Y',
    image: row.image?.trim() || 'Cat_1.png',
    activityName: row.activityName?.trim() || 'Untitled course',
    room: row.room != null ? String(row.room) : '',
    cost: row.cost != null ? String(row.cost) : '',
    limit: limitEnabled && row.limitValue != null ? String(row.limitValue) : '',
    limitEnabled,
    audioUrl: song ? `/subscription_file/playlist/User_${userId}/${song}` : null,
    isDefault: yesNo(row.isDefault) === 'Y'
  };
}

function extractBookingSettings(rows: LegacyTypologyRow[]): BookingSettings {
  const row = rows.find((item) =>
    item.applyCourseSetting != null ||
    item.applyTemporarySetting != null ||
    item.confirmationOption != null ||
    item.selfBook != null ||
    item.authorizeExpired != null
  );

  if (!row) return DEFAULT_BOOKING_SETTINGS;

  return {
    applyCourseSetting: yesNo(row.applyCourseSetting, 'Y'),
    applyTemporarySetting: yesNo(row.applyTemporarySetting),
    confirmationOption: normalizeConfirmation(row.confirmationOption),
    selfBook: yesNo(row.selfBook),
    authorizeExpired: yesNo(row.authorizeExpired)
  };
}

async function fetchLegacyRows(userIds: string[], clubId: string | null) {
  const typologyTable = await getTypologyTableForRead();
  const areaTable = await findExistingTable(AREA_TABLE_CANDIDATES);
  const defaultTable = await findExistingTable(DEFAULT_TABLE_CANDIDATES);
  const userPlaceholders = userIds.map(() => '?').join(',');
  const areaSelect = areaTable ? 'COALESCE(a.area, t.area_activity) AS area' : 't.area_activity AS area';
  const areaJoin = areaTable ? `LEFT JOIN \`${areaTable}\` a ON a.id = t.area_activity` : '';
  const defaultSelect = defaultTable ? `CASE WHEN d.id IS NULL THEN 'N' ELSE 'Y' END AS isDefault` : `'N' AS isDefault`;
  const defaultJoin = defaultTable ? `LEFT JOIN \`${defaultTable}\` d ON d.club_setting_subscription_typology_id = t.id` : '';

  const selectSql = `
    SELECT
      t.id AS id,
      t.user_id AS userId,
      ${areaSelect},
      COALESCE(t.block_access, 'N') AS blockAccess,
      COALESCE(t.image, 'Cat_1.png') AS image,
      COALESCE(t.activity_name, '') AS activityName,
      COALESCE(t.room, '') AS room,
      COALESCE(t.cost_for_lesson, '') AS cost,
      COALESCE(t.max_limit_value, '') AS limitValue,
      COALESCE(t.max_limit_status, 'Y') AS limitStatus,
      COALESCE(t.song, '') AS song,
      ${defaultSelect},
      COALESCE(t.apply_course_setting, 'Y') AS applyCourseSetting,
      COALESCE(t.apply_temporary_setting, 'N') AS applyTemporarySetting,
      COALESCE(t.confirmation_option, 'no') AS confirmationOption,
      COALESCE(t.self_book, 'N') AS selfBook,
      COALESCE(t.authorize_expired, 'N') AS authorizeExpired
    FROM \`${typologyTable}\` t
    ${areaJoin}
    ${defaultJoin}
    WHERE t.user_id IN (${userPlaceholders})
  `;

  const orderedSql = ' ORDER BY t.id DESC';
  const clubRows = clubId
    ? await prisma.$queryRawUnsafe<LegacyTypologyRow[]>(
        `${selectSql} AND t.club_id = ?${orderedSql}`,
        ...userIds,
        clubId
      )
    : [];

  const rows = clubRows.length > 0
    ? clubRows
    : await prisma.$queryRawUnsafe<LegacyTypologyRow[]>(
        `${selectSql}${orderedSql}`,
        ...userIds
      );

  return {
    rows,
    bookingSettings: extractBookingSettings(rows)
  };
}

async function getAuthorizedContext(request: NextRequest) {
  const decoded = getTokenPayload(request);
  if (!decoded?.userId || !decoded.userType) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!isClubAccountUserType(String(decoded.userType))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const userId = String(decoded.userId);
  const requestedClubId = request.nextUrl.searchParams.get('clubId');
  const club = await getOwnedClub(userId, requestedClubId);
  const legacyUserId = await getLegacyUserId(userId);
  const userIds = Array.from(new Set([userId, legacyUserId].filter(Boolean) as string[]));

  return { userId, club, userIds };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const areas = await fetchAreaOptions(context.userIds, context.club?.id ?? null);
    const typologyId = request.nextUrl.searchParams.get('id');

    if (typologyId) {
      const row = await fetchTypologyRowById(typologyId, context.userIds, context.club?.id ?? null);
      if (!row) {
        return NextResponse.json({ error: 'Typology not found' }, { status: 404 });
      }

      const typology = mapDbRowToTypologyForm(row);
      const lanesForDays = await fetchLanesForDays(typologyId);

      return NextResponse.json({
        club: context.club,
        areas,
        typology: { ...typology, lanesForDays },
        source: 'database'
      });
    }

    await normalizeTypologyAreaReferences(context.userIds, context.club?.id ?? null);
    const legacy = await fetchLegacyRows(context.userIds, context.club?.id ?? null);
    const items = legacy.rows.map(normalizeLegacyRow);

    return NextResponse.json({
      club: context.club,
      items,
      areas,
      bookingSettings: legacy.bookingSettings,
      source: 'database'
    });
  } catch (error) {
    console.error('GET /api/club/settings/typology-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const body = await request.json();
    const id = String(body.id ?? '');
    const action = String(body.action ?? '');

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing action or id' }, { status: 400 });
    }

    const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
    if (!typologyTable || id.startsWith('local-')) {
      return NextResponse.json({ success: true, persisted: false });
    }

    const userPlaceholders = context.userIds.map(() => '?').join(',');

    if (action === 'block') {
      await prisma.$executeRawUnsafe(
        `UPDATE \`${typologyTable}\`
         SET block_access = ?
         WHERE id = ?
           AND user_id IN (${userPlaceholders})`,
        body.blockAccess ? 'Y' : 'N',
        id,
        ...context.userIds
      );
      return NextResponse.json({ success: true, persisted: true });
    }

    if (action === 'default') {
      const defaultTable = await findExistingTable(DEFAULT_TABLE_CANDIDATES);
      if (!defaultTable) {
        return NextResponse.json({ success: true, persisted: false });
      }

      const userId = context.userIds[context.userIds.length - 1];
      const clubId = context.club?.id ?? '';

      await prisma.$executeRawUnsafe(
        `DELETE FROM \`${defaultTable}\`
         WHERE user_id IN (${userPlaceholders})
           AND club_id = ?`,
        ...context.userIds,
        clubId
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`${defaultTable}\`
           (club_id, user_id, club_setting_subscription_typology_id)
         VALUES (?, ?, ?)`,
        clubId,
        userId,
        id
      );

      return NextResponse.json({ success: true, persisted: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/club/settings/typology-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const body = await request.json();
    if (body.action === 'create-typology') {
      const typologyTable = await getTypologyTableForWrite();
      const validation = await validateTypologyPayload(body, typologyTable, context);
      if (Object.keys(validation.fieldErrors).length > 0 || !validation.areaActivity) {
        return NextResponse.json({
          error: 'Validation failed',
          fieldErrors: validation.fieldErrors
        }, { status: 400 });
      }

      const id = await insertTypology(
        typologyTable,
        body,
        context.userIds,
        context.club?.id ?? null,
        validation.areaActivity
      );

      if (Array.isArray(body.lanesForDays) && Array.isArray(body.lanes)) {
        await saveLanesForDays(String(id), body.lanesForDays, body.lanes);
      }

      return NextResponse.json({ success: true, persisted: true, id });
    }

    if (body.action === 'copy-typology') {
      const sourceId = String(body.sourceId ?? body.id ?? '');
      if (!sourceId || sourceId.startsWith('local-')) {
        return NextResponse.json({ error: 'Invalid typology id' }, { status: 400 });
      }

      const sourceRow = await fetchTypologyRowById(
        sourceId,
        context.userIds,
        context.club?.id ?? null
      );
      if (!sourceRow) {
        return NextResponse.json({ error: 'Typology not found' }, { status: 404 });
      }

      const typologyTable = await getTypologyTableForWrite();
      const formPayload = mapDbRowToTypologyForm(sourceRow);
      const lanesForDays = await fetchLanesForDays(sourceId);

      const areaActivity = await resolveAreaActivity(
        formPayload.areaActivity,
        context.userIds,
        context.club?.id ?? null
      );
      if (!areaActivity) {
        return NextResponse.json({ error: 'Invalid area activity for this typology.' }, { status: 400 });
      }

      const activityName = await resolveCopyActivityName(
        formPayload.activityName,
        areaActivity,
        typologyTable,
        context.userIds,
        context.club?.id ?? null
      );

      const copyBody = {
        ...formPayload,
        activityName,
        lanesForDays
      };

      const validation = await validateTypologyPayload(copyBody, typologyTable, context);
      if (Object.keys(validation.fieldErrors).length > 0) {
        return NextResponse.json({
          error: 'Validation failed',
          fieldErrors: validation.fieldErrors
        }, { status: 400 });
      }

      const newId = await insertTypology(
        typologyTable,
        copyBody,
        context.userIds,
        context.club?.id ?? null,
        areaActivity
      );

      if (!newId) {
        return NextResponse.json({ error: 'Unable to create typology copy.' }, { status: 500 });
      }

      if (Array.isArray(copyBody.lanes)) {
        await saveLanesForDays(newId, lanesForDays, copyBody.lanes);
      }

      return NextResponse.json({
        success: true,
        persisted: true,
        id: newId,
        activityName
      });
    }

    if (body.action === 'update-typology') {
      const typologyId = String(body.id ?? '');
      if (!typologyId || typologyId.startsWith('local-')) {
        return NextResponse.json({ error: 'Invalid typology id' }, { status: 400 });
      }

      const typologyTable = await getTypologyTableForWrite();
      const existing = await fetchTypologyRowById(typologyId, context.userIds, context.club?.id ?? null);
      if (!existing) {
        return NextResponse.json({ error: 'Typology not found' }, { status: 404 });
      }

      const validation = await validateTypologyPayload(body, typologyTable, context, typologyId);
      if (Object.keys(validation.fieldErrors).length > 0 || !validation.areaActivity) {
        return NextResponse.json({
          error: 'Validation failed',
          fieldErrors: validation.fieldErrors
        }, { status: 400 });
      }

      const persisted = await updateTypology(
        typologyTable,
        typologyId,
        body,
        context.userIds,
        validation.areaActivity
      );

      if (Array.isArray(body.lanesForDays) && Array.isArray(body.lanes)) {
        await saveLanesForDays(typologyId, body.lanesForDays, body.lanes);
      }

      return NextResponse.json({ success: true, persisted, id: typologyId });
    }

    if (body.action === 'save-lanes-for-days') {
      const typologyId = String(body.id ?? '');
      if (!typologyId || typologyId.startsWith('local-')) {
        return NextResponse.json({ error: 'Invalid typology id' }, { status: 400 });
      }

      const typologyTable = await getTypologyTableForWrite();
      const existing = await fetchTypologyRowById(typologyId, context.userIds, context.club?.id ?? null);
      if (!existing) {
        return NextResponse.json({ error: 'Typology not found' }, { status: 404 });
      }

      if (!Array.isArray(body.lanesForDays) || !Array.isArray(body.lanes)) {
        return NextResponse.json({ error: 'lanesForDays and lanes are required' }, { status: 400 });
      }

      const lanesPersisted = await saveLanesForDays(typologyId, body.lanesForDays, body.lanes);
      const mergedForm = {
        ...mapDbRowToTypologyForm(existing),
        lanes: body.lanes,
        enableLanesBooths:
          typeof body.enableLanesBooths === 'boolean' ? body.enableLanesBooths : true
      };
      const laneGridPersisted = await updateTypology(
        typologyTable,
        typologyId,
        mergedForm,
        context.userIds,
        text(existing.area_activity)
      );

      return NextResponse.json({
        success: true,
        persisted: lanesPersisted && laneGridPersisted
      });
    }

    if (body.action !== 'booking-settings') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
    if (!typologyTable) {
      return NextResponse.json({ success: true, persisted: false });
    }

    const applyCourseSetting = yesNo(body.applyCourseSetting, 'Y');
    const applyTemporarySetting = applyCourseSetting === 'Y' ? 'N' : yesNo(body.applyTemporarySetting);
    const confirmationOption = applyCourseSetting === 'Y'
      ? 'no'
      : normalizeConfirmation(body.confirmationOption);
    const allowDifferentInstructor = confirmationOption === 'no' ? 'N' : 'Y';
    const userPlaceholders = context.userIds.map(() => '?').join(',');
    const columns = await getTableColumns(typologyTable);
    const bookingValues: Record<string, unknown> = {
      apply_course_setting: applyCourseSetting,
      apply_temporary_setting: applyTemporarySetting,
      confirmation_option: confirmationOption,
      allow_different_instructor: allowDifferentInstructor,
      self_book: yesNo(body.selfBook),
      authorize_expired: yesNo(body.authorizeExpired)
    };
    const updateColumns = Object.keys(bookingValues).filter((column) => columns.has(column));

    if (updateColumns.length === 0) {
      return NextResponse.json({ success: true, persisted: false });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE \`${typologyTable}\`
       SET ${updateColumns.map((column) => `\`${column}\` = ?`).join(', ')}
       WHERE user_id IN (${userPlaceholders})`,
      ...updateColumns.map((column) => bookingValues[column]),
      ...context.userIds
    );

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error('POST /api/club/settings/typology-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    if ('error' in context) return context.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const typologyTable = await findExistingTable(TYPOLOGY_TABLE_CANDIDATES);
    if (!typologyTable || id.startsWith('local-')) {
      return NextResponse.json({ success: true, persisted: false });
    }

    const userPlaceholders = context.userIds.map(() => '?').join(',');
    await prisma.$executeRawUnsafe(
      `DELETE FROM \`${typologyTable}\`
       WHERE id = ?
         AND user_id IN (${userPlaceholders})`,
      id,
      ...context.userIds
    );

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error('DELETE /api/club/settings/typology-subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
