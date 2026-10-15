'use client';

import { useEffect, useState } from 'react';
import type { SponsorSectionKey } from '@/lib/club/sponsors/sponsorConstants';
import type { SponsorSlotItem } from '@/lib/club/sponsors/sponsorSlotTypes';

const pendingViews = new Map<string, { s: string; sec: string }>();
let flushTimer: number | null = null;

/** One view per sponsor image and section per browser session, sent in batches. */
function queueView(item: { id: string; section: string }) {
  const key = `spv:${item.id}:${item.section}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode: count anyway */
  }
  pendingViews.set(key, { s: item.id, sec: item.section });
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const items = Array.from(pendingViews.values());
    pendingViews.clear();
    if (items.length === 0) return;
    void fetch('/api/public/sponsors/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      keepalive: true,
    }).catch(() => undefined);
  }, 800);
}

/** Counts a view for each shown sponsor (`section` `''` = club presentation). */
export function useSponsorViews(items: Array<{ id: string; section: string }>) {
  useEffect(() => {
    items.forEach(queueView);
  }, [items]);
}

/** Sponsors of a club/team placed in the given sections (members app, dashboards). */
export function useSectionSponsors(orgId: string | null | undefined, sections: SponsorSectionKey[]) {
  const [items, setItems] = useState<SponsorSlotItem[]>([]);
  const key = sections.join(',');
  useEffect(() => {
    if (!orgId || !key) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/public/sponsors/placements?org=${encodeURIComponent(orgId)}&sections=${encodeURIComponent(key)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((d: { items?: SponsorSlotItem[] }) => !cancelled && setItems(d.items ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [orgId, key]);
  return items;
}

/** Sponsor logos / banners with view counting and tracked clicks. Renders nothing without items. */
export default function SponsorSlot({
  items,
  title,
  className,
  compact,
}: {
  items: SponsorSlotItem[];
  title?: string;
  className?: string;
  /** Smaller logos for cards and sidebars. */
  compact?: boolean;
}) {
  useSponsorViews(items);

  if (items.length === 0) return null;
  const banners = items.filter((i) => i.kind === 'banner');
  const logos = items.filter((i) => i.kind === 'logo');

  const wrap = (item: SponsorSlotItem, child: React.ReactNode) =>
    item.clickUrl ? (
      <a
        key={`${item.id}-${item.section}`}
        href={item.clickUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        title={item.name}
        className="block"
      >
        {child}
      </a>
    ) : (
      <div key={`${item.id}-${item.section}`} title={item.name}>
        {child}
      </div>
    );

  return (
    <div className={className}>
      {title ? (
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</div>
      ) : null}
      <div className="space-y-2">
        {banners.map((b) =>
          wrap(
            b,
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.name} className="w-full rounded-md object-cover" />,
          ),
        )}
        {logos.length ? (
          <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-4'}`}>
            {logos.map((l) =>
              wrap(
                l,
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt={l.name}
                  className={compact ? 'h-8 max-w-[90px] object-contain' : 'h-12 max-w-[140px] object-contain'}
                />,
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
