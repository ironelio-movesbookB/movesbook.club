'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, Loader2, RotateCcw, Save } from 'lucide-react';
import ClubSettingsTypologyTabs from '@/components/club/settings/ClubSettingsTypologyTabs';
import ListpriceEditSubTabs, { PRICELIST_PATH } from './ListpriceEditSubTabs';
import { authFetch, type PackageDetailResponse, type PackageService } from './types';
import StatusToast, { type Toast } from './StatusToast';

type Draft = {
  packageName: string;
  putTable: boolean;
  selected: Set<string>;
  order: string[];
};

function draftFrom(data: PackageDetailResponse): Draft {
  return {
    packageName: data.package.packageName,
    putTable: data.package.putTable,
    selected: new Set(data.package.serviceIds),
    order: data.services.map((s) => s.id)
  };
}

/** "Subscription package" tab. Legacy: clubsetting_typology_subscription_package.ctp */
export default function SubscriptionPackageForm({ listpriceId }: { listpriceId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PackageDetailResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    authFetch<PackageDetailResponse>(
      `/api/club/settings/subscription-package?listpriceId=${encodeURIComponent(listpriceId)}`
    )
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setDraft(draftFrom(response));
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Unable to load.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [listpriceId]);

  const save = useCallback(
    async (next: Draft, successMessage = 'Updated successfully.') => {
      setSaving(true);
      try {
        await authFetch('/api/club/settings/subscription-package', {
          method: 'PUT',
          body: JSON.stringify({
            listpriceId,
            packageName: next.packageName,
            putTable: next.putTable,
            serviceIds: next.order.filter((id) => next.selected.has(id)),
            viewOrder: next.order
          })
        });
        setToast({ type: 'success', message: successMessage });
      } catch (e) {
        setToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to update' });
      } finally {
        setSaving(false);
      }
    },
    [listpriceId]
  );

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }
  if (loadError || !data || !draft) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError ?? 'Unable to load.'}</p>
        <button type="button" onClick={() => router.push(PRICELIST_PATH)} className="mt-4 text-sm font-semibold">
          Back
        </button>
      </div>
    );
  }

  const servicesById = new Map(data.services.map((s) => [s.id, s]));
  const orderedServices = draft.order.map((id) => servicesById.get(id)).filter(Boolean) as PackageService[];

  const toggleService = (id: string, checked: boolean) => {
    const selected = new Set(draft.selected);
    if (checked) selected.add(id);
    else selected.delete(id);
    setDraft({ ...draft, selected });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.order.indexOf(String(active.id));
    const newIndex = draft.order.indexOf(String(over.id));
    const next = { ...draft, order: arrayMove(draft.order, oldIndex, newIndex) };
    setDraft(next);
    // Legacy behaviour: reordering is saved immediately only when the package is in the table.
    if (next.putTable) save(next, 'Order and subscription package updated successfully');
  };

  return (
    <div className="p-4 lg:p-6">
      <StatusToast toast={toast} onClose={() => setToast(null)} />
      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <ClubSettingsTypologyTabs listPriceTypologyId={data.listprice.typologyId || null} />
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4">
          <h1 className="text-xl font-semibold">Typology of subscription</h1>
          <button
            type="button"
            onClick={() => router.push(`${PRICELIST_PATH}?typologyId=${encodeURIComponent(data.listprice.typologyId)}`)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold uppercase text-gray-600">Select Price List</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
              <label htmlFor="pricelist-selector" className="text-sm font-medium text-gray-700">
                Price List
              </label>
              <select
                id="pricelist-selector"
                value={listpriceId}
                onChange={(e) => e.target.value && router.push(`${PRICELIST_PATH}/package/${encodeURIComponent(e.target.value)}`)}
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              >
                {data.pricelistOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ListpriceEditSubTabs listpriceId={listpriceId} showAllPackagesLink />

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-sm">
            <label className="flex items-center gap-2 font-medium text-gray-700">
              Package name :
              <input
                value={draft.packageName}
                maxLength={255}
                onChange={(e) => setDraft({ ...draft, packageName: e.target.value })}
                className="h-9 w-56 rounded-md border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={draft.putTable}
                onChange={(e) => setDraft({ ...draft, putTable: e.target.checked })}
                className="h-5 w-5"
              />
              Put this typology of subscription among the &quot;Subscription packages&quot;
            </label>
          </div>

          <div className="max-h-[480px] overflow-auto rounded-md border border-gray-200">
            <table className="w-full min-w-[760px] text-center text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
                <tr>
                  <th className="w-44 py-3 pl-6 pr-3 text-left">Sector</th>
                  <th className="px-3 py-3" />
                  <th className="px-3 py-3">Image</th>
                  <th className="px-3 py-3">Service</th>
                  <th className="px-3 py-3" />
                  <th className="px-3 py-3 text-left">Cost</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={draft.order} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {orderedServices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-gray-500">
                          No special services available.
                        </td>
                      </tr>
                    )}
                    {orderedServices.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        checked={draft.selected.has(service.id)}
                        disabled={saving}
                        onToggle={(checked) => toggleService(service.id, checked)}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 bg-gray-50 px-4 py-4">
          <button
            type="button"
            onClick={() => setDraft(draftFrom(data))}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(draft)}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function ServiceRow({
  service,
  checked,
  disabled,
  onToggle
}: {
  service: PackageService;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled
  });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-gray-100 bg-white ${isDragging ? 'relative z-10 opacity-70 shadow-md ring-2 ring-gray-300' : 'hover:bg-gray-50'}`}
    >
      <td className="w-44 py-3 pl-6 pr-3 text-left">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-5 shrink-0"
            aria-label={`Include ${service.serviceName}`}
          />
          {service.sectorName}
        </label>
      </td>
      <td className="px-3 py-3">
        <input
          readOnly
          value={service.serviceName}
          className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-sm"
        />
      </td>
      <td className="px-3 py-3">
        <ServiceImage src={service.imageUrl} className="h-16 w-20" />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-2">
          <ServiceImage src={service.image1Url} className="h-16 w-20" />
          <ServiceImage src={service.image2Url} className="h-16 w-20" />
        </div>
      </td>
      <td className="px-3 py-3">
        {service.videoUrl ? (
          <a href={service.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            Link
          </a>
        ) : (
          '-'
        )}
      </td>
      <td className="px-3 py-3 text-left">{service.cost}</td>
      <td className="px-2 py-3">
        <button
          type="button"
          className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag to reorder ${service.serviceName}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
}

function ServiceImage({ src, className }: { src: string | null; className: string }) {
  if (!src) return <span className="text-xs text-gray-400">No Image</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Service" className={`${className} inline-block rounded-md object-cover`} />;
}
