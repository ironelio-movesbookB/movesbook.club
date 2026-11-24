'use client';

export type ClubSubscriptionEditTab =
  | 'setting_subscriptions'
  | 'purchase_new_accounts'
  | 'identification_cards'
  | 'special_offer';

const TABS: { key: ClubSubscriptionEditTab; label: string }[] = [
  { key: 'setting_subscriptions', label: 'General' },
  { key: 'special_offer', label: 'Special offer' },
  { key: 'purchase_new_accounts', label: 'Purchase new accounts' },
  { key: 'identification_cards', label: 'Identification Cards Pricelist' },
];

type ClubSubscriptionEditTabsProps = {
  activeTab: ClubSubscriptionEditTab;
  onTabChange: (tab: ClubSubscriptionEditTab) => void;
};

export default function ClubSubscriptionEditTabs({
  activeTab,
  onTabChange,
}: ClubSubscriptionEditTabsProps) {
  return (
    <div className="flex flex-wrap gap-0 border-b border-gray-400 bg-[#e8e8e8] px-2 pt-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2 text-xs sm:text-sm font-bold border border-gray-400 border-b-0 rounded-t transition-colors ${
              isActive
                ? 'bg-black text-white'
                : 'bg-gradient-to-b from-[#f5f5f5] to-[#d8d8d8] text-gray-900 hover:from-[#eee] hover:to-[#ccc]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
