'use client';

import { useEffect, useState } from 'react';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import type { PaymentSettingsAdminView } from '@/lib/payments/paymentSettings';

type SecretField =
  | 'stripeTestSecret'
  | 'stripeLiveSecret'
  | 'paypalSandboxSecret'
  | 'paypalLiveSecret';

type ClearFlags = Record<SecretField, boolean>;

const NO_CLEAR: ClearFlags = {
  stripeTestSecret: false,
  stripeLiveSecret: false,
  paypalSandboxSecret: false,
  paypalLiveSecret: false,
};

const NO_SECRETS: Record<SecretField, string> = {
  stripeTestSecret: '',
  stripeLiveSecret: '',
  paypalSandboxSecret: '',
  paypalLiveSecret: '',
};

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
      />
    </label>
  );
}

function SecretInput({
  label,
  hint,
  value,
  cleared,
  onChange,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  cleared: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const stored = hint && !cleared;
  return (
    <div className="text-sm">
      <span className="mb-1 block font-semibold text-gray-700">{label}</span>
      <input
        type="password"
        value={value}
        autoComplete="new-password"
        placeholder={stored ? `Saved (${hint}) — type to replace` : 'Not set'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
      />
      {stored ? (
        <button type="button" onClick={onClear} className="mt-1 text-xs text-red-700 hover:underline">
          Remove saved key
        </button>
      ) : cleared ? (
        <span className="mt-1 block text-xs text-red-700">Will be removed on save</span>
      ) : null}
    </div>
  );
}

export default function PaymentSettingsPanel() {
  const [settings, setSettings] = useState<PaymentSettingsAdminView | null>(null);
  const [secrets, setSecrets] = useState(NO_SECRETS);
  const [clear, setClear] = useState<ClearFlags>(NO_CLEAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const token = getAdminBearerToken();
    if (!token) {
      setMessage({ tone: 'error', text: 'Not authenticated' });
      setLoading(false);
      return;
    }
    void fetch('/api/admin/payment-settings', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setSettings(data.settings);
      })
      .catch((e) => setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Failed to load' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!settings) {
    return <div className="p-6 text-sm text-red-700">{message?.text ?? 'Payment settings unavailable'}</div>;
  }

  const setStripe = (patch: Partial<PaymentSettingsAdminView['stripe']>) =>
    setSettings((s) => (s ? { ...s, stripe: { ...s.stripe, ...patch } } : s));
  const setPaypal = (patch: Partial<PaymentSettingsAdminView['paypal']>) =>
    setSettings((s) => (s ? { ...s, paypal: { ...s.paypal, ...patch } } : s));
  const setSecret = (field: SecretField, value: string) => {
    setSecrets((prev) => ({ ...prev, [field]: value }));
    if (value) setClear((prev) => ({ ...prev, [field]: false }));
  };

  const save = async () => {
    const token = getAdminBearerToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: settings.testMode,
          stripe: {
            enabled: settings.stripe.enabled,
            mode: settings.stripe.mode,
            testPublishableKey: settings.stripe.testPublishableKey,
            testSecretKey: secrets.stripeTestSecret,
            clearTestSecretKey: clear.stripeTestSecret,
            livePublishableKey: settings.stripe.livePublishableKey,
            liveSecretKey: secrets.stripeLiveSecret,
            clearLiveSecretKey: clear.stripeLiveSecret,
          },
          paypal: {
            enabled: settings.paypal.enabled,
            mode: settings.paypal.mode,
            sandboxClientId: settings.paypal.sandboxClientId,
            sandboxSecret: secrets.paypalSandboxSecret,
            clearSandboxSecret: clear.paypalSandboxSecret,
            liveClientId: settings.paypal.liveClientId,
            liveSecret: secrets.paypalLiveSecret,
            clearLiveSecret: clear.paypalLiveSecret,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.settings);
      setSecrets(NO_SECRETS);
      setClear(NO_CLEAR);
      setMessage({ tone: 'ok', text: 'Payment settings saved.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-6">
      <div className="bg-[#a51d2d] px-4 py-2.5 text-lg font-bold text-white">Payment settings</div>

      <section
        className={`rounded border-2 p-4 ${settings.testMode ? 'border-amber-400 bg-amber-50' : 'border-green-500 bg-green-50'}`}
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.testMode}
            onChange={(e) => setSettings({ ...settings, testMode: e.target.checked })}
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="block text-base font-bold text-gray-900">Site payments in test mode</span>
            <span className="block text-sm text-gray-700">
              While ticked, registration does <b>not</b> ask for a payment: the account is created as if paid
              (amount recorded as 0 / Test) and the user receives the activation email. Untick only when the
              Stripe / PayPal keys below are working, otherwise new users cannot register.
            </span>
            <span
              className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-bold text-white ${settings.testMode ? 'bg-amber-600' : 'bg-green-700'}`}
            >
              {settings.testMode ? 'TEST MODE — no payment requested' : 'LIVE — registration requires payment'}
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#635bff]">Stripe (credit cards)</h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={settings.stripe.enabled}
              onChange={(e) => setStripe({ enabled: e.target.checked })}
            />
            Offer Stripe on the payment page
          </label>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="font-semibold text-gray-700">Keys in use:</span>
          {(['test', 'live'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1">
              <input
                type="radio"
                name="stripe-mode"
                checked={settings.stripe.mode === mode}
                onChange={() => setStripe({ mode })}
              />
              {mode === 'test' ? 'Test keys' : 'Live keys'}
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded border border-gray-200 p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Test</div>
            <TextInput
              label="Publishable key"
              placeholder="pk_test_…"
              value={settings.stripe.testPublishableKey}
              onChange={(v) => setStripe({ testPublishableKey: v })}
            />
            <SecretInput
              label="Secret key"
              hint={settings.stripe.testSecretKeyHint}
              value={secrets.stripeTestSecret}
              cleared={clear.stripeTestSecret}
              onChange={(v) => setSecret('stripeTestSecret', v)}
              onClear={() => setClear((c) => ({ ...c, stripeTestSecret: true }))}
            />
          </div>
          <div className="space-y-2 rounded border border-gray-200 p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Live</div>
            <TextInput
              label="Publishable key"
              placeholder="pk_live_…"
              value={settings.stripe.livePublishableKey}
              onChange={(v) => setStripe({ livePublishableKey: v })}
            />
            <SecretInput
              label="Secret key"
              hint={settings.stripe.liveSecretKeyHint}
              value={secrets.stripeLiveSecret}
              cleared={clear.stripeLiveSecret}
              onChange={(v) => setSecret('stripeLiveSecret', v)}
              onClear={() => setClear((c) => ({ ...c, stripeLiveSecret: true }))}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#003087]">PayPal</h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={settings.paypal.enabled}
              onChange={(e) => setPaypal({ enabled: e.target.checked })}
            />
            Offer PayPal on the payment page
          </label>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="font-semibold text-gray-700">Keys in use:</span>
          {(['sandbox', 'live'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1">
              <input
                type="radio"
                name="paypal-mode"
                checked={settings.paypal.mode === mode}
                onChange={() => setPaypal({ mode })}
              />
              {mode === 'sandbox' ? 'Sandbox (test)' : 'Live'}
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded border border-gray-200 p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Sandbox</div>
            <TextInput
              label="Client ID"
              value={settings.paypal.sandboxClientId}
              onChange={(v) => setPaypal({ sandboxClientId: v })}
            />
            <SecretInput
              label="Secret"
              hint={settings.paypal.sandboxSecretHint}
              value={secrets.paypalSandboxSecret}
              cleared={clear.paypalSandboxSecret}
              onChange={(v) => setSecret('paypalSandboxSecret', v)}
              onClear={() => setClear((c) => ({ ...c, paypalSandboxSecret: true }))}
            />
          </div>
          <div className="space-y-2 rounded border border-gray-200 p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Live</div>
            <TextInput
              label="Client ID"
              value={settings.paypal.liveClientId}
              onChange={(v) => setPaypal({ liveClientId: v })}
            />
            <SecretInput
              label="Secret"
              hint={settings.paypal.liveSecretHint}
              value={secrets.paypalLiveSecret}
              cleared={clear.paypalLiveSecret}
              onChange={(v) => setSecret('paypalLiveSecret', v)}
              onClear={() => setClear((c) => ({ ...c, paypalLiveSecret: true }))}
            />
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Secret keys are stored encrypted and are never shown again.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded bg-[#222] px-6 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message ? (
          <span className={`text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
