'use client';

import { ArrowLeft, ExternalLink } from 'lucide-react';

type MubFrameViewProps = {
  url: string;
  title: string;
  onBack: () => void;
};

/**
 * "In the central frame of the same tab" (`pageToOpen: same_label`): the button's
 * external URL is shown inside the page's central area, so the Movesbook header and
 * both sidebars stay in place — the PHP father app's central frame.
 *
 * Some sites refuse to be embedded (X-Frame-Options / CSP frame-ancestors) and the
 * browser then shows an empty or "refused to connect" frame. That cannot be detected
 * from here (cross-origin), so the toolbar always offers "Open in new tab".
 */
export default function MubFrameView({ url, title, onBack }: MubFrameViewProps) {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded border border-gray-400 bg-white shadow">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-400 bg-[#d9d9d9] px-3 py-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 font-semibold text-red-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Most used buttons
        </button>
        <span className="min-w-0 flex-1 truncate text-gray-700" title={url}>
          {title ? <strong className="mr-2 text-gray-900">{title}</strong> : null}
          {url}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>
      <iframe
        key={url}
        src={url}
        title={title || url}
        className="h-[calc(100vh-11rem)] min-h-[32rem] w-full border-0 bg-white"
        referrerPolicy="no-referrer"
        // Let the embedded site run normally, but never navigate Movesbook's own tab.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
      />
    </div>
  );
}
