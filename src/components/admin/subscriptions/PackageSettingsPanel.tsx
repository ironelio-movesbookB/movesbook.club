'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Copy, GripVertical, Pencil, X } from 'lucide-react';
import type { PackageCatalog, PackageItem, PackageSection, PackageSettingsView } from '@/types/adminPackageSettings';
import { PACKAGE_SECTIONS } from '@/types/adminPackageSettings';
import {
  addPackageItem,
  copyPackageSectionToAthleteAccounts,
  ensurePackageSettingsLoaded,
  getAthleteAccountPackages,
  getGlobalPackages,
  getPackageEditHref,
  getPackageSettingsHref,
  getPackageViewMode,
  getTiersForUserType,
  PACKAGE_TYPE_CONFIGS,
  removePackageItem,
  reorderPackagesInSection,
  saveAthleteAccountPackages,
  saveGlobalPackages,
  setPackageViewMode,
  updatePackageTiersForUserType,
} from '@/lib/admin/packageSettingsMock';
import type { PackageViewMode } from '@/types/adminPackageSettings';
import {
  buildCopyAllSettingsWarning,
  buildCopySinglePackageWarning,
  copyAllPackageSettingsToUserType,
  copySinglePackageToUserType,
  getPackageCopyTargetOptions,
} from '@/lib/admin/packageSettingsCopy';
import { getPackageDisplayTitle } from '@/lib/admin/packageSettingsLang';
import SubscriptionSystemDashboardHeader from './SubscriptionSystemDashboardHeader';
import MovesbookLanguageTabs from './MovesbookLanguageTabs';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';

type PackageSettingsPanelProps = {
  initialData: PackageSettingsView;
};

function TierCheck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mx-auto flex h-6 w-6 items-center justify-center"
      aria-label={checked ? 'Enabled' : 'Disabled'}
    >
      {checked ? <Check className="h-5 w-5 text-[#5cb85c] stroke-[3]" /> : null}
    </button>
  );
}

