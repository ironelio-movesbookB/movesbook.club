import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import {
  DeadlinePaymentError,
  listMovesbookDeadlines,
  recordDeadlinePayment,
} from '@/lib/movesbookDeadlines/movesbookDeadlines';

export const dynamic = 'force-dynamic';

/** Archive of Deadlines (Movesbook): filters as in the club archive. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const q = request.nextUrl.searchParams;
    const result = await listMovesbookDeadlines({
      search: q.get('search') ?? '',
      typology: q.get('typology') ?? '',
      fromDate: q.get('fromDate') ?? '',
      toDate: q.get('toDate') ?? '',
      includePaid: q.get('includePaid') === '1',
      userId: q.get('userId') ?? '',
      order: q.get('order') ?? '',
      page: Number(q.get('page')) || 1,
      pageSize: Number(q.get('pageSize')) || 25,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('movesbook-deadlines GET:', e);
    return NextResponse.json({ error: 'Failed to load the deadlines' }, { status: 500 });
  }
}

async function operatorName(adminUserId: string, isSuperAdmin: boolean): Promise<string> {
  if (isSuperAdmin) {
    const admin = await prisma.superAdmin.findUnique({ where: { id: adminUserId }, select: { username: true, name: true } });
    return admin?.name || admin?.username || 'Super Admin';
  }
  const staff = await prisma.staffAccount.findUnique({
    where: { id: adminUserId },
    select: { username: true, name: true, surname: true },
  });
  return staff ? `${staff.name} ${staff.surname}`.trim() || staff.username : 'Staff';
}

/** `{ action: 'pay', id, amountEur, paidOn, payMode, notes }` — register a payment on a deadline. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'pay' || typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const deadline = await recordDeadlinePayment(body.id, {
      amountEur: Number(body.amountEur),
      paidOn: String(body.paidOn ?? ''),
      payMode: String(body.payMode ?? ''),
      notes: String(body.notes ?? ''),
      operator: await operatorName(auth.adminUserId, auth.isSuperAdmin),
    });
    return NextResponse.json({ success: true, deadline });
  } catch (e) {
    if (e instanceof DeadlinePaymentError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('movesbook-deadlines POST:', e);
    return NextResponse.json({ error: 'Failed to record the payment' }, { status: 500 });
  }
}
