'use client';

import { Suspense, useEffect, useState } from 'react';
import type { ClubPurchaseAccountsSettings } from '@/types/clubPurchaseAccounts';
import { useRouter, useSearchParams } from 'next/navigation';
import ClubPurchaseNewAccountsPanel from '@/components/admin/subscriptions/ClubPurchaseNewAccountsPanel';
import ClubSubscriptionEditTabs, {
  type ClubSubscriptionEditTab,
} from '@/components/admin/subscriptions/ClubSubscriptionEditTabs';
import SubscriptionSystemDashboardHeader from '@/components/admin/subscriptions/SubscriptionSystemDashboardHeader';
import { fetchClubPurchaseAccountsSettings } from '@/lib/admin/clubPurchaseAccountsMock';
import { getSubscriptionById } from '@/lib/admin/subscriptionSettingsMock';

function ClubSettingsPurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subscriptionId = Number(searchParams?.get('subscriptionId') ?? '16');
  const row = getSubscriptionById(subscriptionId);
  const [purchaseSettings, setPurchaseSettings] = useState<ClubPurchaseAccountsSettings | null>(null);
  useEffect(() => {
    void fetchClubPurchaseAccountsSettings().then(setPurchaseSettings);
  }, []);

  const handleTabChange = (tab: ClubSubscriptionEditTab) => {
    if (tab === 'setting_subscriptions') {
      router.push(`/subscriptions/club_edit_subscription/${subscriptionId}/club`);
      return;
    }
    if (tab === 'identification_cards') {
      router.push(
        `/subscriptions/club_edit_subscription/${subscriptionId}/club?tab=identification`,
      );
      return;
    }
    router.replace(`/clubs/clubSettings?subscriptionId=${subscriptionId}`, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col bg-gray-100">
      <SubscriptionSystemDashboardHeader />

      <div className="border-b border-gray-300 bg-[#d9d9d9] px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              router.push('/subscriptions/subscription_settings?userType=club')
            }
            className="rounded border border-gray-500 bg-[#e0e0e0] px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-[#d0d0d0]"
          >
            Back
          </button>
          <span className="text-sm font-bold text-gray-800">Super Admin Options</span>
          {row ? <span className="text-xs text-gray-600">— {row.name}</span> : null}
        </div>
      </div>

      <ClubSubscriptionEditTabs
        activeTab="purchase_new_accounts"
        onTabChange={handleTabChange}
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-5xl">
        {purchaseSettings ? (
          <ClubPurchaseNewAccountsPanel initialSettings={purchaseSettings} />
        ) : (
          <div className="p-6 text-gray-600">Loading…</div>
        )}
      </div>
    </div>
  );
}

export default function ClubSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Loading…</div>}>
      <ClubSettingsPurchaseContent />
    </Suspense>
  );
}
