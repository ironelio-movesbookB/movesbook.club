'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Paperclip, Pencil, Printer, Upload, X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import type { ClubStaffListItem } from '@/lib/club/clubStaff.constants';
import {
  EMPTY_CLUB_MEETING_INPUT,
  formatYmd,
  type ClubMeeting,
  type ClubMeetingInput,
} from '@/lib/club/clubStaffAdmin.constants';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import { MEETING_FILE_ACCEPT, openMeetingFile, uploadMeetingFile } from '@/components/club/meetings/ClubMeetingsList';

const CKEditorComponent = dynamic(() => import('@/components/news/CKEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[300px] rounded border border-gray-300 bg-white p-4 text-sm text-gray-500">Loading editor…</div>
  ),
});

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 read-only:bg-gray-50';

const SECRETARY_ROLES = new Set(['Secretary', 'Secretary-Treasurer']);

type Props = { mode: 'create' | 'edit' | 'view'; meetingId?: string };

export default function ClubMeetingForm({ mode, meetingId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<ClubMeetingInput>(EMPTY_CLUB_MEETING_INPUT);
  const [meeting, setMeeting] = useState<ClubMeeting | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [secretaries, setSecretaries] = useState<string[]>([]);
  const [loading, setLoading] = useState(mode !== 'create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const readOnly = mode === 'view';

  useEffect(() => {
    if (mode === 'create' || !meetingId) return;
    clubApiFetch<{ meeting: ClubMeeting }>(`/api/club/meetings/${encodeURIComponent(meetingId)}`)
      .then(({ meeting: m }) => {
        setMeeting(m);
        setValue({
          meetingDate: m.meetingDate,
          subject: m.subject,
          secretary: m.secretary,
          documentName: m.documentName,
          documentHtml: m.documentHtml,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the meeting'))
      .finally(() => setLoading(false));
  }, [meetingId, mode]);

  useEffect(() => {
    if (readOnly) return;
    clubApiFetch<{ items: ClubStaffListItem[] }>('/api/club/staff')
      .then(({ items }) => {
        const named = items.filter((s) => !s.isClubAdmin && s.name);
        named.sort((a, b) => Number(SECRETARY_ROLES.has(b.companyRole)) - Number(SECRETARY_ROLES.has(a.companyRole)));
        setSecretaries([...new Set(named.map((s) => s.name))]);
      })
      .catch(() => setSecretaries([]));
  }, [readOnly]);

  const patch = (next: Partial<ClubMeetingInput>) => setValue((prev) => ({ ...prev, ...next }));

  const save = async () => {
    if (!value.meetingDate) {
      setError('The date of the meeting is required.');
      return;
    }
    if (!value.subject.trim()) {
      setError('The subject is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved =
        mode === 'edit' && meetingId
          ? await clubApiFetch<{ meeting: ClubMeeting }>(`/api/club/meetings/${encodeURIComponent(meetingId)}`, {
              method: 'PATCH',
              body: JSON.stringify(value),
            })
          : await clubApiFetch<{ meeting: ClubMeeting }>('/api/club/meetings', {
              method: 'POST',
              body: JSON.stringify(value),
            });
      if (pendingFile) {
        try {
          await uploadMeetingFile(saved.meeting.id, pendingFile);
        } catch (e) {
          // The meeting is saved: continue editing it so the file can be loaded again.
          setError(e instanceof Error ? e.message : 'Failed to upload the file');
          router.replace(`/club/meetings/${saved.meeting.id}`);
          return;
        }
      }
      router.push('/club/meetings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fileHref = meeting?.fileUrl ?? '';
  const openFile = () => {
    if (!meeting) return;
    openMeetingFile(meeting).catch((e) => setError(e instanceof Error ? e.message : 'The file is not available'));
  };
  const title = mode === 'create' ? 'New meeting document' : mode === 'edit' ? 'Edit meeting document' : 'Meeting document';

  const renderDocument = () => (
    <article className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <h2 className="text-2xl font-bold text-gray-900" translate="no">
        {value.documentName || value.subject}
      </h2>
      <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-1 text-sm">
        <dt className="text-gray-500">Date meeting</dt>
        <dd>{formatYmd(value.meetingDate)}</dd>
        <dt className="text-gray-500">Subject</dt>
        <dd translate="no">{value.subject}</dd>
        <dt className="text-gray-500">Secretary</dt>
        <dd translate="no">{value.secretary || '—'}</dd>
        {fileHref ? (
          <>
            <dt className="text-gray-500">File in attachment</dt>
            <dd>
              <button type="button" onClick={openFile} className="text-blue-700 hover:underline" translate="no">
                {meeting?.fileName}
              </button>
            </dd>
          </>
        ) : null}
      </dl>
      <div className="mt-6 border-t border-gray-200 pt-4">
        {value.documentHtml ? (
          <div
            translate="no"
            className="ck-content max-w-none text-sm text-gray-900 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:font-bold [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:mb-3 [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value.documentHtml) }}
          />
        ) : (
          <p className="text-sm text-gray-500">This meeting has no document text.</p>
        )}
      </div>
    </article>
  );

  return (
    <div className="min-h-full bg-gray-50 p-4 print:bg-white print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">
            <Link href="/club/meetings" className="hover:underline">
              Meetings and minutes
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {readOnly ? (
            <>
              <Link
                href="/club/meetings"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              {meetingId ? (
                <Link
                  href={`/club/meetings/${meetingId}`}
                  className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/club/meetings" className="px-3 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || loading}
                className="rounded-md bg-violet-700 px-8 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : readOnly ? (
        <>
          {renderDocument()}
          {mounted
            ? createPortal(
                <div className="meeting-print-root print-area hidden print:block">
                  <style>{
                    '@media print { html, body { overflow: visible !important; background: #fff !important; } body > *:not(.meeting-print-root) { display: none !important; } }'
                  }</style>
                  <AutoTranslate>{renderDocument()}</AutoTranslate>
                </div>,
                document.body,
              )
            : null}
        </>
      ) : (
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Date meeting<span> *</span>
              <input
                type="date"
                value={value.meetingDate}
                onChange={(e) => patch({ meetingDate: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Secretary
              <input
                type="text"
                list="meeting-secretaries"
                value={value.secretary}
                maxLength={255}
                onChange={(e) => patch({ secretary: e.target.value })}
                className={inputClass}
              />
              <datalist id="meeting-secretaries">
                {secretaries.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Subject<span> *</span>
              <input
                type="text"
                value={value.subject}
                maxLength={255}
                onChange={(e) => patch({ subject: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Document name
              <input
                type="text"
                value={value.documentName}
                maxLength={255}
                onChange={(e) => patch({ documentName: e.target.value })}
                placeholder="e.g. Minutes of the ordinary assembly"
                className={inputClass}
              />
            </label>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Meeting document</p>
            <CKEditorComponent
              value={value.documentHtml}
              onChange={(documentHtml) => patch({ documentHtml })}
              minHeightPx={360}
              placeholder=""
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">File in attachment</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {fileHref && !pendingFile ? (
                <button type="button" onClick={openFile} className="inline-flex items-center gap-1 text-blue-700 hover:underline" translate="no">
                  <Paperclip className="h-4 w-4" />
                  {meeting?.fileName}
                </button>
              ) : null}
              {pendingFile ? (
                <span className="inline-flex items-center gap-1 text-gray-800" translate="no">
                  <Paperclip className="h-4 w-4" />
                  {pendingFile.name}
                  <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove file" className="text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100">
                <Upload className="h-3.5 w-3.5" />
                {fileHref || pendingFile ? 'Replace file' : 'Load file'}
                <input
                  type="file"
                  accept={MEETING_FILE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    setPendingFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
              <span className="text-xs text-gray-500">PDF, Word, Excel, text or image, max 15 MB. Saved with the meeting.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
