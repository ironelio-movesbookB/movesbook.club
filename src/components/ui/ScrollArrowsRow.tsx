'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  children: ReactNode;
  /** Changes when the selected item changes; the element marked `data-scroll-active="true"` is scrolled into view. */
  activeKey?: string;
  className?: string;
};

/**
 * Horizontal row that shows ‹ › arrow buttons only while its content is wider than the space available
 * (e.g. a tab bar on a narrow screen with both sidebars open).
 */
export default function ScrollArrowsRow({ children, activeKey, className = '' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max > 2 && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro?.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector<HTMLElement>('[data-scroll-active="true"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    const box = el.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < box.left || item.right > box.right) {
      el.scrollBy({ left: item.left - box.left - (box.width - item.width) / 2, behavior: 'smooth' });
    }
  }, [activeKey]);

  const scrollByDir = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: (dir === 'left' ? -1 : 1) * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const overflowing = canScrollLeft || canScrollRight;
  const arrowClass = (enabled: boolean) =>
    `flex h-8 w-7 shrink-0 items-center justify-center self-end rounded-md border border-gray-200 bg-white text-gray-600 transition-opacity ${
      enabled ? 'opacity-100 hover:bg-gray-50' : 'pointer-events-none opacity-30'
    }`;

  return (
    <div className={`flex w-full min-w-0 items-stretch gap-1 ${className}`}>
      {overflowing ? (
        <button
          type="button"
          aria-label="Scroll left"
          disabled={!canScrollLeft}
          onClick={() => scrollByDir('left')}
          className={arrowClass(canScrollLeft)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {overflowing ? (
        <button
          type="button"
          aria-label="Scroll right"
          disabled={!canScrollRight}
          onClick={() => scrollByDir('right')}
          className={arrowClass(canScrollRight)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
