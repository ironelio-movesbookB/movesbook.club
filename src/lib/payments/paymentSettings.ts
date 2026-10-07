import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { ensurePromocodeAppSettingsTable } from '@/lib/promocodes/promocodeAppSettings';

/** Settings scope: the whole site today; clubs/teams get `club:<id>` scopes later. */
export const SITE_PAYMENT_SCOPE = 'site';

export type StripeKeyMode = 'test' | 'live';
export type PaypalKeyMode = 'sandbox' | 'live';

type StoredKeys = {
  stripe: {
    enabled: boolean;
    mode: StripeKeyMode;
    testPublishableKey: string;
    testSecretKeyEnc: string;
    livePublishableKey: string;
    liveSecretKeyEnc: string;
  };
  paypal: {
    enabled: boolean;
    mode: PaypalKeyMode;
    sandboxClientId: string;
    sandboxSecretEnc: string;
    liveClientId: string;
    liveSecretEnc: string;
  };
};

type StoredPaymentSettings = StoredKeys & {
  /** When true, registration skips payment (accounts are created as if paid). */
  testMode: boolean;
};

/** Admin view: secrets are never returned, only whether they exist and their last 4 chars. */
export type PaymentSettingsAdminView = {
  testMode: boolean;
  stripe: {
    enabled: boolean;
    mode: StripeKeyMode;
    testPublishableKey: string;
    testSecretKeyHint: string;
    livePublishableKey: string;
    liveSecretKeyHint: string;
  };
  paypal: {
    enabled: boolean;
    mode: PaypalKeyMode;
    sandboxClientId: string;
    sandboxSecretHint: string;
    liveClientId: string;
    liveSecretHint: string;
  };
};

/** Admin save payload: empty secret = keep the stored one; `clear*` = remove it. */
export type PaymentSettingsInput = {
  testMode?: boolean;
  stripe?: {
    enabled?: boolean;
    mode?: StripeKeyMode;
    testPublishableKey?: string;
    testSecretKey?: string;
    clearTestSecretKey?: boolean;
    livePublishableKey?: string;
    liveSecretKey?: string;
    clearLiveSecretKey?: boolean;
  };
  paypal?: {
    enabled?: boolean;
    mode?: PaypalKeyMode;
    sandboxClientId?: string;
    sandboxSecret?: string;
    clearSandboxSecret?: boolean;
    liveClientId?: string;
    liveSecret?: string;
    clearLiveSecret?: boolean;
  };
};

export type ActiveStripeCredentials = {
  mode: StripeKeyMode;
  publishableKey: string;
  secretKey: string;
};

export type ActivePaypalCredentials = {
  mode: PaypalKeyMode;
  clientId: string;
  secret: string;
};

export type ActivePaymentCredentials = {
  testMode: boolean;
  stripe: ActiveStripeCredentials | null;
  paypal: ActivePaypalCredentials | null;
};

function settingKey(scope: string): string {
  return `payment_settings:${scope}`.slice(0, 64);
}

function defaultSettings(): StoredPaymentSettings {
  return {
    testMode: true,
    stripe: {
      enabled: false,
      mode: 'test',
      testPublishableKey: '',
      testSecretKeyEnc: '',
      livePublishableKey: '',
      liveSecretKeyEnc: '',
    },
    paypal: {
      enabled: false,
      mode: 'sandbox',
      sandboxClientId: '',
      sandboxSecretEnc: '',
      liveClientId: '',
      liveSecretEnc: '',
    },
  };
}

/** Both domains share the database, so they must share this secret to read the keys. */
function encryptionKey(): Buffer {
  const secret =
    process.env.PAYMENT_KEYS_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'movesbook-nextjs-jwt-secret-key-2024';
  return crypto.createHash('sha256').update(`movesbook-payment-keys:${secret}`).digest();
}

function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value: string): string {
  if (!value) return '';
  try {
    const [version, ivB64, tagB64, dataB64] = value.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) return '';
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    console.error('Payment settings: a stored secret key cannot be decrypted (PAYMENT_KEYS_SECRET changed?)');
    return '';
  }
}

function hint(encrypted: string): string {
  const plain = decryptSecret(encrypted);
  return plain ? `••••${plain.slice(-4)}` : '';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseStored(raw: string | null | undefined): StoredPaymentSettings {
  const base = defaultSettings();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPaymentSettings>;
    return {
      testMode: typeof parsed.testMode === 'boolean' ? parsed.testMode : true,
      stripe: { ...base.stripe, ...(parsed.stripe ?? {}) },
      paypal: { ...base.paypal, ...(parsed.paypal ?? {}) },
    };
  } catch {
    return base;
  }
}

async function loadStored(scope: string): Promise<StoredPaymentSettings> {
  await ensurePromocodeAppSettingsTable();
  const rows = await prisma.$queryRawUnsafe<{ setting_value: string | null }[]>(
    `SELECT setting_value FROM promocode_app_settings WHERE setting_key = ? LIMIT 1`,
    settingKey(scope),
  );
  return parseStored(rows[0]?.setting_value);
}

