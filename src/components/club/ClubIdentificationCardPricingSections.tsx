'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ClubDevicePriceGridConfig,
  ClubIdentificationDeviceSectionConfig,
  ClubThirdPartyDevicePricelist,
} from '@/types/clubIdentificationCards';

function HorizontalTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t border border-b-0 border-gray-400 px-3 py-1.5 text-xs font-bold ${
        active
          ? 'bg-black text-white'
          : 'bg-gradient-to-b from-[#e8e8e8] to-[#c8c8c8] text-gray-900 hover:from-[#ddd] hover:to-[#bbb]'
      }`}
    >
      {children}
    </button>
  );
}

function VerticalTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded border border-gray-400 px-3 py-2 text-left text-xs font-bold transition-colors ${
        active
          ? 'bg-black text-white'
          : 'bg-gradient-to-b from-[#e8e8e8] to-[#c8c8c8] text-gray-900 hover:from-[#ddd] hover:to-[#bbb]'
      }`}
    >
      {children}
    </button>
  );
}

function DevicePriceGridHorizontal({
  grid,
  mode,
  onChange,
  onUpdate,
}: {
  grid: ClubDevicePriceGridConfig;
  mode: 'admin-edit' | 'registration' | 'review';
  onChange?: (grid: ClubDevicePriceGridConfig) => void;
  onUpdate?: () => void;
}) {
  const editable = mode === 'admin-edit' && onChange;

  const updateUnitPrice = (index: number, raw: string) => {
    if (!onChange) return;
    const unitPrices = [...grid.unitPrices];
    unitPrices[index] = Number(raw) || 0;
    onChange({
      ...grid,
      unitPrices,
      totalPrices: grid.quantities.map(
        (qty, i) => Math.round(qty * (unitPrices[i] ?? 0) * 100) / 100,
      ),
    });
  };

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-end gap-2 pl-[80px]">
        {grid.quantities.map((qty) => (
          <div
            key={qty}
            className="w-14 border border-gray-600 bg-[#c0392b] py-1 text-center text-[10px] font-bold text-white"
          >
            {qty}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[70px] shrink-0 text-xs">Price</span>
        <span className="text-xs font-bold">€</span>
        {grid.unitPrices.map((price, i) => (
          <input
            key={`p-${i}`}
            readOnly={!editable}
            value={price}
            onChange={(e) => updateUnitPrice(i, e.target.value)}
            className="w-14 border border-gray-400 bg-[#fffacd] px-1 py-0.5 text-center text-xs"
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-[70px] shrink-0 text-xs">Total Price</span>
        <span className="text-xs font-bold">€</span>
        {grid.totalPrices.map((price, i) => (
          <input
            key={`t-${i}`}
            readOnly
            value={price}
            className="w-14 border border-gray-400 bg-yellow-300 px-1 py-0.5 text-center text-xs font-semibold"
          />
        ))}
      </div>
      {editable && onUpdate ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={onUpdate}
            className="bg-[#c0392b] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#962d22]"
          >
            Update Terms
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DevicePriceGridVertical({
  grid,
  selectedIndex,
  onSelectIndex,
}: {
  grid: ClubDevicePriceGridConfig;
  selectedIndex?: number | null;
  onSelectIndex?: (index: number | null) => void;
}) {
  return (
    <div className="space-y-0 py-2">
      {grid.quantities.map((qty, i) => (
        <div
          key={qty}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-300 py-3 last:border-b-0"
        >
          <div className="flex w-20 shrink-0 flex-col items-center gap-1">
            <div className="w-full border border-gray-600 bg-[#c0392b] py-1 text-center text-xs font-bold text-white">
              {qty}
            </div>
            {onSelectIndex ? (
              <input
                type="checkbox"
                checked={selectedIndex === i}
                onChange={() => onSelectIndex(selectedIndex === i ? null : i)}
                className="h-4 w-4"
                aria-label={`Select pack of ${qty} cards`}
              />
            ) : null}
          </div>
          <div className="flex min-w-[120px] flex-1 items-center gap-2 text-xs text-gray-800">
            <span className="shrink-0">Price</span>
            <span className="font-bold">€</span>
            <input
              readOnly
              value={grid.unitPrices[i]}
              className="w-16 border border-gray-400 bg-[#fffacd] px-1 py-1 text-center text-sm"
            />
          </div>
          <div className="flex min-w-[120px] items-center gap-2 text-xs text-gray-800">
            <span className="shrink-0">Total Price</span>
            <span className="font-bold">€</span>
            <input
              readOnly
              value={grid.totalPrices[i]}
              className="w-16 border border-gray-400 bg-yellow-300 px-1 py-1 text-center text-sm font-semibold"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type ClubIdentificationCardPricingSectionsProps = {
  thirdPartyPricelists: ClubThirdPartyDevicePricelist[];
  deviceSections: ClubIdentificationDeviceSectionConfig[];
  deviceTabLabels: string[];
  styleTabLabels: readonly string[];
  mode: 'admin-edit' | 'registration' | 'review';
  onThirdPartyChange?: (
    deviceIndex: number,
    pricelist: ClubThirdPartyDevicePricelist,
  ) => void;
  onDeviceSectionChange?: (
    sectionIndex: number,
    style: string,
    grid: ClubDevicePriceGridConfig,
  ) => void;
  onDeviceSectionUpdate?: (sectionIndex: number, style: string) => void;
  selectedThirdPartyTier?: number | null;
  onSelectThirdPartyTier?: (index: number | null) => void;
  selectedDeviceTier?: number | null;
  onSelectDeviceTier?: (index: number | null) => void;
};

export default function ClubIdentificationCardPricingSections({
  thirdPartyPricelists,
  deviceSections,
  deviceTabLabels,
  styleTabLabels,
  mode,
  onThirdPartyChange,
  onDeviceSectionChange,
  onDeviceSectionUpdate,
  selectedThirdPartyTier,
  onSelectThirdPartyTier,
  selectedDeviceTier,
  onSelectDeviceTier,
}: ClubIdentificationCardPricingSectionsProps) {
  const vertical = mode === 'registration';
  const readOnlyReview = mode === 'review';
  const TabButton = vertical ? VerticalTabButton : HorizontalTabButton;

  const [deviceTab, setDeviceTab] = useState(deviceTabLabels[0] ?? '');
  const [styleTab, setStyleTab] = useState(styleTabLabels[0] ?? 'Blank');

  useEffect(() => {
    onSelectThirdPartyTier?.(null);
    onSelectDeviceTier?.(null);
  }, [deviceTab, styleTab, onSelectThirdPartyTier, onSelectDeviceTier]);

  const deviceIndex = thirdPartyPricelists.findIndex((p) => p.deviceLabel === deviceTab);
  const activeThirdParty =
    deviceIndex >= 0 ? thirdPartyPricelists[deviceIndex] : thirdPartyPricelists[0];

  const activeSection =
    deviceSections.find((s) => s.label === deviceTab || s.key === activeThirdParty?.deviceKey) ??
    deviceSections[0];

  const activeGrid =
    activeSection?.grids[styleTab as keyof typeof activeSection.grids] ??
    (activeSection ? Object.values(activeSection.grids)[0] : undefined);

  const registrationThirdPartyRows = useMemo(() => {
    if (!activeThirdParty || mode !== 'registration') return [];
    return activeThirdParty.quantities
      .map((qty, i) => ({
        qty,
        total: activeThirdParty.totals[i],
        enabled: activeThirdParty.enabled[i] ?? true,
        index: i,
      }))
      .filter((row) => row.enabled);
  }, [activeThirdParty, mode]);

  const reviewThirdPartyRows = useMemo(() => {
    if (!activeThirdParty || mode !== 'review') return [];
    return activeThirdParty.quantities
      .map((qty, i) => ({
        qty,
        total: activeThirdParty.totals[i],
        enabled: activeThirdParty.enabled[i] ?? true,
        index: i,
      }))
      .filter((row) => row.enabled);
  }, [activeThirdParty, mode]);

  const updateThirdPartyTotal = (index: number, raw: string) => {
    if (!onThirdPartyChange || deviceIndex < 0 || !activeThirdParty) return;
    const totals = [...activeThirdParty.totals];
    totals[index] = Number(raw) || 0;
    onThirdPartyChange(deviceIndex, { ...activeThirdParty, totals });
  };

  const toggleThirdPartyEnabled = (index: number) => {
    if (!onThirdPartyChange || deviceIndex < 0 || !activeThirdParty) return;
    const enabled = [...activeThirdParty.enabled];
    enabled[index] = !enabled[index];
    onThirdPartyChange(deviceIndex, { ...activeThirdParty, enabled });
  };

  const sectionIndex = deviceSections.findIndex((s) => s.key === activeSection?.key);

  const thirdPartyBlock = activeThirdParty ? (
    <div className="border border-gray-400">
      <div className="flex items-center justify-between bg-[#c0392b] px-3 py-2 text-xs font-bold text-white">
        <span>Third party pricelist</span>
        <span className="font-normal">Prices to enable cards of another company</span>
      </div>
      {!vertical ? (
        <div className="flex flex-wrap gap-1 border-b border-gray-300 bg-[#f5f5f5] p-2">
          {deviceTabLabels.map((tab) => (
            <TabButton key={tab} active={deviceTab === tab} onClick={() => setDeviceTab(tab)}>
              {tab}
            </TabButton>
          ))}
        </div>
      ) : null}
      <div className="bg-[#fffacd] p-3">
        {vertical ? (
          <div className="space-y-0">
            {registrationThirdPartyRows.length === 0 ? (
              <p className="text-xs text-gray-700">No packs available for this device type.</p>
            ) : (
              registrationThirdPartyRows.map((row) => (
                <div
                  key={row.qty}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-300 py-3 last:border-b-0"
                >
                  <div className="flex w-20 shrink-0 flex-col items-center gap-1">
                    <div className="w-full border border-gray-600 bg-[#c0392b] py-1 text-center text-xs font-bold text-white">
                      {row.qty}
                    </div>
                    {onSelectThirdPartyTier ? (
                      <input
                        type="checkbox"
                        checked={selectedThirdPartyTier === row.index}
                        onChange={() =>
                          onSelectThirdPartyTier(
                            selectedThirdPartyTier === row.index ? null : row.index,
                          )
                        }
                        className="h-4 w-4"
                        aria-label={`Select third-party pack of ${row.qty}`}
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-[120px] items-center gap-2 text-xs text-gray-800">
                    <span className="shrink-0">Total Price</span>
                    <span className="font-bold">€</span>
                    <input
                      readOnly
                      value={row.total}
                      className="w-16 border border-gray-400 bg-yellow-300 px-1 py-1 text-center text-sm font-semibold"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : readOnlyReview ? (
          reviewThirdPartyRows.length === 0 ? (
            <p className="text-xs text-gray-700">No packs available for this device type.</p>
          ) : (
            <>
              <div className="mb-2 flex items-end gap-2 pl-[100px]">
                {reviewThirdPartyRows.map((row) => (
                  <div
                    key={row.qty}
                    className="w-14 bg-[#c0392b] py-1 text-center text-[10px] font-bold text-white"
                  >
                    {row.qty}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[90px] text-xs font-medium">Total Price</span>
                <span className="text-xs">€</span>
                {reviewThirdPartyRows.map((row) => (
                  <input
                    key={row.qty}
                    readOnly
                    value={row.total}
                    className="w-14 border border-gray-400 bg-yellow-300 px-1 py-0.5 text-center text-xs"
                  />
                ))}
              </div>
            </>
          )
        ) : (
          <>
            <div className="mb-2 flex items-end gap-2 pl-[100px]">
              {activeThirdParty.quantities.map((qty) => (
                <div
                  key={qty}
                  className="w-14 bg-[#c0392b] py-1 text-center text-[10px] font-bold text-white"
                >
                  {qty}
                </div>
              ))}
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="w-[90px] text-xs font-medium">Enable to displaying to the user</span>
              {activeThirdParty.enabled.map((on, i) => (
                <div key={`en-${i}`} className="flex w-14 justify-center">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleThirdPartyEnabled(i)}
                    className="h-4 w-4"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[90px] text-xs font-medium">Total Price</span>
              <span className="text-xs">€</span>
              {activeThirdParty.totals.map((total, i) => (
                <input
                  key={i}
                  value={total}
                  onChange={(e) => updateThirdPartyTotal(i, e.target.value)}
                  className="w-14 border border-gray-400 bg-yellow-300 px-1 py-0.5 text-center text-xs"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  const devicePricingBlock =
    activeSection && activeGrid ? (
      <div className="border border-gray-400">
        <div
          className="px-3 py-1.5 text-xs font-bold text-white"
          style={{ backgroundColor: activeSection.headerColor }}
        >
          {activeSection.label} {styleTab}
        </div>
        <div className="bg-white px-3">
          {vertical ? (
            <DevicePriceGridVertical
              grid={activeGrid}
              selectedIndex={selectedDeviceTier}
              onSelectIndex={onSelectDeviceTier}
            />
          ) : (
            <DevicePriceGridHorizontal
              grid={activeGrid}
              mode={mode}
              onChange={
                onDeviceSectionChange && sectionIndex >= 0
                  ? (grid) => onDeviceSectionChange(sectionIndex, styleTab, grid)
                  : undefined
              }
              onUpdate={
                onDeviceSectionUpdate && sectionIndex >= 0
                  ? () => onDeviceSectionUpdate(sectionIndex, styleTab)
                  : undefined
              }
            />
          )}
        </div>
      </div>
    ) : (
      <div className="border border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
        No pricing configured for {deviceTab} — {styleTab}.
      </div>
    );

  if (vertical) {
    return (
      <div className="flex min-h-0 gap-2 text-sm">
        <div className="flex w-40 shrink-0 flex-col gap-1">
          {deviceTabLabels.map((tab) => (
            <TabButton key={tab} active={deviceTab === tab} onClick={() => setDeviceTab(tab)}>
              {tab}
            </TabButton>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="flex w-28 shrink-0 flex-col gap-1">
            {styleTabLabels.map((tab) => (
              <TabButton key={tab} active={styleTab === tab} onClick={() => setStyleTab(tab)}>
                {tab}
              </TabButton>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {thirdPartyBlock}
            {devicePricingBlock}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {readOnlyReview ? (
        <p className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          Reference prices only. Identification cards can be purchased in the Club section after you
          select the club that needs them.
        </p>
      ) : null}
      {thirdPartyBlock}
      <div className="flex flex-wrap gap-1">
        {styleTabLabels.map((tab) => (
          <TabButton key={tab} active={styleTab === tab} onClick={() => setStyleTab(tab)}>
            {tab}
          </TabButton>
        ))}
      </div>
      {devicePricingBlock}
    </div>
  );
}
