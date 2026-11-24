'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import SubscriptionMembershipSharingDisplay, {
  getSubscriptionSharingDaysValue,
} from '@/components/admin/subscriptions/SubscriptionMembershipSharingDisplay';
import RegistrationVersionLastNewsBlock from './RegistrationVersionLastNewsBlock';
import { getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import {
  getDetailedOverviewForEntity,
  getEntityDisplayTitle,
  getOverviewFeaturesForEntity,
  getSubscriptionRowForEntity,
  REGISTRATION_USER_TYPE_TABS,
  type RegistrationPackageCategory,
  type RegistrationSelectedEntity,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import RegistrationClubPricelistsPanel, {
  type ClubPricelistTab,
} from './RegistrationClubPricelistsPanel';

type EntityDetailTab =
  | 'overview'
  | 'detailed_overview'
  | 'availability_shares'
  | 'last_news'
  | 'club_pricelists';

export type RegistrationEntityDetailTab = EntityDetailTab;

const ENTITY_TABS: { key: EntityDetailTab; label: string; clubOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'detailed_overview', label: 'Detailed overview' },
  { key: 'availability_shares', label: 'Availability shares' },
  { key: 'last_news', label: 'Last news' },
  { key: 'club_pricelists', label: 'Club pricelists', clubOnly: true },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30];

type RegistrationPackageEntityDetailPanelProps = {
  entity: RegistrationSelectedEntity;
  userType: RegistrationUserType;
  lang: string;
  category: RegistrationPackageCategory;
  onClose?: () => void;
  /** When true, renders inline (dashboard) instead of as a modal overlay. */
  embedded?: boolean;
  initialActiveTab?: EntityDetailTab;
  initialClubSubTab?: ClubPricelistTab;
};

function NoImagePlaceholder() {
  return (
    <div className="flex h-16 w-16 items-center justify-center border border-gray-300 bg-gray-100 text-[9px] font-semibold uppercase text-gray-500 text-center leading-tight">
      No image available
    </div>
  );
}

function FeatureImage({
  src,
  onClick,
}: {
  src: string;
  onClick?: () => void;
}) {
  if (!src) return <NoImagePlaceholder />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#337ab7]"
      aria-label="View enlarged image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-16 w-16 border border-gray-300 object-cover bg-white" />
    </button>
  );
}

function EnlargedImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged package image"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-[#444] p-2 text-white hover:bg-black"
        aria-label="Close enlarged image"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[85vh] max-w-[90vw] border-4 border-white bg-white object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

