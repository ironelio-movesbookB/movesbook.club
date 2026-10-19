'use client';

import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, Star } from 'lucide-react';
import {
  ALT_ROW_COLORS,
  ROW_COUNT_OPTIONS,
  archiveSectionById,
  summaryTileById,
} from '@/lib/club/monitoring/dashboardCatalog';
import type { MonitoringDashboardSettings, SectionSetting, TileSetting } from '@/lib/club/monitoring/dashboardSettings';

type Pane = 'summary' | string;

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: HTMLAttributes<HTMLButtonElement>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-1.5 ${
        isDragging ? 'relative z-10 shadow' : ''
      }`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export default function DashboardSettingsModal({
  draft,
  onChange,
  onSave,
  onCancel,
  onSaveDefault,
  onLoadDefault,
}: {
  draft: MonitoringDashboardSettings;
  onChange: (next: MonitoringDashboardSettings) => void;
  onSave: () => void;
  onCancel: () => void;
  onSaveDefault: () => void;
  onLoadDefault: () => void;
}) {
  const [pane, setPane] = useState<Pane>('summary');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const selectedSection = draft.sections.find((section) => section.id === pane);

  const onTileDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.tiles.findIndex((tile) => tile.id === active.id);
    const newIndex = draft.tiles.findIndex((tile) => tile.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...draft, tiles: arrayMove(draft.tiles, oldIndex, newIndex) });
  };

  const onSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.sections.findIndex((section) => section.id === active.id);
    const newIndex = draft.sections.findIndex((section) => section.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...draft, sections: arrayMove(draft.sections, oldIndex, newIndex) });
  };

  const patchTile = (id: string, enabled: boolean) => {
    onChange({
      ...draft,
      tiles: draft.tiles.map((tile) => (tile.id === id ? { ...tile, enabled } : tile)),
    });
  };

  const patchSection = (id: string, patch: Partial<SectionSetting>) => {
    onChange({
      ...draft,
      sections: draft.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-16">
      <div className="w-full max-w-3xl overflow-hidden rounded-md border border-gray-400 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#7a1f2b] px-3 py-2 text-white">
          <h2 className="text-sm font-semibold">Dashboard setting</h2>
          <button type="button" onClick={onCancel} className="text-lg leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 overflow-hidden md:grid-cols-2">
          <div className="overflow-y-auto border-r border-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-[#fff6cc] px-2 py-2">
              <input
                type="checkbox"
                checked={draft.summaryEnabled}
                onChange={(event) => onChange({ ...draft, summaryEnabled: event.target.checked })}
                aria-label="Show summary panels"
              />
              <span className="flex-1 text-sm font-medium">Summary panels</span>
              <button
                type="button"
                onClick={() => setPane('summary')}
                className={`rounded p-1 ${pane === 'summary' ? 'bg-white' : ''}`}
                aria-label="Summary panel order"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
              <SortableContext items={draft.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
                {draft.sections.map((section) => {
                  const def = archiveSectionById(section.id);
                  return (
                    <SortableRow key={section.id} id={section.id}>
                      {(handle) => (
                        <>
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={(event) => patchSection(section.id, { enabled: event.target.checked })}
                            aria-label={`Show ${def?.label ?? section.id}`}
                          />
                          <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
                          <span className="min-w-0 flex-1 truncate text-sm">{def?.label ?? section.id}</span>
                          <button type="button" className="cursor-grab text-yellow-500" aria-label="Reorder" {...handle}>
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPane(section.id)}
                            className={`rounded p-1 ${pane === section.id ? 'bg-gray-100' : ''}`}
                            aria-label={`${def?.label ?? 'Section'} settings`}
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </SortableRow>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          <div className="overflow-y-auto bg-[#fafafa]">
            {pane === 'summary' ? (
              <>
                <div className="bg-[#7a1f2b] px-3 py-2 text-sm font-semibold text-white">Summary panels</div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTileDragEnd}>
                  <SortableContext items={draft.tiles.map((tile) => tile.id)} strategy={verticalListSortingStrategy}>
                    {draft.tiles.map((tile: TileSetting) => {
                      const def = summaryTileById(tile.id);
                      return (
                        <SortableRow key={tile.id} id={tile.id}>
                          {(handle) => (
                            <>
                              <input
                                type="checkbox"
                                checked={tile.enabled}
                                onChange={(event) => patchTile(tile.id, event.target.checked)}
                                aria-label={`Show ${def?.label ?? tile.id}`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">{def?.label ?? tile.id}</span>
                              <button type="button" className="cursor-grab text-yellow-500" aria-label="Reorder" {...handle}>
                                <GripVertical className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </SortableRow>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </>
            ) : selectedSection ? (
              <div className="space-y-4 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  {archiveSectionById(selectedSection.id)?.label}
                </p>
                <label className="block text-sm text-gray-700">
                  Rows displayed
                  <select
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5"
                    value={selectedSection.rows}
                    onChange={(event) =>
                      patchSection(selectedSection.id, { rows: Number(event.target.value) })
                    }
                  >
                    {ROW_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count === 5 ? '5 rows (def)' : `${count} rows`}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <p className="mb-2 text-sm text-gray-700">Alternate row color</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ALT_ROW_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => patchSection(selectedSection.id, { altColor: color })}
                        className={`h-8 rounded border ${
                          selectedSection.altColor === color ? 'border-gray-900 ring-2 ring-gray-700' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Row color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
          <button type="button" onClick={onSave} className="rounded bg-[#3d6b4f] px-3 py-1.5 text-sm text-white">
            Save
          </button>
          <button type="button" onClick={onCancel} className="rounded bg-gray-500 px-3 py-1.5 text-sm text-white">
            Cancel
          </button>
          <button type="button" onClick={onSaveDefault} className="rounded bg-[#3d6b4f] px-3 py-1.5 text-sm text-white">
            Save default
          </button>
          <button type="button" onClick={onLoadDefault} className="rounded bg-gray-600 px-3 py-1.5 text-sm text-white">
            Load default
          </button>
        </div>
      </div>
    </div>
  );
}
