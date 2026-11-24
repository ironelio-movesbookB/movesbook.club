'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  CLUB_OTHERS_VERSIONS,
  getClubAccountPackRows,
  getClubOptionalModuleRows,
  getClubVersionSubscriptionRows,
  type ClubOthersVersionData,
} from '@/lib/registration/clubPricelistsMock';
import { getClubIdentificationCardsDisplay } from '@/lib/admin/clubIdentificationCardPricing';
import ClubAccountPackPricingSections from '@/components/club/ClubAccountPackPricingSections';
import ClubIdentificationCardPricingSections from '@/components/club/ClubIdentificationCardPricingSections';

export type ClubPricelistTab =
  | 'versions_features'
  | 'optional_modules'
  | 'account_pricelist'
  | 'identification_devices'
  | 'others';

const CLUB_PRICELIST_TABS: { key: ClubPricelistTab; label: string }[] = [
  { key: 'versions_features', label: 'Versions and features' },
  { key: 'optional_modules', label: 'Optional Modules' },
  { key: 'account_pricelist', label: 'Account pricelist' },
  { key: 'identification_devices', label: 'Identification devices' },
  { key: 'others', label: 'Others' },
];

function PricelistTabButton({
  active,
  onClick,
  children,
  vertical = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  vertical?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        vertical
          ? `w-full px-3 py-2 text-left text-xs font-bold border border-gray-400 rounded transition-colors ${
              active
                ? 'bg-black text-white'
                : 'bg-gradient-to-b from-[#e8e8e8] to-[#c8c8c8] text-gray-900 hover:from-[#ddd] hover:to-[#bbb]'
            }`
          : `px-3 py-1.5 text-xs font-bold border border-gray-400 border-b-0 rounded-t ${
              active
                ? 'bg-black text-white'
                : 'bg-gradient-to-b from-[#e8e8e8] to-[#c8c8c8] text-gray-900 hover:from-[#ddd] hover:to-[#bbb]'
            }`
      }
    >
      {children}
    </button>
  );
}

