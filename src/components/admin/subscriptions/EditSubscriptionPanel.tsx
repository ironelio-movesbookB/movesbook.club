'use client';

import { useRouter } from 'next/navigation';
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
import SpecialOfferSettingsPanel from './SpecialOfferSettingsPanel';

type EditTab = 'general' | 'special_offer';

const EDIT_TABS: { key: EditTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'special_offer', label: 'Special offer' },
];

type EditSubscriptionPanelProps = {
  subscriptionId: number;
  lang: string;
  initialData: SubscriptionEditData;
};

export default function EditSubscriptionPanel({
  subscriptionId,
  lang,
  initialData,
}: EditSubscriptionPanelProps) {
  const router = useRouter();
  const row = getSubscriptionById(subscriptionId);
  const [data, setData] = useState(initialData);
  const [activeLang, setActiveLang] = useState(lang || 'en');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<EditTab>('general');

  useEffect(() => {
    syncSubscriptionEditDataFromStorage();
    const fresh = getSubscriptionEditData(subscriptionId, false);
    if (fresh) setData(fresh);

    const refresh = () => {
      syncSubscriptionEditDataFromStorage();
      const updated = getSubscriptionEditData(subscriptionId, false);
      if (updated) setData(updated);
    };

    window.addEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [subscriptionId]);

  if (!row) {
    return (
      <div className="p-6 text-gray-600">
        Subscription not found.
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const saved = await saveSubscriptionEditData(data);
    setSaving(false);
    if (!saved) {
      window.alert('The settings could not be saved in the database. Please log in again as admin and retry.');
      return;
    }
    router.push('/subscriptions/subscription_settings');
  };

  const handleCancel = () => {
    router.push('/subscriptions/subscription_settings');
  };

  const settingsVariant =
    row.userType === 'coach' || row.userType === 'team' || row.userType === 'group'
      ? 'coach'
      : 'athlete';

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <SubscriptionSystemDashboardHeader />
      <div className="flex flex-wrap gap-2 bg-gray-100 px-4 pt-3 lg:px-6">
        {EDIT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-w-[150px] border-2 px-4 py-1 text-base font-semibold transition-colors ${
              activeTab === tab.key
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-red-600 bg-white text-red-600 hover:bg-red-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-5xl">
        {activeTab === 'special_offer' ? (
          <SpecialOfferSettingsPanel versionId={subscriptionId} versionName={row.name} />
        ) : (
        <>
        <SubscriptionGeneralForm
          subscriptionId={subscriptionId}
          general={data.general}
          row={row}
          activeLang={activeLang}
          onLangChange={setActiveLang}
          onChange={(general) => setData({ ...data, general })}
        />

        <SubscriptionEditSettingsForm
          settings={data.settings}
          userType={row.userType}
          variant={settingsVariant}
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
            className="bg-[#333] hover:bg-black text-white px-8 py-2 text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="bg-[#333] hover:bg-black text-white px-8 py-2 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
