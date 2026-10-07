import { NextRequest, NextResponse } from 'next/server';
import { getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import { euroCents, retrieveStripeCheckoutSession } from '@/lib/payments/stripeRest';
import { capturePaypalOrder, euroValue } from '@/lib/payments/paypalRest';
import { getRegistrationPayment } from '@/lib/registration/registrationPayments';
import { finalizePaidRegistration, registrationOrigin } from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

/**
 * Called by the payment page when the buyer returns from Stripe/PayPal.
 * The payment is checked with the provider (never trusted from the browser).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payment = await getRegistrationPayment(params.id);
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    const successUrl = `/register/success?p=${payment.id}`;
    if (payment.status !== 'pending') {
      return NextResponse.json({ paid: true, next: successUrl });
    }
    if (!payment.provider || !payment.providerRef) {
      return NextResponse.json({ error: 'The payment was not started' }, { status: 400 });
    }

    const credentials = await getActivePaymentCredentials();
    const origin = registrationOrigin(request);

    if (payment.provider === 'stripe') {
      if (!credentials.stripe) {
        return NextResponse.json({ error: 'Card payment is not available' }, { status: 400 });
      }
      const session = await retrieveStripeCheckoutSession(credentials.stripe, payment.providerRef);
      const valid =
        session.paid &&
        session.currency === 'eur' &&
        session.amountCents === euroCents(payment.amountEur) &&
        session.reference === payment.id;
      if (!valid) {
        return NextResponse.json({ paid: false, error: 'The payment was not completed' }, { status: 402 });
      }
      await finalizePaidRegistration(payment, session.paymentIntent || payment.providerRef, origin);
      return NextResponse.json({ paid: true, next: successUrl });
    }

    if (!credentials.paypal) {
      return NextResponse.json({ error: 'PayPal is not available' }, { status: 400 });
    }
    const capture = await capturePaypalOrder(credentials.paypal, payment.providerRef);
    const valid =
      capture.completed &&
      capture.currency === 'EUR' &&
      capture.amountValue === euroValue(payment.amountEur) &&
      (capture.reference == null || capture.reference === payment.id);
    if (!valid) {
      return NextResponse.json({ paid: false, error: 'The payment was not completed' }, { status: 402 });
    }
    await finalizePaidRegistration(payment, capture.captureId || payment.providerRef, origin);
    return NextResponse.json({ paid: true, next: successUrl });
  } catch (e) {
    console.error('registration-payments confirm:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not confirm the payment' },
      { status: 502 },
    );
  }
}
