'use client';

import { useEffect, useState } from 'react';

export type EventAttachment = { url: string; name: string };

function extOf(value: string): string {
  const clean = value.split(/[?#]/)[0];
  return (clean.split('.').pop() || '').toLowerCase();
}

function absoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).toString();
}

/** Office files can only be previewed by the Microsoft viewer when the file is publicly reachable. */
function officeViewerAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return !(host === 'localhost' || host.startsWith('127.') || host.endsWith('.local'));
}

/** Full-screen preview of an event attachment (images, PDF, MP4, TXT inline; Office files online). */
export default function EventAttachmentViewer({
  file,
  onClose,
}: {
  file: EventAttachment | null;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const ext = file ? extOf(file.url) || extOf(file.name) : '';

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  useEffect(() => {
    setText(null);
    if (!file || ext !== 'txt') return;
    let active = true;
    void fetch(file.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('load'))))
      .then((t) => {
        if (active) setText(t);
      })
      .catch(() => {
        if (active) setText('Could not load the file.');
      });
    return () => {
      active = false;
    };
  }, [file, ext]);

  if (!file) return null;

  const office = ['doc', 'docx', 'rtf', 'xls', 'xlsx'].includes(ext);
  let body: React.ReactNode;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />;
  } else if (ext === 'pdf') {
    body = <iframe src={file.url} title={file.name} className="h-full w-full rounded bg-white" />;
  } else if (ext === 'mp4') {
    body = <video src={file.url} controls autoPlay className="max-h-full max-w-full" />;
  } else if (ext === 'txt') {
    body = (
      <pre className="h-full w-full overflow-auto whitespace-pre-wrap rounded bg-white p-4 text-sm text-gray-900">
        {text ?? 'Loading…'}
      </pre>
    );
  } else if (office && officeViewerAvailable()) {
    body = (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl(file.url))}`}
        title={file.name}
        className="h-full w-full rounded bg-white"
      />
    );
  } else {
    body = (
      <div className="rounded-lg bg-white p-6 text-center text-sm text-gray-800">
        <p className="mb-3">This file cannot be previewed here.</p>
        <a href={file.url} download={file.name} className="font-semibold text-blue-700 underline">
          Download {file.name}
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black/85" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-white">
        <span className="truncate text-sm font-semibold">{file.name}</span>
        <div className="flex shrink-0 items-center gap-3">
          <a href={file.url} download={file.name} className="text-sm underline">
            Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-2xl leading-none hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">{body}</div>
    </div>
  );
}
