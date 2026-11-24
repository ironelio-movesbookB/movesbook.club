import { prisma } from '@/lib/prisma';
import { sendIonosEmail } from '@/lib/ionosEmail';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import { isLocalOrigin, resolvePublicOrigin } from '@/lib/siteUrl';
import { longTextDisplayHtml } from '@/utils/richTextTranslation';
import {
  mergeNetworkSubscriptionHistory,
  readNetworkSubscriptionHistory,
} from '@/lib/admin/networkSubscriptionHistory';
import { formatLocalAmount } from '@/lib/countries/countryPriceFormula';
import {
  getQuickRegisterPendingData,
  getRegistrationPayment,
  issueActivationToken,
  linkQuickRegisterPaymentUser,
  markRegistrationPaymentPaid,
  setAccountActivationStatus,
  type RegistrationPayment,
} from '@/lib/registration/registrationPayments';
import { decryptPrivateData } from '@/lib/payments/paymentSettings';
import {
  createDeadlinesForPayment,
  ensureMovesbookDeadlinesTable,
  markFirstDeadlinePaid,
} from '@/lib/movesbookDeadlines/movesbookDeadlines';
import { completeRenewalPayment, settleDeadlinePayment } from '@/lib/movesbookDeadlines/subscriptionStatus';
import { quickRegisterUser, type QuickRegisterPayload } from '@/lib/users/quickRegisterService';
import {
  ACTIVATION_EMAIL_BODY_EN,
  ACTIVATION_EMAIL_BODY_KEY,
  ACTIVATION_EMAIL_BUTTON_EN,
  ACTIVATION_EMAIL_BUTTON_KEY,
  ACTIVATION_EMAIL_SUBJECT_EN,
  ACTIVATION_EMAIL_SUBJECT_KEY,
  PAYMENT_SUCCESS_LONG_TEXT_EN,
  PAYMENT_SUCCESS_LONG_TEXT_KEY,
} from '@/constants/activationEmailLongText';

export const PAYMENT_SUCCESS_TEXT_KEY = PAYMENT_SUCCESS_LONG_TEXT_KEY;
export const PAYMENT_SUCCESS_FALLBACK_EN = PAYMENT_SUCCESS_LONG_TEXT_EN;

/** Long text from Settings → Language in the user's language, then English, then the fallback. */
export async function registrationLongText(
  key: string,
  language: string,
  fallbackEn: string,
): Promise<string> {
  const lang = (language || 'en').trim().toLowerCase();
  const rows = await prisma.translation.findMany({
    where: { key, language: { in: Array.from(new Set([lang, 'en'])) }, isDeleted: false },
    select: { language: true, value: true },
  });
  const pick = (code: string) => rows.find((r) => r.language === code && r.value?.trim())?.value;
  return (pick(lang) ?? pick('en') ?? fallbackEn).trim();
}

type OriginRequest = Parameters<typeof resolvePublicOrigin>[0];

/** Base URL for payment returns and activation links (keeps localhost while developing). */
export function registrationOrigin(request: OriginRequest): string {
  const own = request.nextUrl.origin.replace(/\/$/, '');
  if (isLocalOrigin(own) && !request.headers.get('x-forwarded-host')) return own;
  return resolvePublicOrigin(request);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{(name|username|link)\}/g, (_, k: string) => values[k] ?? '');
}

export async function sendActivationEmail(userId: string, origin: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, firstName: true, username: true },
  });
  if (!user?.email) return;
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { language: true },
  });
  const lang = settings?.language || 'en';
  const token = await issueActivationToken(userId);
  const link = `${origin.replace(/\/$/, '')}/register/activate?token=${token}`;
  const displayName = user.firstName?.trim() || user.name?.trim() || user.username;

  const [subject, body, buttonLabel] = await Promise.all([
    registrationLongText(ACTIVATION_EMAIL_SUBJECT_KEY, lang, ACTIVATION_EMAIL_SUBJECT_EN),
    registrationLongText(ACTIVATION_EMAIL_BODY_KEY, lang, ACTIVATION_EMAIL_BODY_EN),
    registrationLongText(ACTIVATION_EMAIL_BUTTON_KEY, lang, ACTIVATION_EMAIL_BUTTON_EN),
  ]);

  const values = {
    name: escapeHtml(displayName),
    username: escapeHtml(user.username),
    link: escapeHtml(link),
  };
  const bodyHtml = sanitizeRichHtml(fillPlaceholders(longTextDisplayHtml(body), values));
  const label = escapeHtml(
    buttonLabel.replace(/<[^>]*>/g, '').trim() || ACTIVATION_EMAIL_BUTTON_EN,
  );
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:560px">
  ${bodyHtml}
  <p style="margin:28px 0">
    <a href="${values.link}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block">${label}</a>
  </p>
  <p style="font-size:12px;color:#666">${values.link}</p>
