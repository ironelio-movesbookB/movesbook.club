/**
 * Machine-translates visible text in a DOM subtree ("Translate page").
 * Only text-node values and a few attributes are changed so React can keep reconciling.
 */

import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';

/** Prefer admin panel token; fall back to regular user JWT (athlete/club/team/…). */
function getPageTranslateBearerToken(): string | null {
  const admin = getAdminBearerToken();
  if (admin) return admin;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token')?.trim() || null;
}

const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'SVG']);
const BATCH_SIZE = 80;

type Shown = { source: string; shown: string };

export type PageTranslateController = {
  translateTo: (targetLanguage: string, sourceLanguage?: string) => Promise<void>;
  showOriginal: () => void;
  getTargetLanguage: () => string | null;
  isBusy: () => boolean;
  dispose: () => void;
};

function optedOut(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (node.getAttribute('translate') === 'no' || node.hasAttribute('data-no-translate')) {
      return true;
    }
    if ((node as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function insideSkipTag(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName)) return true;
  }
  return false;
}

function textSkipped(node: Text): boolean {
  return optedOut(node.parentElement) || insideSkipTag(node.parentElement);
}

function attributesSkipped(el: Element): boolean {
  return optedOut(el) || insideSkipTag(el.parentElement);
}

function coreOf(text: string): string {
  return text.trim();
}

function isTranslatableCore(core: string): boolean {
  if (!core) return false;
  if (!/\p{L}/u.test(core)) return false;
  if (core.length > 2000) return false;
  return true;
}

function applyPreservingSpacing(text: string, translatedCore: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.indexOf(core));
  const trail = text.slice(text.indexOf(core) + core.length);
  return lead + translatedCore + trail;
}

async function fetchTranslations(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
): Promise<Record<string, string>> {
  const token = getPageTranslateBearerToken();
  if (!token) throw new Error('Session not found. Please log in again.');

  const out: Record<string, string> = {};
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const response = await fetch('/api/admin/page-translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ texts: chunk, targetLanguage, sourceLanguage }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Translation request failed (${response.status})`);
    }
    const data = (await response.json()) as { translations?: Record<string, string> };
    Object.assign(out, data.translations ?? {});
  }
  return out;
}

