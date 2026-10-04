const BLOCKED_TAGS = 'script|style|iframe|object|embed|frame|frameset|meta|link|base|form';
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster']);

function decodeAttributeValue(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
    .replace(/[\u0000-\u0020]/g, '');
}

function isUnsafeUrl(value: string): boolean {
  return /^(javascript|vbscript|data:text\/html)/i.test(decodeAttributeValue(value));
}

function sanitizeTag(tag: string): string {
  return tag.replace(
    /(\s+)([^\s"'>\/=]+)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g,
    (attr, _space: string, rawName: string, _assign?: string, rawValue?: string) => {
      const name = rawName.toLowerCase();
      if (name.startsWith('on')) return '';
      if (name === 'style' && rawValue && /expression\s*\(|url\s*\(\s*['"]?\s*javascript/i.test(decodeAttributeValue(rawValue))) {
        return '';
      }
      if (URL_ATTRIBUTES.has(name) && rawValue) {
        const unquoted = rawValue.replace(/^["']|["']$/g, '');
        if (isUnsafeUrl(unquoted)) return '';
      }
      return attr;
    },
  );
}

/** Removes scripts, embedded frames, inline event handlers and `javascript:` URLs from editor HTML. */
export function sanitizeRichHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(new RegExp(`<\\s*(${BLOCKED_TAGS})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\s*\\/?\\s*(${BLOCKED_TAGS})\\b[^>]*>`, 'gi'), '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[a-z][^>]*>/gi, sanitizeTag)
    .trim();
}
