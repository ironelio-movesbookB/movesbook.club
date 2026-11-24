'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import type { PackageItem, PackageSettingsView } from '@/types/adminPackageSettings';
import {
  addGlobalPackageItem,
  getGlobalPackages,
  getPackageEditHref,
  getPackageSettingsHref,
  getTiersForUserType,
  PACKAGE_TYPE_CONFIGS,
  removeGlobalPackageItem,
  reorderGlobalPackages,
  saveGlobalPackages,
  updatePackageTiersForUserType,
} from '@/lib/admin/packageSettingsMock';
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

  return (
    <tr ref={setNodeRef} style={style} className={index % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'}>
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
      <td className="border border-gray-300 px-3 py-2 text-gray-800">
        {getPackageDisplayTitle(row.titlesByLang, lang)}
      </td>
      <td className="border border-gray-300 px-2 py-2 text-center">
        <TierCheck
          checked={row.published}
          onChange={(published) => onTogglePublish(row.id, published)}
        />
      </td>
      {tiers.map((tier) => (
        <td key={tier.key} className="border border-gray-300 px-2 py-2 text-center">
          <TierCheck
            checked={userTiers[tier.key] ?? false}
            onChange={() => onToggleTier(row.id, tier.key)}
          />
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
  const [saving, setSaving] = useState(false);
  const [copyAllTarget, setCopyAllTarget] = useState<string>('');

  const copyTargetOptions = getPackageCopyTargetOptions(data.userTypeId);

  const sortedPackages = useMemo(
    () => [...data.packages].sort((a, b) => a.sortOrder - b.sortOrder),
    [data.packages],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refreshFromGlobal = () => {
    setData((prev) => ({ ...prev, packages: getGlobalPackages() }));
  };

  const updatePackagePublished = (id: number, published: boolean) => {
    const packages = data.packages.map((row) =>
      row.id === id ? { ...row, published } : row,
    );
    saveGlobalPackages(packages);
    setData((prev) => ({ ...prev, packages }));
  };

  const toggleTier = (packageItemId: number, tierKey: string) => {
    const row = data.packages.find((p) => p.id === packageItemId);
    if (!row) return;
    const current = getTiersForUserType(row, data.userTypeId);
    const next = { ...current, [tierKey]: !current[tierKey] };
    updatePackageTiersForUserType(packageItemId, data.userTypeId, next);
    setData((prev) => ({
      ...prev,
      packages: prev.packages.map((p) =>
        p.id === packageItemId
          ? {
              ...p,
              tiersByUserType: { ...p.tiersByUserType, [data.userTypeId]: next },
            }
          : p,
      ),
    }));
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
    removeGlobalPackageItem(id);
    refreshFromGlobal();
  };

  const handleAddNew = () => {
    const item = addGlobalPackageItem();
    router.push(getPackageEditHref(data.userTypeId, item.id, data.lang));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = sortedPackages.map((p) => p.id);
    const reordered = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    reorderGlobalPackages(reordered);
    refreshFromGlobal();
  };

  const handleSave = async () => {
    setSaving(true);
    saveGlobalPackages(data.packages);
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
    const row = data.packages.find((p) => p.id === itemId);
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
            <button
              type="button"
              onClick={handleAddNew}
              className="border border-gray-800 bg-black px-5 py-2 text-sm font-bold text-white hover:bg-[#333]"
            >
              Add New
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#e6e6e6] border-b border-gray-300">
                  <th className="border border-gray-300 px-2 py-2 w-10" />
                  <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800 min-w-[280px]">
                    List of packages
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-800 w-20">
                    Publish
                  </th>
                  {config.tiers.map((tier) => (
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
              <SortableContext
                items={sortedPackages.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {sortedPackages.map((row, index) => (
                    <SortablePackageRow
                      key={row.id}
                      row={row}
                      index={index}
                      lang={data.lang}
                      userTypeId={data.userTypeId}
                      userTypeLabel={config.label}
                      tiers={config.tiers}
                      onTogglePublish={updatePackagePublished}
                      onToggleTier={toggleTier}
                      onDelete={handleDelete}
                      onCopyPackage={handleCopySinglePackage}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>

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
