import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSiteOrigin } from '@/lib/siteUrl';
import { getWorkspaceCurrency } from '@/lib/club/clubCurrency.server';
import {
  createEventDeadline,
  createEventPayLink,
  emailEventPayLink,
  eventDeadlineStates,
  eventsOnlineProviders,
  newConfirmToken,
  sendEventRegistrationEmail,
  subscriberLanguage,
  workspaceName,
} from '@/lib/club/events/eventSubscriptionPayments';
import {
  ensureClubEventTables,
  getClubEvent,
  getClubEventByToken,
  getEventSettings,
  eventMediaUrl,
  ClubEventError,
} from '@/lib/club/events/eventService';
import {
  eventAvailability,
  payChoicesFor,
  todayYmd,
  type EventPayChoice,
  type ClubEvent,
  type ClubEventRegistration,
  type ClubEventWorkspace,
} from '@/lib/club/events/eventConstants';

function str(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export type RegisterEventInput = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  sex?: string;
  birthCountry?: string;
  birthLocality?: string;
  foreignIdCode?: string;
  email: string;
  phone?: string;
  fiscalCode?: string;
  birthdate?: string;
  address?: string;
  city?: string;
  province?: string;
  zip?: string;
  isMinor?: boolean;
  parentName?: string;
  parentFiscalCode?: string;
  notes?: string;
  groupOrTeamName?: string;
  isMember?: boolean;
  memberUserId?: string | null;
  selectedMainEvent?: boolean;
  selectedSubeventIds?: string[];
  selectedServiceIds?: string[];
  textAnswers?: Record<string, boolean | string>;
  /** Files uploaded beforehand (see storeRegistrationTextFile), per additional text id. */
  textFiles?: Record<string, { name?: string; path?: string }>;
  relativeName?: string;
  relativeFiscalCode?: string;
  payMode?: string;
  /** How the subscriber pays (must be allowed by the event payment modality). */
  payChoice?: EventPayChoice;
  /** Online provider picked on the form (stripe / paypal). */
  provider?: string;
  /** Browser language, used for the emails of non-members. */
  language?: string;
};

export type RegisterEventResult = {
  registration: ClubEventRegistration;
  event: ClubEvent;
  /** Redirect here to pay online now. */
  payUrl: string | null;
  /** Confirmation email requested (status Not confirmed until the link is clicked). */
  confirmationRequired: boolean;
  payLinkEmailed: boolean;
};

const TEXT_FILE_PATH = /^\/uploads\/club_events\/[a-f0-9]{32}\.[a-z]{3,4}$/;

function parseTextFiles(raw: unknown): Record<string, { name: string; path: string }> {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw || '{}');
    } catch {
      value = {};
    }
  }
  const out: Record<string, { name: string; path: string }> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [id, f] of Object.entries(value as Record<string, { name?: unknown; path?: unknown }>)) {
    const path = String(f?.path || '');
    if (!TEXT_FILE_PATH.test(path)) continue;
    out[str(id, 191)] = { name: str(f?.name || path.split('/').pop(), 191), path };
  }
  return out;
}

