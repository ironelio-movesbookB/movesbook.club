'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { rewriteUploadUrlsInHtml } from '@/lib/uploadMediaUrl';

/** Hosts whose players may be embedded in FAQ content (CKEditor YouTube / iframe plugins). */
const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'www.dailymotion.com',
];

function isAllowedIframeSrc(src: string): boolean {
  try {
    const u = new URL(src, 'https://movesbook.local');
    return u.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const el = node as Element;
      if (!isAllowedIframeSrc(el.getAttribute('src') || '')) {
        el.parentNode?.removeChild(el);
      }
    }
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/** CKEditor 5 "Insert media" saves <oembed url>; turn YouTube ones into a player. */
function renderOembeds(html: string): string {
  return html.replace(/<oembed\s+url\s*=\s*"([^"]*)"\s*>\s*<\/oembed>/gi, (_m, raw: string) => {
    const url = raw.replace(/&amp;/g, '&');
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i);
    if (m) {
      return `<iframe src="https://www.youtube.com/embed/${m[1]}" allowfullscreen></iframe>`;
    }
    return '';
  });
}

export function sanitizeFaqHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return '';
  ensureHooks();
  return DOMPurify.sanitize(rewriteUploadUrlsInHtml(renderOembeds(html)), {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  });
}

/** Rich FAQ content written with CKEditor (texts, colors, images, videos, links, frames). */
export default function FaqHtml({ html, className = '' }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeFaqHtml(html), [html]);
  return <div className={`faq-html ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