async function writeStored(scope: string, settings: StoredPaymentSettings): Promise<void> {
  await ensurePromocodeAppSettingsTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO promocode_app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    settingKey(scope),
    JSON.stringify(settings),
  );
}

function toAdminView(s: StoredPaymentSettings): PaymentSettingsAdminView {
  return {
    testMode: s.testMode,
    stripe: {
      enabled: s.stripe.enabled,
      mode: s.stripe.mode,
      testPublishableKey: s.stripe.testPublishableKey,
      testSecretKeyHint: hint(s.stripe.testSecretKeyEnc),
      livePublishableKey: s.stripe.livePublishableKey,
      liveSecretKeyHint: hint(s.stripe.liveSecretKeyEnc),
    },
    paypal: {
      enabled: s.paypal.enabled,
      mode: s.paypal.mode,
      sandboxClientId: s.paypal.sandboxClientId,
      sandboxSecretHint: hint(s.paypal.sandboxSecretEnc),
      liveClientId: s.paypal.liveClientId,
      liveSecretHint: hint(s.paypal.liveSecretEnc),
    },
  };
}

export async function getPaymentSettingsAdmin(
  scope = SITE_PAYMENT_SCOPE,
): Promise<PaymentSettingsAdminView> {
  return toAdminView(await loadStored(scope));
}

function nextSecret(current: string, incoming: unknown, clear: unknown): string {
  if (clear === true) return '';
  const plain = str(incoming);
  return plain ? encryptSecret(plain) : current;
}

export async function savePaymentSettings(
  input: PaymentSettingsInput,
  scope = SITE_PAYMENT_SCOPE,
): Promise<PaymentSettingsAdminView> {
  const current = await loadStored(scope);
  const stripeIn = input.stripe ?? {};
  const paypalIn = input.paypal ?? {};
  const next: StoredPaymentSettings = {
    testMode: typeof input.testMode === 'boolean' ? input.testMode : current.testMode,
    stripe: {
      enabled: typeof stripeIn.enabled === 'boolean' ? stripeIn.enabled : current.stripe.enabled,
      mode: stripeIn.mode === 'live' || stripeIn.mode === 'test' ? stripeIn.mode : current.stripe.mode,
      testPublishableKey:
        stripeIn.testPublishableKey !== undefined
          ? str(stripeIn.testPublishableKey)
          : current.stripe.testPublishableKey,
      testSecretKeyEnc: nextSecret(
        current.stripe.testSecretKeyEnc,
        stripeIn.testSecretKey,
        stripeIn.clearTestSecretKey,
      ),
      livePublishableKey:
        stripeIn.livePublishableKey !== undefined
          ? str(stripeIn.livePublishableKey)
          : current.stripe.livePublishableKey,
      liveSecretKeyEnc: nextSecret(
        current.stripe.liveSecretKeyEnc,
        stripeIn.liveSecretKey,
        stripeIn.clearLiveSecretKey,
      ),
    },
    paypal: {
      enabled: typeof paypalIn.enabled === 'boolean' ? paypalIn.enabled : current.paypal.enabled,
      mode:
        paypalIn.mode === 'live' || paypalIn.mode === 'sandbox' ? paypalIn.mode : current.paypal.mode,
      sandboxClientId:
        paypalIn.sandboxClientId !== undefined
          ? str(paypalIn.sandboxClientId)
          : current.paypal.sandboxClientId,
      sandboxSecretEnc: nextSecret(
        current.paypal.sandboxSecretEnc,
        paypalIn.sandboxSecret,
        paypalIn.clearSandboxSecret,
      ),
      liveClientId:
        paypalIn.liveClientId !== undefined ? str(paypalIn.liveClientId) : current.paypal.liveClientId,
      liveSecretEnc: nextSecret(
        current.paypal.liveSecretEnc,
        paypalIn.liveSecret,
        paypalIn.clearLiveSecret,
      ),
    },
  };
  await writeStored(scope, next);
  return toAdminView(next);
}

/** Server-only: decrypted keys of the selected mode, or null when a provider is off/incomplete. */
export async function getActivePaymentCredentials(
  scope = SITE_PAYMENT_SCOPE,
): Promise<ActivePaymentCredentials> {
  const s = await loadStored(scope);

  let stripe: ActiveStripeCredentials | null = null;
  if (s.stripe.enabled) {
    const live = s.stripe.mode === 'live';
    const secretKey = decryptSecret(live ? s.stripe.liveSecretKeyEnc : s.stripe.testSecretKeyEnc);
    const publishableKey = live ? s.stripe.livePublishableKey : s.stripe.testPublishableKey;
    if (secretKey) stripe = { mode: s.stripe.mode, publishableKey, secretKey };
  }

  let paypal: ActivePaypalCredentials | null = null;
  if (s.paypal.enabled) {
    const live = s.paypal.mode === 'live';
    const clientId = live ? s.paypal.liveClientId : s.paypal.sandboxClientId;
    const secret = decryptSecret(live ? s.paypal.liveSecretEnc : s.paypal.sandboxSecretEnc);
    if (clientId && secret) paypal = { mode: s.paypal.mode, clientId, secret };
  }

  return { testMode: s.testMode, stripe, paypal };
}
