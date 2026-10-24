'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  MEMBER_PAYMENT_METHOD_VALUES,
  type MemberPaymentMethodSettings,
  type MemberPaymentSiteMode,
} from '@/lib/club/memberPaymentMethods';
import { PAYMENT_TYPE_OPTIONS } from '@/lib/procedures/payModes';

const API_PATH = '/api/club/settings/member-payment-methods';

type Gateway = 'stripe' | 'paypal';

type GatewaySecrets = {
  stripeTestSecret: string;
  stripeLiveSecret: string;
  paypalSandboxSecret: string;
  paypalLiveSecret: string;
};

const EMPTY_SECRETS: GatewaySecrets = {
  stripeTestSecret: '',
  stripeLiveSecret: '',
  paypalSandboxSecret: '',
  paypalLiveSecret: '',
};

const STEPS: Record<Gateway, string[]> = {
  stripe: [
    'Open dashboard.stripe.com and sign in. Create an account if you do not have one.',
    'With Test mode on, open Developers, then API keys. Copy the test publishable key and the test secret key.',
    'Turn Test mode off and copy the live publishable key and the live secret key.',
    'Paste both pairs below. A secret is shown only once in Stripe, so paste it before you leave that page.',
    'Press Save. The mode shown above decides which pair your members pay with.',
  ],
  paypal: [
    'Open developer.paypal.com and sign in with the PayPal account that should receive the money.',
    'Open Apps & Credentials. Under Sandbox, copy the Client ID and the Secret.',
    'Switch to Live and copy that Client ID and Secret as well.',
    'Paste both pairs below and press Save.',
    'The mode shown above decides which pair your members pay with.',
  ],
};

export default function MemberPaymentMethodsPage({ gateway }: { gateway?: Gateway }) {
  const [settings, setSettings] = useState<MemberPaymentMethodSettings | null>(null);
  const [entityName, setEntityName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<GatewaySecrets>(EMPTY_SECRETS);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await clubApiFetch<{
          settings: MemberPaymentMethodSettings;
          entityName?: string;
        }>(API_PATH, { signal: controller.signal });
        setSettings(data.settings);
        setEntityName(data.entityName ?? '');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load payment methods.');
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const persist = async (body: Record<string, unknown>, note: string) => {
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const data = await clubApiFetch<{ settings: MemberPaymentMethodSettings }>(API_PATH, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSettings(data.settings);
      setSecrets(EMPTY_SECRETS);
      setSavedNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMethod = (value: string) => {
    if (!settings) return;
    const enabled = settings.enabled.includes(value as (typeof settings.enabled)[number])
      ? settings.enabled.filter((item) => item !== value)
      : [...settings.enabled, value as (typeof settings.enabled)[number]];
    void persist({ enabled }, 'Payment methods saved.');
  };

  const toggleStripe = () => {
    if (!settings) return;
    void persist({ stripeEnabled: !settings.stripeEnabled }, 'Stripe choice saved.');
  };

  const saveGateway = (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !gateway) return;
    const secret = (value: string) => (value.trim() ? value.trim() : undefined);
    if (gateway === 'stripe') {
      void persist(
        {
          stripeEnabled: true,
          stripeTestPublishableKey: settings.stripeTestPublishableKey,
          stripeLivePublishableKey: settings.stripeLivePublishableKey,
          ...(secret(secrets.stripeTestSecret) ? { stripeTestSecret: secret(secrets.stripeTestSecret) } : {}),
          ...(secret(secrets.stripeLiveSecret) ? { stripeLiveSecret: secret(secrets.stripeLiveSecret) } : {}),
        },
        'Stripe keys saved.',
      );
      return;
    }
    void persist(
      {
        paypalSandboxClientId: settings.paypalSandboxClientId,
        paypalLiveClientId: settings.paypalLiveClientId,
        ...(secret(secrets.paypalSandboxSecret)
          ? { paypalSandboxSecret: secret(secrets.paypalSandboxSecret) }
          : {}),
        ...(secret(secrets.paypalLiveSecret) ? { paypalLiveSecret: secret(secrets.paypalLiveSecret) } : {}),
      },
      'PayPal keys saved.',
    );
  };

  return (
    <div className="min-h-full bg-[#f7f7f8] p-4 lg:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div>
          {gateway ? (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  gateway === 'paypal'
                    ? '/img/payment_logo/logo_paypal_brand.jpg'
                    : '/img/payment_logo/logo_stripe_brand.png'
                }
                alt={gateway === 'paypal' ? 'PayPal' : 'Stripe'}
                className={`h-16 w-auto object-contain ${gateway === 'stripe' ? 'rounded bg-black px-3 py-1' : ''}`}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/payment_logo/logo_movesbook_brand.jpg"
                alt="Movesbook"
                className="h-14 w-auto object-contain"
              />
            </div>
          ) : null}
          <h1 className="text-xl font-semibold text-gray-950">
            {gateway === 'stripe'
              ? 'Connect Stripe'
              : gateway === 'paypal'
                ? 'Connect PayPal'
                : 'Payment methods for members'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {entityName ? `${entityName} · ` : ''}
            Choose how your members are allowed to pay you.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {savedNote ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {savedNote}
          </div>
        ) : null}

        {loading || !settings ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading payment methods
          </div>
        ) : gateway ? (
          <GatewayForm
            gateway={gateway}
            settings={settings}
            secrets={secrets}
            saving={saving}
            onSecret={(field, value) => setSecrets((current) => ({ ...current, [field]: value }))}
            onChange={setSettings}
            onSubmit={saveGateway}
          />
        ) : (
          <MethodList
            settings={settings}
            saving={saving}
            onToggle={toggleMethod}
            onToggleStripe={toggleStripe}
          />
        )}
      </div>
    </div>
  );
}

