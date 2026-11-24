'use client';

import { useEffect, useState } from 'react';
import { qrImageUrl } from '@/lib/club/sponsors/sponsorClient';

type Props = {
  title: string;
  description: string;
  /** Site-relative path of the public page. */
  path: string;
  qrFileName: string;
};

/** Top banner with a public page link: open, copy, download QR and QR preview. */
export default function PublicLinkBanner({ title, description, path, qrFileName }: Props) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the link', url);
    }
  };

  const downloadQr = async () => {
    const src = qrImageUrl(url, 600);
    try {
      const blob = await (await fetch(src)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${qrFileName}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(src, '_blank', 'noopener');
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white shadow md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-blue-100">{description}</p>
        <p className="mt-2 truncate font-mono text-xs text-blue-200">{url}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            Open page
          </a>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-white/60 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={downloadQr}
            disabled={!url}
            className="rounded-md border border-white/60 px-3 py-1.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Download QR
          </button>
        </div>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrImageUrl(url)} alt="QR code" className="h-28 w-28 shrink-0 rounded-lg bg-white p-1.5" />
      ) : null}
    </div>
  );
}