function mapReg(row: Record<string, unknown>): ClubEventRegistration {
  let selectedSubeventIds: string[] = [];
  let selectedServiceIds: string[] = [];
  let textAnswers: Record<string, boolean | string> = {};
  try {
    selectedSubeventIds = JSON.parse(String(row.selected_subevent_ids || '[]')) as string[];
  } catch {
    selectedSubeventIds = [];
  }
  try {
    selectedServiceIds = JSON.parse(String(row.selected_service_ids || '[]')) as string[];
  } catch {
    selectedServiceIds = [];
  }
  try {
    textAnswers = JSON.parse(String(row.text_answers_json || '{}')) as Record<string, boolean | string>;
  } catch {
    textAnswers = {};
  }
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    fullName: String(row.full_name || ''),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    sex: String(row.sex || ''),
    birthCountry: String(row.birth_country || ''),
    birthLocality: String(row.birth_locality || ''),
    foreignIdCode: String(row.foreign_id_code || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    fiscalCode: String(row.fiscal_code || ''),
    birthdate: String(row.birthdate || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    province: String(row.province || ''),
    zip: String(row.zip || ''),
    isMinor: bool(row.is_minor),
    parentName: String(row.parent_name || ''),
    parentFiscalCode: String(row.parent_fiscal_code || ''),
    notes: String(row.notes || ''),
    groupOrTeamName: String(row.group_or_team_name || ''),
    memberUserId: row.member_user_id ? String(row.member_user_id) : null,
    isMember: bool(row.is_member),
    relativeName: String(row.relative_name || ''),
    relativeFiscalCode: String(row.relative_fiscal_code || ''),
    selectedMainEvent: bool(row.selected_main_event),
    selectedSubeventIds,
    selectedServiceIds,
    textAnswers,
    fileUrl: null,
    textFiles: Object.fromEntries(
      Object.entries(parseTextFiles(row.text_files_json)).map(([id, f]) => [
        id,
        { name: f.name, url: eventMediaUrl(f.path) || f.path },
      ]),
    ),
    amountGross: num(row.amount_gross),
    discountPercent: num(row.discount_percent),
    ...legacyAmounts(row),
    currency: String(row.currency || 'EUR'),
    payMode: String(row.pay_mode || ''),
    status: (String(row.status || 'confirmed') as ClubEventRegistration['status']) || 'confirmed',
    confirmedAt: row.confirmed_at ? new Date(String(row.confirmed_at)).toISOString() : null,
    receiptNumber: row.receipt_number ? String(row.receipt_number) : null,
    procedureRecordId: row.procedure_record_id ? String(row.procedure_record_id) : null,
    deadlineDate: null,
    invoiceNumbers: row.receipt_number ? String(row.receipt_number) : '',
  };
}

/** Subscriptions saved before deadlines existed stored the total in amount_paid as already paid. */
function legacyAmounts(row: Record<string, unknown>): { amountDue: number; amountPaid: number; balance: number } {
  if (row.amount_due == null) {
    const paid = num(row.amount_paid);
    return { amountDue: paid, amountPaid: paid, balance: 0 };
  }
  const due = num(row.amount_due);
  const paid = num(row.amount_paid);
  return { amountDue: due, amountPaid: paid, balance: Math.max(0, round2(due - paid)) };
}

/** Paid / rest / deadline date / receipts from the subscription deadlines. */
export async function withDeadlineState(regs: ClubEventRegistration[]): Promise<ClubEventRegistration[]> {
  const states = await eventDeadlineStates(regs.map((r) => r.procedureRecordId || ''));
  return regs.map((r) => {
    const s = r.procedureRecordId ? states.get(r.procedureRecordId) : undefined;
    if (!s) return r;
    return {
      ...r,
      amountDue: s.total,
      amountPaid: s.paid,
      balance: s.balance,
      deadlineDate: s.dueDate,
      invoiceNumbers: s.invoiceNumbers || r.invoiceNumbers,
    };
  });
}

/** All subscriptions of the club / team events (Archive of Events totals). */
export async function listWorkspaceRegistrations(ws: ClubEventWorkspace): Promise<ClubEventRegistration[]> {
  await ensureClubEventTables();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT r.* FROM org_club_event_registrations r
     INNER JOIN org_club_events e ON e.id = r.event_id
     WHERE e.workspace_kind = ? AND e.workspace_id = ? AND r.status <> 'cancelled'`,
    ws.kind,
    ws.id,
  );
  return withDeadlineState(rows.map(mapReg));
}

export async function listEventRegistrations(
  ws: ClubEventWorkspace,
  eventId: string,
): Promise<ClubEventRegistration[]> {
  const event = await getClubEvent(ws, eventId);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM org_club_event_registrations WHERE event_id = ? ORDER BY created_at DESC`,
    event.id,
  );
  const regs = await withDeadlineState(rows.map(mapReg));
  const userIds = [...new Set(regs.map((r) => r.memberUserId).filter((id): id is string => Boolean(id)))];
  let current = new Set<string>();
  if (userIds.length) {
    const linked =
      ws.kind === 'club'
        ? await prisma.clubMember.findMany({
            where: { clubId: ws.id, memberId: { in: userIds } },
            select: { memberId: true },
          }).then((list) => list.map((m) => m.memberId))
        : await prisma.teamMember.findMany({
            where: { teamId: ws.id, athleteId: { in: userIds } },
            select: { athleteId: true },
          }).then((list) => list.map((m) => m.athleteId));
    current = new Set(linked);
  }
  const wsParam = ws.kind === 'team' ? 'teamId' : 'clubId';
  return regs.map((r) => {
    if (!r.memberUserId || !current.has(r.memberUserId)) return r;
    return {
      ...r,
      isMember: true,
      profilePath: `/clubMembers/memberProfile/${encodeURIComponent(r.memberUserId)}?${wsParam}=${encodeURIComponent(ws.id)}&mode=edit`,
    };
  });
}

