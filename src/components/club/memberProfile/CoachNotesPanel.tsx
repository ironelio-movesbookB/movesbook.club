'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ImagePlus,
  X,
} from 'lucide-react';
import { CheckRow, SectionCard } from '@/components/club/memberProfile/FormBits';
import type { ClubMemberScopedData, MemberProfileBundle } from '@/lib/club/memberProfileTypes';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { MAX_SUPPORT_IMAGES } from '@/lib/messages/supportImages';

type ComposerImage = { id: string; url: string; preview: string };

type Props = {
  data: MemberProfileBundle;
  club: ClubMemberScopedData;
  setClub: (
    next: ClubMemberScopedData | ((prev: ClubMemberScopedData) => ClubMemberScopedData),
  ) => void;
  readOnlyClub: boolean;
  saving: boolean;
  message: string;
  setMessage: (msg: string) => void;
  onChange: (next: MemberProfileBundle) => void;
  onReload: () => void;
  onSaveVisibility: () => void;
};

const fieldClass =
  'w-full border border-slate-800 rounded px-2 py-1.5 text-sm bg-white text-black placeholder:text-slate-500';

/** Poster identity for optimistic notes (must be the logged-in user, not the member profile). */
function getSessionAuthor(): { label: string; image: string | null } {
  if (typeof window === 'undefined') return { label: 'You', image: null };
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return { label: 'You', image: null };
    const u = JSON.parse(raw) as {
      username?: string;
      name?: string;
      image?: string | null;
    };
    const label = String(u.username || u.name || 'You').trim() || 'You';
    return { label, image: u.image ?? null };
  } catch {
    return { label: 'You', image: null };
  }
}

