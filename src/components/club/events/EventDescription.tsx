'use client';

import OgpRichDescription from '@/components/shared/OgpRichDescription';

/** Event description: rich HTML from the editor, or older plain text with line breaks. */
export default function EventDescription({ html, className = '' }: { html: string; className?: string }) {
  if (!html.trim()) return null;
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return <p className={`whitespace-pre-wrap ${className}`}>{html}</p>;
  }
  return <OgpRichDescription html={html} className={className} />;
}