export function createPageTranslateController(root: HTMLElement): PageTranslateController {
  const textState = new WeakMap<Text, Shown>();
  const attrState = new WeakMap<Element, Map<string, Shown>>();
  /** source core → translated core for the active target language */
  let dictionary = new Map<string, string>();
  let targetLanguage: string | null = null;
  let sourceLanguage = 'en';
  let busy = false;
  let observer: MutationObserver | null = null;
  let pendingFetch: Set<string> | null = null;
  let fetchTimer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const lookup = (core: string): string | null => dictionary.get(core) ?? null;

  const translateTextValue = (text: string): string => {
    const core = coreOf(text);
    if (!isTranslatableCore(core)) return text;
    const translated = lookup(core);
    if (translated == null) {
      if (pendingFetch && targetLanguage) pendingFetch.add(core);
      return text;
    }
    return applyPreservingSpacing(text, translated);
  };

  const doText = (node: Text) => {
    if (textSkipped(node)) return;
    const current = node.nodeValue ?? '';
    const state = textState.get(node);
    const source = state && state.shown === current ? state.source : current;
    const shown = translateTextValue(source);
    textState.set(node, { source, shown });
    if (shown !== current) node.nodeValue = shown;
  };

  const doAttr = (el: Element, name: string) => {
    const current = el.getAttribute(name);
    if (current == null) return;
    let states = attrState.get(el);
    if (!states) {
      states = new Map();
      attrState.set(el, states);
    }
    const state = states.get(name);
    const source = state && state.shown === current ? state.source : current;
    const shown = translateTextValue(source);
    states.set(name, { source, shown });
    if (shown !== current) el.setAttribute(name, shown);
  };

  const doElement = (el: Element) => {
    if (attributesSkipped(el)) return;
    for (const name of ATTRIBUTES) {
      if (el.hasAttribute(name)) doAttr(el, name);
    }
  };

  const walk = (start: Node) => {
    if (start.nodeType === Node.TEXT_NODE) {
      doText(start as Text);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE) return;
    const startEl = start as Element;
    if (optedOut(startEl)) return;
    doElement(startEl);
    if (SKIP_TAGS.has(startEl.tagName)) return;
    const walker = document.createTreeWalker(startEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE || !SKIP_TAGS.has((node as Element).tagName)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        doElement(node as Element);
        return NodeFilter.FILTER_REJECT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) doText(node as Text);
      else doElement(node as Element);
    }
  };

  const collectCores = (): string[] => {
    const cores = new Set<string>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (optedOut(el) || SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        const text = node as Text;
        if (textSkipped(text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        const state = textState.get(text);
        const current = text.nodeValue ?? '';
        const source = state && state.shown === current ? state.source : current;
        const core = coreOf(source);
        if (isTranslatableCore(core)) cores.add(core);
      } else {
        const el = node as Element;
        if (attributesSkipped(el)) continue;
        for (const name of ATTRIBUTES) {
          if (!el.hasAttribute(name)) continue;
          const states = attrState.get(el);
          const current = el.getAttribute(name) ?? '';
          const state = states?.get(name);
          const source = state && state.shown === current ? state.source : current;
          const core = coreOf(source);
          if (isTranslatableCore(core)) cores.add(core);
        }
      }
    }
    return [...cores];
  };

  const restoreOriginal = () => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        const state = textState.get(text);
        if (state && text.nodeValue !== state.source) text.nodeValue = state.source;
        textState.delete(text);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const states = attrState.get(el);
        if (!states) continue;
        for (const [name, state] of states) {
          if (el.getAttribute(name) !== state.source) el.setAttribute(name, state.source);
        }
        attrState.delete(el);
      }
    }
  };

  const stopObserver = () => {
    observer?.disconnect();
    observer = null;
    if (fetchTimer) {
      clearTimeout(fetchTimer);
      fetchTimer = null;
    }
    pendingFetch = null;
  };

  const schedulePendingFetch = () => {
    if (!targetLanguage || !pendingFetch || pendingFetch.size === 0) return;
    if (fetchTimer) clearTimeout(fetchTimer);
    fetchTimer = setTimeout(async () => {
      const missing = [...(pendingFetch ?? [])].filter((t) => !dictionary.has(t));
      pendingFetch = new Set();
      if (missing.length === 0 || !targetLanguage) return;
      const gen = generation;
      try {
        const translations = await fetchTranslations(missing, targetLanguage, sourceLanguage);
        if (gen !== generation) return;
        Object.entries(translations).forEach(([k, v]) => dictionary.set(k, v));
        walk(root);
      } catch (error) {
        console.error('Page translate follow-up failed:', error);
      }
    }, 400);
  };

  const startObserver = () => {
    stopObserver();
    pendingFetch = new Set();
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') doText(record.target as Text);
        else if (record.type === 'attributes' && record.attributeName) {
          if (!attributesSkipped(record.target as Element)) {
            doAttr(record.target as Element, record.attributeName);
          }
        } else {
          record.addedNodes.forEach(walk);
        }
      }
      schedulePendingFetch();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
  };

  return {
    async translateTo(nextTarget, nextSource = 'en') {
      if (busy) return;
      busy = true;
      generation += 1;
      const gen = generation;
      try {
        stopObserver();
        restoreOriginal();
        dictionary = new Map();
        targetLanguage = nextTarget;
        sourceLanguage = nextSource;

        if (nextTarget === nextSource) {
          targetLanguage = null;
          return;
        }

        const cores = collectCores();
        if (cores.length === 0) {
          startObserver();
          return;
        }

        const translations = await fetchTranslations(cores, nextTarget, nextSource);
        if (gen !== generation) return;
        Object.entries(translations).forEach(([k, v]) => dictionary.set(k, v));
        walk(root);
        startObserver();
      } finally {
        if (gen === generation) busy = false;
      }
    },

    showOriginal() {
      generation += 1;
      stopObserver();
      restoreOriginal();
      dictionary = new Map();
      targetLanguage = null;
      busy = false;
    },

    getTargetLanguage() {
      return targetLanguage;
    },

    isBusy() {
      return busy;
    },

    dispose() {
      generation += 1;
      stopObserver();
      restoreOriginal();
      dictionary = new Map();
      targetLanguage = null;
      busy = false;
    },
  };
}
