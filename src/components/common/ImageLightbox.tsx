'use client';

import { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type ImageLightboxProps = {
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Must sit above whatever opened it (the login/logout popup uses z-[10000]). */
  zIndexClassName?: string;
};

/** Enlarged picture with < / > (and ← / → keys) to move between pictures. */
export default function ImageLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
  zIndexClassName = 'z-50',
}: ImageLightboxProps) {
  const count = urls.length;
  const hasMany = count > 1;
  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose]);

  const src = urls[index];
  if (!src) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-black/85 p-4`}
      role="dialog"
      aria-modal="true"
      aria-label="Picture"
      onClick={onClose}
    >
      <div className="relative flex max-h-full max-w-4xl items-center" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-[85vh] max-w-full rounded object-contain" />
        <button
          type="button"
          className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          onClick={onClose}
          aria-label="Close picture"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {hasMany ? (
        <>
          <button
            type="button"
            className="fixed left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30 sm:left-6"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous picture"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            className="fixed right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30 sm:right-6"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next picture"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <span className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">
            {index + 1} / {count}
          </span>
        </>
      ) : null}
    </div>
  );
}
