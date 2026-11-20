import { NextRequest, NextResponse } from 'next/server';
import {
  credentialsForMemberPayment,
  getMemberOnlinePayment,
  memberOnlinePaymentStillDue,
  setMemberOnlineCheckout,
} from '@/lib/club/memberOnlinePayments';
import { createPaypalOrder } from '@/lib/payments/paypalRest';
import { createStripeCheckoutSession } from '@/lib/payments/stripeRest';
import { registrationOrigin } from '@/lib/registration/registrationFlow';
import type { ActivePaypalCredentials, ActiveStripeCredentials } from '@/lib/payments/paymentSettings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payment = await getMemberOnlinePayment(params.id);
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    const origin = registrationOrigin(request);
    const pageUrl = `${origin}/pay/club/${payment.id}`;
    if (payment.status === 'paid') return NextResponse.json({ url: pageUrl });
    if (payment.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This payment link was replaced by a newer one. Use the latest link you received.' },
        { status: 410 },
      );
    }
    if (!(await memberOnlinePaymentStillDue(payment.id))) {
      return NextResponse.json(
        { error: 'This deadline is already paid. This payment link can no longer be used.' },
        { status: 409 },
      );
    }

    const credentials = await credentialsForMemberPayment(payment);
    if (!credentials) {
      return NextResponse.json(
        { error: 'This club has not finished connecting the payment account.' },
        { status: 400 },
      );
    }

    if (payment.provider === 'stripe') {
      const stripe = credentials as ActiveStripeCredentials;
      const session = await createStripeCheckoutSession(stripe, {
        amountEur: payment.amountEur,
        productName: payment.description,
        reference: payment.id,
        successUrl: `${pageUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${pageUrl}?cancelled=1`,
      });
      await setMemberOnlineCheckout(payment.id, { mode: stripe.mode, ref: session.id });
      return NextResponse.json({ url: session.url });
    }

    const paypal = credentials as ActivePaypalCredentials;
    const order = await createPaypalOrder(paypal, {
      amountEur: payment.amountEur,
      description: payment.description,
      reference: payment.id,
      returnUrl: `${pageUrl}?provider=paypal`,
      cancelUrl: `${pageUrl}?cancelled=1`,
    });
    await setMemberOnlineCheckout(payment.id, { mode: paypal.mode, ref: order.id });
    return NextResponse.json({ url: order.approveUrl });
  } catch (error) {
    console.error('club member checkout:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not start the payment' },
      { status: 502 },
    );
  }
}
