import { PAYMENT_TYPE_OPTIONS, type PaymentTypeValue } from '@/lib/procedures/payModes';

export const MEMBER_PAYMENT_METHOD_VALUES: PaymentTypeValue[] = PAYMENT_TYPE_OPTIONS.map(
  (option) => option.value,
);

/** Methods a new club or team can use before connecting PayPal or Stripe. */
export const DEFAULT_ENABLED_MEMBER_PAYMENTS: PaymentTypeValue[] = [
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'cheque',
];

/** Chosen by Super Admin. Clubs and teams store both pairs and cannot change this. */
export type MemberPaymentSiteMode = 'test' | 'live';

export type MemberPaymentMethodSettings = {
  enabled: PaymentTypeValue[];
  stripeEnabled: boolean;
  siteMode: MemberPaymentSiteMode;
  stripeTestPublishableKey: string;
  stripeTestConfigured: boolean;
  stripeLivePublishableKey: string;
  stripeLiveConfigured: boolean;
  paypalSandboxClientId: string;
  paypalSandboxConfigured: boolean;
  paypalLiveClientId: string;
  paypalLiveConfigured: boolean;
};

export type StoredMemberPaymentMethods = {
  enabled: PaymentTypeValue[];
  stripeEnabled: boolean;
  stripeTestPublishableKey: string;
  stripeTestSecret: string;
  stripeLivePublishableKey: string;
  stripeLiveSecret: string;
  paypalSandboxClientId: string;
  paypalSandboxSecret: string;
  paypalLiveClientId: string;
  paypalLiveSecret: string;
};

const SECRET_FIELDS = [
  'stripeTestSecret',
  'stripeLiveSecret',
  'paypalSandboxSecret',
  'paypalLiveSecret',
] as const;

export function factoryStoredMemberPaymentMethods(): StoredMemberPaymentMethods {
  return {
    enabled: [...DEFAULT_ENABLED_MEMBER_PAYMENTS],
    stripeEnabled: false,
    stripeTestPublishableKey: '',
    stripeTestSecret: '',
    stripeLivePublishableKey: '',
    stripeLiveSecret: '',
    paypalSandboxClientId: '',
    paypalSandboxSecret: '',
    paypalLiveClientId: '',
    paypalLiveSecret: '',
  };
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function enabledList(value: unknown, fallback: PaymentTypeValue[]): PaymentTypeValue[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<string>(MEMBER_PAYMENT_METHOD_VALUES);
  const next: PaymentTypeValue[] = [];
  for (const entry of value) {
    const code = text(entry);
    if (!allowed.has(code) || next.includes(code as PaymentTypeValue)) continue;
    next.push(code as PaymentTypeValue);
  }
  return next;
}

/** Older saves kept one key pair plus a mode. Fold that pair into the matching slot. */
function absorbLegacyPair(source: Record<string, unknown>, next: StoredMemberPaymentMethods) {
  const hasNewStripe = Boolean(
    text(source.stripeTestPublishableKey) ||
      text(source.stripeLivePublishableKey) ||
      text(source.stripeTestSecret) ||
      text(source.stripeLiveSecret),
  );
  if (!hasNewStripe && (text(source.stripePublishableKey) || text(source.stripeSecret))) {
    if (text(source.stripeMode) === 'live') {
      if (!next.stripeLivePublishableKey) next.stripeLivePublishableKey = text(source.stripePublishableKey).slice(0, 500);
      if (!next.stripeLiveSecret) next.stripeLiveSecret = text(source.stripeSecret).slice(0, 500);
    } else {
      if (!next.stripeTestPublishableKey) next.stripeTestPublishableKey = text(source.stripePublishableKey).slice(0, 500);
      if (!next.stripeTestSecret) next.stripeTestSecret = text(source.stripeSecret).slice(0, 500);
    }
  }
  const hasNewPaypal = Boolean(
    text(source.paypalSandboxClientId) ||
      text(source.paypalLiveClientId) ||
      text(source.paypalSandboxSecret) ||
      text(source.paypalLiveSecret),
  );
  if (!hasNewPaypal && (text(source.paypalClientId) || text(source.paypalSecret))) {
    if (text(source.paypalMode) === 'live') {
      if (!next.paypalLiveClientId) next.paypalLiveClientId = text(source.paypalClientId).slice(0, 500);
      if (!next.paypalLiveSecret) next.paypalLiveSecret = text(source.paypalSecret).slice(0, 500);
    } else {
      if (!next.paypalSandboxClientId) next.paypalSandboxClientId = text(source.paypalClientId).slice(0, 500);
      if (!next.paypalSandboxSecret) next.paypalSandboxSecret = text(source.paypalSecret).slice(0, 500);
    }
  }
}

export function normalizeStoredMemberPaymentMethods(
  input: unknown,
  previous?: StoredMemberPaymentMethods,
): StoredMemberPaymentMethods {
  const prev = previous ?? factoryStoredMemberPaymentMethods();
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const field = (key: keyof StoredMemberPaymentMethods, previousValue: string) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return previousValue;
    const value = text(source[key]);
    if (!value && (SECRET_FIELDS as readonly string[]).includes(key)) return previousValue;
    return value.slice(0, 500);
  };
  const next: StoredMemberPaymentMethods = {
    enabled: enabledList(source.enabled, prev.enabled),
    stripeEnabled: Object.prototype.hasOwnProperty.call(source, 'stripeEnabled')
      ? Boolean(source.stripeEnabled)
      : prev.stripeEnabled,
    stripeTestPublishableKey: field('stripeTestPublishableKey', prev.stripeTestPublishableKey),
    stripeTestSecret: field('stripeTestSecret', prev.stripeTestSecret),
    stripeLivePublishableKey: field('stripeLivePublishableKey', prev.stripeLivePublishableKey),
    stripeLiveSecret: field('stripeLiveSecret', prev.stripeLiveSecret),
    paypalSandboxClientId: field('paypalSandboxClientId', prev.paypalSandboxClientId),
    paypalSandboxSecret: field('paypalSandboxSecret', prev.paypalSandboxSecret),
    paypalLiveClientId: field('paypalLiveClientId', prev.paypalLiveClientId),
    paypalLiveSecret: field('paypalLiveSecret', prev.paypalLiveSecret),
  };
  absorbLegacyPair(source, next);
  return next;
}

