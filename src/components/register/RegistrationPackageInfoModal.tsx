'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import {
  buildSelectedEntity,
  formatRegistrationPrice,
  getPackageReviewRowsForCategory,
  getUserTypeReviewLabel,
  getVersionColumnsForUserType,
  type RegistrationPackageCategory,
  type RegistrationSelectedEntity,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import RegistrationPackageEntityDetailPanel, {
  type RegistrationEntityDetailTab,
} from './RegistrationPackageEntityDetailPanel';
import type { ClubPricelistTab } from './RegistrationClubPricelistsPanel';
import {
  formatCountryPrice,
  priceForCountry,
  type CountryPriceInfo,
} from '@/lib/countries/countryPriceFormula';

type RegistrationPackageInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userType: RegistrationUserType;
  lang: string;
  onPurchaseVersion?: (subscriptionId: number) => void;
  countryPrice?: CountryPriceInfo | null;
};

export default function RegistrationPackageInfoModal({
  isOpen,
  onClose,
  userType,
  lang,
  onPurchaseVersion,
  countryPrice = null,
}: RegistrationPackageInfoModalProps) {
  const formatVersionPrice = (price: number) =>
    countryPrice
      ? formatCountryPrice(priceForCountry(price, countryPrice.factor), countryPrice)
      : formatRegistrationPrice(price);
  const [category, setCategory] = useState<RegistrationPackageCategory>('social_training');
  const [selectedEntity, setSelectedEntity] = useState<RegistrationSelectedEntity | null>(null);
  const [purchasePanelTab, setPurchasePanelTab] = useState<
    RegistrationEntityDetailTab | undefined
  >();
  const [purchaseClubSubTab, setPurchaseClubSubTab] = useState<ClubPricelistTab>(
    'account_pricelist',
  );
  const [purchasedTierKey, setPurchasedTierKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedEntity(null);
      setCategory('social_training');
      setPurchasePanelTab(undefined);
      setPurchasedTierKey(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedEntity(null);
  }, [userType, category]);

  if (!isOpen) return null;

  const versionColumns = getVersionColumnsForUserType(userType);
  const packages = getPackageReviewRowsForCategory(userType, lang, category);
  const userTypeLabel = getUserTypeReviewLabel(userType);

  const handleOtherInfo = (tierKey: string, columnIndex: number) => {
    setPurchasePanelTab(undefined);
    setSelectedEntity(buildSelectedEntity(userType, tierKey, columnIndex));
  };

  const handlePurchase = (tierKey: string, columnIndex: number) => {
    const entity = buildSelectedEntity(userType, tierKey, columnIndex);
    setPurchasedTierKey(tierKey);
    if (entity.subscriptionId != null) {
      onPurchaseVersion?.(entity.subscriptionId);
    }

    if (userType === 'club') {
      setPurchasePanelTab('club_pricelists');
      setPurchaseClubSubTab('account_pricelist');
      setSelectedEntity(entity);
      return;
    }

    setPurchasePanelTab('overview');
    setSelectedEntity(entity);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-[#337ab7] shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-4xl font-bold italic text-white uppercase tracking-wide">
              Product Review
            </h2>
            <p className="mt-2 text-sm sm:text-base text-white/95 max-w-2xl leading-snug">
              Sign-up today for a free Training Log account and get unprecedented insight into
              your workouts
            </p>
          </div>
          <div className="flex shrink-0 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#444] hover:bg-[#222] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded shadow"
            >
              Back
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-2 sm:px-4 pb-4 relative">
          <div className="min-w-[640px] border border-[#286090] bg-[#337ab7]">
            <table className="w-full border-collapse text-white">
              <thead>
                <tr className="border-b border-[#286090]">
                  <th
                    rowSpan={2}
                    className="border-r border-[#286090] px-3 py-3 text-left align-bottom w-[42%]"
                  >
                    <div className="text-sm font-bold uppercase mb-2">Package</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setCategory('social_training')}
                        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded ${
                          category === 'social_training'
                            ? 'bg-[#444] text-white'
                            : 'bg-[#666] text-white/90 hover:bg-[#555]'
                        }`}
                      >
                        Social &amp; Training
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategory('management')}
                        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded ${
                          category === 'management'
                            ? 'bg-[#444] text-white'
                            : 'bg-[#666] text-white/90 hover:bg-[#555]'
                        }`}
                      >
                        Management
                      </button>
                    </div>
                  </th>
                  <th
                    colSpan={versionColumns.length}
                    className="border-b border-[#286090] px-2 py-2 text-center text-sm font-bold uppercase"
                  >
                    {userTypeLabel}
                  </th>
                </tr>
                <tr className="border-b border-[#286090]">
                  {versionColumns.map((version) => (
                    <th
                      key={version.key}
                      className="border-r border-[#286090] last:border-r-0 px-2 py-2 text-center align-top min-w-[100px]"
                    >
                      <div className="text-[10px] sm:text-xs font-bold leading-tight">
                        {version.label}
                      </div>
                      <div className="mt-1 text-[11px] sm:text-xs font-semibold text-[#dbeafe]">
                        {formatVersionPrice(version.price)}
                      </div>
                      <div className="mt-0.5 text-[10px] sm:text-xs text-white/90">
                        Duration: {version.durationDays} days
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-[#286090] bg-[#2a6496]">
                  <td className="border-r border-[#286090] px-3 py-2 text-xs font-semibold italic text-white/95">
                    Other Info
                  </td>
                  {versionColumns.map((version, columnIndex) => (
                    <td
                      key={`other-info-${version.key}`}
                      className="border-r border-[#286090] last:border-r-0 px-2 py-2 text-center"
                    >
                      <button
                        type="button"
                        onClick={() => handleOtherInfo(version.key, columnIndex)}
                        className={`bg-[#c0392b] hover:bg-[#962d22] text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow ${
                          selectedEntity?.tierKey === version.key ? 'ring-2 ring-white' : ''
                        }`}
                      >
                        Other Info
                      </button>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#286090] bg-[#2a6496]">
                  <td className="border-r border-[#286090] px-3 py-2 text-xs font-semibold italic text-white/95">
                    Prices for one your account
                  </td>
                  {versionColumns.map((version, columnIndex) => (
                    <td
                      key={`price-${version.key}`}
                      className="border-r border-[#286090] last:border-r-0 px-2 py-2 text-center"
                    >
                      <button
                        type="button"
                        onClick={() => handlePurchase(version.key, columnIndex)}
                        className={`bg-[#c0392b] hover:bg-[#962d22] text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow ${
                          purchasedTierKey === version.key ? 'ring-2 ring-white' : ''
                        }`}
                      >
                        Purchase
                      </button>
                      <div className="mt-1 text-[10px] sm:text-xs font-semibold text-[#dbeafe]">
                        {formatVersionPrice(version.price)}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#286090] bg-[#2a6496]">
                  <td className="border-r border-[#286090] px-3 py-2 text-xs font-semibold italic text-white/95">
                    Duration
                  </td>
                  {versionColumns.map((version) => (
                    <td
                      key={`duration-${version.key}`}
                      className="border-r border-[#286090] last:border-r-0 px-2 py-2 text-center text-xs font-semibold text-[#dbeafe]"
                    >
                      {version.durationDays} days
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={versionColumns.length + 1}
                      className="px-4 py-8 text-center text-sm text-white/90"
                    >
                      No published packages available.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg, index) => (
                    <tr
                      key={pkg.id}
                      className={`border-b border-[#286090] ${
                        index % 2 === 0 ? 'bg-[#337ab7]' : 'bg-[#2e6da4]'
                      }`}
                    >
                      <td className="border-r border-[#286090] px-3 py-3 align-top">
                        <div className="font-bold text-sm uppercase leading-snug mb-1">
                          {pkg.title}
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed">
                          {pkg.description || '—'}
                        </p>
                      </td>
                      {versionColumns.map((version) => {
                        const enabled = pkg.tiers[version.key] ?? false;
                        return (
                          <td
                            key={`${pkg.id}-${version.key}`}
                            className="border-r border-[#286090] last:border-r-0 px-2 py-3 text-center align-middle"
                          >
                            {enabled ? (
                              <Check
                                className="mx-auto h-6 w-6 text-[#7cfc00] stroke-[3]"
                                aria-label="Included"
                              />
                            ) : (
                              <span className="inline-block h-6 w-6" aria-hidden />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedEntity ? (
            <RegistrationPackageEntityDetailPanel
              key={`${selectedEntity.tierKey}-${purchasePanelTab ?? 'info'}`}
              entity={selectedEntity}
              userType={userType}
              lang={lang}
              category={category}
              onClose={() => {
                setSelectedEntity(null);
                setPurchasePanelTab(undefined);
              }}
              initialActiveTab={purchasePanelTab}
              initialClubSubTab={purchaseClubSubTab}
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:hidden text-white/80 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
