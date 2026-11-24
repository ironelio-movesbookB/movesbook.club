'use client';

import { useEffect, useState } from 'react';

/** Member medical files are stored under this folder and served only via `/api/media` with auth. */
const PRIVATE_UPLOAD_PREFIX = '/uploads/member-medical/';

/** Old stored paths may point at `/uploads/member-medical/…`, which is no longer served directly. */
export function toPrivateMediaUrl(url: string): string {
  if (typeof window === 'undefined' || !url) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return url;
    if (parsed.pathname.toLowerCase().startsWith(PRIVATE_UPLOAD_PREFIX)) {
      return `/api/media${parsed.pathname}${parsed.search}`;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** True when the URL needs the Authorization header (same-site `/api/…`). */
export function needsAuthFetch(url: string): boolean {
  return toPrivateMediaUrl(url).startsWith('/api/');
}

export async function fetchWithAuth(url: string): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return fetch(toPrivateMediaUrl(url), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** `<img>` cannot send the Authorization header, so protected images are loaded as blobs. */
export default function AuthImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setObjectUrl('');
    if (!src) return;
    if (!needsAuthFetch(src)) {
      setObjectUrl(src);
      return;
    }
    let cancelled = false;
    let created = '';
    fetchWithAuth(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (failed) {
    return <p className="mt-2 text-sm text-red-600">Could not load the image.</p>;
  }
  if (!objectUrl) {
    return <p className="mt-2 text-sm text-gray-500">Loading image…</p>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={alt} className={className} />;
}
