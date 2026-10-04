'use client';

import { useState } from 'react';
import type { ClubPurchaseAccountPack, ClubPurchaseAccountsSettings } from '@/types/clubPurchaseAccounts';
import {
  recalcPackTotals,
  saveClubPurchaseAccountsSettings,
} from '@/lib/admin/clubPurchaseAccountsMock';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import { packToDisplayRow } from '@/lib/admin/clubAccountPackPricing';
import ClubAccountPackPricingSections from '@/components/club/ClubAccountPackPricingSections';
import SubscriptionLanguageTabs from './SubscriptionLanguageTabs';
import RichTextEditor from '@/components/shared/RichTextEditor';

type ClubPurchaseNewAccountsPanelProps = {
  initialSettings: ClubPurchaseAccountsSettings;
};

function YesNoRadio({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name={name}
          checked={value}
          onChange={() => onChange(true)}
        />
        Y
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name={name}
          checked={!value}
          onChange={() => onChange(false)}
        />
        N
      </label>
    </div>
  );
}

function displayRowToPack(row: ReturnType<typeof packToDisplayRow>): ClubPurchaseAccountPack {
  return {
    versionKey: row.versionKey,
    versionLabel: row.versionLabel,
    headerColor: row.headerColor,
    packSizes: row.packSizes,
    packEnabled: row.packEnabled,
    unitPrices: row.unitPrices,
    totalPrices: row.totalPrices,
    standardPrice: row.standardPrice,
    resellingSuggestion: row.resellingSuggestion,
    durationDays: row.durationDays,
  };
}

export default function ClubPurchaseNewAccountsPanel({
  initialSettings,
}: ClubPurchaseNewAccountsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [activeLang, setActiveLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const update = (patch: Partial<ClubPurchaseAccountsSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const updatePack = (index: number, pack: ClubPurchaseAccountPack) => {
    setSettings((prev) => {
      const accountPacks = [...prev.accountPacks];
      accountPacks[index] = pack;
      return { ...prev, accountPacks };
    });
  };

  const updateActivationMessage = (html: string) => {
    setSettings((prev) => ({
      ...prev,
      activationMessageByLang: { ...prev.activationMessageByLang, [activeLang]: html },
    }));
  };

  const persist = async (next: ClubPurchaseAccountsSettings) => {
    setSaving(true);
    setSaveError('');
    try {
      setSettings(await saveClubPurchaseAccountsSettings(next, getAdminBearerToken()));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerms = () => persist(settings);

  const handlePackUpdate = (index: number) => {
    const pack = settings.accountPacks[index];
    if (!pack) return;
    const accountPacks = [...settings.accountPacks];
    accountPacks[index] = recalcPackTotals(pack);
    void persist({ ...settings, accountPacks });
  };

  return (
    <div className="space-y-4">
      {saveError ? (
        <div className="border border-[#e0a0a0] bg-[#fde8e8] px-4 py-2 text-sm text-[#8a1f1f]">
          {saveError}
        </div>
      ) : null}
      <div className="border border-gray-300">
        <div className="bg-[#f0ad4e] px-4 py-2 text-sm font-bold text-gray-900">
          Setting block for payment of the subscription without credit card or cash
        </div>
        <div className="space-y-4 bg-white p-4">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-medium text-gray-800">Credit card</span>
            <YesNoRadio
              name="credit-card"
              value={!settings.paymentWithoutCreditCard}
              onChange={(creditCard) => update({ paymentWithoutCreditCard: !creditCard })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
            <span>Send money later and before of</span>
            <input
              type="text"
              value={settings.sendMoneyLaterDays}
              onChange={(e) => update({ sendMoneyLaterDays: Number(e.target.value) || 0 })}
              className="w-14 border border-gray-300 bg-[#fffacd] px-2 py-1 text-center"
            />
            <span>days</span>
          </div>
        </div>
      </div>

      <div className="border border-gray-300">
        <div className="bg-[#a94442] px-4 py-2 text-sm font-bold text-white">
          Message to be displayed after the activation of the accounts but not payed
        </div>
        <div className="space-y-3 bg-white p-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.activationMessageEnabled}
              onChange={(e) => update({ activationMessageEnabled: e.target.checked })}
            />
            Enable message
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>Days after the assignments of the accounts</span>
            <select
              value={settings.activationDaysAfterAssignment}
              onChange={(e) =>
                update({ activationDaysAfterAssignment: Number(e.target.value) })
              }
              className="border border-gray-300 bg-white px-2 py-1"
            >
              <option value={30}>(1-30)</option>
              <option value={60}>(1-60)</option>
              <option value={90}>(1-90)</option>
              <option value={120}>(1-120)</option>
            </select>
            <span>days</span>
          </div>
          <SubscriptionLanguageTabs
            activeLang={activeLang}
            onChange={setActiveLang}
            label="Edit for each language"
            variant="lower"
          />
          <RichTextEditor
            value={settings.activationMessageByLang[activeLang] ?? ''}
            onChange={updateActivationMessage}
            minHeight="220px"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveTerms()}
            className="bg-[#c0392b] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#962d22] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Update Terms'}
          </button>
        </div>
      </div>

      <div className="border border-gray-300">
        <div className="bg-[#8e44ad] px-4 py-2 text-sm font-bold text-white">
          Account list prices —{' '}
          <span className="font-normal">
            configured here; shown to club admins only during registration (not after)
          </span>
        </div>
        <div className="space-y-4 bg-white p-4">
          <ClubAccountPackPricingSections
            packs={settings.accountPacks.map(packToDisplayRow)}
            mode="admin-edit"
            onPackChange={(index, row) => updatePack(index, displayRowToPack(row))}
            onPackUpdate={saving ? undefined : handlePackUpdate}
          />
        </div>
      </div>
    </div>
  );
}
