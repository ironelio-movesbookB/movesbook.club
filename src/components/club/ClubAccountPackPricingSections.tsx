'use client';

import type { ClubAccountPackDisplayRow } from '@/lib/admin/clubAccountPackPricing';

type ClubAccountPackPricingSectionsProps = {
  packs: ClubAccountPackDisplayRow[];
  mode: 'admin-edit' | 'registration' | 'review';
  onPackChange?: (index: number, pack: ClubAccountPackDisplayRow) => void;
  onPackUpdate?: (index: number) => void;
  selectedPacks?: Record<string, number | null>;
  onSelectPack?: (versionKey: string, packIndex: number | null) => void;
};

function PackSection({
  pack,
  mode,
  onChange,
  onUpdate,
  selectedPackIndex,
  onSelectPack,
}: {
  pack: ClubAccountPackDisplayRow;
  mode: 'admin-edit' | 'registration' | 'review';
  onChange?: (pack: ClubAccountPackDisplayRow) => void;
  onUpdate?: () => void;
  selectedPackIndex?: number | null;
  onSelectPack?: (packIndex: number | null) => void;
}) {
  const editable = mode === 'admin-edit' && onChange;

  const updateUnitPrice = (index: number, raw: string) => {
    if (!onChange) return;
    const unitPrices = [...pack.unitPrices];
    unitPrices[index] = Number(raw) || 0;
    onChange({
      ...pack,
      totalPrices: pack.packSizes.map(
        (size, i) => Math.round(size * (unitPrices[i] ?? 0) * 100) / 100,
      ),
      unitPrices,
    });
  };

  const togglePack = (index: number) => {
    if (mode === 'registration') {
      onSelectPack?.(selectedPackIndex === index ? null : index);
      return;
    }
    if (!onChange) return;
    const packEnabled = [...pack.packEnabled];
    packEnabled[index] = !packEnabled[index];
    onChange({ ...pack, packEnabled });
  };

  if (mode === 'registration') {
    return (
      <div className="border border-gray-400 bg-[#f0f0f0]">
        <div
          className="px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: pack.headerColor }}
        >
          {pack.versionLabel}
        </div>
        <div className="space-y-0 p-4">
          {pack.packSizes.map((size, i) => pack.packEnabled[i] === false ? null : (
            <div
              key={`${pack.versionKey}-${size}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-300 py-3 last:border-b-0"
            >
              <div className="flex w-20 shrink-0 flex-col items-center gap-1">
                <div className="w-full border border-gray-600 bg-[#c0392b] py-1 text-center text-xs font-bold text-white">
                  {size}
                </div>
                <input
                  type="checkbox"
                  checked={selectedPackIndex === i}
                  onChange={() => togglePack(i)}
                  className="h-4 w-4"
                  aria-label={`Select pack of ${size} accounts`}
                />
              </div>
              <div className="flex min-w-[140px] flex-1 items-center gap-2 text-xs text-gray-800">
                <span className="shrink-0">Price for account in Pack</span>
                <span className="font-bold">€</span>
                <input
                  readOnly
                  value={pack.unitPrices[i]}
                  className="w-16 border border-gray-400 bg-[#fffacd] px-1 py-1 text-center text-sm"
                />
              </div>
              <div className="flex min-w-[120px] items-center gap-2 text-xs text-gray-800">
                <span className="shrink-0">Total Price</span>
                <span className="font-bold">€</span>
                <input
                  readOnly
                  value={pack.totalPrices[i]}
                  className="w-16 border border-gray-400 bg-yellow-300 px-1 py-1 text-center text-sm font-semibold"
                />
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3 border-t border-gray-300 pt-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">Standard price of single account</span>
              <span className="font-bold">€</span>
              <input
                readOnly
                value={pack.standardPrice}
                className="w-20 border border-gray-400 bg-[#e8d5f5] px-2 py-1 text-center"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">Reselling suggestion</span>
              <span className="font-bold">€</span>
              <input
                readOnly
                value={pack.resellingSuggestion}
                className="w-20 border border-gray-400 bg-white px-2 py-1 text-center"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">Dura</span>
              <input
                readOnly
                value={pack.durationDays}
                className="w-16 border border-gray-400 bg-white px-2 py-1 text-center"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'review' || mode === 'admin-edit') {
    const showPackCheckboxes = mode === 'admin-edit';
    return (
      <div className="border border-gray-400 bg-[#f0f0f0]">
        <div
          className="px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: pack.headerColor }}
        >
          {pack.versionLabel}
        </div>
        <div className="p-4 space-y-3">
          <div className={`flex items-end gap-2 ${showPackCheckboxes ? 'pl-[150px]' : ''}`}>
            {pack.packSizes.map((size, i) => (
              <div key={size} className="flex w-16 flex-col items-center gap-1">
                <div className="w-full border border-gray-600 bg-[#c0392b] py-1 text-center text-xs font-bold text-white">
                  {size}
                </div>
                {showPackCheckboxes ? (
                  <input
                    type="checkbox"
                    checked={pack.packEnabled[i] ?? false}
                    onChange={() => togglePack(i)}
                    className="h-4 w-4"
                    aria-label={`Enable pack of ${size} accounts`}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[140px] shrink-0 text-xs text-gray-800">Price for account in Pack</span>
            <span className="text-sm font-bold">€</span>
            {pack.unitPrices.map((price, i) => (
              <input
                key={`unit-${pack.versionKey}-${i}`}
                type="text"
                readOnly={!editable}
                value={price}
                onChange={(e) => updateUnitPrice(i, e.target.value)}
                className="w-16 border border-gray-400 bg-[#fffacd] px-1 py-1 text-center text-sm"
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-[140px] shrink-0 text-xs text-gray-800">Total Price</span>
            <span className="text-sm font-bold">€</span>
            {pack.totalPrices.map((price, i) => (
              <input
                key={`total-${pack.versionKey}-${i}`}
                readOnly
                value={price}
                className="w-16 border border-gray-400 bg-yellow-300 px-1 py-1 text-center text-sm font-semibold"
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-gray-300 pt-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Standard price of single account</span>
              <span className="font-bold">€</span>
              <input
                type="text"
                readOnly={!editable}
                value={pack.standardPrice}
                onChange={(e) =>
                  onChange?.({ ...pack, standardPrice: Number(e.target.value) || 0 })
                }
                className="w-20 border border-gray-400 bg-[#e8d5f5] px-2 py-1 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Reselling suggestion</span>
              <span className="font-bold">€</span>
              <input
                type="text"
                readOnly={!editable}
                value={pack.resellingSuggestion}
                onChange={(e) =>
                  onChange?.({ ...pack, resellingSuggestion: Number(e.target.value) || 0 })
                }
                className="w-20 border border-gray-400 bg-white px-2 py-1 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Dura</span>
              <input
                type="text"
                readOnly={!editable}
                value={pack.durationDays}
                onChange={(e) =>
                  onChange?.({ ...pack, durationDays: Number(e.target.value) || 0 })
                }
                className="w-16 border border-gray-400 bg-white px-2 py-1 text-center"
              />
            </div>
          </div>

          {editable && onUpdate ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={onUpdate}
                className="bg-[#c0392b] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#962d22]"
              >
                Update
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}

export default function ClubAccountPackPricingSections({
  packs,
  mode,
  onPackChange,
  onPackUpdate,
  selectedPacks,
  onSelectPack,
}: ClubAccountPackPricingSectionsProps) {
  return (
    <div className="space-y-4">
      {mode === 'registration' ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Club account packs can be purchased only during club registration / creation. These list
          prices are configured in Super Admin → Purchase new accounts.
        </p>
      ) : mode === 'review' ? (
        <p className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          Reference prices only. Account packs can be purchased in the Club section after you select
          the club that needs additional member accounts.
        </p>
      ) : (
        <p className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          List prices for Base, Premium (Special), and Professional club member accounts. Shown to
          club admins only during registration — not after the club profile exists.
        </p>
      )}
      {packs.map((pack, index) => (
        <PackSection
          key={pack.versionKey}
          pack={pack}
          mode={mode}
          onChange={onPackChange ? (next) => onPackChange(index, next) : undefined}
          onUpdate={onPackUpdate ? () => onPackUpdate(index) : undefined}
          selectedPackIndex={selectedPacks?.[pack.versionKey] ?? null}
          onSelectPack={
            onSelectPack ? (packIndex) => onSelectPack(pack.versionKey, packIndex) : undefined
          }
        />
      ))}
    </div>
  );
}
