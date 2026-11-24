'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ClubDocumentViewShell from '@/components/club/documents/ClubDocumentViewShell';

type PublicDoc = {
  error?: string;
  clubName?: string;
  logoUrl?: string | null;
  title?: string;
  type?: string;
  contentHtml?: string;
  filePath?: string;
  fileName?: string;
};

function ClubDocumentViewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const docId = String(params?.docId || '');
  const clubId = searchParams?.get('clubId') || '';
  const [data, setData] = useState<PublicDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId || !docId) {
      setLoading(false);
      setData({ error: !clubId ? 'Missing club.' : 'Missing document.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/clubs/${encodeURIComponent(clubId)}/documents-folder/public?docId=${encodeURIComponent(docId)}`,
        );
        const json = (await res.json()) as PublicDoc;
        if (cancelled) return;
        if (!res.ok) {
          setData({ error: json.error || 'Document not found' });
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setData({ error: 'Failed to load document' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, docId]);

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  }
  if (!data || data.error) {
    return <p className="p-6 text-sm text-red-600">{data?.error || 'Not found'}</p>;
  }

  return (
    <ClubDocumentViewShell
      clubName={data.clubName || ''}
      logoUrl={data.logoUrl || null}
      title={data.title || 'Document'}
    >
      {data.filePath ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={data.filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              Open PDF{data.fileName ? `: ${data.fileName}` : ''}
            </a>
            <a
              href={data.filePath}
              download={data.fileName || true}
              className="inline-flex rounded border border-gray-400 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Download original
            </a>
          </div>
          <p className="text-sm text-gray-600">
            Drawings made in the browser are temporary. To keep them, open the PDF in a new tab,
            draw there, then use the viewer download and choose{' '}
            <span className="font-semibold">With your changes</span>. That file is only on your
            computer unless you upload it again with Add document → Load a PDF.
          </p>
          <iframe
            title={data.title || 'PDF'}
            src={data.filePath}
            className="h-[75vh] w-full rounded border border-gray-300 bg-white"
          />
          {data.type === 'generated' && data.contentHtml?.trim() ? (
            <details className="rounded border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                HTML preview
              </summary>
              <article
                className="prose prose-base mt-3 max-w-none md:prose-lg"
                dangerouslySetInnerHTML={{ __html: data.contentHtml }}
              />
            </details>
          ) : null}
        </div>
      ) : data.contentHtml?.trim() ? (
        <article
          className="prose prose-base max-w-none rounded border border-gray-300 bg-white p-5 sm:p-8 md:prose-lg"
          dangerouslySetInnerHTML={{ __html: data.contentHtml }}
        />
      ) : (
        <p className="rounded border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
          This document is empty.
        </p>
      )}
    </ClubDocumentViewShell>
  );
}

export default function ClubDocumentViewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <ClubDocumentViewContent />
    </Suspense>
  );
}
