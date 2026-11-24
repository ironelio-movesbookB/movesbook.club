import { NextRequest, NextResponse } from 'next/server';
import { getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import { createStripeCheckoutSession } from '@/lib/payments/stripeRest';
import { createPaypalOrder } from '@/lib/payments/paypalRest';
import {
  getRegistrationPayment,
  setRegistrationPaymentCheckout,
} from '@/lib/registration/registrationPayments';
import { registrationOrigin, registrationPaymentBuyer } from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

/** Starts Stripe Checkout or a PayPal order and returns the provider page to open. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { provider?: string };
    const provider = body.provider === 'paypal' ? 'paypal' : body.provider === 'stripe' ? 'stripe' : null;
    if (!provider) {
      return NextResponse.json({ error: 'Choose PayPal or credit card' }, { status: 400 });
    }

    const payment = await getRegistrationPayment(params.id);
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (payment.status !== 'pending') {
      return NextResponse.json({ url: `/register/success?p=${payment.id}` });
    }

    const credentials = await getActivePaymentCredentials();
    const origin = registrationOrigin(request);
    const pageUrl = `${origin}/register/payment/${payment.id}`;
    const description = `Movesbook - ${payment.versionName}`;

    if (provider === 'stripe') {
      if (!credentials.stripe) {
        return NextResponse.json({ error: 'Card payment is not available' }, { status: 400 });
      }
      const buyer = await registrationPaymentBuyer(payment);
      const session = await createStripeCheckoutSession(credentials.stripe, {
        amountEur: payment.amountEur,
        productName: description,
        reference: payment.id,
        customerEmail: buyer.email || undefined,
        successUrl: `${pageUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${pageUrl}?cancelled=1`,
      });
      await setRegistrationPaymentCheckout(payment.id, {
        provider: 'stripe',
        mode: credentials.stripe.mode,
        ref: session.id,
      });
      return NextResponse.json({ url: session.url });
    }

    if (!credentials.paypal) {
      return NextResponse.json({ error: 'PayPal is not available' }, { status: 400 });
    }
    const order = await createPaypalOrder(credentials.paypal, {
      amountEur: payment.amountEur,
      description,
      reference: payment.id,
      returnUrl: `${pageUrl}?provider=paypal`,
      cancelUrl: `${pageUrl}?cancelled=1`,
    });
    await setRegistrationPaymentCheckout(payment.id, {
      provider: 'paypal',
      mode: credentials.paypal.mode,
      ref: order.id,
    });
    return NextResponse.json({ url: order.approveUrl });
  } catch (e) {
    console.error('registration-payments checkout:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not start the payment' },
      { status: 502 },
    );
  }
}
