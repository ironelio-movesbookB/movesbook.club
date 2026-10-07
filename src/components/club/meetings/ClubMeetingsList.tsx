'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, FilePlus2, Pencil, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { clubApiFetch, getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { toMediaApiPath } from '@/lib/uploadMediaUrl';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  MAX_MEETING_FILE_BYTES,
  MEETING_FILE_EXTENSIONS,
  formatYmd,
  type ClubMeeting,
} from '@/lib/club/clubStaffAdmin.constants';

export const MEETING_FILE_ACCEPT = MEETING_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export async function uploadMeetingFile(meetingId: string, file: File): Promise<ClubMeeting> {
  if (file.size > MAX_MEETING_FILE_BYTES) throw new Error('The file is too large (max 15 MB).');
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(withSelectedClubId(`/api/club/meetings/${encodeURIComponent(meetingId)}/file`), {
    method: 'POST',
    headers: { Authorization: (getAuthHeaders() as Record<string, string>).Authorization ?? '' },
    body,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to upload the file');
  return payload.meeting as ClubMeeting;
}

/** `/api/media` needs the bearer token for non-image files, so a plain link would get 401. */
export async function openMeetingFile(meeting: Pick<ClubMeeting, 'fileUrl' | 'fileName'>) {
  const url = toMediaApiPath(meeting.fileUrl) || meeting.fileUrl;
  const popup = window.open('', '_blank');
  try {
    const res = await fetch(url, {
      headers: { Authorization: (getAuthHeaders() as Record<string, string>).Authorization ?? '' },
    });
    if (!res.ok) throw new Error('The file is not available');
    const objectUrl = URL.createObjectURL(await res.blob());
    if (popup) {
      popup.location.href = objectUrl;
    } else {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = meeting.fileName || 'attachment';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (e) {
    popup?.close();
    throw e;
  }
}

export default function ClubMeetingsList() {
  const [items, setItems] = useState<ClubMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'meeting' | 'file'; meeting: ClubMeeting } | null>(null);
  const { t } = useLanguage();

  const load = useCallback(async () => {
    try {
      const data = await clubApiFetch<{ items: ClubMeeting[] }>('/api/club/meetings');
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => `${m.subject} ${m.secretary} ${m.documentName} ${m.fileName}`.toLowerCase().includes(q));
  }, [items, search]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { kind, meeting } = confirm;
    const url = `/api/club/meetings/${encodeURIComponent(meeting.id)}${kind === 'file' ? '/file' : ''}`;
    await run(meeting.id, () => clubApiFetch(url, { method: 'DELETE' }));
    setConfirm(null);
  };

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Meetings and minutes</h1>
          <p className="text-xs text-gray-500">Administration</p>
        </div>
        <Link
          href="/club/meetings/new"
          className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          <FilePlus2 className="h-4 w-4" />
          New meeting document
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-gray-200 bg-white px-4 py-3">
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Subject, secretary, document"
            className="mt-1 w-64 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
          />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto border border-t-0 border-gray-300 bg-white">
        <table className="min-w-full border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_th]:border [&_th]:border-gray-300">
          <thead>
            <tr className="bg-[#efe7b3] text-left text-gray-900">
              <th className="px-3 py-2 font-semibold">Date meeting</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 font-semibold">Secretary</th>
              <th className="px-3 py-2 font-semibold">Document name</th>
              <th className="px-3 py-2 font-semibold">File in attachment</th>
              <th className="px-3 py-2 font-semibold">Options</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No meetings yet.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const busy = busyId === m.id;
                const fileHref = m.fileUrl;
                return (
                  <tr key={m.id} className="bg-[#e8f4fc] align-top">
                    <td className="whitespace-nowrap px-3 py-2">{formatYmd(m.meetingDate)}</td>
                    <td className="px-3 py-2" translate="no">
                      {m.subject}
                    </td>
                    <td className="px-3 py-2" translate="no">
                      {m.secretary}
                    </td>
                    <td className="px-3 py-2" translate="no">
                      {m.documentName}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {fileHref ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openMeetingFile(m).catch((e) =>
                                  setError(e instanceof Error ? e.message : 'The file is not available'),
                                )
                              }
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                              translate="no"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              {m.fileName}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirm({ kind: 'file', meeting: m })}
                              title="Remove file"
                              aria-label="Remove file"
                              className="rounded p-0.5 text-red-700 hover:bg-white/70 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                        <label
                          className={`inline-flex cursor-pointer items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50 ${
                            busy ? 'pointer-events-none opacity-50' : ''
                          }`}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {fileHref ? 'Replace' : 'Load file'}
                          <input
                            type="file"
                            accept={MEETING_FILE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) void run(m.id, () => uploadMeetingFile(m.id, file));
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/club/meetings/${m.id}`}
                          title="Edit"
                          aria-label="Edit"
                          className="rounded p-1 text-gray-700 hover:bg-white/70"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/club/meetings/${m.id}?view=1`}
                          title="View"
                          aria-label="View"
                          className="rounded p-1 text-gray-700 hover:bg-white/70"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'meeting', meeting: m })}
                          title="Delete"
                          aria-label="Delete"
                          className="rounded p-1 text-red-700 hover:bg-white/70 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PromocodeConfirmModal
        open={confirm !== null}
        title={translateSportLabel(t, confirm?.kind === 'file' ? 'Remove file' : 'Delete meeting')}
        message={translateSportLabel(
          t,
          confirm?.kind === 'file' ? 'Remove the attached file?' : 'Delete this meeting and its attachment?',
        )}
        confirmLabel={translateSportLabel(t, confirm?.kind === 'file' ? 'Remove' : 'Delete')}
        cancelLabel={translateSportLabel(t, 'Cancel')}
        destructive
        loading={busyId !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}
