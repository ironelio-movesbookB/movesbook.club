import type { ActivePaypalCredentials } from '@/lib/payments/paymentSettings';

function apiBase(creds: ActivePaypalCredentials): string {
  return creds.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function accessToken(creds: ActivePaypalCredentials): Promise<string> {
  const res = await fetch(`${apiBase(creds)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(`PayPal: ${data.error_description || `authentication failed (HTTP ${res.status})`}`);
  }
  return data.access_token;
}

type PaypalOrder = {
  id: string;
  status?: string;
  links?: { href: string; rel: string }[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: {
      captures?: {
        id: string;
        status?: string;
        custom_id?: string;
        amount?: { value?: string; currency_code?: string };
      }[];
    };
  }[];
  details?: { issue?: string; description?: string }[];
  message?: string;
};

async function paypalRequest(
  creds: ActivePaypalCredentials,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: PaypalOrder }> {
  const token = await accessToken(creds);
  const res = await fetch(`${apiBase(creds)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as PaypalOrder;
  return { ok: res.ok, status: res.status, data };
}

function paypalError(data: PaypalOrder, status: number): Error {
  const detail = data.details?.[0];
  return new Error(`PayPal: ${detail?.description || detail?.issue || data.message || `HTTP ${status}`}`);
}

export function euroValue(amountEur: number): string {
  return (Math.round(amountEur * 100) / 100).toFixed(2);
}

/** PayPal order in EUR; the buyer approves it on the returned URL. */
export async function createPaypalOrder(
  creds: ActivePaypalCredentials,
  input: {
    amountEur: number;
    description: string;
    reference: string;
    returnUrl: string;
    cancelUrl: string;
  },
): Promise<{ id: string; approveUrl: string }> {
  const { ok, status, data } = await paypalRequest(creds, 'POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: input.reference,
        custom_id: input.reference,
        description: input.description.slice(0, 127),
        amount: { currency_code: 'EUR', value: euroValue(input.amountEur) },
      },
    ],
    application_context: {
      brand_name: 'Movesbook',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    },
  });
  if (!ok) throw paypalError(data, status);
  const approveUrl = data.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href;
  if (!approveUrl) throw new Error('PayPal: order has no approval link');
  return { id: data.id, approveUrl };
}

export type PaypalCaptureResult = {
  completed: boolean;
  amountValue: string;
  currency: string;
  reference: string | null;
  captureId: string | null;
};

function orderReference(order: PaypalOrder): string | null {
  const unit = order.purchase_units?.[0];
  return (
    unit?.custom_id ?? unit?.payments?.captures?.[0]?.custom_id ?? unit?.reference_id ?? null
  );
}

function captureResult(order: PaypalOrder): PaypalCaptureResult {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((c) => c.status === 'COMPLETED');
  return {
    completed: order.status === 'COMPLETED' && Boolean(capture),
    amountValue: capture?.amount?.value ?? unit?.amount?.value ?? '',
    currency: (capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? '').toUpperCase(),
    reference: orderReference(order),
    captureId: capture?.id ?? null,
  };
}

/**
 * Captures an approved order that belongs to `expectedReference`; an order captured earlier
 * is read back instead. Orders of another reference are never captured.
 */
export async function capturePaypalOrder(
  creds: ActivePaypalCredentials,
  orderId: string,
  expectedReference: string,
): Promise<PaypalCaptureResult> {
  const id = encodeURIComponent(orderId);
  const order = await paypalRequest(creds, 'GET', `/v2/checkout/orders/${id}`);
  if (!order.ok) throw paypalError(order.data, order.status);
  if (orderReference(order.data) !== expectedReference) {
    return { ...captureResult(order.data), completed: false };
  }
  if (order.data.status === 'COMPLETED') return captureResult(order.data);

  const captured = await paypalRequest(creds, 'POST', `/v2/checkout/orders/${id}/capture`, {});
  if (captured.ok) {
    const result = captureResult(captured.data);
    return { ...result, reference: result.reference ?? expectedReference };
  }
  const alreadyCaptured = captured.data.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');
  if (!alreadyCaptured) throw paypalError(captured.data, captured.status);
  const reread = await paypalRequest(creds, 'GET', `/v2/checkout/orders/${id}`);
  if (!reread.ok) throw paypalError(reread.data, reread.status);
  return captureResult(reread.data);
}
