import type { ActiveStripeCredentials } from '@/lib/payments/paymentSettings';

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeRequest<T>(
  creds: ActiveStripeCredentials,
  method: 'GET' | 'POST',
  path: string,
  form?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${creds.secretKey}`,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`Stripe: ${data.error?.message || `HTTP ${res.status}`}`);
  }
  return data;
}

export function euroCents(amountEur: number): number {
  return Math.round(amountEur * 100);
}

/** Hosted Stripe Checkout page for one EUR amount. */
export async function createStripeCheckoutSession(
  creds: ActiveStripeCredentials,
  input: {
    amountEur: number;
    productName: string;
    reference: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<{ id: string; url: string }> {
  const form: Record<string, string> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.reference,
    'metadata[registration_payment_id]': input.reference,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(euroCents(input.amountEur)),
    'line_items[0][price_data][product_data][name]': input.productName.slice(0, 250),
  };
  if (input.customerEmail) form.customer_email = input.customerEmail;
  const session = await stripeRequest<{ id: string; url: string | null }>(
    creds,
    'POST',
    '/checkout/sessions',
    form,
  );
  if (!session.url) throw new Error('Stripe: checkout session has no URL');
  return { id: session.id, url: session.url };
}

export type StripeSessionResult = {
  paid: boolean;
  amountCents: number;
  currency: string;
  reference: string | null;
  paymentIntent: string | null;
};

export async function retrieveStripeCheckoutSession(
  creds: ActiveStripeCredentials,
  sessionId: string,
): Promise<StripeSessionResult> {
  const session = await stripeRequest<{
    payment_status?: string;
    amount_total?: number | null;
    currency?: string | null;
    client_reference_id?: string | null;
    payment_intent?: string | { id?: string } | null;
  }>(creds, 'GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const intent = session.payment_intent;
  return {
    paid: session.payment_status === 'paid',
    amountCents: Number(session.amount_total ?? 0),
    currency: String(session.currency ?? '').toLowerCase(),
    reference: session.client_reference_id ?? null,
    paymentIntent: typeof intent === 'string' ? intent : intent?.id ?? null,
  };
}