function OverviewTab({
  entity,
  userType,
  lang,
  category,
}: {
  entity: RegistrationSelectedEntity;
  userType: RegistrationUserType;
  lang: string;
  category: RegistrationPackageCategory;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const features = useMemo(
    () => getOverviewFeaturesForEntity(userType, entity.tierKey, lang, category),
    [userType, entity.tierKey, lang, category],
  );

  useEffect(() => {
    setPage(1);
  }, [userType, entity.tierKey, lang, category, pageSize]);

  const totalPages = Math.max(1, Math.ceil(features.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageFeatures = features.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const title = getEntityDisplayTitle(userType, entity.versionLabel);
  const canPaginate = totalPages > 1;

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-white px-3 py-2">
        <div className="bg-[#337ab7] px-3 py-1.5 text-sm font-bold text-white">{title}</div>
        <div className="flex gap-2">
          <span className="bg-[#444] px-3 py-1.5 text-xs font-bold text-white">Overview</span>
          <span className="bg-[#888] px-3 py-1.5 text-xs font-bold text-white opacity-70">
            Back to versions features
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-[#f9f9f9] px-3 py-2 text-sm">
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border border-gray-300 bg-white px-2 py-1 text-sm"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-gray-600">per page</span>
        <span className="text-xs text-gray-500">
          {features.length} package{features.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canPaginate || currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border border-gray-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          {canPaginate ? (
            <label className="flex items-center gap-1 text-xs text-gray-700">
              <span>Page</span>
              <select
                value={currentPage}
                onChange={(e) => setPage(Number(e.target.value))}
                className="border border-gray-300 bg-white px-2 py-1 text-xs"
                aria-label="Select page"
              >
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <option key={pageNumber} value={pageNumber}>
                    {pageNumber}
                  </option>
                ))}
              </select>
              <span>of {totalPages}</span>
            </label>
          ) : (
            <span className="border border-gray-300 bg-[#ddd] px-2 py-1 text-xs font-bold">
              {currentPage}
            </span>
          )}
          <button
            type="button"
            disabled={!canPaginate || currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="border border-gray-300 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {enlargedImage ? (
        <EnlargedImageModal src={enlargedImage} onClose={() => setEnlargedImage(null)} />
      ) : null}

      <div className="flex-1 overflow-y-auto bg-white">
        {pageFeatures.length === 0 ? (
          <p className="p-6 text-sm text-gray-600">No features available for this version.</p>
        ) : (
          pageFeatures.map((feature) => (
            <div
              key={feature.id}
              className="flex flex-wrap items-start gap-3 border-b border-gray-200 px-4 py-4"
            >
              <div className="flex gap-2">
                {feature.pictures.map((picture, pictureIndex) => (
                  <FeatureImage
                    key={`${feature.id}-pic-${pictureIndex}`}
                    src={picture}
                    onClick={picture ? () => setEnlargedImage(picture) : undefined}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-[#5cb85c] stroke-[3]" />
                  <span className="font-bold text-gray-900">{feature.title}</span>
                </div>
                {feature.description ? (
                  <p className="mt-1 text-sm text-gray-700 leading-relaxed">{feature.description}</p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailedOverviewTab({
  entity,
  userType,
  lang,
  category,
}: {
  entity: RegistrationSelectedEntity;
  userType: RegistrationUserType;
  lang: string;
  category: RegistrationPackageCategory;
}) {
  const items = useMemo(
    () => getDetailedOverviewForEntity(userType, entity.tierKey, lang, category),
    [userType, entity.tierKey, lang, category],
  );
  const title = getEntityDisplayTitle(userType, entity.versionLabel);

  if (items.length === 0) {
    return (
      <p className="p-6 text-sm text-gray-600">
        No detailed overviews available for enabled packages in this version.
      </p>
    );
  }

  return (
    <div className="overflow-y-auto p-4">
      <h3 className="mb-4 text-base font-bold text-gray-800">{title}</h3>
      <div className="space-y-6">
        {items.map((item) => (
          <section key={item.id} className="border border-gray-300 bg-white">
            <div className="border-b border-gray-300 bg-[#7eb8da] px-4 py-2 text-sm font-bold text-gray-900">
              {item.title}
            </div>
            <div
              className="prose prose-sm max-w-none p-4 text-gray-800"
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function AvailabilitySharesTab({
  entity,
  userType,
}: {
  entity: RegistrationSelectedEntity;
  userType: RegistrationUserType;
}) {
  const row = getSubscriptionRowForEntity(entity);
  const editData = entity.subscriptionId ? getSubscriptionEditData(entity.subscriptionId, false) : null;

  if (!row || !editData) {
    return (
      <p className="p-6 text-sm text-gray-600">
        Availability settings are not available for this version.
      </p>
    );
  }

  const subscriptionUserType = REGISTRATION_USER_TYPE_TABS.find((t) => t.key === userType)
    ?.subscriptionType ?? 'athlete';

  return (
    <div className="overflow-y-auto p-4">
      <SubscriptionMembershipSharingDisplay
        settings={editData.settings}
        userType={subscriptionUserType}
        daysValue={getSubscriptionSharingDaysValue(row.days1, row.days2)}
        mode="registration"
      />
    </div>
  );
}

function LastNewsTab({ entity, lang }: { entity: RegistrationSelectedEntity; lang: string }) {
  const editData = entity.subscriptionId ? getSubscriptionEditData(entity.subscriptionId, false) : null;

  if (!editData) {
    return (
      <p className="p-6 text-sm text-gray-600">Last news is not available for this version.</p>
    );
  }

  return (
    <RegistrationVersionLastNewsBlock
      lastNewsByLang={editData.settings.lastNewsByLang}
      lang={lang}
      variant="tab"
    />
  );
}

export default function RegistrationPackageEntityDetailPanel({
  entity,
  userType,
  lang,
  category,
  onClose,
  embedded = false,
  initialActiveTab,
  initialClubSubTab = 'versions_features',
}: RegistrationPackageEntityDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<EntityDetailTab>(initialActiveTab ?? 'overview');
  const [clubSubTab, setClubSubTab] = useState<ClubPricelistTab>(initialClubSubTab);
  const [showClubSubNav, setShowClubSubNav] = useState(
    initialActiveTab === 'club_pricelists',
  );

  const visibleTabs = ENTITY_TABS.filter((tab) => !tab.clubOnly || userType === 'club');

  const handleTabClick = (tab: EntityDetailTab) => {
    if (tab === 'club_pricelists') {
      setShowClubSubNav(true);
      setActiveTab(tab);
      return;
    }
    setShowClubSubNav(false);
    setActiveTab(tab);
  };

  const handleClubBack = () => {
    setShowClubSubNav(false);
    setActiveTab('overview');
  };

  const containerClass = embedded
    ? 'absolute inset-0 z-10 flex flex-col overflow-hidden bg-white'
    : 'absolute inset-x-2 bottom-2 top-24 z-20 flex flex-col overflow-hidden rounded-md border-2 border-gray-400 bg-white shadow-2xl sm:inset-x-4';

  return (
    <div className={containerClass}>
      {!embedded && onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-30 rounded-full bg-[#444] p-1 text-white hover:bg-black"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {!showClubSubNav ? (
        <div
          className={`flex flex-wrap border-b border-gray-300 bg-[#f0f0f0] ${embedded ? '' : 'pr-10'}`}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabClick(tab.key)}
                className={`px-3 py-2 text-xs sm:text-sm font-bold border-r border-gray-300 transition-colors ${
                  isActive
                    ? 'bg-[#555] text-white'
                    : tab.clubOnly
                      ? 'bg-[#ddd] text-[#c71585] hover:bg-[#ccc]'
                      : 'bg-[#ddd] text-gray-800 hover:bg-[#ccc]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden">
        {showClubSubNav && activeTab === 'club_pricelists' ? (
          <RegistrationClubPricelistsPanel
            lang={lang}
            activeSubTab={clubSubTab}
            onSubTabChange={setClubSubTab}
            onBack={handleClubBack}
          />
        ) : activeTab === 'overview' ? (
          <OverviewTab entity={entity} userType={userType} lang={lang} category={category} />
        ) : activeTab === 'detailed_overview' ? (
          <DetailedOverviewTab
            entity={entity}
            userType={userType}
            lang={lang}
            category={category}
          />
        ) : activeTab === 'availability_shares' ? (
          <AvailabilitySharesTab entity={entity} userType={userType} />
        ) : activeTab === 'last_news' ? (
          <LastNewsTab entity={entity} lang={lang} />
        ) : null}
      </div>
    </div>
  );
}
