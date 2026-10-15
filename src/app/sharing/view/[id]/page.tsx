'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import ModernNavbar from '@/components/ModernNavbar';
import { sharingFetch } from '@/hooks/useSharingSummary';
import {
  SHARE_PARTY_KIND_LABELS,
  shareSectionsForKind,
  type ShareParty,
  type ShareRequestView,
} from '@/lib/sharing/sharingTypes';
import { ShareLogo, formatShareDate } from '@/components/sharing/SharingUi';

type SharedPartyDetails = {
  share: ShareRequestView;
  party: ShareParty;
  sections: string[];
  info: { label: string; value: string }[];
  members: { id: string; name: string; logo: string | null }[];
};

/** Read-only view of a shared company / user: no insert or delete actions are offered. */
export default function SharedPartyViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const shareId = String(params?.id ?? '');
  const [details, setDetails] = useState<SharedPartyDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    sharingFetch<{ details: SharedPartyDetails }>(`/api/sharing/requests/${encodeURIComponent(shareId)}`)
      .then((data) => {
        setDetails(data.details);
        setActiveSection(data.details.sections[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the sharing'));
  }, [shareId]);

  const sectionLabels = details
    ? Object.fromEntries(shareSectionsForKind(details.party.kind).map((s) => [s.key, s.label]))
    : {};

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <ModernNavbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {error ? <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {!details && !error ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : null}

        {details ? (
          <div className="rounded-lg border border-gray-300 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 p-4">
              <ShareLogo party={details.party} size={72} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-semibold text-gray-900">{details.party.name}</h1>
                <p className="text-sm text-gray-500">
                  {SHARE_PARTY_KIND_LABELS[details.party.kind]} · shared since{' '}
                  {formatShareDate(details.share.respondedAt ?? details.share.createdAt)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                <Eye className="h-3.5 w-3.5" /> Read-only
              </span>
            </div>

            {details.sections.length === 0 ? (
              <p className="p-6 text-sm text-gray-600">No sections are shared with you.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4 pt-3">
                  {details.sections.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSection(key)}
                      className={`rounded-t px-3 py-1.5 text-sm font-semibold ${
                        activeSection === key ? 'bg-teal-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {sectionLabels[key] ?? key}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {activeSection === 'info' ? (
                    details.info.length === 0 ? (
                      <p className="text-sm text-gray-600">No information available.</p>
                    ) : (
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_1fr]">
                        {details.info.map((row) => (
                          <div key={row.label} className="contents">
                            <dt className="text-sm font-semibold text-gray-600">{row.label}</dt>
                            <dd className="text-sm text-gray-900">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )
                  ) : activeSection === 'dashboard' || activeSection === 'management' ? (
                    <div>
                      <p className="mb-3 text-sm text-gray-700">
                        Members: <strong>{details.members.length}</strong>
                      </p>
                      {details.members.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {details.members.map((m) => (
                            <li key={m.id} className="flex items-center gap-2 rounded border border-gray-200 p-2">
                              <ShareLogo party={{ kind: 'user', id: m.id, name: m.name, logo: m.logo }} size={32} />
                              <span className="truncate text-sm text-gray-800">{m.name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {sectionLabels[activeSection ?? ''] ?? 'This section'} is shared with you in
                      read-only mode.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
