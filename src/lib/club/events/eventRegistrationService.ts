import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { getSiteOrigin } from '@/lib/siteUrl';
import {
  ensureClubEventTables,
  getClubEvent,
  getClubEventByToken,
  getEventSettings,
  ClubEventError,
} from '@/lib/club/events/eventService';
import type {
  ClubEvent,
  ClubEventRegistration,
  ClubEventWorkspace,
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
  payMode?: string;
  amountPaid?: number;
};

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
    selectedMainEvent: bool(row.selected_main_event),
    selectedSubeventIds,
    selectedServiceIds,
    textAnswers,
    fileUrl: null,
    amountGross: num(row.amount_gross),
    discountPercent: num(row.discount_percent),
    amountPaid: num(row.amount_paid),
    payMode: String(row.pay_mode || ''),
    status: (String(row.status || 'confirmed') as ClubEventRegistration['status']) || 'confirmed',
    receiptNumber: row.receipt_number ? String(row.receipt_number) : null,
  };
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
  return rows.map(mapReg);
}

export type EventMemberLookup = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  fiscalCode: string;
  birthdate: string;
  address: string;
  city: string;
  archived: boolean;
};

function memberFromProfile(
  profileJson: string,
  u: {
    id: string;
    email: string | null;
    name: string | null;
    firstName: string | null;
    surname: string | null;
    birthdate: Date | null;
  },
  archived: boolean,
): EventMemberLookup {
  let fiscal = '';
  let phone = '';
  let address = '';
  let city = '';
  try {
    const j = JSON.parse(profileJson || '{}') as Record<string, unknown>;
    fiscal = String(j.fiscalCode ?? j.fiscal_code ?? j.taxCode ?? '')
      .toUpperCase()
      .trim();
    phone = String(j.phone ?? j.phone1 ?? '');
    address = String(j.address ?? '');
    city = String(j.city ?? '');
  } catch {
    /* ignore */
  }
  return {
    userId: u.id,
    fullName: `${u.surname || ''} ${u.firstName || ''}`.trim() || u.name || '',
    email: u.email || '',
    phone,
    fiscalCode: fiscal,
    birthdate: u.birthdate ? u.birthdate.toISOString().slice(0, 10) : '',
    address,
    city,
    archived,
  };
}

/** Look up current club/team member by fiscal code (ClubMemberProfile.profileJson). */
export async function findMemberByFiscalCode(
  ws: ClubEventWorkspace,
  fiscalCode: string,
): Promise<EventMemberLookup | null> {
  const code = str(fiscalCode, 32).toUpperCase();
  if (code.length < 6) return null;

  if (ws.kind === 'club') {
    const profiles = await prisma.clubMemberProfile.findMany({
      where: { clubMember: { clubId: ws.id } },
      select: {
        profileJson: true,
        clubMember: {
          select: {
            member: {
              select: { id: true, email: true, name: true, firstName: true, surname: true, birthdate: true },
            },
          },
        },
      },
      take: 3000,
    });
    for (const p of profiles) {
      const m = memberFromProfile(p.profileJson, p.clubMember.member, false);
      if (m.fiscalCode && m.fiscalCode === code) return m;
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
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      surname: true,
      birthdate: true,
      password: true,
    },
  });
  if (!user?.password || !(await verifyPassword(pass, user.password))) return null;

  if (ws.kind === 'club') {
    const membership = await prisma.clubMember.findFirst({
      where: { clubId: ws.id, memberId: user.id },
      select: { id: true },
    });
    if (!membership) return null;
    const profile = await prisma.clubMemberProfile.findFirst({
      where: { clubMemberId: membership.id },
      select: { profileJson: true },
    });
    return memberFromProfile(profile?.profileJson || '{}', user, false);
  }

  return {
    userId: user.id,
    fullName: `${user.surname || ''} ${user.firstName || ''}`.trim() || user.name || '',
    email: user.email || '',
    phone: '',
    fiscalCode: '',
    birthdate: user.birthdate ? user.birthdate.toISOString().slice(0, 10) : '',
    address: '',
    city: '',
    archived: false,
  };
}

function computeAmounts(
  event: ClubEvent,
  input: RegisterEventInput,
  discountRules: Array<{ minSubevents: number; discountPercent: number }>,
): { gross: number; discountPercent: number; paid: number } {
  let gross = 0;
  const selectedMain = input.selectedMainEvent !== false;
  const subIds = input.selectedSubeventIds || [];
  const serviceIds = input.selectedServiceIds || [];

  if (selectedMain) gross += event.cost;
  for (const sub of event.subevents) {
    if (subIds.includes(sub.id)) gross += sub.cost;
  }
  for (const svc of event.services) {
    if (serviceIds.includes(svc.id)) gross += svc.price;
  }

  let discountPercent = 0;
  const selectedCount = (selectedMain ? 1 : 0) + subIds.length;
  for (const rule of [...discountRules].sort((a, b) => b.minSubevents - a.minSubevents)) {
    if (selectedCount >= rule.minSubevents) {
      discountPercent = rule.discountPercent;
      break;
    }
  }
  if (event.siblingDiscount.enabled && event.siblingDiscount.percent > 0) {
    discountPercent = Math.max(discountPercent, event.siblingDiscount.percent);
  }
  const paid = Math.max(0, Math.round(gross * (1 - discountPercent / 100) * 100) / 100);
  return { gross, discountPercent, paid };
}

