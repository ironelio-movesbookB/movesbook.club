/**
 * Machine-translates visible text in a DOM subtree ("Translate page").
 * Only text-node values and a few attributes are changed so React can keep reconciling.
 *
 * Hardening for chatty admin UIs (polling + lazy menus):
 * - sessionStorage dictionary so expand/poll does not re-hit the API for known strings
 * - single-flight request queue so parallel follow-ups cannot stampede the free providers
 * - longer debounce + short negative cache for strings the API could not translate
 */

import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import { mapLangForTranslationApi } from '@/utils/richTextTranslation';

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
/** Wait for DOM churn (polls / accordion open) to settle before follow-up API calls. */
const FOLLOW_UP_DEBOUNCE_MS = 1200;
/** Do not re-request a string that just failed / came back empty. */
const NEGATIVE_CACHE_MS = 60_000;
const CACHE_PREFIX = 'movesbook:page-translate:v1:';
const CACHE_MAX_ENTRIES = 4000;

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

function cacheKey(sourceLanguage: string, targetLanguage: string): string {
  return `${CACHE_PREFIX}${sourceLanguage}:${targetLanguage}`;
}

function loadDictionaryCache(sourceLanguage: string, targetLanguage: string): Map<string, string> {
  const map = new Map<string, string>();
  if (typeof sessionStorage === 'undefined') return map;
  try {
    const raw = sessionStorage.getItem(cacheKey(sourceLanguage, targetLanguage));
    if (!raw) return map;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return map;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && k && v) map.set(k, v);
    }
  } catch {
    // ignore corrupt cache
  }
  return map;
}

function persistDictionaryCache(
  sourceLanguage: string,
  targetLanguage: string,
  dictionary: Map<string, string>,
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const entries = [...dictionary.entries()];
    const trimmed =
      entries.length > CACHE_MAX_ENTRIES
        ? entries.slice(entries.length - CACHE_MAX_ENTRIES)
        : entries;
    sessionStorage.setItem(
      cacheKey(sourceLanguage, targetLanguage),
      JSON.stringify(Object.fromEntries(trimmed)),
    );
  } catch {
    // quota / private mode — ignore
  }
}

/** Serialize all page-translate HTTP calls across controllers. */
let translateQueue: Promise<unknown> = Promise.resolve();

function enqueueTranslate<T>(task: () => Promise<T>): Promise<T> {
  const run = translateQueue.then(task, task);
  translateQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Max characters per browser → Google request (one text per line). */
const BROWSER_GTX_CHARS = 3500;
/** Parallel browser → Google requests. */
const BROWSER_GTX_CONCURRENCY = 3;
/** After a CORS/network/429 failure, skip the browser path for a while and use the server. */
const BROWSER_GTX_COOLDOWN_MS = 5 * 60_000;
let browserGtxDisabledUntil = 0;

function chunkByChars(texts: string[], maxChars: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of texts) {
    if (current.length > 0 && size + text.length + 1 > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

class BrowserGtxUnavailable extends Error {}

/**
 * Free Google endpoint called from the viewer's browser, so traffic comes from each
 * user's own IP instead of the server's datacenter IP (which Google throttles).
 * Returns null per text when the response lines do not line up.
 */
async function browserGtxChunk(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
): Promise<(string | null)[]> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t` +
    `&sl=${encodeURIComponent(mapLangForTranslationApi(sourceLanguage))}` +
    `&tl=${encodeURIComponent(mapLangForTranslationApi(targetLanguage))}`;

  let response: Response;
  try {
    // URLSearchParams body = form-urlencoded "simple" request → no CORS preflight.
    response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ q: texts.join('\n') }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new BrowserGtxUnavailable('network/CORS');
  }
  if (response.status === 429 || response.status === 403) {
    throw new BrowserGtxUnavailable(String(response.status));
  }
  if (!response.ok) return texts.map(() => null);

  const data = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) return texts.map(() => null);
  const joined = (data[0] as unknown[][])
    .map((part) => (typeof part?.[0] === 'string' ? part[0] : ''))
    .join('');
  const lines = joined.split('\n').map((l) => l.trim());
  if (lines.length === texts.length) return lines.map((l) => l || null);

  // Google merged/split lines: retry halves so one odd string doesn't lose the whole chunk.
  if (texts.length === 1) return [null];
  const mid = Math.ceil(texts.length / 2);
  const [a, b] = await Promise.all([
    browserGtxChunk(texts.slice(0, mid), targetLanguage, sourceLanguage),
    browserGtxChunk(texts.slice(mid), targetLanguage, sourceLanguage),
  ]);
  return [...a, ...b];
}

/** Translate as much as possible in the browser; whatever fails is left for the server. */
async function translateInBrowser(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined' || Date.now() < browserGtxDisabledUntil) return out;

  // Multi-line strings can't be sent one-per-line; the server handles those.
  const single = texts.filter((t) => !t.includes('\n'));
  const chunks = chunkByChars(single, BROWSER_GTX_CHARS);
  let next = 0;

  const worker = async () => {
    while (next < chunks.length && Date.now() >= browserGtxDisabledUntil) {
      const chunk = chunks[next++];
      try {
        const translated = await browserGtxChunk(chunk, targetLanguage, sourceLanguage);
        translated.forEach((value, i) => {
          if (value) out[chunk[i]] = value;
        });
      } catch (error) {
        if (error instanceof BrowserGtxUnavailable) {
          browserGtxDisabledUntil = Date.now() + BROWSER_GTX_COOLDOWN_MS;
          console.warn('Browser translate unavailable, using server fallback:', error.message);
        }
        return;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BROWSER_GTX_CONCURRENCY, chunks.length) }, worker),
  );
  return out;
}

async function fetchTranslations(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
): Promise<Record<string, string>> {
  if (texts.length === 0) return {};

  return enqueueTranslate(async () => {
    const out = await translateInBrowser(texts, targetLanguage, sourceLanguage);
    const remaining = texts.filter((t) => !out[t]);
    if (remaining.length === 0) return out;

    const token = getPageTranslateBearerToken();
    if (!token) {
      if (Object.keys(out).length > 0) return out;
      throw new Error('Session not found. Please log in again.');
    }

    for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
      const chunk = remaining.slice(i, i + BATCH_SIZE);
      const response = await fetch('/api/admin/page-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ texts: chunk, targetLanguage, sourceLanguage }),
      });
      if (!response.ok) {
        // Keep what the browser already translated rather than failing the whole page.
        if (Object.keys(out).length > 0) return out;
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Translation request failed (${response.status})`);
      }
      const data = (await response.json()) as { translations?: Record<string, string> };
      Object.assign(out, data.translations ?? {});
    }
    return out;
  });
}