export function stripeKeysForMode(
  stored: StoredMemberPaymentMethods,
  siteMode: MemberPaymentSiteMode,
): { publishableKey: string; secret: string } | null {
  const publishableKey =
    siteMode === 'live' ? stored.stripeLivePublishableKey : stored.stripeTestPublishableKey;
  const secret = siteMode === 'live' ? stored.stripeLiveSecret : stored.stripeTestSecret;
  if (!publishableKey || !secret) return null;
  return { publishableKey, secret };
}

export function paypalKeysForMode(
  stored: StoredMemberPaymentMethods,
  siteMode: MemberPaymentSiteMode,
): { clientId: string; secret: string } | null {
  const clientId = siteMode === 'live' ? stored.paypalLiveClientId : stored.paypalSandboxClientId;
  const secret = siteMode === 'live' ? stored.paypalLiveSecret : stored.paypalSandboxSecret;
  if (!clientId || !secret) return null;
  return { clientId, secret };
}

export function memberGatewayReady(
  stored: StoredMemberPaymentMethods,
  provider: 'stripe' | 'paypal',
  siteMode: MemberPaymentSiteMode,
): boolean {
  if (provider === 'stripe') return stored.stripeEnabled && stripeKeysForMode(stored, siteMode) !== null;
  return stored.enabled.includes('paypal') && paypalKeysForMode(stored, siteMode) !== null;
}

export function toPublicMemberPaymentSettings(
  stored: StoredMemberPaymentMethods,
  siteMode: MemberPaymentSiteMode,
): MemberPaymentMethodSettings {
  return {
    enabled: stored.enabled,
    stripeEnabled: stored.stripeEnabled,
    siteMode,
    stripeTestPublishableKey: stored.stripeTestPublishableKey,
    stripeTestConfigured: Boolean(stored.stripeTestPublishableKey && stored.stripeTestSecret),
    stripeLivePublishableKey: stored.stripeLivePublishableKey,
    stripeLiveConfigured: Boolean(stored.stripeLivePublishableKey && stored.stripeLiveSecret),
    paypalSandboxClientId: stored.paypalSandboxClientId,
    paypalSandboxConfigured: Boolean(stored.paypalSandboxClientId && stored.paypalSandboxSecret),
    paypalLiveClientId: stored.paypalLiveClientId,
    paypalLiveConfigured: Boolean(stored.paypalLiveClientId && stored.paypalLiveSecret),
  };
}
