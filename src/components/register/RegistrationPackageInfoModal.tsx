'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import {
  buildSelectedEntity,
  formatRegistrationPrice,
  getPackageReviewRowsForCategory,
  getRegistrationPackageViewMode,
  getUserTypeReviewLabel,
  getVersionColumnsForUserType,
  REGISTRATION_PACKAGE_SECTIONS,
  type RegistrationPackageCategory,
  type RegistrationPackageReviewRow,
  type RegistrationSelectedEntity,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import { ensurePackageSettingsLoaded, isPurchaseTabVisible } from '@/lib/admin/packageSettingsMock';
import { PACKAGE_DESCRIPTION_ROW_CHARS } from '@/lib/admin/packageSettingsLang';
import type { PackageViewMode } from '@/types/adminPackageSettings';
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
  const [category, setCategory] = useState<RegistrationPackageCategory>('management');
  const [viewMode, setViewMode] = useState<PackageViewMode>('standard');
  const [settingsTick, setSettingsTick] = useState(0);
  const [detailPackage, setDetailPackage] = useState<RegistrationPackageReviewRow | null>(null);
  const [detailMode, setDetailMode] = useState<'description' | 'overview'>('description');
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<RegistrationSelectedEntity | null>(null);
  const [purchasePanelTab, setPurchasePanelTab] = useState<
    RegistrationEntityDetailTab | undefined
  >();
  const [purchaseClubSubTab, setPurchaseClubSubTab] = useState<ClubPricelistTab>(
    'account_pricelist',
  );
  const [purchasedTierKey, setPurchasedTierKey] = useState<string | null>(null);
  const [detailScroll, setDetailScroll] = useState(0);
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const reviewScrollRef = useRef<HTMLDivElement>(null);
  const savedReviewScroll = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    ensurePackageSettingsLoaded();
    setViewMode(getRegistrationPackageViewMode());
    setSettingsTick((tick) => tick + 1);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedEntity(null);
      setCategory('management');
      setViewMode(getRegistrationPackageViewMode());
      setDetailPackage(null);
      setPurchasePanelTab(undefined);
      setPurchasedTierKey(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedEntity(null);
  }, [userType, category]);

  useEffect(() => {
    if (!isOpen || !selectedEntity || detailScroll === 0) return;
    const node = detailSectionRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isOpen, selectedEntity, detailScroll, purchasePanelTab, purchaseClubSubTab]);

  const packages = useMemo(
    () => getPackageReviewRowsForCategory(userType, lang, category),
    [userType, lang, category, settingsTick],
  );

  if (!isOpen) return null;

  const versionColumns = getVersionColumnsForUserType(userType);
  const userTypeLabel = getUserTypeReviewLabel(userType);
  const black = viewMode === 'black';
  const line = black ? 'border-white/10' : 'border-white/30';
  const shell = black ? 'border-white/10 bg-[#0b0b0d] text-white' : 'border-white/30 bg-[#337ab7] text-white';
  const headerBg = black ? 'bg-[#0b0b0d]' : 'bg-[#337ab7]';
  const rowAlt = black ? 'bg-[#0b0b0d]' : 'bg-[#2e6da4]';
  const rowBase = black ? 'bg-[#0b0b0d]' : 'bg-[#337ab7]';
  const band = black ? 'bg-[#0b0b0d]' : 'bg-[#2a6496]';
  const highlightedColumn = Math.min(1, Math.max(0, versionColumns.length - 1));

  const rememberReviewScroll = () => {
    if (selectedEntity) return;
    savedReviewScroll.current = reviewScrollRef.current?.scrollTop ?? 0;
  };

  const handleOtherInfo = (tierKey: string, columnIndex: number) => {
    rememberReviewScroll();
    setPurchasePanelTab(undefined);
    setSelectedEntity(buildSelectedEntity(userType, tierKey, columnIndex));
    setDetailScroll((tick) => tick + 1);
  };

  const handlePurchase = (tierKey: string, columnIndex: number) => {
    const entity = buildSelectedEntity(userType, tierKey, columnIndex);
    setPurchasedTierKey(tierKey);
    if (entity.subscriptionId != null) {
      onPurchaseVersion?.(entity.subscriptionId);
    }

    if (userType === 'club') {
      const firstVisible =
        (['versions_features', 'optional_modules', 'account_pricelist', 'identification_devices', 'others'] as const)
          .find((key) => isPurchaseTabVisible(key)) ?? null;
      if (!firstVisible) return;
      rememberReviewScroll();
      setPurchasePanelTab('club_pricelists');
      setPurchaseClubSubTab(firstVisible);
      setSelectedEntity(entity);
      setDetailScroll((tick) => tick + 1);
      return;
    }

    rememberReviewScroll();
    setPurchasePanelTab('overview');
    setSelectedEntity(entity);
    setDetailScroll((tick) => tick + 1);
  };

  const closeDetailSection = () => {
    const top = savedReviewScroll.current;
    setSelectedEntity(null);
    setPurchasePanelTab(undefined);
    window.requestAnimationFrame(() => {
      reviewScrollRef.current?.scrollTo({ top, behavior: 'smooth' });
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close"
      />

      <div className={`relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg shadow-2xl ${headerBg}`}>
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

        <div ref={reviewScrollRef} className="flex-1 overflow-auto px-2 sm:px-4 pb-4 relative">
          <div className={`min-w-[640px] border ${shell}`}>
            <table className="w-full border-collapse text-white">
              <thead>
                <tr className={`border-b ${line}`}>
                  <th
                    rowSpan={2}
                    className={`border-r ${line} px-3 py-3 text-left align-bottom w-[42%]`}
                  >
                    <div className="text-sm font-bold uppercase mb-2">Package</div>
                    <div className="flex flex-wrap gap-1">
                      {REGISTRATION_PACKAGE_SECTIONS.map((section) => (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => setCategory(section.key)}
                          className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded ${
                            category === section.key
                              ? black
                                ? 'bg-white text-black'
                                : 'bg-[#444] text-white'
                              : black
                                ? 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
                                : 'bg-[#666] text-white/90 hover:bg-[#555]'
                          }`}
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                  </th>
                  <th
                    colSpan={versionColumns.length}
                    className={`border-b ${line} px-2 py-2 text-center text-sm font-bold uppercase`}
                  >
                    {userTypeLabel}
                  </th>
                </tr>
                <tr className={`border-b ${line}`}>
                  {versionColumns.map((version, columnIndex) => (
                    <th
                      key={`${version.subscriptionId ?? version.key}-${columnIndex}`}
                      className={`border-r ${line} last:border-r-0 px-2 py-2 text-center align-top min-w-[100px] ${
                        black && columnIndex === highlightedColumn ? 'bg-[#1a1024]' : ''
                      }`}
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
                <tr className={`border-b ${line} ${band}`}>
                  <td className={`border-r ${line} px-3 py-2 text-xs font-semibold italic text-white/95`}>
                    Other Info
                  </td>
                  {versionColumns.map((version, columnIndex) => (
                    <td
                      key={`other-info-${version.key}`}
                      className={`border-r ${line} last:border-r-0 px-2 py-2 text-center`}
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
                <tr className={`border-b ${line} ${band}`}>
                  <td className={`border-r ${line} px-3 py-2 text-xs font-semibold italic text-white/95`}>
                    Prices for one your account
                  </td>
                  {versionColumns.map((version, columnIndex) => (
                    <td
                      key={`price-${version.key}`}
                      className={`border-r ${line} last:border-r-0 px-2 py-2 text-center`}
                    >
                      <button
                        type="button"
                        onClick={() => handlePurchase(version.key, columnIndex)}
                        className={
                          black
                            ? `rounded-full px-4 py-1.5 text-[10px] sm:text-xs font-bold shadow ${
                                columnIndex === highlightedColumn
                                  ? 'bg-gradient-to-r from-[#7c5cff] to-[#ff4ecd] text-white'
                                  : 'bg-white text-black'
                              } ${purchasedTierKey === version.key ? 'ring-2 ring-white' : ''}`
                            : `bg-[#c0392b] hover:bg-[#962d22] text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow ${
                                purchasedTierKey === version.key ? 'ring-2 ring-white' : ''
                              }`
                        }
                      >
                        Purchase
                      </button>
                      <div className="mt-1 text-[10px] sm:text-xs font-semibold text-[#dbeafe]">
                        {formatVersionPrice(version.price)}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className={`border-b ${line} ${band}`}>
                  <td className={`border-r ${line} px-3 py-2 text-xs font-semibold italic text-white/95`}>
                    Duration
                  </td>
                  {versionColumns.map((version) => (
                    <td
                      key={`duration-${version.key}`}
                      className={`border-r ${line} last:border-r-0 px-2 py-2 text-center text-xs font-semibold text-[#dbeafe]`}
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
                  packages.map((pkg, index) =>
                    pkg.kind === 'separator' ? (
                      <tr key={pkg.id} style={{ backgroundColor: pkg.backgroundColor }}>
                        <td colSpan={versionColumns.length + 1} className="px-3 py-2">
                          <div className="text-sm font-bold" style={{ color: pkg.titleColor }}>
                            {pkg.icon ? `${pkg.icon} ` : ''}
                            {pkg.title}
                          </div>
                        </td>
                      </tr>
                    ) : (
                    <tr
                      key={pkg.id}
                      className={`border-b ${line} ${index % 2 === 0 ? rowBase : rowAlt}`}
                    >
                      <td className={`border-r ${line} px-3 py-3 align-top`}>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailMode('description');
                            setDetailPackage(pkg);
                          }}
                          className="text-left font-bold text-sm leading-snug mb-1 text-white hover:underline"
                        >
                          {pkg.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailMode('description');
                            setDetailPackage(pkg);
                          }}
                          style={{ width: `${PACKAGE_DESCRIPTION_ROW_CHARS}ch`, minWidth: `${PACKAGE_DESCRIPTION_ROW_CHARS}ch`, maxHeight: '2.5rem' }}
                          className="mt-1 block overflow-hidden whitespace-pre-wrap text-left text-sm leading-5 text-white/90"
                        >
                          {pkg.fullDescription || '—'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailMode('overview');
                            setDetailPackage(pkg);
                          }}
                          className="mt-2 border border-white/40 bg-white/10 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/20"
                        >
                          Detailed overview
                        </button>
                      </td>
                      {versionColumns.map((version, columnIndex) => {
                        const enabled = pkg.tiers[version.key] ?? false;
                        return (
                          <td
                            key={`${pkg.id}-${version.subscriptionId ?? version.key}-${columnIndex}`}
                            className={`border-r ${line} last:border-r-0 px-2 py-3 text-center align-middle ${
                              black && columnIndex === highlightedColumn ? 'bg-[#161022]' : ''
                            }`}
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
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {selectedEntity ? (
            <div ref={detailSectionRef} className="scroll-mt-2">
            <RegistrationPackageEntityDetailPanel
              key={`${selectedEntity.tierKey}-${purchasePanelTab ?? 'info'}`}
              entity={selectedEntity}
              userType={userType}
              lang={lang}
              category={category}
              flow
              onClose={closeDetailSection}
              initialActiveTab={purchasePanelTab}
              initialClubSubTab={purchaseClubSubTab}
            />
            </div>
          ) : null}
        </div>

          {detailPackage ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded bg-white p-4 text-gray-900 shadow-2xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-black">{detailPackage.title}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailPackage(null);
                      setEnlargedImage(null);
                    }}
                    className="bg-[#444] px-3 py-1 text-xs font-bold text-white"
                  >
                    Close
                  </button>
                </div>
                {detailMode === 'overview' ? (
                  detailPackage.html ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-800"
                      dangerouslySetInnerHTML={{ __html: detailPackage.html }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                      {detailPackage.fullDescription || 'No detailed overview for this package.'}
                    </p>
                  )
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                      {detailPackage.fullDescription || '—'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {detailPackage.pictures.map((picture, pictureIndex) =>
                        picture ? (
                          <button
                            key={`${detailPackage.id}-pic-${pictureIndex}`}
                            type="button"
                            onClick={() => setEnlargedImage(picture)}
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={picture}
                              alt=""
                              className="h-28 w-40 border border-gray-300 object-cover"
                            />
                          </button>
                        ) : (
                          <div
                            key={`${detailPackage.id}-empty-${pictureIndex}`}
                            className="flex h-28 w-40 items-center justify-center border border-gray-300 bg-gray-100 text-[10px] font-semibold uppercase text-gray-500"
                          >
                            No image
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
          {enlargedImage ? (
            <button
              type="button"
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/80"
              onClick={() => setEnlargedImage(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlargedImage}
                alt=""
                className="max-h-[85vh] max-w-[90vw] border-4 border-white object-contain"
              />
            </button>
          ) : null}

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
