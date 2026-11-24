import { NextRequest, NextResponse } from 'next/server';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { QUICK_REGISTER_SUCCESS_MESSAGE } from '@/lib/users/quickRegisterShared';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';
import { getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import { getRegistrationPayment } from '@/lib/registration/registrationPayments';
import {
  PAYMENT_SUCCESS_FALLBACK_EN,
  PAYMENT_SUCCESS_TEXT_KEY,
  registrationLongText,
  registrationPaymentBuyer,
} from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

/** Public view of one registration payment (payment page and success page). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payment = await getRegistrationPayment(params.id);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const [buyer, credentials] = await Promise.all([
      registrationPaymentBuyer(payment),
      getActivePaymentCredentials(),
    ]);
    const successText =
      payment.kind === 'quick_register'
        ? QUICK_REGISTER_SUCCESS_MESSAGE
        : await registrationLongText(
            PAYMENT_SUCCESS_TEXT_KEY,
            payment.language,
            PAYMENT_SUCCESS_FALLBACK_EN,
          );
    const successHtml =
      payment.status === 'pending' ? null : sanitizeRichHtml(longTextDisplayHtml(successText));

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      versionName: payment.versionName,
      specialOffer: payment.specialOffer,
      amountEur: payment.amountEur,
      amountLocal: payment.amountLocal,
      currencyCode: payment.currencyCode,
      country: payment.country,
      language: payment.language,
      name: buyer.name || buyer.username,
      username: buyer.username,
      testMode: credentials.testMode,
      providers: { stripe: Boolean(credentials.stripe), paypal: Boolean(credentials.paypal) },
      successHtml,
    });
  } catch (e) {
    console.error('registration-payments GET:', e);
    return NextResponse.json({ error: 'Could not load the payment' }, { status: 500 });
  }
}
