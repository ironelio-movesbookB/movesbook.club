import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';
import { getActivePaymentCredentials } from '@/lib/payments/paymentSettings';
import { getRegistrationPayment } from '@/lib/registration/registrationPayments';
import {
  PAYMENT_SUCCESS_FALLBACK_EN,
  PAYMENT_SUCCESS_TEXT_KEY,
  registrationLongText,
} from '@/lib/registration/registrationFlow';

export const dynamic = 'force-dynamic';

/** Public view of one registration payment (payment page and success page). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payment = await getRegistrationPayment(params.id);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const [user, credentials] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payment.userId },
        select: { name: true, firstName: true, surname: true, username: true },
      }),
      getActivePaymentCredentials(),
    ]);
    const successHtml =
      payment.status === 'pending'
        ? null
        : sanitizeRichHtml(
            longTextDisplayHtml(
              await registrationLongText(
                PAYMENT_SUCCESS_TEXT_KEY,
                payment.language,
                PAYMENT_SUCCESS_FALLBACK_EN,
              ),
            ),
          );

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
      name:
        [user?.firstName, user?.surname].filter(Boolean).join(' ').trim() ||
        user?.name ||
        user?.username ||
        '',
      username: user?.username ?? '',
      testMode: credentials.testMode,
      providers: { stripe: Boolean(credentials.stripe), paypal: Boolean(credentials.paypal) },
      successHtml,
    });
  } catch (e) {
    console.error('registration-payments GET:', e);
    return NextResponse.json({ error: 'Could not load the payment' }, { status: 500 });
  }
}
