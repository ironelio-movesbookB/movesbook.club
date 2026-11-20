'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'movesbook.displayLayoutOptions';
const LAYOUT_EVENT = 'movesbook:display-layout';

export type LayoutModeId = '1' | '2' | '3';

export type LayoutSnapshot = {
  showAdBanner: boolean;
  showPersonalBanner: boolean;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  showSectionsToolbar: boolean;
  showMyPageToolbar: boolean;
  showCentralToolbar: boolean;
};

export type DisplayLayoutOptions = LayoutSnapshot & {
  modes: Partial<Record<LayoutModeId, LayoutSnapshot>>;
};

const DEFAULT_SNAPSHOT: LayoutSnapshot = {
  showAdBanner: true,
  showPersonalBanner: true,
  showLeftSidebar: true,
  showRightSidebar: true,
  showSectionsToolbar: true,
  showMyPageToolbar: true,
  showCentralToolbar: true,
};

const DEFAULTS: DisplayLayoutOptions = {
  ...DEFAULT_SNAPSHOT,
  modes: {},
};

function snapshotOf(options: DisplayLayoutOptions): LayoutSnapshot {
  return {
    showAdBanner: options.showAdBanner,
    showPersonalBanner: options.showPersonalBanner,
    showLeftSidebar: options.showLeftSidebar,
    showRightSidebar: options.showRightSidebar,
    showSectionsToolbar: options.showSectionsToolbar,
    showMyPageToolbar: options.showMyPageToolbar,
    showCentralToolbar: options.showCentralToolbar,
  };
}

function normalizeSnapshot(raw: Partial<LayoutSnapshot> | undefined): LayoutSnapshot {
  return { ...DEFAULT_SNAPSHOT, ...raw };
}

function normalize(raw: Partial<DisplayLayoutOptions> | null | undefined): DisplayLayoutOptions {
  const modesIn = raw?.modes && typeof raw.modes === 'object' ? raw.modes : {};
  const modes: DisplayLayoutOptions['modes'] = {};
  (['1', '2', '3'] as LayoutModeId[]).forEach((id) => {
    if (modesIn[id]) modes[id] = normalizeSnapshot(modesIn[id]);
  });
  return {
    ...DEFAULT_SNAPSHOT,
    ...raw,
    modes,
  };
}

function sameLayout(a: DisplayLayoutOptions, b: DisplayLayoutOptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useDisplayLayoutOptions() {
  const [options, setOptions] = useState<DisplayLayoutOptions>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const skipBroadcast = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOptions(normalize(JSON.parse(raw) as Partial<DisplayLayoutOptions>));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);

    const onLayout = (event: Event) => {
      const detail = (event as CustomEvent<DisplayLayoutOptions>).detail;
      if (!detail) return;
      const next = normalize(detail);
      setOptions((prev) => {
        if (sameLayout(prev, next)) return prev;
        skipBroadcast.current = true;
        return next;
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const next = event.newValue ? normalize(JSON.parse(event.newValue)) : DEFAULTS;
        setOptions((prev) => {
          if (sameLayout(prev, next)) return prev;
          skipBroadcast.current = true;
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(LAYOUT_EVENT, onLayout);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LAYOUT_EVENT, onLayout);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipBroadcast.current) {
      skipBroadcast.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      /* ignore quota errors */
    }
    window.dispatchEvent(new CustomEvent(LAYOUT_EVENT, { detail: options }));
  }, [options, hydrated]);

  const patchOptions = useCallback((patch: Partial<LayoutSnapshot>) => {
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      return sameLayout(prev, next) ? prev : next;
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
  const setShowSectionsToolbar = useCallback(
    (showSectionsToolbar: boolean) => patchOptions({ showSectionsToolbar }),
    [patchOptions],
  );
  const setShowMyPageToolbar = useCallback(
    (showMyPageToolbar: boolean) => patchOptions({ showMyPageToolbar }),
    [patchOptions],
  );
  const setShowCentralToolbar = useCallback(
    (showCentralToolbar: boolean) => patchOptions({ showCentralToolbar }),
    [patchOptions],
  );
  const setBannerSection = useCallback((visible: boolean) => {
    patchOptions({ showAdBanner: visible, showPersonalBanner: visible });
  }, [patchOptions]);

  const hideAllExceptCentral = useCallback(() => {
    patchOptions({
      showAdBanner: false,
      showPersonalBanner: false,
      showLeftSidebar: false,
      showRightSidebar: false,
      showSectionsToolbar: false,
      showMyPageToolbar: false,
      showCentralToolbar: false,
    });
  }, [patchOptions]);

  const restoreAll = useCallback(() => {
    patchOptions(DEFAULT_SNAPSHOT);
  }, [patchOptions]);

  const saveMode = useCallback((id: LayoutModeId) => {
    setOptions((prev) => ({
      ...prev,
      modes: { ...prev.modes, [id]: snapshotOf(prev) },
    }));
  }, []);

  const loadMode = useCallback((id: LayoutModeId) => {
    setOptions((prev) => {
      const saved = prev.modes[id];
      if (!saved) return prev;
      return { ...prev, ...normalizeSnapshot(saved), modes: prev.modes };
    });
  }, []);

  const applyCarousel = useCallback(() => {
    patchOptions({ showAdBanner: true });
  }, [patchOptions]);

  /** From everything visible: hide the first three sections, then the right sidebar, then restore. */
  const cycleCentralToolbar = useCallback(() => {
    setOptions((prev) => {
      const sectionsHidden = !prev.showSectionsToolbar;
      const bannerHidden = !prev.showAdBanner && !prev.showPersonalBanner;
      const myPageHidden = !prev.showMyPageToolbar;
      const rightHidden = !prev.showRightSidebar;
      const firstThreeHidden = sectionsHidden && bannerHidden && myPageHidden && !rightHidden;
      const allFourHidden = sectionsHidden && bannerHidden && myPageHidden && rightHidden;

      if (allFourHidden) {
        return {
          ...prev,
          showSectionsToolbar: true,
          showAdBanner: true,
          showPersonalBanner: true,
          showMyPageToolbar: true,
          showRightSidebar: true,
          showCentralToolbar: true,
        };
      }
      if (firstThreeHidden) {
        return { ...prev, showRightSidebar: false, showCentralToolbar: true };
      }
      return {
        ...prev,
        showSectionsToolbar: false,
        showAdBanner: false,
        showPersonalBanner: false,
        showMyPageToolbar: false,
        showRightSidebar: true,
        showCentralToolbar: true,
      };
    });
  }, []);

  return useMemo(
    () => ({
      ...options,
      hydrated,
      bannerSectionVisible: options.showAdBanner || options.showPersonalBanner,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
      setShowSectionsToolbar,
      setShowMyPageToolbar,
      setShowCentralToolbar,
      setBannerSection,
      hideAllExceptCentral,
      restoreAll,
      saveMode,
      loadMode,
      applyCarousel,
      cycleCentralToolbar,
    }),
    [
      options,
      hydrated,
      setShowAdBanner,
      setShowPersonalBanner,
      setShowLeftSidebar,
      setShowRightSidebar,
      setShowSectionsToolbar,
      setShowMyPageToolbar,
      setShowCentralToolbar,
      setBannerSection,
      hideAllExceptCentral,
      restoreAll,
      saveMode,
      loadMode,
      applyCarousel,
      cycleCentralToolbar,
    ],
  );
}
