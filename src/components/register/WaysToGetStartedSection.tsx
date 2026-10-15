'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  formatCountryPrice,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';
import {
  getDefaultVersionId,
  getRegistrationVersions,
  REGISTRATION_USER_TYPE_TABS,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import {
  SUBSCRIPTION_SETTINGS_UPDATED_EVENT,
  getSubscriptionEditData,
  syncSubscriptionEditDataFromStorage,
} from '@/lib/admin/subscriptionSettingsMock';
import RegistrationPackageInfoModal from './RegistrationPackageInfoModal';
import RegistrationSubscriptionPricingBlock from './RegistrationSubscriptionPricingBlock';
import RegistrationMonthlyCostLine from './RegistrationMonthlyCostLine';
import RegistrationVersionLastNewsBlock from './RegistrationVersionLastNewsBlock';
import RegistrationVersionSloganBlock from './RegistrationVersionSloganBlock';
import RegistrationVersionNewsModal, {
  type RegistrationVersionTextMode,
} from './RegistrationVersionNewsModal';
import RegistrationSpecialOfferBox from './RegistrationSpecialOfferBox';
import { SubscriptionSharingSummary } from '@/components/admin/subscriptions/SubscriptionMembershipSharingDisplay';

type WaysToGetStartedSectionProps = {
  userType: RegistrationUserType;
  onUserTypeChange: (userType: RegistrationUserType) => void;
  selectedVersionId: number | null;
  onVersionSelect: (versionId: number) => void;
  lang: string;
  specialOfferConfirmed?: boolean;
  onSpecialOfferConfirmChange?: (confirmed: boolean) => void;
  /** Pricing of the selected country: prices are scaled and shown in local currency too. */
  countryPrice?: CountryPriceInfo | null;
};

export default function WaysToGetStartedSection({
  userType,
  onUserTypeChange,
  selectedVersionId,
  onVersionSelect,
  lang,
  specialOfferConfirmed = false,
  onSpecialOfferConfirmChange,
  countryPrice = null,
}: WaysToGetStartedSectionProps) {
  const priceFactor = countryPrice?.factor ?? 1;
  const [expanded, setExpanded] = useState(true);
  const [showPackageInfo, setShowPackageInfo] = useState(false);
  const [versionTextMode, setVersionTextMode] = useState<RegistrationVersionTextMode | null>(null);

  const [settingsRevision, setSettingsRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      syncSubscriptionEditDataFromStorage();
      setSettingsRevision((value) => value + 1);
    };
    window.addEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SUBSCRIPTION_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const versions = useMemo(() => {
    void settingsRevision; // re-read when subscription settings update events fire
    return getRegistrationVersions(userType);
  }, [userType, settingsRevision]);
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const selectedEditData = useMemo(() => {
    void settingsRevision; // re-read when subscription settings update events fire
    return selectedVersionId ? getSubscriptionEditData(selectedVersionId, false) : null;
  }, [selectedVersionId, settingsRevision]);

  useEffect(() => {
    syncSubscriptionEditDataFromStorage();
    setSettingsRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!versions.length) return;
    const stillValid = versions.some((v) => v.id === selectedVersionId);
    if (!stillValid) {
      const defaultId = getDefaultVersionId(userType);
      if (defaultId) onVersionSelect(defaultId);
    }
  }, [userType, versions, selectedVersionId, onVersionSelect]);

  return (
    <>
      <div className="border-2 border-red-500 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 bg-[#7a1f2e] px-4 py-2.5 text-left text-white font-bold text-sm uppercase tracking-wide"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          Ways to get started
        </button>

        {expanded ? (
          <div className="bg-[#e8e8e8]">
            <div className="flex border-b border-gray-300 bg-[#7a1f2e]">
              {REGISTRATION_USER_TYPE_TABS.map((tab) => {
                const isActive = userType === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onUserTypeChange(tab.key)}
                    className={`relative flex-1 px-2 py-2 text-xs sm:text-sm font-bold text-white border-r border-[#5c1824] last:border-r-0 transition-colors ${
                      isActive ? 'bg-[#5c1824]' : 'hover:bg-[#6a2230]'
                    }`}
                  >
                    {tab.label}
                    {isActive ? (
                      <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#e8e8e8]" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 p-3 sm:p-4">
              <div className="flex-1 min-w-0 space-y-1">
                {versions.map((version) => {
                  const isSelected = selectedVersionId === version.id;
                  const countryVersionPrice = priceForCountry(version.price, priceFactor);
                  return (
                    <label
                      key={version.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 px-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-white/80 ring-1 ring-[#7a1f2e]/30' : 'hover:bg-white/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="subscription-version"
                        checked={isSelected}
                        onChange={() => onVersionSelect(version.id)}
                        className="shrink-0 accent-[#7a1f2e]"
                      />
                      <span className="text-sm font-medium text-gray-900 min-w-[140px] flex-1">
                        {version.name}
                      </span>
                      <span className="text-sm font-semibold text-[#8b2942] whitespace-nowrap">
                        : {formatCountryPrice(countryVersionPrice, countryPrice)}
                      </span>
                      <span className="text-sm text-gray-700 whitespace-nowrap ml-auto sm:ml-0">
                        Duration : <span className="font-medium">{version.durationDays} days</span>
                      </span>
                      <RegistrationMonthlyCostLine
                        price={countryVersionPrice}
                        durationDays={version.durationDays}
                        className="w-full sm:w-auto basis-full sm:basis-auto"
                      />
                    </label>
                  );
                })}

                {selectedEditData ? (
                  <>
                    <RegistrationVersionSloganBlock
                      general={selectedEditData.general}
                      lang={lang}
                      versionName={selectedVersion?.name}
                    />
                    <SubscriptionSharingSummary
                      settings={selectedEditData.settings}
                      userType={
                        REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType)
                          ?.subscriptionType ?? 'athlete'
                      }
                    />
                    <RegistrationSubscriptionPricingBlock
                      general={selectedEditData.general}
                      scenario="first"
                      countryPrice={countryPrice}
                    />
                    <RegistrationVersionLastNewsBlock
                      lastNewsByLang={selectedEditData.settings.lastNewsByLang}
                      lang={lang}
                      versionName={selectedVersion?.name}
                    />
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap sm:flex-col gap-2 sm:w-48 shrink-0 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() =>
                    selectedVersionId ? setVersionTextMode('info') : setShowPackageInfo(true)
                  }
                  className="flex-1 sm:flex-none bg-[#555] hover:bg-[#333] text-white text-xs font-bold py-2.5 px-3 rounded-md shadow-sm transition-colors"
                >
                  Info Versions
                </button>
                <button
                  type="button"
                  onClick={() => setVersionTextMode('news')}
                  disabled={!selectedVersionId}
                  className="flex-1 sm:flex-none bg-[#555] hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 px-3 rounded-md shadow-sm transition-colors"
                >
                  News about version
                </button>
                {onSpecialOfferConfirmChange ? (
                  <RegistrationSpecialOfferBox
                    versionId={selectedVersionId}
                    durationDays={selectedVersion?.durationDays}
                    lang={lang}
                    confirmed={specialOfferConfirmed}
                    onConfirmChange={onSpecialOfferConfirmChange}
                    countryPrice={countryPrice}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <RegistrationPackageInfoModal
        isOpen={showPackageInfo}
        onClose={() => setShowPackageInfo(false)}
        userType={userType}
        lang={lang}
        onPurchaseVersion={onVersionSelect}
        countryPrice={countryPrice}
      />

      <RegistrationVersionNewsModal
        key={`news-${selectedVersionId ?? 'none'}-${settingsRevision}`}
        isOpen={versionTextMode !== null}
        onClose={() => setVersionTextMode(null)}
        versionId={selectedVersionId}
        versionName={selectedVersion?.name}
        lang={lang}
        editData={selectedEditData}
        mode={versionTextMode ?? 'news'}
        onShowAllVersions={() => {
          setVersionTextMode(null);
          setShowPackageInfo(true);
        }}
      />
    </>
  );
}
