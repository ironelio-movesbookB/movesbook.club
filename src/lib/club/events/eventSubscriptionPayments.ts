import { createHash, randomBytes } from 'crypto';
import { ProcedureRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { procedureService } from '@/lib/procedures';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import { workspaceOwnerId } from '@/lib/club/clubCurrency.server';
import {
  createMemberOnlinePayment,
  emailMemberPayLink,
  readyMemberProviders,
  type MemberOnlineProvider,
} from '@/lib/club/memberOnlinePayments';
import {
  formatEventEuro,
  todayYmd,
  type ClubEvent,
  type ClubEventWorkspace,
  type EventPayChoice,
} from '@/lib/club/events/eventConstants';

const EVENT_TYPE = PROCEDURE_TYPE_CODES.EVENT_SUBSCRIPTION;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function hashConfirmToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newConfirmToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('hex');
  return { token, hash: hashConfirmToken(token) };
}

export async function workspaceName(ws: ClubEventWorkspace): Promise<string> {
  const row =
    ws.kind === 'team'
      ? await prisma.team.findUnique({ where: { id: ws.id }, select: { name: true } })
      : await prisma.club.findUnique({ where: { id: ws.id }, select: { name: true } });
  return row?.name?.trim() || (ws.kind === 'team' ? 'Team' : 'Club');
}

/** 'it' or 'en': the member's account language, else the subscriber's browser language. */
export async function subscriberLanguage(memberUserId: string | null, browserLanguage: string): Promise<string> {
  let lang = '';
  if (memberUserId) {
    const s = await prisma.userSettings
      .findUnique({ where: { userId: memberUserId }, select: { language: true } })
      .catch(() => null);
    lang = s?.language || '';
  }
  lang = (lang || browserLanguage || 'en').toLowerCase();
  return lang.startsWith('it') ? 'it' : 'en';
}

export type EventDeadlineInput = {
  ws: ClubEventWorkspace;
  event: ClubEvent;
  registrationId: string;
  memberUserId: string | null;
  fullName: string;
  email: string;
  amount: number;
  currency: string;
  payChoice: EventPayChoice | null;
};

/**
 * Deadline in the Archive of Deadlines (typology "EVENT - <type>"). Non-members are stored under the
 * club / team owner and their own name / email are kept in the metadata.
 */