function VersionsFeaturesView({
  selectedVersionId,
  onSelectVersion,
}: {
  selectedVersionId: number | null;
  onSelectVersion: (id: number) => void;
}) {
  const rows = getClubVersionSubscriptionRows();

  return (
    <div className="flex justify-center p-6">
      <table className="w-full max-w-2xl border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-[#008b8b] text-white">
            <th className="border border-gray-300 px-4 py-2 text-center font-bold w-16">Select</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-bold">Code</th>
            <th className="border border-gray-300 px-4 py-2 text-left font-bold">Name Subscription</th>
            <th className="border border-gray-300 px-4 py-2 text-right font-bold">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="bg-white">
              <td className="border border-gray-300 px-4 py-2 text-center">
                <input
                  type="radio"
                  name="club-version-purchase"
                  checked={selectedVersionId === row.id}
                  onChange={() => onSelectVersion(row.id)}
                  className="h-4 w-4 cursor-pointer"
                  aria-label={`Select ${row.name}`}
                />
              </td>
              <td className="border border-gray-300 px-4 py-2">{row.code}</td>
              <td className="border border-gray-300 px-4 py-2">{row.name}</td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                EUR {row.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionalModulesView({
  lang,
  selectedModuleIds,
  onToggleModule,
}: {
  lang: string;
  selectedModuleIds: Set<number>;
  onToggleModule: (id: number) => void;
}) {
  const rows = getClubOptionalModuleRows(lang);

  return (
    <div className="flex justify-center p-6">
      <table className="w-full max-w-3xl border-collapse border border-gray-400 text-sm bg-[#e8e8e8]">
        <thead>
          <tr className="bg-[#d0d0d0]">
            <th className="border border-gray-400 px-3 py-2 text-center font-bold w-16">Select</th>
            <th className="border border-gray-400 px-3 py-2 text-left font-bold w-16">Sr. no</th>
            <th className="border border-gray-400 px-3 py-2 text-left font-bold">List of features</th>
            <th className="border border-gray-400 px-3 py-2 text-center font-bold" colSpan={2}>
              Optionals
            </th>
          </tr>
          <tr className="bg-[#d0d0d0]">
            <th className="border border-gray-400" colSpan={3} />
            <th className="border border-gray-400 px-3 py-1 text-center text-xs font-bold">No limit</th>
            <th className="border border-gray-400 px-3 py-1 text-center text-xs font-bold">1 year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="bg-[#ececec]">
              <td className="border border-gray-400 px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selectedModuleIds.has(row.id)}
                  onChange={() => onToggleModule(row.id)}
                  className="h-4 w-4 cursor-pointer"
                  aria-label={`Select ${row.name}`}
                />
              </td>
              <td className="border border-gray-400 px-3 py-2 text-center">{index + 1}</td>
              <td className="border border-gray-400 px-3 py-2">{row.name}</td>
              <td className="border border-gray-400 px-3 py-2 text-center">
                <input
                  readOnly
                  value={row.priceNoLimit}
                  className="w-16 border border-gray-400 bg-white px-2 py-1 text-center text-sm"
                />
              </td>
              <td className="border border-gray-400 px-3 py-2 text-center">
                <input
                  readOnly
                  value={row.priceOneYear}
                  className="w-16 border border-gray-400 bg-white px-2 py-1 text-center text-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CLUB_VERSION_TO_OTHERS_KEY: Record<number, 'base' | 'premium' | 'pro'> = {
  15: 'base',
  16: 'premium',
  17: 'pro',
  18: 'base',
};

function AccountPricelistView() {
  const packs = getClubAccountPackRows();
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <ClubAccountPackPricingSections packs={packs} mode="review" />
    </div>
  );
}

function IdentificationDevicesView({ lang }: { lang: string }) {
  const display = getClubIdentificationCardsDisplay();
  const messageHtml = display.thirdPartyMessageByLang[lang] ?? display.thirdPartyMessageByLang.en ?? '';

  return (
    <div className="space-y-3 p-3 text-sm">
      {display.thirdPartyMessageEnabled && messageHtml ? (
        <div
          className="prose prose-sm max-w-none rounded border border-gray-300 bg-white p-4 text-sm text-gray-800"
          dangerouslySetInnerHTML={{ __html: messageHtml }}
        />
      ) : null}
      <ClubIdentificationCardPricingSections
        thirdPartyPricelists={display.thirdPartyPricelists}
        deviceSections={display.deviceSections}
        deviceTabLabels={display.deviceTabLabels}
        styleTabLabels={display.styleTabLabels}
        mode="review"
      />
    </div>
  );
}

function OthersVersionPanel({ data }: { data: ClubOthersVersionData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      <div className="border border-gray-400 bg-[#e8e8e8]">
        <div className="bg-[#7a1f2e] px-3 py-2 text-white text-sm font-bold">Available sharing</div>
        <div className="p-3">
          <div className="mb-2 inline-block border border-gray-400 bg-white px-2 py-0.5 text-[10px]">
            {data.unlimitedLegend}
          </div>
          <p className="mb-2 text-[10px] text-gray-700">
            Assigned automatically according to the club version selected in Versions and features.
          </p>
          <div className="bg-[#337ab7] text-white text-xs font-bold px-2 py-1 mb-2">
            {data.sharingHeader}
          </div>
          <div className="space-y-1">
            {data.sharingRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[90px_60px_24px_60px] items-center gap-2 text-xs"
              >
                <span className="font-medium">{row.label}</span>
                <input
                  readOnly
                  value={row.freeUntil}
                  className="border border-gray-400 bg-[#fffacd] px-1 py-1 text-center"
                />
                <span>€</span>
                <span>{row.costEach !== '' ? row.costEach : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-gray-400 bg-[#e8e8e8]">
        <div className="bg-[#337ab7] px-3 py-2 text-white text-sm font-bold">
          Permission for management section
        </div>
        <p className="border-b border-gray-300 px-4 py-2 text-[10px] text-gray-700">
          Display only — cost to open the Management section from additional devices.
        </p>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0">Exceeded the:</span>
            <input
              readOnly
              value={data.exceededDevice}
              className="w-12 border border-gray-400 bg-white px-2 py-1 text-center"
            />
            <span>th device</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0">Price:</span>
            <span>€</span>
            <span>{data.exceededPrice}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0">Days durations:</span>
            <input
              readOnly
              value={data.daysDuration}
              className="w-16 border border-gray-400 bg-white px-2 py-1 text-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OthersView({ selectedVersionId }: { selectedVersionId: number | null }) {
  const mappedKey = selectedVersionId ? CLUB_VERSION_TO_OTHERS_KEY[selectedVersionId] : null;
  const [versionTab, setVersionTab] = useState<'base' | 'premium' | 'pro'>(mappedKey ?? 'base');

  useEffect(() => {
    if (mappedKey) setVersionTab(mappedKey);
  }, [mappedKey]);

  const active = CLUB_OTHERS_VERSIONS.find((v) => v.key === versionTab) ?? CLUB_OTHERS_VERSIONS[0];
  const selectedVersionName = selectedVersionId
    ? getClubVersionSubscriptionRows().find((row) => row.id === selectedVersionId)?.name
    : null;

  return (
    <div>
      {selectedVersionName ? (
        <p className="border-b border-gray-300 bg-sky-50 px-4 py-2 text-xs text-sky-950">
          Showing limits and costs for <strong>{selectedVersionName}</strong> (from your version
          selection).
        </p>
      ) : (
        <div className="flex flex-wrap gap-1 px-4 pt-3 border-b border-gray-300 bg-[#f5f5f5]">
          {CLUB_OTHERS_VERSIONS.map((version) => (
            <PricelistTabButton
              key={version.key}
              active={versionTab === version.key}
              onClick={() => setVersionTab(version.key)}
            >
              {version.label}
            </PricelistTabButton>
          ))}
        </div>
      )}
      <OthersVersionPanel data={active} />
    </div>
  );
}

type RegistrationClubPricelistsPanelProps = {
  lang: string;
  activeSubTab: ClubPricelistTab;
  onSubTabChange: (tab: ClubPricelistTab) => void;
  onBack: () => void;
};

export default function RegistrationClubPricelistsPanel({
  lang,
  activeSubTab,
  onSubTabChange,
  onBack,
}: RegistrationClubPricelistsPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedOptionalModules, setSelectedOptionalModules] = useState<Set<number>>(new Set());

  const toggleOptionalModule = (id: number) => {
    setSelectedOptionalModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'versions_features':
        return (
          <VersionsFeaturesView
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
          />
        );
      case 'optional_modules':
        return (
          <OptionalModulesView
            lang={lang}
            selectedModuleIds={selectedOptionalModules}
            onToggleModule={toggleOptionalModule}
          />
        );
      case 'account_pricelist':
        return <AccountPricelistView />;
      case 'identification_devices':
        return <IdentificationDevicesView lang={lang} />;
      case 'others':
        return <OthersView selectedVersionId={selectedVersionId} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-[320px] flex-col bg-[#eef6fc]">
      <div className="shrink-0 bg-[#7294c1] px-4 py-2.5 text-center text-sm font-bold text-white">
        Club Pricelists
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-44 shrink-0 flex-col gap-1 border-r border-black bg-[#f0f0f0] p-2">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded border border-gray-400 bg-[#ddd] px-3 py-2 text-left text-xs font-bold text-gray-800 hover:bg-[#ccc]"
          >
            Back
          </button>
          {CLUB_PRICELIST_TABS.map((tab) => (
            <PricelistTabButton
              key={tab.key}
              active={activeSubTab === tab.key}
              onClick={() => onSubTabChange(tab.key)}
              vertical
            >
              {tab.label}
            </PricelistTabButton>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto bg-[#eef6fc]">{renderContent()}</div>
      </div>
    </div>
  );
}

export { CLUB_PRICELIST_TABS };
