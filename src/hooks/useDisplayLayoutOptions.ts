'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'movesbook.displayLayoutOptions';

export type DisplayLayoutOptions = {
  showAdBanner: boolean;
  showPersonalBanner: boolean;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
};

const DEFAULTS: DisplayLayoutOptions = {
  showAdBanner: true,
  showPersonalBanner: true,
  showLeftSidebar: true,
  showRightSidebar: true,
};

export function useDisplayLayoutOptions() {
  const [options, setOptions] = useState<DisplayLayoutOptions>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DisplayLayoutOptions>;
        setOptions({ ...DEFAULTS, ...parsed });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

  return useMemo(
    () => ({
      ...options,
      hydrated,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
    }),
    [
      options,
      hydrated,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
    ],
  );
}