export default function CoachNotesPanel({
  data,
  club,
  setClub,
  readOnlyClub,
  saving,
  message,
  setMessage,
  onChange,
  onReload,
  onSaveVisibility,
}: Props) {
  const isAdmin = data.viewer.isClubAdmin;
  const isMember = data.viewer.isSelf;
  const canPost = isAdmin && !readOnlyClub;
  const canMemberReply = isMember && club.visibility.notesCoachComments;

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);

  const [composerObject, setComposerObject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerImages, setComposerImages] = useState<ComposerImage[]>([]);
  const [composerEnableFrom, setComposerEnableFrom] = useState('');
  const [composerEnableTo, setComposerEnableTo] = useState('');
  const [composerShowAtLogin, setComposerShowAtLogin] = useState(false);
  const [composerShowAtLogout, setComposerShowAtLogout] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [posting, setPosting] = useState(false);

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySendingId, setReplySendingId] = useState<string | null>(null);
  const [pictureLightbox, setPictureLightbox] = useState<{ urls: string[]; index: number } | null>(
    null,
  );

  const composerFileInputRef = useRef<HTMLInputElement>(null);

  const notes = data.coachNotes;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.authorLabel.toLowerCase().includes(q),
    );
  }, [notes, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const canReplyToNote = (item: (typeof notes)[number]) =>
    isAdmin ||
    (canMemberReply && item.commentsEnabled && item.visibleToMember);

  const resetCoachNotes = async () => {
    if (!window.confirm('Reset all coach reflections and member replies?')) return;
    setPosting(true);
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/notes?resetKind=coach`,
        ),
        { method: 'DELETE', headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error('Reset failed');
      setMessage('Coach notes reset.');
      setReplyDrafts({});
      onReload();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setPosting(false);
    }
  };

  const handleComposerImagesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_SUPPORT_IMAGES - composerImages.length;
    if (remaining <= 0) return;

    setUploadingImages(true);
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const formData = new FormData();
        formData.append('file', file);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch('/api/messages/support/upload-image', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.path) {
          setMessage('Picture upload failed.');
          break;
        }
        const url = String(json.path);
        setComposerImages((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, url, preview: url },
        ]);
      }
    } finally {
      setUploadingImages(false);
      if (composerFileInputRef.current) composerFileInputRef.current.value = '';
    }
  };

  const postReflection = async () => {
    if (!composerBody.trim()) {
      setMessage('Enter a message.');
      return;
    }
    setPosting(true);
    const title = composerObject.trim();
    const body = composerBody.trim();
    const imageUrls = composerImages.map((img) => img.url);
    const enableFrom = composerEnableFrom;
    const enableTo = composerEnableTo;
    const showAtLogin = composerShowAtLogin;
    const showAtLogout = composerShowAtLogout;
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/notes`,
        ),
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'coach',
            title,
            body,
            visibleToMember: club.visibility.notesCoach,
            commentsEnabled: club.visibility.notesCoachComments,
            imageUrls,
            enableFrom: enableFrom || null,
            enableTo: enableTo || null,
            showAtLogin,
            showAtLogout,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to post');

      const noteId = String(json.note?.id || `local-${Date.now()}`);
      const author = getSessionAuthor();

      onChange({
        ...data,
        coachNotes: [
          {
            id: noteId,
            title,
            body,
            createdAt: new Date().toISOString(),
            authorLabel: author.label,
            authorImage: author.image,
            visibleToMember: club.visibility.notesCoach,
            commentsEnabled: club.visibility.notesCoachComments,
            imageUrls,
            enableFrom,
            enableTo,
            showAtLogin,
            showAtLogout,
            replies: [],
          },
          ...data.coachNotes,
        ],
      });

      setComposerObject('');
      setComposerBody('');
      setComposerImages([]);
      setComposerEnableFrom('');
      setComposerEnableTo('');
      setComposerShowAtLogin(false);
      setComposerShowAtLogout(false);
      setMessage('Reflection posted.');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const postReply = async (noteId: string) => {
    const body = (replyDrafts[noteId] || '').trim();
    if (!body) return;
    setReplySendingId(noteId);
    try {
      const res = await fetch(
        withSelectedClubId(
          `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/notes`,
        ),
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'coach',
            body,
            parentId: noteId,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to reply');

      const replyId = String(json.note?.id || `local-${Date.now()}`);
      const author = getSessionAuthor();

      // Patch local notes — avoid full profile reload / tab remount flash.
      onChange({
        ...data,
        coachNotes: data.coachNotes.map((n) =>
          n.id === noteId
            ? {
                ...n,
                replies: [
                  {
                    id: replyId,
                    body,
                    createdAt: new Date().toISOString(),
                    authorLabel: author.label,
                  },
                  ...n.replies,
                ],
              }
            : n,
        ),
      });
      setReplyDrafts((prev) => ({ ...prev, [noteId]: '' }));
      setMessage('Reply posted.');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to reply');
    } finally {
      setReplySendingId(null);
    }
  };

  return (
    <div>
      {isAdmin ? (
        <SectionCard title="Coach notes visibility" tone="purple">
          <p className="mb-3 text-xs text-slate-600">
            Admin/Coach posts reflections here from{' '}
            <span className="font-medium">
              Club management → Administration → Archives → Archive of Members
            </span>
            : open the member profile, then this tab.
          </p>
          <CheckRow
            label="Coach reflections visible to the member"
            checked={club.visibility.notesCoach}
            disabled={readOnlyClub}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                visibility: { ...c.visibility, notesCoach: v, notesCoachComments: v ? c.visibility.notesCoachComments : false },
              }))
            }
          />
          <CheckRow
            label="Comments available to the member"
            checked={club.visibility.notesCoachComments}
            disabled={readOnlyClub || !club.visibility.notesCoach}
            onChange={(v) =>
              setClub((c) => ({
                ...c,
                visibility: { ...c.visibility, notesCoachComments: v },
              }))
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!readOnlyClub ? (
              <button
                type="button"
                disabled={saving}
                onClick={onSaveVisibility}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save visibility'}
              </button>
            ) : null}
            <Link
              href="/assistance/feedback?tab=support"
              className="text-sm font-medium text-blue-800 underline"
              target="_blank"
            >
              Open Feedbacks reference
            </Link>
            <button
              type="button"
              className="text-sm text-red-700 underline"
              disabled={posting}
              onClick={() => void resetCoachNotes()}
            >
              Reset coach notes and replies
            </button>
          </div>
          {message ? <p className="mt-2 text-sm text-gray-700">{message}</p> : null}
        </SectionCard>
      ) : message ? (
        <p className="mb-3 text-sm text-gray-700">{message}</p>
      ) : null}

      <div
        className={`mt-4 grid grid-cols-1 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white ${
          canPost ? 'lg:grid-cols-2' : ''
        }`}
      >
        <div className="flex flex-col min-h-[360px] max-h-[70vh] lg:max-h-[640px] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <div className="font-semibold text-slate-800 text-base">
              {isAdmin ? 'Coach reflections' : 'Reflections from your coach'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 items-center text-xs">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchQuery(searchInput);
                    setPage(1);
                  }
                }}
                className="border border-slate-800 rounded px-2 py-1 text-xs bg-white flex-1 min-w-[120px]"
                placeholder="Title, message…"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(searchInput);
                  setPage(1);
                }}
                className="px-2 py-1 rounded font-medium bg-[#c43c54] text-white"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {notes.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No coach reflections yet.</p>
            ) : pageItems.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No matches.</p>
            ) : (
              <ul className="space-y-3">
                {pageItems.map((item) => {
                  const showReplyBox = canReplyToNote(item);
                  const draft = replyDrafts[item.id] || '';
                  const sending = replySendingId === item.id;
                  return (
                    <li key={item.id} className="border border-slate-200 rounded bg-white p-2">
                      <div className="flex gap-2">
                        {item.authorImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.authorImage}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0 bg-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-200 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 text-[13px] leading-snug bg-sky-50 border border-sky-100 px-1.5 py-0.5 inline-block max-w-full">
                            {item.title ? `< ${item.title} >` : '< Reflection >'}
                          </div>
                          <p className="text-slate-800 text-sm mt-1 whitespace-pre-wrap">{item.body}</p>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Posted by{' '}
                            <span className="font-medium text-slate-700">{item.authorLabel}</span> —{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                          {item.showAtLogin || item.showAtLogout || item.enableFrom || item.enableTo ? (
                            <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 inline-block">
                              Popup:{' '}
                              {[
                                item.showAtLogin ? 'Login' : null,
                                item.showAtLogout ? 'Logout' : null,
                              ]
                                .filter(Boolean)
                                .join(' / ') || '—'}
                              {item.enableFrom || item.enableTo
                                ? ` · ${item.enableFrom || '…'} → ${item.enableTo || '…'}`
                                : ''}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {item.imageUrls.length > 0 ? (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          {item.imageUrls.slice(0, MAX_SUPPORT_IMAGES).map((src, imgIdx) => (
                            <button
                              key={src}
                              type="button"
                              onClick={() =>
                                setPictureLightbox({ urls: item.imageUrls, index: imgIdx })
                              }
                              className="rounded border border-slate-200 overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" className="h-16 w-16 object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {item.replies.length > 0 ? (
                        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                          {item.replies.map((r) => (
                            <li
                              key={r.id}
                              className="rounded p-2 text-xs bg-slate-50 border border-slate-200 ml-2"
                            >
                              <span className="font-semibold text-slate-600">{r.authorLabel}</span>
                              <p className="mt-1 whitespace-pre-wrap text-slate-800">{r.body}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(r.createdAt).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {showReplyBox ? (
                        <div className="mt-3 border-t border-slate-100 pt-2">
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                if (!sending && draft.trim()) void postReply(item.id);
                              }
                            }}
                            rows={3}
                            placeholder="Reply… (Ctrl+Enter to send)"
                            className={`${fieldClass} text-xs py-1`}
                          />
                          <button
                            type="button"
                            disabled={sending || !draft.trim()}
                            onClick={() => void postReply(item.id)}
                            className="mt-2 text-sm font-medium text-[#c43c54] underline disabled:opacity-50"
                          >
                            {sending ? 'Sending…' : 'Reply'}
                          </button>
                        </div>
                      ) : isMember ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Comments are not available for this reflection.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {filtered.length > pageSize ? (
            <div className="border-t border-slate-200 px-2 py-2 flex items-center justify-between text-xs">
              <span>
                Page {page} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {canPost ? (
          <div className="flex flex-col min-h-[360px] overflow-y-auto bg-slate-50 p-4 text-black">
            <div className="relative flex justify-center mb-2">
              <div className="w-16 h-16 rounded-full bg-sky-100 border-2 border-sky-400 flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-sky-800" strokeWidth={1.75} />
              </div>
            </div>
            <div className="text-center font-bold mb-3">Post coach reflection</div>

            <label className="block text-xs font-medium mb-1">Object</label>
            <input
              type="text"
              value={composerObject}
              onChange={(e) => setComposerObject(e.target.value)}
              placeholder="Object"
              className={`${fieldClass} mb-3`}
            />

            <label className="block text-xs font-medium mb-1">Message</label>
            <textarea
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              rows={6}
              placeholder="Type here your reflection for this athlete…"
              className={`${fieldClass} mb-3`}
            />

            <div className="mb-3 rounded border border-slate-300 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-slate-800">
                Popup display (login / logout)
              </p>
              <p className="mb-2 text-[11px] text-slate-600">
                Document is shown in a popup at login and/or logout within this date range.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">From</span>
                  <input
                    type="date"
                    value={composerEnableFrom}
                    onChange={(e) => setComposerEnableFrom(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium">Until to</span>
                  <input
                    type="date"
                    value={composerEnableTo}
                    onChange={(e) => setComposerEnableTo(e.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-800">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={composerShowAtLogin}
                    onChange={(e) => setComposerShowAtLogin(e.target.checked)}
                  />
                  Show at Login
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={composerShowAtLogout}
                    onChange={(e) => setComposerShowAtLogout(e.target.checked)}
                  />
                  Show at Logout
                </label>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button
                  type="button"
                  disabled={uploadingImages || composerImages.length >= MAX_SUPPORT_IMAGES}
                  onClick={() => composerFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-400 rounded bg-white hover:bg-slate-100 disabled:opacity-50"
                >
                  <ImagePlus className="w-4 h-4" />
                  {uploadingImages ? 'Uploading…' : 'Add pictures'}
                </button>
                <span className="text-[11px] text-slate-600">
                  Up to 3 images (JPG, PNG, GIF, WebP) ({composerImages.length}/{MAX_SUPPORT_IMAGES})
                </span>
                <input
                  ref={composerFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleComposerImagesSelected(e.target.files)}
                />
              </div>
              {composerImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {composerImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative h-20 w-20 rounded border border-slate-300 overflow-hidden bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview || img.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setComposerImages((prev) => prev.filter((x) => x.id !== img.id))
                        }
                        className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={posting || uploadingImages || !composerBody.trim()}
              onClick={() => void postReflection()}
              className="w-full py-2.5 rounded font-semibold text-white bg-[#c43c54] hover:bg-[#a83249] disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        ) : null}
      </div>

      {pictureLightbox ? (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPictureLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pictureLightbox.urls[pictureLightbox.index]}
              alt=""
              className="max-h-[85vh] max-w-full object-contain"
            />
            <button
              type="button"
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white"
              onClick={() => setPictureLightbox(null)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
