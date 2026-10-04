/**
 * Swaps the English texts rendered inside a DOM subtree for their translation, and keeps doing
 * so while React updates the subtree. Only text node values and a few attributes are changed —
 * never the node structure — so React's reconciliation keeps working on the same nodes.
 */

export type TextTranslator = (text: string) => string | null;

type CompiledPattern = { regex: RegExp; translated: string };

/**
 * Exact lookup first, then texts built from templates: `Section News (managed by the member)`
 * matches the pattern `Section News ({0})`, whose translation gets the values back (each value
 * translated too when it is a known text).
 */
export function createTextTranslator(
  lookup: TextTranslator,
  patterns: readonly string[],
): TextTranslator {
  const compiled: CompiledPattern[] = [];
  for (const pattern of [...patterns].sort((a, b) => b.length - a.length)) {
    const translated = lookup(pattern);
    if (!translated) continue;
    const source = pattern
      .split(/\{\d\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('(.+?)');
    compiled.push({ regex: new RegExp(`^${source}$`), translated });
  }
  return (text) => {
    const exact = lookup(text);
    if (exact != null) return exact;
    for (const { regex, translated } of compiled) {
      const m = regex.exec(text);
      if (!m) continue;
      return translated.replace(/\{(\d)\}/g, (_, i: string) => {
        const value = m[Number(i) + 1] ?? '';
        const valueTranslated = lookup(value);
        return valueTranslated == null ? value : matchFirstLetterCase(value, valueTranslated);
      });
    }
    return null;
  };
}

const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);
const SUFFIX = /^([\s\S]*?)(\s*(?:[:*]+|\(\s*\*+\s*\))\s*)$/;

type Shown = { source: string; shown: string };

const textState = new WeakMap<Text, Shown>();
const attrState = new WeakMap<Element, Map<string, Shown>>();

function optedOut(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (node.getAttribute('translate') === 'no' || node.hasAttribute('data-no-translate')) return true;
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

/** Text typed in a <textarea> is user content; its placeholder / title are not. */
function textSkipped(node: Text): boolean {
  return optedOut(node.parentElement) || insideSkipTag(node.parentElement);
}

function attributesSkipped(el: Element): boolean {
  return optedOut(el) || insideSkipTag(el.parentElement);
}

/** Translates `text`, keeping its surrounding spaces and a trailing ":" / "*" marker. */
export function translatePreservingSpacing(text: string, translate: TextTranslator): string {
  const core = text.trim();
  if (!core || !/[A-Za-z]/.test(core)) return text;
  const lead = text.slice(0, text.indexOf(core));
  const trail = text.slice(text.indexOf(core) + core.length);
  let out = translate(core);
  if (out == null) {
    const m = SUFFIX.exec(core);
    const base = m?.[1]?.trim();
    if (m && base) {
      const translated = translate(base);
      if (translated != null) out = translated + m[2];
    }
  }
  return out == null ? text : lead + matchFirstLetterCase(core, out) + trail;
}

/** Keys ignore case, so "managed by…" and "Managed by…" share one translation. */
function matchFirstLetterCase(source: string, translated: string): string {
  if (/^[a-z]/.test(source) && /^\p{Lu}/u.test(translated)) {
    return translated[0].toLowerCase() + translated.slice(1);
  }
  return translated;
}

export function attachAutoTranslate(root: HTMLElement, translate: TextTranslator): () => void {
  const doText = (node: Text) => {
    if (textSkipped(node)) return;
    const current = node.nodeValue ?? '';
    const state = textState.get(node);
    const source = state && state.shown === current ? state.source : current;
    const shown = translatePreservingSpacing(source, translate);
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
    const shown = translatePreservingSpacing(source, translate);
    states.set(name, { source, shown });
    if (shown !== current) el.setAttribute(name, shown);
  };

  const doElement = (el: Element) => {
    if (attributesSkipped(el)) return;
    for (const name of ATTRIBUTES) if (el.hasAttribute(name)) doAttr(el, name);
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
        // The walker never returns rejected nodes, so their attributes are handled here.
        doElement(node as Element);
        return NodeFilter.FILTER_REJECT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) doText(node as Text);
      else doElement(node as Element);
    }
  };

  walk(root);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') doText(record.target as Text);
      else if (record.type === 'attributes' && record.attributeName) {
        if (!attributesSkipped(record.target as Element)) doAttr(record.target as Element, record.attributeName);
      } else record.addedNodes.forEach(walk);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTES],
  });
  return () => observer.disconnect();
}