function SortablePackageRow({
  row,
  index,
  lang,
  userTypeId,
  userTypeLabel,
  tiers,
  onTogglePublish,
  onToggleTier,
  onDelete,
  onCopyPackage,
}: {
  row: PackageItem;
  index: number;
  lang: string;
  userTypeId: PackageSettingsView['userTypeId'];
  userTypeLabel: string;
  tiers: { key: string; label: string }[];
  onTogglePublish: (id: number, published: boolean) => void;
  onToggleTier: (id: number, tierKey: string) => void;
  onDelete: (id: number) => void;
  onCopyPackage: (itemId: number, targetUserTypeId: PackageSettingsView['userTypeId']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const userTiers = getTiersForUserType(row, userTypeId);
  const copyTargets = getPackageCopyTargetOptions(userTypeId);
  const [rowCopyTarget, setRowCopyTarget] = useState<string>('');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleRowCopy = () => {
    if (!rowCopyTarget) return;
    onCopyPackage(row.id, Number(rowCopyTarget) as PackageSettingsView['userTypeId']);
  };

  const greyed = !row.published;
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={greyed ? 'bg-gray-300 text-gray-500' : index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}
      title={greyed ? 'Unpublished — shown grey here and hidden on the registration form' : undefined}
    >
      <td className="border border-gray-300 px-2 py-2 text-center w-10">
        <button
          type="button"
          className="mx-auto flex cursor-grab items-center justify-center text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className={`border border-gray-300 px-3 py-2 ${greyed ? 'text-gray-500' : 'text-gray-800'}`}>
        {row.kind === 'separator' ? (
          <span className="font-bold" style={{ color: greyed ? undefined : row.titleColor }}>
            {row.icon ? `${row.icon} ` : ''}
            {getPackageDisplayTitle(row.titlesByLang, lang)}
            <span className="ml-2 text-[10px] font-semibold uppercase text-gray-500">Separator</span>
          </span>
        ) : (
          getPackageDisplayTitle(row.titlesByLang, lang)
        )}
      </td>
      <td className="border border-gray-300 px-2 py-2 text-center">
        <TierCheck
          checked={row.published}
          onChange={(published) => onTogglePublish(row.id, published)}
        />
      </td>
      {tiers.map((tier) => (
        <td key={tier.key} className="border border-gray-300 px-2 py-2 text-center">
          {row.kind === 'separator' ? (
            <span className="text-gray-400">—</span>
          ) : (
            <TierCheck
              checked={userTiers[tier.key] ?? false}
              onChange={() => onToggleTier(row.id, tier.key)}
            />
          )}
        </td>
      ))}
      <td className="border border-gray-300 px-2 py-2 text-center align-top">
        <div className="flex min-w-[120px] flex-col items-stretch gap-1">
          <select
            value={rowCopyTarget}
            onChange={(e) => setRowCopyTarget(e.target.value)}
            className="w-full border border-gray-300 bg-white px-1 py-0.5 text-[10px]"
          >
            <option value="">Copy to…</option>
            {copyTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!rowCopyTarget}
            onClick={handleRowCopy}
            className="inline-flex items-center justify-center gap-1 rounded border border-gray-400 bg-white px-1 py-0.5 text-[10px] font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Copy this package from ${userTypeLabel} to another user type`}
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      </td>
      <td className="border border-gray-300 px-2 py-2 text-center">
        <Link
          href={getPackageEditHref(userTypeId, row.id, lang)}
          className="mx-auto flex items-center justify-center"
          aria-label="Edit package"
        >
          <Pencil className="h-4 w-4 text-[#f0ad4e]" />
        </Link>
      </td>
      <td className="border border-gray-300 px-2 py-2 text-center">
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#d9534f] text-white"
          aria-label="Remove package"
        >
          <X className="h-3 w-3 stroke-[3]" />
        </button>
      </td>
    </tr>
  );
}

export default function PackageSettingsPanel({ initialData }: PackageSettingsPanelProps) {
  const router = useRouter();
  const config = PACKAGE_TYPE_CONFIGS.find((c) => c.id === initialData.userTypeId)!;
  const [data, setData] = useState(initialData);
  const [athletePackages, setAthletePackages] = useState<PackageItem[]>([]);
  const [viewMode, setViewMode] = useState<PackageViewMode>('standard');
  const [saving, setSaving] = useState(false);
  const [copyAllTarget, setCopyAllTarget] = useState<string>('');
  const [sectionCopy, setSectionCopy] = useState<PackageSection | null>(null);

  useEffect(() => {
    ensurePackageSettingsLoaded();
    setAthletePackages(getAthleteAccountPackages());
    setData((prev) => ({ ...prev, packages: getGlobalPackages() }));
    setViewMode(getPackageViewMode());
  }, []);

  const copyTargetOptions = getPackageCopyTargetOptions(data.userTypeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refreshFromGlobal = () => {
    setData((prev) => ({ ...prev, packages: getGlobalPackages() }));
    setAthletePackages(getAthleteAccountPackages());
  };

  const listFor = (catalog: PackageCatalog) =>
    catalog === 'athlete_accounts' ? athletePackages : data.packages;

  const saveList = (catalog: PackageCatalog, packages: PackageItem[]) => {
    if (catalog === 'athlete_accounts') {
      saveAthleteAccountPackages(packages);
      setAthletePackages(packages);
      return;
    }
    saveGlobalPackages(packages);
    setData((prev) => ({ ...prev, packages }));
  };

  const updatePackagePublished = (id: number, published: boolean) => {
    const row = [...data.packages, ...athletePackages].find((item) => item.id === id);
    if (!row) return;
    const catalog = row.catalog ?? 'packages';
    saveList(
      catalog,
      listFor(catalog).map((item) => (item.id === id ? { ...item, published } : item)),
    );
  };

  const toggleTier = (packageItemId: number, tierKey: string) => {
    const row = [...data.packages, ...athletePackages].find((p) => p.id === packageItemId);
    if (!row) return;
    const catalog = row.catalog ?? 'packages';
    const current = getTiersForUserType(row, data.userTypeId);
    const next = { ...current, [tierKey]: !current[tierKey] };
    updatePackageTiersForUserType(packageItemId, data.userTypeId, next);
    saveList(
      catalog,
      listFor(catalog).map((p) =>
        p.id === packageItemId
          ? {
              ...p,
              tiersByUserType: { ...p.tiersByUserType, [data.userTypeId]: next },
            }
          : p,
      ),
    );
  };

  const handleLangChange = (nextLang: string) => {
    saveGlobalPackages(data.packages);
    router.push(getPackageSettingsHref(data.userTypeId, nextLang));
  };

  const handleUserTypeTab = (userTypeId: number) => {
    saveGlobalPackages(data.packages);
    router.push(getPackageSettingsHref(userTypeId as PackageSettingsView['userTypeId'], data.lang));
  };

  const handleDelete = (id: number) => {
    removePackageItem(id);
    refreshFromGlobal();
  };

  const handleAddNew = (catalog: PackageCatalog, section: PackageSection) => {
    const item = addPackageItem({ catalog, section, kind: 'package' });
    router.push(getPackageEditHref(data.userTypeId, item.id, data.lang));
  };

  const handleAddSeparator = (catalog: PackageCatalog, section: PackageSection) => {
    const item = addPackageItem({ catalog, section, kind: 'separator' });
    router.push(getPackageEditHref(data.userTypeId, item.id, data.lang));
  };

  const handleDragEnd = (
    catalog: PackageCatalog,
    section: PackageSection,
    rows: PackageItem[],
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = rows.map((p) => p.id);
    const reordered = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    reorderPackagesInSection(catalog, section, reordered);
    refreshFromGlobal();
  };

  const handleCopySection = (section: PackageSection) => {
    setSectionCopy(section);
  };

  const confirmCopySection = () => {
    if (!sectionCopy) return;
    copyPackageSectionToAthleteAccounts(sectionCopy);
    refreshFromGlobal();
    setSectionCopy(null);
  };

  const handleViewMode = (mode: PackageViewMode) => {
    setViewMode(mode);
    setPackageViewMode(mode);
  };

  const handleSave = async () => {
    setSaving(true);
    saveGlobalPackages(data.packages);
    saveAthleteAccountPackages(athletePackages);
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);
  };

  const handleCopyAllSettings = () => {
    if (!copyAllTarget) return;
    const targetId = Number(copyAllTarget) as PackageSettingsView['userTypeId'];
    const targetConfig = PACKAGE_TYPE_CONFIGS.find((c) => c.id === targetId);
    if (!targetConfig) return;

    const confirmed = window.confirm(
      buildCopyAllSettingsWarning(config.label, targetConfig.label),
    );
    if (!confirmed) return;

    copyAllPackageSettingsToUserType(data.userTypeId, targetId);
    refreshFromGlobal();
    setCopyAllTarget('');
  };

  const handleCopySinglePackage = (
    itemId: number,
    targetUserTypeId: PackageSettingsView['userTypeId'],
  ) => {
    const targetConfig = PACKAGE_TYPE_CONFIGS.find((c) => c.id === targetUserTypeId);
    const row = [...data.packages, ...athletePackages].find((p) => p.id === itemId);
    if (!targetConfig || !row) return;

    const confirmed = window.confirm(
      buildCopySinglePackageWarning(
        getPackageDisplayTitle(row.titlesByLang, data.lang),
        config.label,
        targetConfig.label,
      ),
    );
    if (!confirmed) return;

    copySinglePackageToUserType(data.userTypeId, targetUserTypeId, itemId);
    refreshFromGlobal();
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <SubscriptionSystemDashboardHeader />

      <div className="flex-1 overflow-y-auto bg-white">
        <MovesbookLanguageTabs
          activeLang={data.lang}
          onChange={handleLangChange}
          label="Select a language to edit the features for each package version"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 bg-[#f5f5f5] px-4 py-2">
          <div className="flex gap-0">
            {PACKAGE_TYPE_CONFIGS.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handleUserTypeTab(pkg.id)}
                className={`border border-gray-800 px-5 py-2 text-sm font-bold ${
                  pkg.id === data.userTypeId
                    ? 'bg-black text-white'
                    : 'bg-[#555] text-white hover:bg-black'
                }`}
              >
                {pkg.label}
              </button>
            ))}
            <label className="ml-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
              View mode
              <select
                value={viewMode}
                onChange={(e) => handleViewMode(e.target.value as PackageViewMode)}
                className="border border-gray-800 bg-white px-2 py-1.5 text-sm font-normal"
              >
                <option value="standard">Standard blue</option>
                <option value="black">Black</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Copy current on</span>
            <select
              value={copyAllTarget}
              onChange={(e) => setCopyAllTarget(e.target.value)}
              className="border border-gray-400 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Select user type…</option>
              {copyTargetOptions.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!copyAllTarget}
              onClick={handleCopyAllSettings}
              className="inline-flex items-center gap-1 border border-gray-800 bg-[#333] px-4 py-1.5 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>
        </div>

        <PackageCatalogBlock
          title="Packages infos"
          catalog="packages"
          packages={data.packages}
          lang={data.lang}
          userTypeId={data.userTypeId}
          userTypeLabel={config.label}
          tiers={config.tiers}
          sensors={sensors}
          showCopyToAthlete
          onCopySection={handleCopySection}
          onAddNew={handleAddNew}
          onAddSeparator={handleAddSeparator}
          onDragEnd={handleDragEnd}
          onTogglePublish={updatePackagePublished}
          onToggleTier={toggleTier}
          onDelete={handleDelete}
          onCopyPackage={handleCopySinglePackage}
        />

        <PackageCatalogBlock
          title="Athlete Accounts Packages"
          catalog="athlete_accounts"
          packages={athletePackages}
          lang={data.lang}
          userTypeId={data.userTypeId}
          userTypeLabel={config.label}
          tiers={config.tiers}
          sensors={sensors}
          onAddNew={handleAddNew}
          onAddSeparator={handleAddSeparator}
          onDragEnd={handleDragEnd}
          onTogglePublish={updatePackagePublished}
          onToggleTier={toggleTier}
          onDelete={handleDelete}
          onCopyPackage={handleCopySinglePackage}
        />

        <PromocodeConfirmModal
          open={sectionCopy !== null}
          title="Copy to Athlete Accounts Packages"
          message={
            sectionCopy
              ? `Copy the whole ${PACKAGE_SECTIONS.find((entry) => entry.key === sectionCopy)?.label ?? sectionCopy} section from Packages infos into the same section of Athlete Accounts Packages? Existing rows in that athlete section will be replaced.`
              : ''
          }
          confirmLabel="Copy"
          cancelLabel="Cancel"
          onClose={() => setSectionCopy(null)}
          onConfirm={confirmCopySection}
        />

        <div className="flex justify-center gap-3 py-6 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#333] hover:bg-black text-white px-8 py-2 text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <Link
            href="/subscriptions/subscription_settings"
            className="bg-[#333] hover:bg-black text-white px-8 py-2 text-sm font-bold"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

function PackageCatalogBlock({
  title,
  catalog,
  packages,
  lang,
  userTypeId,
  userTypeLabel,
  tiers,
  sensors,
  showCopyToAthlete = false,
  onCopySection,
  onAddNew,
  onAddSeparator,
  onDragEnd,
  onTogglePublish,
  onToggleTier,
  onDelete,
  onCopyPackage,
}: {
  title: string;
  catalog: PackageCatalog;
  packages: PackageItem[];
  lang: string;
  userTypeId: PackageSettingsView['userTypeId'];
  userTypeLabel: string;
  tiers: { key: string; label: string }[];
  sensors: SensorDescriptor<SensorOptions>[];
  showCopyToAthlete?: boolean;
  onCopySection?: (section: PackageSection) => void;
  onAddNew: (catalog: PackageCatalog, section: PackageSection) => void;
  onAddSeparator: (catalog: PackageCatalog, section: PackageSection) => void;
  onDragEnd: (
    catalog: PackageCatalog,
    section: PackageSection,
    rows: PackageItem[],
    event: DragEndEvent,
  ) => void;
  onTogglePublish: (id: number, published: boolean) => void;
  onToggleTier: (id: number, tierKey: string) => void;
  onDelete: (id: number) => void;
  onCopyPackage: (itemId: number, targetUserTypeId: PackageSettingsView['userTypeId']) => void;
}) {
  return (
    <div className="border-t-4 border-[#333]">
      <div className="bg-[#7a1f2e] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
        {title}
      </div>
      {PACKAGE_SECTIONS.map((section) => {
        const rows = packages
          .filter((row) => (row.section ?? 'training') === section.key)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        return (
          <div key={`${catalog}-${section.key}`} className="border-b border-gray-300">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e6e6e6] px-4 py-2">
              <h3 className="text-sm font-bold text-gray-900">{section.label}</h3>
              <div className="flex flex-wrap gap-2">
                {showCopyToAthlete && onCopySection ? (
                  <button
                    type="button"
                    onClick={() => onCopySection(section.key)}
                    className="border border-gray-800 bg-white px-3 py-1 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  >
                    Copy to Athlete Accounts Packages
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAddSeparator(catalog, section.key)}
                  className="border border-gray-800 bg-[#5bc0de] px-3 py-1 text-xs font-bold text-white hover:bg-[#31b0d5]"
                >
                  Add separator
                </button>
                <button
                  type="button"
                  onClick={() => onAddNew(catalog, section.key)}
                  className="border border-gray-800 bg-black px-3 py-1 text-xs font-bold text-white hover:bg-[#333]"
                >
                  Add New
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => onDragEnd(catalog, section.key, rows, event)}
              >
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#f7f7f7]">
                      <th className="border border-gray-300 px-2 py-2 w-10" />
                      <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800 min-w-[280px]">
                        List of packages
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 w-20">
                        Publish
                      </th>
                      {tiers.map((tier) => (
                        <th
                          key={tier.key}
                          className="border border-gray-300 px-2 py-2 text-center font-bold text-gray-800 w-20"
                        >
                          {tier.label}
                        </th>
                      ))}
                      <th className="border border-gray-300 px-2 py-2 w-28 text-center font-bold text-gray-800">
                        Copy
                      </th>
                      <th className="border border-gray-300 px-2 py-2 w-12">Edit</th>
                      <th className="border border-gray-300 px-2 py-2 w-12">Remove</th>
                    </tr>
                  </thead>
                  <SortableContext items={rows.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={tiers.length + 5}
                            className="border border-gray-300 px-3 py-4 text-center text-xs text-gray-500"
                          >
                            No packages in {section.label}.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, index) => (
                          <SortablePackageRow
                            key={row.id}
                            row={row}
                            index={index}
                            lang={lang}
                            userTypeId={userTypeId}
                            userTypeLabel={userTypeLabel}
                            tiers={tiers}
                            onTogglePublish={onTogglePublish}
                            onToggleTier={onToggleTier}
                            onDelete={onDelete}
                            onCopyPackage={onCopyPackage}
                          />
                        ))
                      )}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </div>
        );
      })}
    </div>
  );
}
