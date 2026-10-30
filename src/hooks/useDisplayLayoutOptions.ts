'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'movesbook.displayLayoutOptions';
const MODES_KEY = 'movesbook.displayLayoutModes';
export const DISPLAY_LAYOUT_EVENT = 'movesbook:display-layout';

export type DisplayLayoutOptions = {
  showAdBanner: boolean;
  showPersonalBanner: boolean;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  /** The row of section checkboxes. The carousel button stays available when this is off. */
  showOptionsToolbar: boolean;
};

export type LayoutModeId = 'mode1' | 'mode2' | 'mode3';

export type SavedLayoutModes = Record<LayoutModeId, DisplayLayoutOptions | null>;

const DEFAULTS: DisplayLayoutOptions = {
  showAdBanner: true,
  showPersonalBanner: true,
  showLeftSidebar: true,
  showRightSidebar: true,
  showOptionsToolbar: true,
};

const EMPTY_MODES: SavedLayoutModes = {
  mode1: null,
  mode2: null,
  mode3: null,
};

/** Each carousel step hides the next section that is still visible. A full cycle restores everything. */
const CAROUSEL_ORDER: (keyof DisplayLayoutOptions)[] = [
  'showLeftSidebar',
  'showAdBanner',
  'showPersonalBanner',
  'showRightSidebar',
];

function readOptions(): DisplayLayoutOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DisplayLayoutOptions>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function readModes(): SavedLayoutModes {
  try {
    const raw = localStorage.getItem(MODES_KEY);
    if (!raw) return EMPTY_MODES;
    const parsed = JSON.parse(raw) as Partial<SavedLayoutModes>;
    return {
      mode1: parsed.mode1 ? { ...DEFAULTS, ...parsed.mode1 } : null,
      mode2: parsed.mode2 ? { ...DEFAULTS, ...parsed.mode2 } : null,
      mode3: parsed.mode3 ? { ...DEFAULTS, ...parsed.mode3 } : null,
    };
  } catch {
    return EMPTY_MODES;
  }
}

function writeOptions(next: DisplayLayoutOptions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(DISPLAY_LAYOUT_EVENT));
}

function writeModes(next: SavedLayoutModes) {
  localStorage.setItem(MODES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(DISPLAY_LAYOUT_EVENT));
}

export function nextCarouselLayout(current: DisplayLayoutOptions): DisplayLayoutOptions {
  const key = CAROUSEL_ORDER.find((item) => current[item]);
  if (!key) return { ...DEFAULTS };
  return { ...current, [key]: false };
}

export function useDisplayLayoutOptions() {
  const [options, setOptions] = useState<DisplayLayoutOptions>(DEFAULTS);
  const [modes, setModes] = useState<SavedLayoutModes>(EMPTY_MODES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const reload = () => {
      setOptions(readOptions());
      setModes(readModes());
      setHydrated(true);
    };
    reload();
    window.addEventListener(DISPLAY_LAYOUT_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(DISPLAY_LAYOUT_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const patchOptions = useCallback((patch: Partial<DisplayLayoutOptions>) => {
    setOptions((prev) => {
      let changed = false;
      for (const key of Object.keys(patch) as (keyof DisplayLayoutOptions)[]) {
        if (patch[key] !== undefined && patch[key] !== prev[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;

      const next = { ...prev, ...patch };
      try {
        writeOptions(next);
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  const setShowAdBanner = useCallback(
    (showAdBanner: boolean) => patchOptions({ showAdBanner }),
    [patchOptions],
  );
  const setShowPersonalBanner = useCallback(
    (showPersonalBanner: boolean) => patchOptions({ showPersonalBanner }),
    [patchOptions],
  );
  const setShowLeftSidebar = useCallback(
    (showLeftSidebar: boolean) => patchOptions({ showLeftSidebar }),
    [patchOptions],
  );
  const setShowRightSidebar = useCallback(
    (showRightSidebar: boolean) => patchOptions({ showRightSidebar }),
    [patchOptions],
  );

  const applyCarouselStep = useCallback(() => {
    const next = nextCarouselLayout(readOptions());
    try {
      writeOptions(next);
    } catch {
      /* ignore quota errors */
    }
    setOptions(next);
  }, []);

  const saveMode = useCallback((id: LayoutModeId) => {
    const next = { ...readModes(), [id]: readOptions() };
    try {
      writeModes(next);
    } catch {
      /* ignore quota errors */
    }
    setModes(next);
  }, []);

  const loadMode = useCallback((id: LayoutModeId) => {
    const saved = readModes()[id];
    if (!saved) return false;
    try {
      writeOptions(saved);
    } catch {
      return false;
    }
    setOptions(saved);
    return true;
  }, []);

  const hideExceptCentral = useCallback(() => {
    const next: DisplayLayoutOptions = {
      showAdBanner: false,
      showPersonalBanner: false,
      showLeftSidebar: false,
      showRightSidebar: false,
      showOptionsToolbar: false,
    };
    try {
      writeOptions(next);
    } catch {
      /* ignore quota errors */
    }
    setOptions(next);
  }, []);

  const restoreAll = useCallback(() => {
    try {
      writeOptions(DEFAULTS);
    } catch {
      /* ignore quota errors */
    }
    setOptions(DEFAULTS);
  }, []);

  return useMemo(
    () => ({
      ...options,
      modes,
      hydrated,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
      applyCarouselStep,
      saveMode,
      loadMode,
      hideExceptCentral,
      restoreAll,
    }),
    [
      options,
      modes,
      hydrated,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
      applyCarouselStep,
      saveMode,
      loadMode,
      hideExceptCentral,
      restoreAll,
    ],
  );
}