</div>`;
  const text = `${fillPlaceholders(body.replace(/<[^>]*>/g, ''), {
    name: displayName,
    username: user.username,
    link,
  })}\n\n${buttonLabel.replace(/<[^>]*>/g, '')}: ${link}`;

  await sendIonosEmail({
    to: user.email,
    subject: subject.replace(/<[^>]*>/g, '').trim() || ACTIVATION_EMAIL_SUBJECT_EN,
    html,
    text,
  });
}

/**
 * Activation mail failures must not undo a registration or a payment. Callers do not wait for
 * it (SMTP can take up to 30 s); this needs a long-running server (`next start`), not serverless.
 */
export async function sendActivationEmailSafely(userId: string, origin: string): Promise<boolean> {
  try {
    await sendActivationEmail(userId, origin);
    return true;
  } catch (e) {
    console.error('Activation email failed for user', userId, e);
    return false;
  }
}

export function localAmountLabel(payment: Pick<RegistrationPayment, 'amountLocal' | 'currencyCode'>): string {
  if (payment.amountLocal == null || !payment.currencyCode || payment.currencyCode === 'EUR') return '';
  return formatLocalAmount(payment.amountLocal, payment.currencyCode);
}

/**
 * Verified payment → record it on the membership period, wait for activation, send the mail.
 * Safe to call twice: only the first call does the work.
 */
export async function finalizePaidRegistration(
  payment: RegistrationPayment,
  providerTxn: string,
  origin: string,
): Promise<void> {
  const first = await markRegistrationPaymentPaid(payment.id, providerTxn, payment.provider);
  if (!first) return;

  // Later deadline / renewal of an existing account: no activation step.
  const testPayMode = providerTxn.startsWith('test-') ? 'test' : undefined;
  if (payment.kind === 'deadline') {
    await settleDeadlinePayment(payment, testPayMode);
    return;
  }
  if (payment.kind === 'renewal') {
    await completeRenewalPayment(payment, testPayMode);
    return;
  }

  if (payment.kind === 'quick_register') {
    await completePaidQuickRegister(payment);
    await syncPaidPaymentDeadlines(payment.id);
    return;
  }
  await syncPaidPaymentDeadlines(payment.id);

  const settings = await prisma.userSettings.findUnique({
    where: { userId: payment.userId },
    select: { adminSettings: true },
  });
  if (settings) {
    const history = readNetworkSubscriptionHistory(settings.adminSettings);
    const next = history.map((p) =>
      p.id === payment.periodId
        ? {
            ...p,
            amountPaid: String(payment.amountEur),
            amountLocal: localAmountLabel(payment) || undefined,
            paymentMethod: payment.provider ?? 'online',
          }
        : p,
    );
    await prisma.userSettings.update({
      where: { userId: payment.userId },
      data: { adminSettings: mergeNetworkSubscriptionHistory(settings.adminSettings, next) },
    });
  }

  await setAccountActivationStatus(prisma, payment.userId, 'pending_activation');
  void sendActivationEmailSafely(payment.userId, origin);
}

/**
 * Paid promocode registration: create the account from the stored form data (credentials email included).
 * On failure the form data is kept so the account can still be created from the paid row.
 */
/**
 * Archive of Deadlines: the paid registration payment settles its first deadline. Deadlines are
 * created here when missing (quick register accounts exist only after payment; older payments).
 * Never blocks the payment flow.
 */
async function syncPaidPaymentDeadlines(paymentId: string): Promise<void> {
  try {
    const fresh = await getRegistrationPayment(paymentId);
    if (!fresh) return;
    await ensureMovesbookDeadlinesTable();
    await createDeadlinesForPayment(prisma, fresh, {
      dateStart: fresh.createdAt.toISOString().slice(0, 10),
      typology: 'A',
    });
    await markFirstDeadlinePaid(fresh.id, fresh.provider);
  } catch (e) {
    console.error('Archive of Deadlines update failed for payment', paymentId, e);
  }
}

async function completePaidQuickRegister(payment: RegistrationPayment): Promise<void> {
  const encrypted = await getQuickRegisterPendingData(payment.id);
  if (!encrypted) return;
  let payload: QuickRegisterPayload;
  try {
    payload = JSON.parse(decryptPrivateData(encrypted)) as QuickRegisterPayload;
  } catch (e) {
    console.error('Quick register payment', payment.id, 'has unreadable form data', e);
    return;
  }
  const result = await quickRegisterUser(payload, {
    paid: {
      provider: payment.provider ?? 'online',
      amountEur: payment.amountEur,
      amountLocal: localAmountLabel(payment),
    },
  });
  if (!result.success || !result.userId) {
    console.error('Quick register payment', payment.id, 'is paid but the account failed:', result.message);
    return;
  }
  await linkQuickRegisterPaymentUser(payment.id, result.userId);
}

/** Display data of the buyer, also before a quick-register account exists. */
export async function registrationPaymentBuyer(
  payment: RegistrationPayment,
): Promise<{ name: string; username: string; email: string }> {
  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { name: true, firstName: true, surname: true, username: true, email: true },
  });
  if (user) {
    return {
      name: [user.firstName, user.surname].filter(Boolean).join(' ').trim() || user.name || '',
      username: user.username,
      email: user.email,
    };
  }
  if (payment.kind !== 'quick_register') return { name: '', username: '', email: '' };
  const encrypted = await getQuickRegisterPendingData(payment.id);
  try {
    const data = encrypted ? (JSON.parse(decryptPrivateData(encrypted)) as QuickRegisterPayload) : null;
    return {
      name: '',
      username: data?.username?.trim() ?? '',
      email: data?.email?.trim() ?? payment.userId.replace(/^quick:/, ''),
    };
  } catch {
    return { name: '', username: '', email: payment.userId.replace(/^quick:/, '') };
  }
}
