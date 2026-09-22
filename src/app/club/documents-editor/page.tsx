'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useClubWorkspace } from '@/contexts/ClubWorkspaceContext';
import { getAuthHeaders } from '@/lib/club/servicePurchasesClient';
import {
  clubLegalDocumentHref,
  type ClubLegalDocuments,
} from '@/lib/club/clubLegalDocuments';

const CKEditor = dynamic(() => import('@/components/news/CKEditor'), { ssr: false });

type TabId = 'rules' | 'privacy-policy';

function DocumentsEditorContent() {
  const searchParams = useSearchParams();
  const clubIdFromQuery = searchParams.get('clubId') || '';
  const tabFromQuery = searchParams.get('tab');
  const { selectedClubId } = useClubWorkspace();
  const [clubId, setClubId] = useState(clubIdFromQuery || selectedClubId || '');

  const [tab, setTab] = useState<TabId>(
    tabFromQuery === 'privacy-policy' ? 'privacy-policy' : 'rules',
  );
  const [clubName, setClubName] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [docs, setDocs] = useState<ClubLegalDocuments>({
    rulesHtml: '',
    privacyPolicyHtml: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setClubId(
      clubIdFromQuery || selectedClubId || localStorage.getItem('selectedClub') || '',
    );
  }, [clubIdFromQuery, selectedClubId]);

  useEffect(() => {
    if (tabFromQuery === 'rules' || tabFromQuery === 'privacy-policy') {
      setTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      setError('Select a club first.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/legal-documents`, {
          headers: getAuthHeaders(),
        });
        const data = (await res.json()) as {
          error?: string;
          clubName?: string;
          canEdit?: boolean;
          documents?: ClubLegalDocuments;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load documents');
        if (cancelled) return;
        setClubName(data.clubName || '');
        setCanEdit(Boolean(data.canEdit));
        setDocs(data.documents || { rulesHtml: '', privacyPolicyHtml: '' });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const save = async () => {
    if (!clubId || !canEdit) return;
    try {
      setSaving(true);
      setMessage('');
      setError('');
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/legal-documents`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ documents: docs }),
      });
      const data = (await res.json()) as { error?: string; documents?: ClubLegalDocuments };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.documents) setDocs(data.documents);
      setMessage('Documents saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const currentHtml = tab === 'rules' ? docs.rulesHtml : docs.privacyPolicyHtml;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Documents Editor</h1>
        <p className="text-sm text-gray-600">
          Write the club <strong>Rules</strong> and <strong>Privacy policy</strong> shown from My
          Club overview and the Parents / Signatures tabs.
          {clubName ? (
            <>
              {' '}
              Club: <span className="font-medium text-gray-800">{clubName}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('rules')}
          className={`rounded px-3 py-1.5 text-sm font-semibold ${
            tab === 'rules' ? 'bg-red-700 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          Rules
        </button>
        <button
          type="button"
          onClick={() => setTab('privacy-policy')}
          className={`rounded px-3 py-1.5 text-sm font-semibold ${
            tab === 'privacy-policy' ? 'bg-red-700 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          Privacy policy
        </button>
        {clubId ? (
          <Link
            href={clubLegalDocumentHref(clubId, tab)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Open preview
          </Link>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          {!canEdit ? (
            <p className="mb-3 text-sm text-amber-700">
              Only the club admin can edit these documents. You can still open the preview.
            </p>
          ) : null}
          <div className="min-h-[70vh] rounded border border-gray-300 bg-white p-2 sm:p-3 md:p-4">
            <CKEditor
              value={currentHtml}
              readOnly={!canEdit}
              instanceId={`legal-doc-${tab}`}
              localeKey={tab}
              minHeightPx={620}
              onChange={(html) =>
                setDocs((d) =>
                  tab === 'rules'
                    ? { ...d, rulesHtml: html }
                    : { ...d, privacyPolicyHtml: html },
                )
              }
            />
          </div>
          {canEdit ? (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {message ? <span className="text-sm text-green-700">{message}</span> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function DocumentsEditorPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <DocumentsEditorContent />
    </Suspense>
  );
}
