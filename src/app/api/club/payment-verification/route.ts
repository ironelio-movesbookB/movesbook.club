import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClubAuthContext } from '@/lib/procedures';
import {
  loadToBeVerifiedPaymentIds,
  setPaymentToBeVerified,
} from '@/lib/procedures/paymentVerification';

export const dynamic = 'force-dynamic';

/** POST { paymentId } — confirms a payment stored as "To be verified" (Archive of Payments). */
export async function POST(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as { paymentId?: unknown };
    const paymentId = String(body.paymentId ?? '').trim();
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    const payment = await prisma.procedurePayment.findFirst({
      where: { id: paymentId, procedureRecord: { clubId: auth.ctx.club.id } },
      select: { id: true },
    });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const pending = await loadToBeVerifiedPaymentIds([payment.id]);
    if (!pending.has(payment.id)) {
      return NextResponse.json({ error: 'This payment is already confirmed' }, { status: 409 });
    }

    await setPaymentToBeVerified(payment.id, false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST payment verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
