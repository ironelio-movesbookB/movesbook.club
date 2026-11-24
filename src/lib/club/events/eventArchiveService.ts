import { prisma } from '@/lib/prisma';
import { procedureService } from '@/lib/procedures';
import { PROCEDURE_TYPE_CODES } from '@/lib/procedures/types';
import type { ClubAuthContext } from '@/lib/procedures/types';
import { getWorkspaceCurrency } from '@/lib/club/clubCurrency.server';
import { ClubEventError, ensureClubEventTables } from '@/lib/club/events/eventService';
import {
  listEventRegistrations,
  listWorkspaceRegistrations,
} from '@/lib/club/events/eventRegistrationService';
import { locationOf, type ClubEventWorkspace } from '@/lib/club/events/eventConstants';

export type EventArchiveRow = {
  id: string;
  name: string;
  eventType: string;
  startDate: string;
  endDate: string;
  location: string;
  subscribers: number;
  confirmed: number;
  amountDue: number;
  paid: number;
  rest: number;
  currency: string;
  /** Removed from Manage Events (kept for the archive). */
  removed: boolean;
};

export type EventArchiveSubscriber = {
  id: string;
  name: string;
  surname: string;
  gender: string;
  isMember: boolean;
  confirmed: boolean;
  deadlineDate: string | null;
  cost: number;
  paid: number;
  rest: number;
  invoice: string;
  procedureRecordId: string | null;
};

export type EventArchiveMoneyRow = {
  id: string;
  recordId: string;
  name: string;
  date: string;
  amount: number;
  payMode: string;
  document: string;
  operator: string;
  notes: string;
};

type EventDbRow = {
  id: string;
  name: string;
  event_type: string;
  start_date: Date | string;
  end_date: Date | string;
  city: string;
  zip: string;
  address: string;
  province: string;
  removed_at: Date | string | null;
};

function ymd(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Archive of Events: every event of the club / team (org_club_events) with subscription totals. */
export async function listEventArchiveRows(ws: ClubEventWorkspace): Promise<EventArchiveRow[]> {
  await ensureClubEventTables();
  const [events, regs, currency] = await Promise.all([
    prisma.$queryRawUnsafe<EventDbRow[]>(
      `SELECT id, name, event_type, start_date, end_date, city, zip, address, province, removed_at
       FROM org_club_events WHERE workspace_kind = ? AND workspace_id = ?
       ORDER BY start_date DESC, name ASC`,
      ws.kind,
      ws.id,
    ),
    listWorkspaceRegistrations(ws),
    getWorkspaceCurrency(ws.kind, ws.id),
  ]);
  const totals = new Map<string, { n: number; confirmed: number; due: number; paid: number; rest: number }>();
  for (const r of regs) {
    const t = totals.get(r.eventId) ?? { n: 0, confirmed: 0, due: 0, paid: 0, rest: 0 };
    t.n += 1;
    if (r.status === 'confirmed') t.confirmed += 1;
    t.due += r.amountDue;
    t.paid += r.amountPaid;
    t.rest += r.balance;
    totals.set(r.eventId, t);
  }
  return events.map((e) => {
    const t = totals.get(e.id);
    return {
      id: e.id,
      name: e.name,
      eventType: e.event_type,
      startDate: ymd(e.start_date),
      endDate: ymd(e.end_date),
      location: locationOf({ city: e.city || '', zip: e.zip || '', address: e.address || '', province: e.province || '' }),
      subscribers: t?.n ?? 0,
      confirmed: t?.confirmed ?? 0,
      amountDue: round2(t?.due ?? 0),
      paid: round2(t?.paid ?? 0),
      rest: round2(t?.rest ?? 0),
      currency,
      removed: Boolean(e.removed_at),
    };
  });
}

function splitName(fullName: string): { first: string; last: string } {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return { first: first || '', last: rest.join(' ') };
}

/** Subscribers, payments and receipts of one event (Archive of Events tabs). */
export async function eventArchiveDetail(
  ctx: ClubAuthContext,
  ws: ClubEventWorkspace,
  eventId: string,
): Promise<{
  subscribers: EventArchiveSubscriber[];
  payments: EventArchiveMoneyRow[];
  receipts: EventArchiveMoneyRow[];
}> {
  const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM org_club_events WHERE id = ? AND workspace_kind = ? AND workspace_id = ? LIMIT 1`,
    eventId,
    ws.kind,
    ws.id,
  );
  if (!exists[0]) throw new ClubEventError('Event not found', 404);

  const regs = (await listEventRegistrations(ws, eventId).catch(() => [])).filter((r) => r.status !== 'cancelled');
  const subscribers: EventArchiveSubscriber[] = regs.map((r) => {
    const fallback = splitName(r.fullName);
    return {
      id: r.id,
      name: r.firstName || fallback.first,
      surname: r.lastName || fallback.last,
      gender: r.sex === 'M' ? 'Male' : r.sex === 'F' ? 'Female' : '',
      isMember: r.isMember,
      confirmed: r.status === 'confirmed',
      deadlineDate: r.deadlineDate,
      cost: r.amountDue,
      paid: r.amountPaid,
      rest: r.balance,
      invoice: r.invoiceNumbers,
      procedureRecordId: r.procedureRecordId,
    };
  });

  const recordIds = regs.map((r) => r.procedureRecordId).filter((id): id is string => Boolean(id));
  if (!recordIds.length) return { subscribers, payments: [], receipts: [] };

  const query = { page: 1, pageSize: 500, recordIds };
  const [payments, receipts] = await Promise.all([
    procedureService.listPayments(ctx, PROCEDURE_TYPE_CODES.EVENT_SUBSCRIPTION, query).catch(() => ({ items: [] })),
    procedureService.listReceipts(ctx, PROCEDURE_TYPE_CODES.EVENT_SUBSCRIPTION, query).catch(() => ({ items: [] })),
  ]);
  return {
    subscribers,
    payments: payments.items.map((p) => ({
      id: p.id,
      recordId: p.procedureRecordId,
      name: p.memberName,
      date: p.paymentDate,
      amount: p.amount,
      payMode: p.payMode || '',
      document: '',
      operator: p.operatorName,
      notes: p.notes || '',
    })),
    receipts: receipts.items.map((r) => ({
      id: r.id,
      recordId: r.procedureRecordId,
      name: r.memberName,
      date: r.receiptDate,
      amount: r.paymentAmount,
      payMode: '',
      document: `${r.documentType || ''} ${r.documentNumber || ''}`.trim(),
      operator: r.operatorName,
      notes: r.annotations || '',
    })),
  };
}