export async function createEventDeadline(input: EventDeadlineInput): Promise<{ recordId: string; ownerId: string } | null> {
  const ownerId = await workspaceOwnerId(input.ws.kind, input.ws.id);
  if (!ownerId || input.amount <= 0) return null;
  const today = todayYmd();
  const dueDate = input.payChoice === 'online' ? today : input.event.startDate > today ? input.event.startDate : today;
  const ctx = {
    userId: ownerId,
    club: { id: input.ws.id, name: await workspaceName(input.ws) },
    workspaceKind: input.ws.kind,
  };
  const created = await procedureService.createRecord(ctx, EVENT_TYPE, {
    memberId: input.memberUserId || ownerId,
    totalAmount: input.amount,
    recordDate: today,
    dueDate,
    operatorId: ownerId,
    forceDeadline: true,
    notes: `Subscription to ${input.event.name}`,
    metadata: {
      eventId: input.event.id,
      eventName: input.event.name,
      eventType: input.event.eventType,
      registrationId: input.registrationId,
      currency: input.currency,
      serviceName: input.event.name,
      ...(input.memberUserId ? {} : { subscriberName: input.fullName, subscriberEmail: input.email }),
    },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE org_club_event_registrations SET procedure_record_id = ? WHERE id = ?`,
    created.recordId,
    input.registrationId,
  );
  return { recordId: created.recordId, ownerId };
}

/** Pay link for the deadline (Stripe / PayPal of the club). The payment, receipt and cash IN are written when paid. */
export async function createEventPayLink(input: {
  ws: ClubEventWorkspace;
  event: ClubEvent;
  recordId: string;
  ownerId: string;
  memberUserId: string | null;
  fullName: string;
  amount: number;
  currency: string;
  provider?: string | null;
  origin: string;
}): Promise<{ id: string; url: string } | null> {
  const ready = await readyMemberProviders(input.ws.id);
  const provider: MemberOnlineProvider | undefined =
    ready.find((p) => p === input.provider) ?? ready[0];
  if (!provider) return null;
  const description = `Subscription to ${input.event.name}`;
  const payment = await createMemberOnlinePayment({
    entityId: input.ws.id,
    entityName: await workspaceName(input.ws),
    memberUserId: input.memberUserId || input.ownerId,
    memberName: input.fullName,
    createdByUserId: input.ownerId,
    provider,
    amountEur: input.amount,
    currency: input.currency,
    description,
    settlement: [
      {
        procedureType: EVENT_TYPE,
        recordId: input.recordId,
        amount: input.amount,
        payMode: '',
        operatorId: input.ownerId,
        paymentDate: '',
        description,
      },
    ],
    receipt: { documentType: 'Receipt', serviceName: input.event.name, annotations: description },
  });
  return { id: payment.id, url: `${input.origin}/pay/club/${payment.id}` };
}

export async function emailEventPayLink(input: {
  to: string;
  entityName: string;
  memberUserId: string;
  amount: number;
  currency: string;
  url: string;
  eventName: string;
}): Promise<void> {
  try {
    await emailMemberPayLink({
      memberUserId: input.memberUserId,
      entityName: input.entityName,
      amountEur: input.amount,
      payUrl: input.url,
      description: `Subscription to ${input.eventName}`,
      to: input.to,
      currency: input.currency,
    });
  } catch (error) {
    console.error('event pay link email', error);
  }
}

export function eventsOnlineProviders(wsId: string): Promise<MemberOnlineProvider[]> {
  return readyMemberProviders(wsId).catch(() => []);
}

const EMAIL_TEXT = {
  en: {
    subject: (name: string) => `Event registration: ${name}`,
    hello: (name: string) => `Hello ${name},`,
    received: (name: string) => `your registration for <strong>${name}</strong> was received.`,
    amount: 'Amount to pay',
    free: 'No payment is required.',
    payOnline: 'Pay online now with the button on the payment page.',
    payClub: 'You can pay at the club (cash or cheque).',
    payLater: 'You will receive a separate email with the payment link: you can pay whenever you like before the event.',
    confirm: 'Please confirm your subscription:',
    confirmButton: 'Confirm my subscription',
    openEvent: 'Open event page',
  },
  it: {
    subject: (name: string) => `Iscrizione all'evento: ${name}`,
    hello: (name: string) => `Ciao ${name},`,
    received: (name: string) => `abbiamo ricevuto la tua iscrizione a <strong>${name}</strong>.`,
    amount: 'Importo da pagare',
    free: 'Non è richiesto alcun pagamento.',
    payOnline: 'Paga online ora con il pulsante nella pagina di pagamento.',
    payClub: 'Puoi pagare presso il club (contanti o assegno).',
    payLater: 'Riceverai una email separata con il link di pagamento: puoi pagare quando vuoi prima dell\'evento.',
    confirm: 'Conferma la tua iscrizione:',
    confirmButton: 'Conferma la mia iscrizione',
    openEvent: 'Apri la pagina dell\'evento',
  },
} as const;

export async function sendEventRegistrationEmail(input: {
  to: string;
  language: string;
  fullName: string;
  event: ClubEvent;
  amount: number;
  currency: string;
  payChoice: EventPayChoice | null;
  confirmUrl: string | null;
  eventUrl: string;
}): Promise<void> {
  const t = input.language === 'it' ? EMAIL_TEXT.it : EMAIL_TEXT.en;
  const name = escapeHtml(input.event.name);
  const payLine =
    input.amount <= 0
      ? t.free
      : input.payChoice === 'online'
        ? t.payOnline
        : input.payChoice === 'later'
          ? t.payLater
          : input.payChoice === 'club'
            ? t.payClub
            : '';
  const html = `<p>${escapeHtml(t.hello(input.fullName))}</p>
<p>${t.received(name)}</p>
${input.amount > 0 ? `<p>${t.amount}: <strong>${escapeHtml(formatEventEuro(input.amount, input.currency))}</strong></p>` : ''}
${payLine ? `<p>${escapeHtml(payLine)}</p>` : ''}
${input.event.confirmationText ? `<p>${escapeHtml(input.event.confirmationText)}</p>` : ''}
${
  input.confirmUrl
    ? `<p>${t.confirm}</p><p><a href="${escapeHtml(input.confirmUrl)}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">${t.confirmButton}</a></p>`
    : ''
}
<p><a href="${escapeHtml(input.eventUrl)}">${t.openEvent}</a></p>`;
  try {
    await sendIonosEmail({ to: input.to, subject: t.subject(input.event.name), html });
  } catch (error) {
    console.error('event registration email', error);
  }
}

export type ConfirmEventResult =
  | { ok: true; alreadyConfirmed: boolean; eventName: string; fullName: string; eventUrl: string }
  | { ok: false };

/** The confirmation link only changes the status: the seat and deadline were created at subscription. */
export async function confirmEventRegistration(token: string): Promise<ConfirmEventResult> {
  if (!/^[a-f0-9]{32,64}$/i.test(token)) return { ok: false };
  const hash = hashConfirmToken(token);
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      status: string;
      confirmed_at: Date | null;
      full_name: string;
      event_name: string;
      workspace_id: string;
      public_token: string;
    }>
  >(
    `SELECT r.id, r.status, r.confirmed_at, r.full_name, e.name AS event_name, e.workspace_id, e.public_token
     FROM org_club_event_registrations r INNER JOIN org_club_events e ON e.id = r.event_id
     WHERE r.confirm_token = ? LIMIT 1`,
    hash,
  );
  const row = rows[0];
  if (!row || row.status === 'cancelled') return { ok: false };
  const alreadyConfirmed = Boolean(row.confirmed_at);
  if (!alreadyConfirmed) {
    await prisma.$executeRawUnsafe(
      `UPDATE org_club_event_registrations SET status = 'confirmed', confirmed_at = ? WHERE id = ?`,
      new Date(),
      row.id,
    );
  }
  return {
    ok: true,
    alreadyConfirmed,
    eventName: row.event_name,
    fullName: row.full_name,
    eventUrl: `/club-events/${encodeURIComponent(row.workspace_id)}/${encodeURIComponent(row.public_token)}`,
  };
}

export type EventDeadlineState = {
  total: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  invoiceNumbers: string;
};

/** Paid / rest / receipts of the subscription deadlines (Archive of Deadlines is the source of truth). */
export async function eventDeadlineStates(recordIds: string[]): Promise<Map<string, EventDeadlineState>> {
  const out = new Map<string, EventDeadlineState>();
  const ids = [...new Set(recordIds.filter(Boolean))];
  if (!ids.length) return out;
  const rows = await prisma.procedureRecord.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
      dueDate: true,
      receipts: { select: { documentNumber: true }, orderBy: { receiptDate: 'asc' } },
    },
  });
  for (const r of rows) {
    if (r.status !== ProcedureRecordStatus.ACTIVE) continue;
    out.set(r.id, {
      total: Number(r.totalAmount),
      paid: Number(r.paidAmount),
      balance: Number(r.balanceAmount),
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      invoiceNumbers: r.receipts
        .map((x) => (x.documentNumber || '').trim())
        .filter(Boolean)
        .join(', '),
    });
  }
  return out;
}
