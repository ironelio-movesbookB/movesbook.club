'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown, Languages, Loader2, X } from 'lucide-react';
import { PAGE_TRANSLATE_LANGUAGES } from '@/constants/pageTranslateLanguages';
import {
  ADMIN_PAGE_TRANSLATE_OPEN_EVENT,
  ADMIN_PAGE_TRANSLATE_STATUS_EVENT,
  emitAdminPageTranslateStatus,
  openAdminPageTranslatePanel,
} from '@/lib/adminPageTranslateEvents';
import {
  createPageTranslateController,
  type PageTranslateController,
} from '@/lib/translation/pageTranslate';

/** Language panel + page translation engine. Opened from the admin header button. */
export default function AdminPageTranslate() {
  const pathname = usePathname();
  const controllerRef = useRef<PageTranslateController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState('en');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLanguage =
    PAGE_TRANSLATE_LANGUAGES.find((l) => l.code === selectedCode) ??
    PAGE_TRANSLATE_LANGUAGES.find((l) => l.code === 'en')!;

  const activeLanguageName = useMemo(() => {
    if (!activeCode) return null;
    return PAGE_TRANSLATE_LANGUAGES.find((l) => l.code === activeCode)?.name ?? activeCode;
  }, [activeCode]);

  useEffect(() => {
    const root = document.documentElement;
    const controller = createPageTranslateController(root);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    emitAdminPageTranslateStatus({
      busy,
      activeCode,
      activeName: activeLanguageName,
    });
  }, [busy, activeCode, activeLanguageName]);

  const activeCodeRef = useRef<string | null>(null);
  activeCodeRef.current = activeCode;

  // Route changes replace a lot of DOM; re-apply the active page translation.
  useEffect(() => {
    const controller = controllerRef.current;
    const code = activeCodeRef.current;
    if (!controller || !code) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        await controller.translateTo(code, 'en');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Translation failed');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    setListOpen(true);
    setQuery('');
    setError(null);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setListOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const onOpen = () => openPanel();
    window.addEventListener(ADMIN_PAGE_TRANSLATE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ADMIN_PAGE_TRANSLATE_OPEN_EVENT, onOpen);
  }, [openPanel]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [panelOpen]);

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGE_TRANSLATE_LANGUAGES;
    return PAGE_TRANSLATE_LANGUAGES.filter(
      (lang) => lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q),
    );
  }, [query]);

  const handleShowOriginal = useCallback(() => {
    controllerRef.current?.showOriginal();
    setActiveCode(null);
    setSelectedCode('en');
    setError(null);
    closePanel();
  }, [closePanel]);

  const handleTranslate = useCallback(
    async (code: string) => {
      const controller = controllerRef.current;
      if (!controller) return;
      setSelectedCode(code);
      setError(null);

      if (code === 'en') {
        handleShowOriginal();
        return;
      }

      setBusy(true);
      try {
        await controller.translateTo(code, 'en');
        setActiveCode(code);
        closePanel();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Translation failed');
      } finally {
        setBusy(false);
      }
    },
    [closePanel, handleShowOriginal],
  );

  if (!panelOpen) return null;

  return (
    <div data-no-translate="page-translate-ui" translate="no">
      <button
        type="button"
        aria-label="Close translate panel"
        className="fixed inset-0 z-[97] cursor-default bg-black/20"
        onClick={closePanel}
      />
      <div
        className="fixed right-5 top-20 z-[98] flex w-[280px] max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-lg border border-gray-300 bg-white text-gray-900 shadow-2xl"
        role="dialog"
        aria-label="Language to translate into"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
          <h2 className="text-sm font-semibold">Language to translate into</h2>
          <button
            type="button"
            onClick={closePanel}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-200 p-3">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            <span>{selectedLanguage.name}</span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition ${listOpen ? 'rotate-180' : ''}`} />
          </button>
          {listOpen && (
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search languages"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        {listOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredLanguages.map((lang) => {
              const selected = lang.code === selectedCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTranslate(lang.code)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-60 ${
                    selected ? 'bg-blue-50 text-blue-800' : ''
                  }`}
                >
                  <span>{lang.name}</span>
                  {selected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
            {filteredLanguages.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">No languages match.</p>
            )}
          </div>
        )}

        {(busy || error || activeCode) && (
          <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-600">
            {busy && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Translating page…
              </span>
            )}
            {!busy && error && <span className="text-red-600">{error}</span>}
            {!busy && !error && activeCode && (
              <button
                type="button"
                className="font-medium text-blue-700 hover:underline"
                onClick={handleShowOriginal}
              >
                Show original
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Header trigger that opens the page-translate panel. */
export function AdminPageTranslateButton({ className = '' }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ busy: boolean; activeName: string | null }>).detail;
      setBusy(Boolean(detail?.busy));
      setActiveName(detail?.activeName ?? null);
    };
    window.addEventListener(ADMIN_PAGE_TRANSLATE_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(ADMIN_PAGE_TRANSLATE_STATUS_EVENT, onStatus);
  }, []);

  return (
    <button
      type="button"
      onClick={openAdminPageTranslatePanel}
      className={`inline-flex items-center gap-2 rounded-md border border-white/30 bg-black/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/30 transition ${className}`}
      title="Translate page"
      data-no-translate="page-translate-ui"
      translate="no"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
      <span className="whitespace-nowrap">
        {activeName ? `Translated · ${activeName}` : 'Translate page'}
      </span>
    </button>
  );
}