function ModeStatus({ mode }: { mode: MemberPaymentSiteMode }) {
  const live = mode === 'live';
  return (
    <section className={`rounded-lg border-2 p-5 shadow-sm ${live ? 'border-green-500 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
      <h2 className="text-base font-semibold text-gray-900">Payment mode</h2>
      <p className="mt-1 text-sm text-gray-700">
        {live
          ? 'Live mode is on. Members pay with your live keys.'
          : 'Test mode is on. Members pay with your test keys.'}
      </p>
      <p className="mt-1 text-sm text-gray-600">Set by the Super Admin. This page cannot change it.</p>
      <span className={`mt-3 inline-block rounded px-2 py-0.5 text-xs font-bold text-white ${live ? 'bg-green-700' : 'bg-amber-600'}`}>
        {live ? 'LIVE' : 'TEST MODE'}
      </span>
    </section>
  );
}

function MethodList({
  settings,
  saving,
  onToggle,
  onToggleStripe,
}: {
  settings: MemberPaymentMethodSettings;
  saving: boolean;
  onToggle: (value: string) => void;
  onToggleStripe: () => void;
}) {
  const paypalOn = settings.enabled.includes('paypal');
  const stripeReady = settings.siteMode === 'live' ? settings.stripeLiveConfigured : settings.stripeTestConfigured;
  const paypalReady =
    settings.siteMode === 'live' ? settings.paypalLiveConfigured : settings.paypalSandboxConfigured;
  return (
    <>
      <ModeStatus mode={settings.siteMode} />
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Methods your members can use</h2>
        <p className="mt-1 text-sm text-gray-600">
          Tick a method to show it on member payments. Untick it to hide it. Cash, card, and bank
          transfer appear on the forms as soon as you tick them. For card or PayPal, save both the
          test keys and the live keys, then use Send payment module on the member. The member opens
          that link and the money goes to your account.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PAYMENT_TYPE_OPTIONS.filter((option) =>
            MEMBER_PAYMENT_METHOD_VALUES.includes(option.value),
          ).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={settings.enabled.includes(option.value)}
                disabled={saving}
                onChange={() => onToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={settings.stripeEnabled} disabled={saving} onChange={onToggleStripe} />
            Stripe (card payments to your Stripe account)
          </label>
        </div>
      </section>

      {paypalOn ? (
        <GatewayPrompt
          title="PayPal is enabled"
          ready={paypalReady}
          href="/club/settings/member_payment_methods/paypal"
          readyText={
            settings.siteMode === 'live'
              ? 'Live PayPal keys are saved. Members pay your live PayPal account.'
              : 'Sandbox PayPal keys are saved. Members pay your sandbox PayPal account.'
          }
          missingText={
            settings.siteMode === 'live'
              ? 'Live mode is on. Paste your live PayPal keys as well as the sandbox keys.'
              : 'Test mode is on. Paste your sandbox PayPal keys as well as the live keys.'
          }
        />
      ) : null}
      {settings.stripeEnabled ? (
        <GatewayPrompt
          title="Stripe is enabled"
          ready={stripeReady}
          href="/club/settings/member_payment_methods/stripe"
          readyText={
            settings.siteMode === 'live'
              ? 'Live Stripe keys are saved. Card payments go to your live Stripe account.'
              : 'Test Stripe keys are saved. Card payments go to your test Stripe account.'
          }
          missingText={
            settings.siteMode === 'live'
              ? 'Live mode is on. Paste your live Stripe keys as well as the test keys.'
              : 'Test mode is on. Paste your test Stripe keys as well as the live keys.'
          }
        />
      ) : null}
    </>
  );
}

function GatewayPrompt({
  title,
  ready,
  href,
  readyText,
  missingText,
}: {
  title: string;
  ready: boolean;
  href: string;
  readyText: string;
  missingText: string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{ready ? readyText : missingText}</p>
      <Link href={href} className="mt-3 inline-block rounded bg-[#7d0e1f] px-4 py-2 text-sm font-semibold text-white">
        {ready ? 'Review connection' : 'Open the setup page'}
      </Link>
    </section>
  );
}

function KeyPair({
  title,
  publicLabel,
  publicValue,
  publicPlaceholder,
  secretLabel,
  secretValue,
  secretSaved,
  saving,
  onPublic,
  onSecret,
}: {
  title: string;
  publicLabel: string;
  publicValue: string;
  publicPlaceholder: string;
  secretLabel: string;
  secretValue: string;
  secretSaved: boolean;
  saving: boolean;
  onPublic: (value: string) => void;
  onSecret: (value: string) => void;
}) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h3>
      <label className="mt-3 block text-sm font-medium text-gray-800">
        {publicLabel}
        <input
          value={publicValue}
          disabled={saving}
          onChange={(event) => onPublic(event.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder={publicPlaceholder}
          autoComplete="off"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-gray-800">
        {secretLabel}
        <input
          type="password"
          value={secretValue}
          disabled={saving}
          onChange={(event) => onSecret(event.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder={secretSaved ? 'Already saved. Paste a new one only to replace it.' : 'Paste the secret here'}
          autoComplete="new-password"
        />
      </label>
    </div>
  );
}

function GatewayForm({
  gateway,
  settings,
  secrets,
  saving,
  onSecret,
  onChange,
  onSubmit,
}: {
  gateway: Gateway;
  settings: MemberPaymentMethodSettings;
  secrets: GatewaySecrets;
  saving: boolean;
  onSecret: (field: keyof GatewaySecrets, value: string) => void;
  onChange: (next: MemberPaymentMethodSettings) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ModeStatus mode={settings.siteMode} />
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Do these steps in order</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {STEPS[gateway].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {gateway === 'stripe' ? (
            <>
              <KeyPair
                title="Test"
                publicLabel="Publishable key"
                publicValue={settings.stripeTestPublishableKey}
                publicPlaceholder="pk_test_..."
                secretLabel="Secret key"
                secretValue={secrets.stripeTestSecret}
                secretSaved={settings.stripeTestConfigured}
                saving={saving}
                onPublic={(value) => onChange({ ...settings, stripeTestPublishableKey: value })}
                onSecret={(value) => onSecret('stripeTestSecret', value)}
              />
              <KeyPair
                title="Live"
                publicLabel="Publishable key"
                publicValue={settings.stripeLivePublishableKey}
                publicPlaceholder="pk_live_..."
                secretLabel="Secret key"
                secretValue={secrets.stripeLiveSecret}
                secretSaved={settings.stripeLiveConfigured}
                saving={saving}
                onPublic={(value) => onChange({ ...settings, stripeLivePublishableKey: value })}
                onSecret={(value) => onSecret('stripeLiveSecret', value)}
              />
            </>
          ) : (
            <>
              <KeyPair
                title="Sandbox"
                publicLabel="Client ID"
                publicValue={settings.paypalSandboxClientId}
                publicPlaceholder="Sandbox client ID"
                secretLabel="Secret"
                secretValue={secrets.paypalSandboxSecret}
                secretSaved={settings.paypalSandboxConfigured}
                saving={saving}
                onPublic={(value) => onChange({ ...settings, paypalSandboxClientId: value })}
                onSecret={(value) => onSecret('paypalSandboxSecret', value)}
              />
              <KeyPair
                title="Live"
                publicLabel="Client ID"
                publicValue={settings.paypalLiveClientId}
                publicPlaceholder="Live client ID"
                secretLabel="Secret"
                secretValue={secrets.paypalLiveSecret}
                secretSaved={settings.paypalLiveConfigured}
                saving={saving}
                onPublic={(value) => onChange({ ...settings, paypalLiveClientId: value })}
                onSecret={(value) => onSecret('paypalLiveSecret', value)}
              />
            </>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#7d0e1f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href="/club/settings/member_payment_methods" className="text-sm text-blue-800 underline">
            Back to payment methods
          </Link>
        </div>
      </section>
    </form>
  );
}
