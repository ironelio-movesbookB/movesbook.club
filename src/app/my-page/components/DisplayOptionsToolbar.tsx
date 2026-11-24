"use client";

import { Eye, EyeOff } from "lucide-react";

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
  return (
    <div className="relative z-30 shrink-0 border-b bg-white px-4 py-2 md:px-12">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-hidden flex-wrap">
          <ToggleOption
            checked={showAdBanner}
            label="Advertising Banner"
            onChange={onToggleAdBanner}
          />

          <ToggleOption
            checked={showPersonalBanner}
            label="Personal Banner & Picture"
            onChange={onTogglePersonalBanner}
          />

          <ToggleOption
            checked={showLeftSidebar}
            label="Left Sidebar"
            onChange={onToggleLeftSidebar}
          />

          <ToggleOption
            checked={showRightSidebar}
            label="Right Sidebar"
            onChange={onToggleRightSidebar}
          />
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