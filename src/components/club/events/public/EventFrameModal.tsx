'use client';

import { X } from 'lucide-react';
import { formatYmd, primaryButton, secondaryButton } from '@/components/club/events/eventUi';
import { formatEventEuro } from '@/lib/club/events/eventConstants';

export type EventFrameItem = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  cost: number;
  coverUrl: string | null;
  bannerUrl: string;
  subscribeHref: string;
};

type Props = {
  item: EventFrameItem | null;
  orgName?: string;
  onClose: () => void;
};

/** Popup similar to News OGP preview — image opens URL, description, Subscribe now. */
export default function EventFrameModal({ item, orgName, onClose }: Props) {
  if (!item) return null;
  const image = item.coverUrl?.trim() || null;
  const href = item.bannerUrl?.trim() || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-frame-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between bg-gray-800 px-4 py-3 text-white">
          <span className="font-semibold" id="event-frame-title">
            {orgName || 'EVENT FRAME'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-300 hover:bg-gray-700 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {image ? (
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-64 w-full object-cover" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-64 w-full object-cover" />
            )
          ) : null}
          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {formatYmd(item.startDate)}
              {item.endDate && item.endDate !== item.startDate ? ` – ${formatYmd(item.endDate)}` : ''}
              {item.location ? ` · ${item.location}` : ''}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {item.cost > 0 ? formatEventEuro(item.cost) : 'Free'}
            </p>
            {item.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{item.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={item.subscribeHref} className={primaryButton}>
                Subscribe now
              </a>
              <button type="button" className={secondaryButton} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
