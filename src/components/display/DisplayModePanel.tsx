'use client';

import { useState } from 'react';
import { Monitor } from 'lucide-react';
import {
  useDisplayLayoutOptions,
  type LayoutModeId,
} from '@/hooks/useDisplayLayoutOptions';

const MODE_OPTIONS: { id: LayoutModeId; label: string }[] = [
  { id: 'mode1', label: 'Mode 1' },
  { id: 'mode2', label: 'Mode 2' },
  { id: 'mode3', label: 'Mode 3' },
];

export default function DisplayModePanel({ onClose }: { onClose: () => void }) {
  const layout = useDisplayLayoutOptions();
  const [saveAs, setSaveAs] = useState<LayoutModeId>('mode1');
  const [savedNotice, setSavedNotice] = useState('');

  const save = () => {
    layout.saveMode(saveAs);
    const label = MODE_OPTIONS.find((item) => item.id === saveAs)?.label ?? 'Mode';
    setSavedNotice(`${label} saved`);
  };

  return (
    <div
      className="w-72 overflow-hidden rounded border border-gray-300 bg-white text-sm text-gray-900 shadow-xl"
      role="dialog"
      aria-label="Switch to Full Mode"
    >
      <button
        type="button"
        onClick={layout.restoreAll}
        className="w-full border-b border-gray-300 bg-gray-100 px-3 py-2 text-center font-medium text-gray-800 hover:bg-gray-200"
      >
        Switch to Full Mode
      </button>

      <div className="space-y-2 p-3">
        <SectionCheck
          checked={layout.showLeftSidebar}
          label="Sections toolbar"
          onChange={layout.setShowLeftSidebar}
        />
        <SectionCheck
          checked={layout.showAdBanner}
          label="Banner section"
          onChange={layout.setShowAdBanner}
        />
        <SectionCheck
          checked={layout.showPersonalBanner}
          label="MyPage/MyClub toolbar"
          onChange={layout.setShowPersonalBanner}
        />
        <SectionCheck
          checked={layout.showRightSidebar}
          label="Right sidebar"
          onChange={layout.setShowRightSidebar}
        />

        <button
          type="button"
          onClick={layout.applyCarouselStep}
          className="flex w-full items-center gap-2 rounded bg-orange-600 px-2 py-1.5 text-left font-semibold text-white hover:bg-orange-700"
        >
          <Monitor className="h-4 w-4 shrink-0" />
          Central toolbar
        </button>
        <p className="pl-6 text-xs text-gray-500">
          Each click hides the next section. When all are hidden, the next click restores every section except the right sidebar, and the click after that restores the full page.
        </p>

        <div className="flex gap-2 pl-6">
          {MODE_OPTIONS.map((mode) => {
            const saved = layout.modes[mode.id] != null;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={!saved}
                title={saved ? `Load ${mode.label}` : `Save ${mode.label} first`}
                onClick={() => layout.loadMode(mode.id)}
                className="rounded border-2 border-orange-600 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="shrink-0 text-xs font-medium text-gray-700">Save current as</span>
          <select
            value={saveAs}
            onChange={(event) => setSaveAs(event.target.value as LayoutModeId)}
            className="min-w-0 flex-1 rounded border border-gray-400 bg-white px-1 py-1 text-xs"
            aria-label="Save current layout as"
          >
            {MODE_OPTIONS.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            className="rounded bg-orange-600 px-2 py-1 text-xs font-bold text-white hover:bg-orange-700"
          >
            OK
          </button>
        </div>
        {savedNotice ? <p className="text-xs font-medium text-green-700">{savedNotice}</p> : null}

        <button
          type="button"
          onClick={layout.hideExceptCentral}
          className="w-full rounded border border-gray-400 bg-gray-50 px-2 py-1.5 text-left text-xs font-medium hover:bg-gray-100"
        >
          Hide all sidebars and toolbars except the central page
        </button>
        <button
          type="button"
          onClick={layout.restoreAll}
          className="w-full rounded border border-gray-400 bg-gray-50 px-2 py-1.5 text-left text-xs font-medium hover:bg-gray-100"
        >
          Restore all sidebars and toolbars
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SectionCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span>{label}</span>
    </label>
  );
}