export type EventMemberLookup = {
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fiscalCode: string;
  birthdate: string;
  address: string;
  city: string;
  province: string;
  zip: string;
  /** 'M' | 'F' | '' */
  sex: string;
  birthCountry: string;
  birthLocality: string;
  foreignIdCode: boolean;
  archived: boolean;
};

type LookupUser = {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  surname: string | null;
  birthdate: Date | null;
  gender?: string | null;
};

const LOOKUP_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  surname: true,
  birthdate: true,
  gender: true,
} as const;

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function text(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function sexCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (['m', 'male', 'maschio', 'uomo', 'man'].includes(v)) return 'M';
  if (['f', 'female', 'femmina', 'donna', 'woman'].includes(v)) return 'F';
  return '';
}

/**
 * Member data from the shared owner profile (user_profile_extras.ownerJson, where the member profile
 * editor saves fiscal code, contacts and birth data), with the legacy club profile JSON as fallback.
 */
function memberFromProfile(ownerJson: string | null, legacyJson: string | null, u: LookupUser): EventMemberLookup {
  const owner = parseJson(ownerJson);
  const legacy = parseJson(legacyJson);
  const address = obj(owner.address);
  const personal = obj(owner.personal);
  const admin = obj(owner.administrative);
  const login = obj(owner.login);
  const firstName = text(u.firstName, login.firstName);
  const lastName = text(u.surname, login.lastName);
  return {
    userId: u.id,
    fullName: `${lastName} ${firstName}`.trim() || u.name || '',
    firstName,
    lastName,
    email: text(u.email, login.email),
    phone: text(address.mobile1, address.phone, address.mobile2, legacy.phone, legacy.phone1),
    fiscalCode: text(admin.fiscalCode, legacy.fiscalCode, legacy.fiscal_code, legacy.taxCode).toUpperCase(),
    birthdate: u.birthdate ? u.birthdate.toISOString().slice(0, 10) : text(personal.dateOfBirth).slice(0, 10),
    address: text(address.address, legacy.address),
    city: text(address.city, legacy.city),
    province: text(address.province, legacy.province),
    zip: text(address.zipCode, legacy.zip, legacy.zipCode),
    sex: sexCode(text(u.gender, personal.gender)),
    birthCountry: text(personal.countryOfBirth),
    birthLocality: text(personal.locationOfBirth),
    foreignIdCode: admin.foreignerIdCode === true,
    archived: false,
  };
}

/** Current members of the club / team: user id → legacy club profile JSON (club only). */
async function workspaceMembers(ws: ClubEventWorkspace): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (ws.kind === 'club') {
    const rows = await prisma.clubMember.findMany({
      where: { clubId: ws.id },
      select: { memberId: true, profile: { select: { profileJson: true } } },
    });
    for (const r of rows) out.set(r.memberId, r.profile?.profileJson ?? null);
  } else {
    const rows = await prisma.teamMember.findMany({ where: { teamId: ws.id }, select: { athleteId: true } });
    for (const r of rows) out.set(r.athleteId, null);
  }
  return out;
}

