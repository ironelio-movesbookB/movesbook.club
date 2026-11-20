import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  credentialsForMemberPayment,
  getMemberOnlinePayment,
  markMemberOnlinePaymentPaid,
  settleMemberOnlinePayment,
} from '@/lib/club/memberOnlinePayments';
import { currencyMinorUnits, retrieveStripeCheckoutSession } from '@/lib/payments/stripeRest';
import { capturePaypalOrder, currencyValue } from '@/lib/payments/paypalRest';
import type { ActivePaypalCredentials, ActiveStripeCredentials } from '@/lib/payments/paymentSettings';

export const dynamic = 'force-dynamic';

async function tellTheClub(paymentId: string, text: string) {
  const payment = await getMemberOnlinePayment(paymentId);
  if (!payment || payment.createdByUserId === payment.memberUserId) return;
  const [user1Id, user2Id] = [payment.createdByUserId, payment.memberUserId].sort();
  const conversation = await prisma.chatConversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    update: {},
    create: { user1Id, user2Id },
    select: { id: true },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      senderId: payment.createdByUserId,
      content: text,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string; orderId?: string };
    const payment = await getMemberOnlinePayment(params.id);
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (payment.status === 'paid') return NextResponse.json({ paid: true });

    const credentials = await credentialsForMemberPayment(payment);
    if (!credentials) {
      return NextResponse.json({ error: 'This club has not finished connecting the payment account.' }, { status: 400 });
    }

    if (payment.provider === 'stripe') {
      const sessionId = (body.sessionId || payment.providerRef || '').trim();
      if (!sessionId) return NextResponse.json({ error: 'The card payment is missing' }, { status: 400 });
      const session = await retrieveStripeCheckoutSession(credentials as ActiveStripeCredentials, sessionId);
      const valid =
        session.paid &&
        session.currency === payment.currency.toLowerCase() &&
        session.amountCents === currencyMinorUnits(payment.amountEur, payment.currency) &&
        session.reference === payment.id;
      if (!valid) {
        return NextResponse.json({ paid: false, error: 'The payment was not completed' }, { status: 402 });
      }
      if (!(await markMemberOnlinePaymentPaid(payment.id, session.paymentIntent || sessionId))) {
        return NextResponse.json({ paid: true });
      }
    } else {
      const orderId = (body.orderId || payment.providerRef || '').trim();
      if (!orderId) return NextResponse.json({ error: 'The PayPal payment is missing' }, { status: 400 });
      const capture = await capturePaypalOrder(credentials as ActivePaypalCredentials, orderId, payment.id);
      const valid =
        capture.completed &&
        capture.currency === payment.currency &&
        capture.amountValue === currencyValue(payment.amountEur, payment.currency) &&
        capture.reference === payment.id;
      if (!valid) {
        return NextResponse.json({ paid: false, error: 'The payment was not completed' }, { status: 402 });
      }
      if (!(await markMemberOnlinePaymentPaid(payment.id, capture.captureId || orderId))) {
        return NextResponse.json({ paid: true });
      }
    }
    // The money is already taken, so a settle error is logged instead of failing the member's page.
    await settleMemberOnlinePayment(payment).catch((error) => {
      console.error('club member settle:', payment.id, error);
    });

    const paid = await getMemberOnlinePayment(payment.id);
    const how = payment.provider === 'paypal' ? 'PayPal' : 'card';
    await tellTheClub(
      payment.id,
      `Payment received: ${payment.currency === 'EUR' ? '€' : payment.currency} ${payment.amountEur.toFixed(2)} by ${how}. The money is in the ${payment.entityName} account.`,
    ).catch(() => undefined);
    return NextResponse.json({ paid: paid?.status === 'paid' });
  } catch (error) {
    console.error('club member confirm:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not confirm the payment' },
      { status: 502 },
    );
  }
}
