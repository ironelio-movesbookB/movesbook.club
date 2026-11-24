'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ClubDocumentViewShell from '@/components/club/documents/ClubDocumentViewShell';

type SharedItem = {
  id: string;
  title: string;
  type: string;
  publicUrl: string;
  filePath?: string;
};

function ClubDocumentsSharedContent() {
  const searchParams = useSearchParams();
  const clubId = searchParams?.get('clubId') || '';
  const [clubName, setClubName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<SharedItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      setError('Missing club.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/documents-folder/public`,
        );
        const data = (await res.json()) as {
          error?: string;
          clubName?: string;
          logoUrl?: string | null;
          items?: SharedItem[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Documents page is not available');
          return;
        }
        setClubName(data.clubName || '');
        setLogoUrl(data.logoUrl || null);
        setItems(data.items || []);
      } catch {
        if (!cancelled) setError('Failed to load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (loading) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  if (error) {
    const notShared = /not shared/i.test(error);
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div
          className={`rounded border px-4 py-6 text-sm ${
            notShared
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          <p className="font-semibold">
            {notShared ? 'Documents page is not shared' : 'Unable to open Documents'}
          </p>
          <p className="mt-2">
            {notShared
              ? 'An admin must turn Shared ON in General settings → Documents. Individual Get link URLs still work for single documents.'
              : error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClubDocumentViewShell clubName={clubName} logoUrl={logoUrl} title="Documents">
      <p className="mb-3 text-sm text-gray-600">
        Only documents marked Visible are listed here.
      </p>
      {items.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
          No visible documents.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-300 bg-white">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.publicUrl}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                <span>{item.title}</span>
                <span className="text-xs uppercase text-gray-500">{item.type}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ClubDocumentViewShell>
  );
}

export default function ClubDocumentsSharedPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <ClubDocumentsSharedContent />
    </Suspense>
  );
}