async function ownerJsonOf(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  const rows = await prisma.$queryRawUnsafe<Array<{ userId: string; ownerJson: string | null }>>(
    `SELECT userId, ownerJson FROM user_profile_extras WHERE userId IN (${userIds.map(() => '?').join(',')})`,
    ...userIds,
  );
  for (const r of rows) out.set(r.userId, r.ownerJson || '');
  return out;
}

/** Look up a current club / team member by fiscal code. */
export async function findMemberByFiscalCode(
  ws: ClubEventWorkspace,
  fiscalCode: string,
): Promise<EventMemberLookup | null> {
  const code = str(fiscalCode, 32).toUpperCase().replace(/\s+/g, '');
  if (code.length < 6) return null;
  const members = await workspaceMembers(ws);
  const ids = [...members.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const owners = await ownerJsonOf(chunk);
    const candidates = chunk.filter((id) => {
      const blob = `${owners.get(id) || ''} ${members.get(id) || ''}`.toUpperCase();
      return blob.includes(code);
    });
    if (!candidates.length) continue;
    const users = await prisma.user.findMany({ where: { id: { in: candidates } }, select: LOOKUP_USER_SELECT });
    for (const u of users) {
      const m = memberFromProfile(owners.get(u.id) ?? null, members.get(u.id) ?? null, u);
      if (m.fiscalCode.replace(/\s+/g, '') === code) return m;
    }
  }
  return null;
}

/** Recognize a member with username/email + password (current club membership). */
export async function findMemberByCredentials(
  ws: ClubEventWorkspace,
  username: string,
  password: string,
): Promise<EventMemberLookup | null> {
  const ident = str(username, 191);
  const pass = String(password || '');
  if (!ident || !pass) return null;

  const { verifyPassword } = await import('@/lib/auth');
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: ident }, { username: ident }, { name: ident }],
    },
    select: { ...LOOKUP_USER_SELECT, password: true },
  });
  if (!user?.password || !(await verifyPassword(pass, user.password))) return null;

  const members = await workspaceMembers(ws);
  if (!members.has(user.id)) return null;
  const owners = await ownerJsonOf([user.id]);
  return memberFromProfile(owners.get(user.id) ?? null, members.get(user.id) ?? null, user);
}

/** userId when it belongs to a current member of the club / team, else null. */
async function currentMemberId(ws: ClubEventWorkspace, userId: string): Promise<string | null> {
  const found =
    ws.kind === 'club'
      ? await prisma.clubMember.findFirst({ where: { clubId: ws.id, memberId: userId }, select: { id: true } })
      : await prisma.teamMember.findFirst({ where: { teamId: ws.id, athleteId: userId }, select: { id: true } });
  return found ? userId : null;
}

