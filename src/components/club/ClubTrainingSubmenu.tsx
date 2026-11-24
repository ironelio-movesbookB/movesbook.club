'use client';

import { useState } from 'react';
import {
  BookMarked,
  CalendarRange,
  ChevronDown,
  Database,
  Dumbbell,
  Globe2,
  Library,
  Settings2,
  Timer,
} from 'lucide-react';

type TrainingLeafItem = {
  key: string;
  label: string;
  icon: typeof Dumbbell;
};

const LIBRARY_ITEMS: TrainingLeafItem[] = [
  { key: 'global-library', label: 'My Global library of exercises', icon: Globe2 },
  { key: 'exercise-bank', label: 'Exercise Bank', icon: Database },
  { key: 'ogp-library', label: 'My library of OGP Exercises', icon: BookMarked },
];

const TRAINING_LEAF_ITEMS: TrainingLeafItem[] = [
  { key: 'my-workouts', label: 'My workouts', icon: Dumbbell },
  { key: 'workouts-planning', label: 'Workouts planning', icon: CalendarRange },
  { key: 'workout-settings', label: 'Workout settings', icon: Settings2 },
];

type ClubTrainingSubmenuProps = {
  onGlobalLibraryClick?: () => void;
  onOgpLibraryClick?: () => void;
};

/**
 * My Club sidebar — expandable Section Training with nested Libraries of exercises.
 */
export default function ClubTrainingSubmenu({
  onGlobalLibraryClick,
  onOgpLibraryClick,
}: ClubTrainingSubmenuProps = {}) {
  const [open, setOpen] = useState(false);
  const [librariesOpen, setLibrariesOpen] = useState(false);

  const handleLibraryClick = (key: string) => {
    if (key === 'global-library') {
      onGlobalLibraryClick?.();
      return;
    }
    if (key === 'ogp-library') {
      onOgpLibraryClick?.();
    }
  };

  return (
    <div className="border-b border-teal-700">
      <div className="flex w-full items-stretch border border-white/80 bg-[#1e4c9a] text-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3 pr-2 text-left transition-colors hover:bg-[#2557a8]"
        >
          <Timer className="h-5 w-5 shrink-0" />
          <span className="font-bold tracking-wide text-sm">Section Training</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="flex shrink-0 items-center px-3 transition-colors hover:bg-[#2557a8]"
        >
          <ChevronDown
            className={`h-4 w-4 opacity-90 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-teal-900/40 bg-[#2d2d2d] text-sm text-white">
          <div className="border-b border-black/25">
            <div className="flex w-full items-stretch">
              <button
                type="button"
                onClick={() => setLibrariesOpen((v) => !v)}
                aria-expanded={librariesOpen}
                className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90"
              >
                <Library className="h-4 w-4 shrink-0 opacity-90" />
                <span>Libraries of exercises</span>
              </button>
              <button
                type="button"
                onClick={() => setLibrariesOpen((v) => !v)}
                aria-label={librariesOpen ? 'Collapse' : 'Expand'}
                className="flex shrink-0 items-center px-3 transition-colors hover:bg-zinc-700/90"
              >
                <ChevronDown
                  className={`h-4 w-4 opacity-90 transition-transform duration-200 ${
                    librariesOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {librariesOpen && (
              <div className="border-t border-black/25 bg-[#242424]">
                {LIBRARY_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  const clickable =
                    item.key === 'global-library' || item.key === 'ogp-library';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleLibraryClick(item.key)}
                      className={`flex w-full items-center gap-2 py-2.5 pl-8 pr-4 text-left transition-colors hover:bg-zinc-700/90 ${
                        idx > 0 ? 'border-t border-black/25' : ''
                      } ${clickable ? '' : 'opacity-70'}`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {TRAINING_LEAF_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className="flex w-full items-center gap-2 border-t border-black/25 px-4 py-2.5 text-left transition-colors hover:bg-zinc-700/90"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