export function createPageTranslateController(root: HTMLElement): PageTranslateController {
  const textState = new WeakMap<Text, Shown>();
  const attrState = new WeakMap<Element, Map<string, Shown>>();
  /** source core → translated core for the active target language */
  let dictionary = new Map<string, string>();
  /** source core → earliest time we may ask the API again */
  const negativeUntil = new Map<string, number>();
  let targetLanguage: string | null = null;
  let sourceLanguage = 'en';
  let busy = false;
  let observer: MutationObserver | null = null;
  let pendingFetch: Set<string> | null = null;
  let fetchTimer: ReturnType<typeof setTimeout> | null = null;
  let followUpInFlight = false;
  let generation = 0;

  const lookup = (core: string): string | null => dictionary.get(core) ?? null;

  const isNegativelyCached = (core: string): boolean => {
    const until = negativeUntil.get(core);
    if (until == null) return false;
    if (until <= Date.now()) {
      negativeUntil.delete(core);
      return false;
    }
    return true;
  };

  const markMissingAsNegative = (requested: string[], translations: Record<string, string>) => {
    const now = Date.now();
    for (const text of requested) {
      if (!translations[text]) negativeUntil.set(text, now + NEGATIVE_CACHE_MS);
    }
  };

  const mergeTranslations = (translations: Record<string, string>) => {
    let added = false;
    for (const [k, v] of Object.entries(translations)) {
      if (!k || !v) continue;
      dictionary.set(k, v);
      negativeUntil.delete(k);
      added = true;
    }
    if (added && targetLanguage) {
      persistDictionaryCache(sourceLanguage, targetLanguage, dictionary);
    }
  };

  const translateTextValue = (text: string): string => {
    const core = coreOf(text);
    if (!isTranslatableCore(core)) return text;
    const translated = lookup(core);
    if (translated == null) {
      if (pendingFetch && targetLanguage && !isNegativelyCached(core)) {
        pendingFetch.add(core);
      }
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
      if (followUpInFlight) {
        // Another follow-up is running; retry after debounce so we keep coalescing.
        schedulePendingFetch();
        return;
      }
      const missing = [...(pendingFetch ?? [])].filter(
        (t) => !dictionary.has(t) && !isNegativelyCached(t),
      );
      pendingFetch = new Set();
      if (missing.length === 0 || !targetLanguage) return;

      const gen = generation;
      const lang = targetLanguage;
      const src = sourceLanguage;
      followUpInFlight = true;
      try {
        const translations = await fetchTranslations(missing, lang, src);
        if (gen !== generation) return;
        markMissingAsNegative(missing, translations);
        mergeTranslations(translations);
        walk(root);
      } catch (error) {
        console.error('Page translate follow-up failed:', error);
        const until = Date.now() + NEGATIVE_CACHE_MS;
        for (const text of missing) negativeUntil.set(text, until);
      } finally {
        followUpInFlight = false;
        // Mutations during the request may have queued more strings.
        if (gen === generation && pendingFetch && pendingFetch.size > 0) {
          schedulePendingFetch();
        }
      }
    }, FOLLOW_UP_DEBOUNCE_MS);
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
        negativeUntil.clear();
        targetLanguage = nextTarget;
        sourceLanguage = nextSource;
        dictionary = loadDictionaryCache(nextSource, nextTarget);

        if (nextTarget === nextSource) {
          targetLanguage = null;
          dictionary = new Map();
          return;
        }

        // Apply cached strings immediately so polls/menus feel translated while we fetch the rest.
        walk(root);

        const cores = collectCores().filter((c) => !dictionary.has(c));
        if (cores.length === 0) {
          startObserver();
          return;
        }

        const translations = await fetchTranslations(cores, nextTarget, nextSource);
        if (gen !== generation) return;
        markMissingAsNegative(cores, translations);
        mergeTranslations(translations);
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
      negativeUntil.clear();
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
      negativeUntil.clear();
      targetLanguage = null;
      busy = false;
    },
  };
}
