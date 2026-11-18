'use client';

import { useCallback, useEffect, useState } from 'react';
import { inputClass, labelClass, primaryButton, secondaryButton, dangerButton } from '@/components/club/events/eventUi';
import { eventApi } from '@/lib/club/events/eventClient';
import type { ClubEventDiscountRule, ClubEventSettings } from '@/lib/club/events/eventConstants';

const HIDDEN_KEY = 'clubEventSettingsHidden';

export default function EventSettingsCard() {
  const [settings, setSettings] = useState<ClubEventSettings>({
    disableSubscriptionEmails: false,
    autoRemoveExpired: false,
    requireConfirmation: true,
  });
  const [rules, setRules] = useState<ClubEventDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [minSubevents, setMinSubevents] = useState('2');
  const [discountPercent, setDiscountPercent] = useState('5');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(HIDDEN_KEY) === '1');
  }, []);

  const toggleHidden = () => {
    setHidden((h) => {
      localStorage.setItem(HIDDEN_KEY, h ? '0' : '1');
      return !h;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await eventApi<{ settings: ClubEventSettings; discountRules: ClubEventDiscountRule[] }>(
        '/settings',
      );
      setSettings(data.settings);
      setRules(data.discountRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await eventApi<{ settings: ClubEventSettings }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            disableSubscriptionEmails: settings.disableSubscriptionEmails,
            requireConfirmation: settings.requireConfirmation,
          },
        }),
      });
      setSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await eventApi<{ discountRules: ClubEventDiscountRule[] }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'add-rule',
          minSubevents: Number(minSubevents),
          discountPercent: Number(discountPercent),
        }),
      });
      setRules(data.discountRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm('Remove this discount rule?')) return;
    setSaving(true);
    try {
      const data = await eventApi<{ discountRules: ClubEventDiscountRule[] }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'delete-rule', id }),
      });
      setRules(data.discountRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Event settings</h2>
        <button
          type="button"
          className="text-sm font-semibold text-red-600 hover:underline"
          aria-expanded={!hidden}
          onClick={toggleHidden}
        >
          {hidden ? 'Show' : 'Hide'}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Email notifications and multi-selection discounts when a visitor picks several sub-events.
      </p>
      {hidden ? null : error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {hidden ? null : loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={settings.disableSubscriptionEmails}
              onChange={(e) => setSettings((s) => ({ ...s, disableSubscriptionEmails: e.target.checked }))}
            />
            Disable subscription confirmation emails
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              disabled={settings.disableSubscriptionEmails}
              checked={settings.requireConfirmation && !settings.disableSubscriptionEmails}
              onChange={(e) => setSettings((s) => ({ ...s, requireConfirmation: e.target.checked }))}
            />
            Ask subscribers to confirm with the link in the email (status Confirmed after the click)
          </label>
          <button type="button" className={primaryButton} disabled={saving} onClick={() => void saveSettings()}>
            Save settings
          </button>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Discount rules (by number of selections)</h3>
            <p className="mt-1 text-xs text-gray-500">
              Example: 2 selections → 5%, 3 selections → 10%. Highest matching rule applies.
            </p>
            <ul className="mt-3 space-y-2">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <span>
                    {r.minSubevents} selection(s) → {r.discountPercent}% off
                  </span>
                  <button type="button" className={dangerButton} onClick={() => void deleteRule(r.id)}>
                    Delete
                  </button>
                </li>
              ))}
              {!rules.length ? <li className="text-sm text-gray-500">No rules yet.</li> : null}
            </ul>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Min. selections</label>
                <input className={inputClass} value={minSubevents} onChange={(e) => setMinSubevents(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Discount %</label>
                <input
                  className={inputClass}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button type="button" className={secondaryButton} disabled={saving} onClick={() => void addRule()}>
                  Add rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
