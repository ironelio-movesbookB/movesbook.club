'use client';

import { useEffect, useState } from 'react';
import {
  PACKAGE_PURCHASE_TABS,
  ensurePackageSettingsLoaded,
  getPurchaseTabVisibility,
  setPurchaseTabVisibility,
  type PackagePurchaseTabKey,
} from '@/lib/admin/packageSettingsMock';

export default function SubscriptionOtherSettingsPage() {
  const [tabs, setTabs] = useState<Record<PackagePurchaseTabKey, boolean> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ensurePackageSettingsLoaded();
    setTabs(getPurchaseTabVisibility());
  }, []);

  if (!tabs) return null;

  const toggle = (key: PackagePurchaseTabKey) => {
    setSaved(false);
    setTabs((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const save = () => {
    setPurchaseTabVisibility(tabs);
    setSaved(true);
  };

  return (
    <div className="min-h-full bg-white p-6">
      <h1 className="mb-2 text-xl font-bold text-gray-900">Other Settings</h1>
      <p className="mb-6 max-w-2xl text-sm text-gray-600">
        Choose which options appear in the registration form when Purchase is clicked.
        Checked options are shown. Unchecked options stay hidden.
      </p>
      <div className="max-w-md border border-gray-300">
        <div className="bg-[#333] px-4 py-2 text-sm font-bold text-white">Purchase options</div>
        <ul className="divide-y divide-gray-200">
          {PACKAGE_PURCHASE_TABS.map((tab) => (
            <li key={tab.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm font-medium text-gray-800">{tab.label}</span>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={tabs[tab.key]}
                  onChange={() => toggle(tab.key)}
                />
                {tabs[tab.key] ? 'ON' : 'OFF'}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={save}
        className="mt-4 bg-[#333] px-6 py-2 text-sm font-bold text-white hover:bg-black"
      >
        Save
      </button>
      {saved ? <p className="mt-2 text-sm text-green-700">Saved.</p> : null}
    </div>
  );
}