export type EventAmounts = {
  gross: number;
  /** Discount applied to the event / sub-events part. */
  discountPercent: number;
  paid: number;
  relativeDiscountApplied: boolean;
  /** Multi sub-event rule that applies (null = none). */
  appliedRule: { minSubevents: number; discountPercent: number } | null;
  /** Event + sub-events selected (counted by the multi sub-event rules). */
  selectedCount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nameWords(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function canClaimRelativeDiscount(event: ClubEvent, input: RegisterEventInput): boolean {
  const d = event.siblingDiscount;
  if (!d.enabled || d.percent <= 0) return false;
  return Boolean(input.isMember || input.memberUserId) || d.applyToNonMembers;
}

/** True when a relative with this fiscal code (and matching name) is already subscribed to the event. */
async function relativeIsSubscribed(event: ClubEvent, input: RegisterEventInput): Promise<boolean> {
  if (!canClaimRelativeDiscount(event, input)) return false;
  const code = str(input.relativeFiscalCode, 32).toUpperCase();
  const words = nameWords(str(input.relativeName, 191));
  if (code.length < 6 || !words.length) return false;
  const rows = await prisma.$queryRawUnsafe<Array<{ full_name: string }>>(
    `SELECT full_name FROM org_club_event_registrations
     WHERE event_id = ? AND UPPER(fiscal_code) = ? AND status <> 'cancelled'`,
    event.id,
    code,
  );
  return rows.some((r) => {
    const full = nameWords(r.full_name || '');
    return words.every((w) => full.includes(w));
  });
}

function computeAmounts(
  event: ClubEvent,
  input: RegisterEventInput,
  discountRules: Array<{ minSubevents: number; discountPercent: number }>,
  relativeOk: boolean,
): EventAmounts {
  const selectedMain = input.selectedMainEvent !== false;
  const subIds = input.selectedSubeventIds || [];
  const serviceIds = input.selectedServiceIds || [];

  let eventPart = selectedMain ? event.cost : 0;
  for (const sub of event.subevents) {
    if (subIds.includes(sub.id)) eventPart += sub.cost;
  }
  let servicesPart = 0;
  for (const svc of event.services) {
    if (serviceIds.includes(svc.id)) servicesPart += svc.price;
  }

  let rulePercent = 0;
  let appliedRule: EventAmounts['appliedRule'] = null;
  const selectedCount = (selectedMain ? 1 : 0) + subIds.length;
  for (const rule of [...discountRules].sort((a, b) => b.minSubevents - a.minSubevents)) {
    if (selectedCount >= rule.minSubevents) {
      rulePercent = rule.discountPercent;
      appliedRule = { minSubevents: rule.minSubevents, discountPercent: rule.discountPercent };
      break;
    }
  }
  const relativePercent = relativeOk ? event.siblingDiscount.percent : 0;
  const eventPercent = Math.max(rulePercent, relativePercent);
  const paid = Math.max(
    0,
    round2(eventPart * (1 - eventPercent / 100) + servicesPart * (1 - rulePercent / 100)),
  );
  return {
    gross: round2(eventPart + servicesPart),
    discountPercent: eventPercent,
    paid,
    relativeDiscountApplied: relativePercent > 0 && relativePercent >= rulePercent,
    appliedRule,
    selectedCount,
  };
}

/** Live total for the subscription form (same rules as registerForEvent). */
export async function quoteEventRegistration(
  token: string,
  input: RegisterEventInput,
): Promise<EventAmounts & { relativeFound: boolean }> {
  const event = await getClubEventByToken(token);
  if (!event || event.hideFromShare) throw new ClubEventError('Event not found', 404);
  const ws: ClubEventWorkspace = {
    kind: event.workspaceKind === 'team' ? 'team' : 'club',
    id: event.workspaceId,
  };
  const { discountRules } = await getEventSettings(ws);
  const relativeFound = await relativeIsSubscribed(event, input);
  return { ...computeAmounts(event, input, discountRules, relativeFound), relativeFound };
}

export async function registerForEvent(
  token: string,
  input: RegisterEventInput,
  opts: { origin?: string } = {},
): Promise<RegisterEventResult> {
  await ensureClubEventTables();
  const event = await getClubEventByToken(token);
  if (!event) throw new ClubEventError('Event not found', 404);
  if (event.hideFromShare) throw new ClubEventError('This event is not open for registration', 403);

  const status = eventAvailability(event);
  if (status.expired || status.closed) throw new ClubEventError(status.blockMessage, 409);

  const email = str(input.email, 191);
  const firstName = str(input.firstName, 120);
  const lastName = str(input.lastName, 120);
  const fullName = str(`${firstName} ${lastName}`.trim() || input.fullName, 191);
  if (!email) throw new ClubEventError('Email is required');
  if (!fullName) throw new ClubEventError('Name and surname are required');
  const sex = ['M', 'F'].includes(str(input.sex, 1).toUpperCase()) ? str(input.sex, 1).toUpperCase() : '';

  const selectedMain = input.selectedMainEvent !== false;
  const subIds = [...new Set(input.selectedSubeventIds || [])];
  const serviceIds = [...new Set(input.selectedServiceIds || [])];

  if (!selectedMain && subIds.length === 0) {
    throw new ClubEventError('Select the event and/or at least one sub-event');
  }
  if (selectedMain && subIds.length > 0) {
    const nonExternal = subIds.filter((id) => {
      const sub = event.subevents.find((s) => s.id === id);
      return sub && !sub.externalToMain;
    });
    if (nonExternal.length) {
      throw new ClubEventError(
        'When the whole event is selected, only sub-events marked as external to the main event can also be selected',
      );
    }
  }

  if (status.full && selectedMain) {
    throw new ClubEventError('Seats not more available', 409);
  }
  for (const id of subIds) {
    const sub = event.subevents.find((s) => s.id === id);
    if (!sub) throw new ClubEventError('Invalid sub-event');
    if (sub.endDate && sub.endDate < todayYmd()) {
      throw new ClubEventError(`${sub.name}: Date end expired`, 409);
    }
    if (sub.seats > 0 && sub.registered >= sub.seats) {
      throw new ClubEventError(`${sub.name}: Seats not more available`, 409);
    }
  }

  const ws: ClubEventWorkspace = {
    kind: event.workspaceKind === 'team' ? 'team' : 'club',
    id: event.workspaceId,
  };
  const memberUserId = input.memberUserId ? await currentMemberId(ws, String(input.memberUserId)) : null;
  if (event.membersOnly && !event.openToNonMembers && !memberUserId) {
    throw new ClubEventError('This event is only for members: use the quick registration with your fiscal code');
  }
  const isMember = Boolean(memberUserId);

  const allFiles = parseTextFiles(input.textFiles);
  const textFiles: Record<string, { name: string; path: string }> = {};
  for (const t of event.texts.filter((x) => x.enabled)) {
    if (t.fileUploadEnabled && allFiles[t.id]) textFiles[t.id] = allFiles[t.id];
    if (!t.mandatory) continue;
    const ans = input.textAnswers?.[t.id];
    if (ans !== true && String(ans || '').trim() === '') {
      throw new ClubEventError(`Please confirm: ${t.label}`);
    }
    if (t.fileUploadEnabled && !textFiles[t.id]) {
      throw new ClubEventError(`Please attach: ${t.fileUploadLabel || t.label}`);
    }
  }

  const { discountRules, settings } = await getEventSettings(ws);
  const memberInput = { ...input, isMember, memberUserId };
  const relativeOk = await relativeIsSubscribed(event, memberInput);
  const amounts = computeAmounts(event, memberInput, discountRules, relativeOk);
  const modality = event.paymentModality;
  const amountDue = modality === 'A' ? 0 : amounts.paid;
  const currency = event.currency || (await getWorkspaceCurrency(ws.kind, ws.id));

  const choices = payChoicesFor(modality);
  let payChoice: EventPayChoice | null = null;
  if (amountDue > 0 && choices.length) {
    const wanted = input.payChoice && choices.includes(input.payChoice) ? input.payChoice : null;
    if (!wanted && choices.length > 1) throw new ClubEventError('Choose how you want to pay');
    payChoice = wanted ?? choices[0];
  }
  if (payChoice === 'online' || payChoice === 'later') {
    const providers = await eventsOnlineProviders(ws.id);
    if (!providers.length) {
      throw new ClubEventError(
        choices.includes('club')
          ? 'Online payment is not available yet: choose "Pay at the club"'
          : 'Online payment is not available for this event yet. Please contact the club.',
        409,
      );
    }
  }

  const sendEmails = !settings.disableSubscriptionEmails && Boolean(email);
  const confirmationRequired = settings.requireConfirmation && sendEmails;
  const confirm = confirmationRequired ? newConfirmToken() : null;
  const language = await subscriberLanguage(memberUserId, str(input.language, 10));
  const payModeLabel = payChoice ? { online: 'Online', club: 'At the club', later: 'Online (later)' }[payChoice] : '';

  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO org_club_event_registrations
      (id, event_id, full_name, email, phone, fiscal_code, birthdate, address, city, province, zip,
       is_minor, parent_name, parent_fiscal_code, notes, group_or_team_name, member_user_id, is_member,
       selected_main_event, selected_subevent_ids, selected_service_ids, text_answers_json,
       amount_gross, discount_percent, amount_paid, pay_mode, status, receipt_number, created_at,
       relative_name, relative_fiscal_code, text_files_json,
       first_name, last_name, sex, birth_country, birth_locality, foreign_id_code,
       amount_due, currency, language, confirm_token, confirmed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    event.id,
    fullName,
    email,
    str(input.phone, 64),
    str(input.fiscalCode, 32).toUpperCase(),
    str(input.birthdate, 10),
    str(input.address, 255),
    str(input.city, 120),
    str(input.province, 40),
    str(input.zip, 20),
    input.isMinor ? 1 : 0,
    str(input.parentName, 191),
    str(input.parentFiscalCode, 32).toUpperCase(),
    str(input.notes, 4000),
    str(input.groupOrTeamName, 191),
    memberUserId,
    isMember ? 1 : 0,
    selectedMain ? 1 : 0,
    JSON.stringify(subIds),
    JSON.stringify(serviceIds),
    JSON.stringify(input.textAnswers || {}),
    amounts.gross,
    amounts.discountPercent,
    0,
    payModeLabel || str(input.payMode, 64),
    confirmationRequired ? 'pending' : 'confirmed',
    null,
    now,
    relativeOk ? str(input.relativeName, 191) : '',
    relativeOk ? str(input.relativeFiscalCode, 32).toUpperCase() : '',
    JSON.stringify(textFiles),
    firstName,
    lastName,
    sex,
    str(input.birthCountry, 80),
    str(input.birthLocality, 120),
    str(input.foreignIdCode, 64).toUpperCase(),
    amountDue,
    currency,
    language,
    confirm?.hash ?? null,
    confirmationRequired ? null : now,
  );

  const origin = (opts.origin || getSiteOrigin()).replace(/\/$/, '');
  let payUrl: string | null = null;
  let payLinkEmailed = false;
  if (amountDue > 0 && modality !== 'A') {
    try {
      const deadline = await createEventDeadline({
        ws,
        event,
        registrationId: id,
        memberUserId,
        fullName,
        email,
        amount: amountDue,
        currency,
        payChoice,
      });
      if (deadline && (payChoice === 'online' || payChoice === 'later')) {
        const link = await createEventPayLink({
          ws,
          event,
          recordId: deadline.recordId,
          ownerId: deadline.ownerId,
          memberUserId,
          fullName,
          amount: amountDue,
          currency,
          provider: input.provider,
          origin,
        });
        if (link && payChoice === 'online') payUrl = link.url;
        if (link && payChoice === 'later' && email) {
          await emailEventPayLink({
            to: email,
            entityName: await workspaceName(ws),
            memberUserId: memberUserId || deadline.ownerId,
            amount: amountDue,
            currency,
            url: link.url,
            eventName: event.name,
          });
          payLinkEmailed = true;
        }
      }
    } catch (error) {
      console.error('event subscription deadline', error);
    }
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM org_club_event_registrations WHERE id = ? LIMIT 1`,
    id,
  );
  const [registration] = await withDeadlineState([mapReg(rows[0])]);

  if (sendEmails) {
    await sendEventRegistrationEmail({
      to: email,
      language,
      fullName,
      event,
      amount: amountDue,
      currency,
      payChoice,
      confirmUrl: confirm ? `${origin}/club-event-confirm/${confirm.token}` : null,
      eventUrl: `${origin}/club-events/${encodeURIComponent(event.workspaceId)}/${encodeURIComponent(event.publicToken)}`,
    });
  }

  return {
    registration,
    event: await getClubEvent(ws, event.id),
    payUrl,
    confirmationRequired,
    payLinkEmailed,
  };
}
