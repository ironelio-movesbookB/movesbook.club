'use client';

import Link from 'next/link';
import ShareModal from '@/components/ShareModal';
import {
  BarChart3,
  ClipboardList,
  LayoutList,
  Mail,
  PanelLeft,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

type Props = {
  /** Page selector row (prev / numbers / next + page-size). */
  pagination?: ReactNode;
  /** Number of checked rows — enables Delete selected when > 0. */
  selectedCount?: number;
  onDeleteSelected?: () => void;
  /** Optional control shown beside Print, such as an archive-specific paid filter. */
  paginationTrailing?: ReactNode;
  /** Optional title used in mail / share copy. */
  shareTitle?: string;
  /** When set, the Statistics button navigates here. Otherwise it stays disabled. */
  statisticsHref?: string;
  /** When set, the Statistics button calls this (used if no href is given). */
  onStatisticsClick?: () => void;
  /** Replaces the default "mail the page link" Send data action (e.g. receipt PDFs). */
  onSendData?: () => void;
  sendDataTitle?: string;
  /** When set, the two view buttons switch the member-photo layout. */
  photoMode?: 'with' | 'without';
  onPhotoModeChange?: (mode: 'with' | 'without') => void;
};

const inactiveBtn =
  'inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-gray-400 cursor-not-allowed opacity-70';
const activeBtn =
  'inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-gray-800 hover:bg-gray-100';

function currentPageUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

function handlePrint() {
  window.print();
}

function handleSendDataByMail(shareTitle?: string) {
  const url = currentPageUrl();
  const subject = shareTitle ? `Archive data · ${shareTitle}` : 'Archive data';
  const body = `Archive page data (current page only):\n\n${url}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Legacy-style archive chrome:
 * Send msg / Send data / Share · Totals / Statistics / Delete
 * + page selector · Print · with/without photo
 *
 * Only Print, Send data by mail, Share, and Delete selected are active.
 */
export default function ArchiveActionsBar({
  pagination,
  selectedCount = 0,
  onDeleteSelected,
  shareTitle,
  paginationTrailing,
  statisticsHref,
  onStatisticsClick,
  onSendData,
  sendDataTitle,
  photoMode,
  onPhotoModeChange,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const statisticsEnabled = Boolean(statisticsHref || onStatisticsClick);
  const canDelete = selectedCount > 0 && typeof onDeleteSelected === 'function';

  return (
    <div className="mb-3 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" disabled className={inactiveBtn} title="Not available yet">
            <Mail className="h-3.5 w-3.5" />
            Send msg
          </button>
          <button
            type="button"
            className={activeBtn}
            onClick={() => (onSendData ? onSendData() : handleSendDataByMail(shareTitle))}
            title={sendDataTitle ?? 'Send current page link by mail'}
          >
            <Send className="h-3.5 w-3.5" />
            Send data
          </button>
          <button
            type="button"
            className={activeBtn}
            onClick={() => setShareOpen(true)}
            title="Share the current page"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" disabled className={inactiveBtn} title="Not available yet">
            <ClipboardList className="h-3.5 w-3.5" />
            Totals
          </button>
          {statisticsEnabled && statisticsHref ? (
            <Link href={statisticsHref} className={activeBtn} title="Open statistics">
              <BarChart3 className="h-3.5 w-3.5" />
              Statistics
            </Link>
          ) : statisticsEnabled ? (
            <button
              type="button"
              className={activeBtn}
              onClick={onStatisticsClick}
              title="Open statistics"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Statistics
            </button>
          ) : (
            <button type="button" disabled className={inactiveBtn} title="Not available yet">
              <BarChart3 className="h-3.5 w-3.5" />
              Statistics
            </button>
          )}
          <button
            type="button"
            disabled={!canDelete}
            className={
              canDelete
                ? 'inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50'
                : inactiveBtn
            }
            onClick={() => {
              if (!canDelete) return;
              onDeleteSelected?.();
            }}
            title={
              canDelete
                ? `Delete ${selectedCount} selected`
                : 'Select one or more rows to delete'
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{pagination}</div>
        <div className="flex items-center gap-2">
          {paginationTrailing}
          <button
            type="button"
            onClick={handlePrint}
            className="rounded bg-gray-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-gray-800"
          >
            Print
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!onPhotoModeChange}
              aria-pressed={photoMode === 'with'}
              title={onPhotoModeChange ? 'Show the member picture on every row' : 'Photo layout (not available yet)'}
              onClick={() => onPhotoModeChange?.('with')}
              className={`rounded p-1.5 ${
                !onPhotoModeChange
                  ? 'cursor-not-allowed border-2 border-yellow-400 bg-white text-gray-400'
                  : photoMode === 'with'
                    ? 'border-2 border-yellow-400 bg-white text-gray-900'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="With photo"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!onPhotoModeChange}
              aria-pressed={photoMode === 'without'}
              title={onPhotoModeChange ? 'Hide the member picture' : 'Photo layout (not available yet)'}
              onClick={() => onPhotoModeChange?.('without')}
              className={`rounded p-1.5 ${
                !onPhotoModeChange
                  ? 'cursor-not-allowed border border-gray-300 bg-white text-gray-400'
                  : photoMode === 'without'
                    ? 'border-2 border-yellow-400 bg-white text-gray-900'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
              }`}
              aria-label="Without photo"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        gridOnly
      />
    </div>
  );
}
