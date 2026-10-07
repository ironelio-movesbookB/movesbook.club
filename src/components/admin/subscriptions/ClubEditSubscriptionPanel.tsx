'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { SubscriptionEditData } from '@/types/adminSubscriptionSettings';
import {
  getSubscriptionById,
  getSubscriptionEditData,
  saveSubscriptionEditData,
  SUBSCRIPTION_SETTINGS_UPDATED_EVENT,
  syncSubscriptionEditDataFromStorage,
} from '@/lib/admin/subscriptionSettingsMock';
import SubscriptionSystemDashboardHeader from './SubscriptionSystemDashboardHeader';
import SubscriptionGeneralForm from './SubscriptionGeneralForm';
import SubscriptionEditSettingsForm from './SubscriptionEditSettingsForm';
import SubscriptionExpirationSections from './SubscriptionExpirationSections';
import ClubSubscriptionEditTabs, {
  type ClubSubscriptionEditTab,
} from './ClubSubscriptionEditTabs';
import ClubIdentificationCardsPricelistPanel from './ClubIdentificationCardsPricelistPanel';
import SpecialOfferSettingsPanel from './SpecialOfferSettingsPanel';

type ClubEditSubscriptionPanelProps = {
  id: number;
  initialData: SubscriptionEditData;
};

function parseTab(param: string | null): ClubSubscriptionEditTab {
  if (param === 'purchase' || param === 'purchase_new_accounts') return 'purchase_new_accounts';
  if (param === 'identification' || param === 'identification_cards') {
    return 'identification_cards';
  }
  if (param === 'special_offer') return 'special_offer';
  return 'setting_subscriptions';
}

export default function ClubEditSubscriptionPanel({
  id,
  initialData,
}: ClubEditSubscriptionPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const row = getSubscriptionById(id);
  const [data, setData] = useState(initialData);
  const [activeLang, setActiveLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ClubSubscriptionEditTab>(() =>
    parseTab(searchParams?.get('tab') ?? null),
  );

  useEffect(() => {
    syncSubscriptionEditDataFromStorage();
    const fresh = getSubscriptionEditData(id, false);
    if (fresh) setData(fresh);

    const refresh = () => {
      syncSubscriptionEditDataFromStorage();
      const updated = getSubscriptionEditData(id, false);
      if (updated) setData(updated);
    };

    window.addEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [id]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'purchase' || tab === 'purchase_new_accounts') {
      router.replace(`/clubs/clubSettings?subscriptionId=${id}`);
    }
  }, [searchParams, router, id]);

  if (!row || row.userType !== 'club') {
    return (
      <div className="p-6 text-gray-600">
        Club subscription not found.
      </div>
    );
  }

  const handleTabChange = (tab: ClubSubscriptionEditTab) => {
    if (tab === 'purchase_new_accounts') {
      router.push(`/clubs/clubSettings?subscriptionId=${id}`);
      return;
    }
    setActiveTab(tab);
    const tabParam =
      tab === 'identification_cards'
        ? 'identification'
        : tab === 'special_offer'
          ? 'special_offer'
          : null;
    const base = `/subscriptions/club_edit_subscription/${id}/club`;
    router.replace(tabParam ? `${base}?tab=${tabParam}` : base, { scroll: false });
  };

  const handleSave = async () => {
    setSaving(true);
    saveSubscriptionEditData(data);
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);
    router.push('/subscriptions/subscription_settings?userType=club');
  };

  const handleCancel = () => {
    router.push('/subscriptions/subscription_settings?userType=club');
  };

  return (
    <div className="flex h-full flex-col bg-gray-100">
      <SubscriptionSystemDashboardHeader />

      <div className="border-b border-gray-300 bg-[#d9d9d9] px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/subscriptions/subscription_settings?userType=club')}
            className="rounded border border-gray-500 bg-[#e0e0e0] px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-[#d0d0d0]"
          >
            Back
          </button>
          <span className="text-sm font-bold text-gray-800">Super Admin Options</span>
          <span className="text-xs text-gray-600">— {row.name}</span>
        </div>
      </div>

      <ClubSubscriptionEditTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-5xl">
        {activeTab === 'setting_subscriptions' ? (
          <>
            <SubscriptionGeneralForm
              subscriptionId={id}
              general={data.general}
              row={row}
              activeLang={activeLang}
              onLangChange={setActiveLang}
              onChange={(general) => setData({ ...data, general })}
            />

            <SubscriptionEditSettingsForm
              settings={data.settings}
              userType="club"
              variant="coach"
              daysValue={row.days2 || row.days1}
              onChange={(settings) => setData({ ...data, settings })}
            />

            <SubscriptionExpirationSections
              settings={data.settings}
              activeLang={activeLang}
              onLangChange={setActiveLang}
              versionName={row.name}
              onChange={(settings) => setData({ ...data, settings })}
            />

            <div className="flex justify-center gap-3 py-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#333] px-8 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-[#333] px-8 py-2 text-sm font-bold text-white hover:bg-black"
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {activeTab === 'identification_cards' ? (
          <ClubIdentificationCardsPricelistPanel />
        ) : null}

        {activeTab === 'special_offer' ? (
          <SpecialOfferSettingsPanel versionId={id} versionName={row.name} />
        ) : null}
      </div>
    </div>
  );
}
