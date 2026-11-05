"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import DisplayModePanel from "@/components/display/DisplayModePanel";
import { useDisplayLayoutOptions } from "@/hooks/useDisplayLayoutOptions";

interface DisplayOptionsToolbarProps {
  showAdBanner: boolean;
  showPersonalBanner: boolean;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  onToggleAdBanner: (value: boolean) => void;
  onTogglePersonalBanner: (value: boolean) => void;
  onToggleLeftSidebar: (value: boolean) => void;
  onToggleRightSidebar: (value: boolean) => void;
}

export default function DisplayOptionsToolbar({
  showAdBanner,
  showPersonalBanner,
  showLeftSidebar,
  showRightSidebar,
  onToggleAdBanner,
  onTogglePersonalBanner,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: DisplayOptionsToolbarProps) {
  const { showOptionsToolbar } = useDisplayLayoutOptions();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [panelOpen]);

  return (
    <div className={`relative z-30 shrink-0 border-b bg-white print:hidden ${showOptionsToolbar ? "px-4 py-2 md:px-12" : "h-10"}`}>
      <div className="flex items-center gap-4">
        {showOptionsToolbar ? (
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-hidden flex-wrap pr-12">
          <ToggleOption
            checked={showLeftSidebar}
            label="Left side bar"
            onChange={onToggleLeftSidebar}
          />

          <ToggleOption
            checked={showAdBanner}
            label="Advertising banner"
            onChange={onToggleAdBanner}
          />

          <ToggleOption
            checked={showPersonalBanner}
            label="Personal banner"
            onChange={onTogglePersonalBanner}
          />

          <ToggleOption
            checked={showRightSidebar}
            label="Right sidebar"
            onChange={onToggleRightSidebar}
          />
        </div>
        ) : <div className="flex-1" />}
        <div ref={panelRef} className="absolute right-2 top-1/2 z-40 -translate-y-1/2">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className="flex h-7 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-base font-bold leading-none text-gray-900 shadow-sm hover:bg-gray-100"
            aria-expanded={panelOpen}
            aria-label="Open the display carousel"
            title="Display carousel"
          >
            «
          </button>
          {panelOpen ? (
            <div className="fixed right-4 top-28 z-[80]">
              <DisplayModePanel onClose={() => setPanelOpen(false)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ToggleOptionProps {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

function ToggleOption({
  checked,
  label,
  onChange,
}: ToggleOptionProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-[#7092BE] focus:ring-[#7092BE]"
      />

      <span className="flex items-center gap-1.5">
        {checked ? (
          <Eye className="h-4 w-4 text-[#7092BE]" />
        ) : (
          <EyeOff className="h-4 w-4 text-gray-400" />
        )}

        {label}
      </span>
    </label>
  );
}