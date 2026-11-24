import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  createDeadlinePayment,
  createRenewalPayment,
  getUserSubscriptionStatus,
} from '@/lib/movesbookDeadlines/subscriptionStatus';

export const dynamic = 'force-dynamic';

function userIdFrom(request: NextRequest): string | null {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  return decoded?.userId ? String(decoded.userId) : null;
}

/** Deadlines expiring within a week, overdue deadlines and the renewal offer of the logged-in user. */
export async function GET(request: NextRequest) {
  const userId = userIdFrom(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getUserSubscriptionStatus(userId));
  } catch (e) {
    console.error('subscription-status GET:', e);
    return NextResponse.json({ error: 'Could not load your subscription status' }, { status: 500 });
  }
}

/** `{ action: 'pay-deadline', deadlineId }` or `{ action: 'renew', modality }` → payment page to open. */
export async function POST(request: NextRequest) {
  const userId = userIdFrom(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    let paymentId: string;
    if (body.action === 'pay-deadline' && typeof body.deadlineId === 'string') {
      paymentId = await createDeadlinePayment(userId, body.deadlineId);
    } else if (body.action === 'renew') {
      paymentId = await createRenewalPayment(userId, body.modality ?? null);
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ paymentId, paymentUrl: `/register/payment/${paymentId}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not start the payment' }, { status: 400 });
  }
}