export async function registerForEvent(
  token: string,
  input: RegisterEventInput,
): Promise<{ registration: ClubEventRegistration; event: ClubEvent }> {
  await ensureClubEventTables();
  const event = await getClubEventByToken(token);
  if (!event) throw new ClubEventError('Event not found', 404);
  if (event.hideFromShare) throw new ClubEventError('This event is not open for registration', 403);

  const email = str(input.email, 191);
  const fullName = str(input.fullName, 191);
  if (!email) throw new ClubEventError('Email is required');
  if (!fullName) throw new ClubEventError('Full name is required');

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

  if (event.seats > 0 && event.registered >= event.seats && selectedMain) {
    throw new ClubEventError('No seats left for this event', 409);
  }
  for (const id of subIds) {
    const sub = event.subevents.find((s) => s.id === id);
    if (!sub) throw new ClubEventError('Invalid sub-event');
    if (sub.seats > 0 && sub.registered >= sub.seats) {
      throw new ClubEventError(`No seats left for ${sub.name}`, 409);
    }
  }

  if (event.membersOnly && !event.openToNonMembers && !input.isMember && !input.memberUserId) {
    throw new ClubEventError('This event is only for members');
  }

  for (const t of event.texts.filter((x) => x.enabled && x.mandatory)) {
    const ans = input.textAnswers?.[t.id];
    if (ans !== true && String(ans || '').trim() === '') {
      throw new ClubEventError(`Please confirm: ${t.label}`);
    }
  }

  const ws: ClubEventWorkspace = {
    kind: event.workspaceKind === 'team' ? 'team' : 'club',
    id: event.workspaceId,
  };
  const { discountRules, settings } = await getEventSettings(ws);
  const amounts = computeAmounts(event, input, discountRules);
  const amountPaid =
    input.amountPaid !== undefined && Number(input.amountPaid) >= 0 ? num(input.amountPaid) : amounts.paid;

  const id = randomUUID();
  let receiptNumber: string | null = null;
  if (amountPaid > 0) {
    const countRows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(
      `SELECT COUNT(*) AS n FROM org_club_event_registrations r
       INNER JOIN org_club_events e ON e.id = r.event_id
       WHERE e.workspace_kind = ? AND e.workspace_id = ? AND r.receipt_number IS NOT NULL`,
      ws.kind,
      ws.id,
    );
    receiptNumber = String(Number(countRows[0]?.n ?? 0) + 1);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO org_club_event_registrations
      (id, event_id, full_name, email, phone, fiscal_code, birthdate, address, city, province, zip,
       is_minor, parent_name, parent_fiscal_code, notes, group_or_team_name, member_user_id, is_member,
       selected_main_event, selected_subevent_ids, selected_service_ids, text_answers_json,
       amount_gross, discount_percent, amount_paid, pay_mode, status, receipt_number, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    input.memberUserId || null,
    input.isMember || input.memberUserId ? 1 : 0,
    selectedMain ? 1 : 0,
    JSON.stringify(subIds),
    JSON.stringify(serviceIds),
    JSON.stringify(input.textAnswers || {}),
    amounts.gross,
    amounts.discountPercent,
    amountPaid,
    str(input.payMode, 64),
    'confirmed',
    receiptNumber,
    new Date(),
  );

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM org_club_event_registrations WHERE id = ? LIMIT 1`,
    id,
  );
  const registration = mapReg(rows[0]);

  if (!settings.disableSubscriptionEmails && email) {
    const origin = getSiteOrigin();
    try {
      await sendIonosEmail({
        to: email,
        subject: `Event registration: ${event.name}`,
        html: `<p>Hello ${fullName},</p>
<p>Your registration for <strong>${event.name}</strong> was received.</p>
<p>Amount: € ${amountPaid.toFixed(2)}${receiptNumber ? ` — Receipt n. ${receiptNumber}` : ''}.</p>
${event.confirmationText ? `<p>${event.confirmationText}</p>` : ''}
<p><a href="${origin}/club-events/${encodeURIComponent(event.workspaceId)}/${encodeURIComponent(event.publicToken)}">Open event page</a></p>`,
      });
    } catch (e) {
      console.error('event registration email', e);
    }
  }

  return { registration, event: await getClubEvent(ws, event.id) };
}
