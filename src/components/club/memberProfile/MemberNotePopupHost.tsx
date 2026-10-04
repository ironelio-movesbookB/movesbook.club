'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import ImageLightbox from '@/components/common/ImageLightbox';
import { rewriteUploadUrlsInHtml } from '@/lib/uploadMediaUrl';
import AutoTranslate from '@/components/i18n/AutoTranslate';

type PopupDoc = {
  id: string;
  kind?: 'coach' | 'staff';
  title: string;
  body: string;
  bodyIsHtml?: boolean;
  clubName: string;
  enableFrom: string;
  enableTo: string;
  imageUrls?: string[];
  dismissKey?: string;
};

type Moment = 'login' | 'logout';

const LOGIN_FLAG = 'memberNotePopupMoment';
const LOGOUT_EVENT = 'member-note-check-logout';
const LOGOUT_DONE_EVENT = 'member-note-logout-done';
const LOGIN_EVENT = 'member-note-check-login';
const LOGOUT_SHOWING_EVENT = 'member-note-logout-showing';

function inlineImageSources(html: string): string[] {
  const out: string[] = [];
  const re = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function signalLogoutDone() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOGOUT_DONE_EVENT));
  }
}

function clearLoginFlag() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(LOGIN_FLAG);
  }
}

/**
 * Shows staff / coach documents as popups at login / logout when scheduled.
 */
function MemberNotePopupHostView() {
  const pathname = usePathname();
  const [docs, setDocs] = useState<PopupDoc[]>([]);
  const [index, setIndex] = useState(0);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const [dismissError, setDismissError] = useState('');
  const [pictureIndex, setPictureIndex] = useState<number | null>(null);
  const loadingRef = useRef(false);
  const queuedLogoutRef = useRef(false);
  const momentRef = useRef<Moment | null>(null);
  const pendingLogoutRef = useRef(false);
  const mountedRef = useRef(true);
  const dismissQueueRef = useRef<Promise<void>>(Promise.resolve());
  const popupTokenRef = useRef<string | null>(null);

  momentRef.current = moment;
  pendingLogoutRef.current = pendingLogout;

  const closeAll = useCallback(() => {
    const wasLogout = momentRef.current === 'logout' || pendingLogoutRef.current;
    setDocs([]);
    setIndex(0);
    setPictureIndex(null);
    setDismissedKeys(new Set());
    setDismissError('');
    setMoment(null);
    setPendingLogout(false);
    momentRef.current = null;
    pendingLogoutRef.current = false;
    clearLoginFlag();
    if (wasLogout) {
      void dismissQueueRef.current.finally(signalLogoutDone);
    }
  }, []);

  const load = useCallback(async (m: Moment, forLogout = false) => {
    if (loadingRef.current) {
      // Don't drop logout: run it when the in-flight request finishes.
      if (forLogout) queuedLogoutRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        if (m === 'login') clearLoginFlag();
        if (forLogout) signalLogoutDone();
        return;
      }

      const res = await fetch(`/api/user/member-note-popups?moment=${m}&popup=1`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[MemberNotePopupHost] API error', res.status, json);
        // Keep login flag on failure so a remount / later tick can retry.
        if (forLogout) signalLogoutDone();
        return;
      }
      const items = Array.isArray(json.items) ? (json.items as PopupDoc[]) : [];

      // Only clear the login flag after a successful response, and only if we are
      // still mounted — Strict Mode remounts must be able to retry via the flag.
      if (!mountedRef.current) {
        return;
      }

      if (m === 'login') clearLoginFlag();

      if (items.length === 0) {
        if (forLogout) signalLogoutDone();
        return;
      }
      setMoment(m);
      setPendingLogout(forLogout);
      momentRef.current = m;
      pendingLogoutRef.current = forLogout;
      popupTokenRef.current = token;
      setDocs(items);
      setIndex(0);
      setPictureIndex(null);
      setDismissedKeys(new Set());
      setDismissError('');
      if (forLogout) window.dispatchEvent(new Event(LOGOUT_SHOWING_EVENT));
    } catch (e) {
      console.warn('[MemberNotePopupHost] load failed', e);
      if (forLogout) signalLogoutDone();
    } finally {
      loadingRef.current = false;
      if (queuedLogoutRef.current) {
        queuedLogoutRef.current = false;
        void load('logout', true);
      }
    }
  }, []);

  const tryLoginFlag = useCallback(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem(LOGIN_FLAG);
    const token = localStorage.getItem('token');
    // Do NOT remove the flag here — wait until load() finishes while mounted.
    if (flag === 'login' && token) {
      void load('login', false);
    }
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    tryLoginFlag();
    // After login → router.push, flag/token may settle a tick later.
    const t1 = window.setTimeout(tryLoginFlag, 300);
    const t2 = window.setTimeout(tryLoginFlag, 1200);
    const t3 = window.setTimeout(tryLoginFlag, 2500);

    const onLogoutCheck = () => {
      void load('logout', true);
    };

    window.addEventListener(LOGOUT_EVENT, onLogoutCheck);
    window.addEventListener(LOGIN_EVENT, tryLoginFlag);

    return () => {
      window.removeEventListener(LOGOUT_EVENT, onLogoutCheck);
      window.removeEventListener(LOGIN_EVENT, tryLoginFlag);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [load, tryLoginFlag, pathname]);

  const toggleDismissed = useCallback((dismissKey: string, dismissed: boolean) => {
    const apply = (on: boolean) =>
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        if (on) next.add(dismissKey);
        else next.delete(dismissKey);
        return next;
      });
    apply(dismissed);
    setDismissError('');
    // Serialized so a quick tick → untick reaches the server in click order.
    dismissQueueRef.current = dismissQueueRef.current.then(async () => {
      try {
        const res = await fetch('/api/user/member-note-popups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') || !popupTokenRef.current
              ? getAuthHeaders()
              : { Authorization: `Bearer ${popupTokenRef.current}` }),
          },
          body: JSON.stringify({ dismissKey, dismissed }),
          keepalive: true,
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        if (!mountedRef.current) return;
        apply(!dismissed);
        setDismissError('Could not save, please try again.');
      }
    });
    return dismissQueueRef.current;
  }, []);

  if (!docs.length) return null;
  const current = docs[index];
  if (!current) return null;
  const bodyHtml = current.bodyIsHtml ? rewriteUploadUrlsInHtml(current.body) : '';
  const inlinePictures = bodyHtml ? inlineImageSources(bodyHtml) : [];
  const attachedPictures = current.imageUrls ?? [];
  const pictures = [...inlinePictures, ...attachedPictures];
  const goToMessage = (next: number) => {
    setPictureIndex(null);
    setIndex(next);
  };

  const isLast = index >= docs.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-lg border border-gray-300 bg-white shadow-xl"
      >
        <button
          type="button"
          onClick={closeAll}
          className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="border-b border-gray-200 bg-sky-50 px-4 py-3 pr-10">
          {current.kind === 'coach' ? (
            <p className="mb-1 text-base font-bold text-red-600">Message by the Coach</p>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            {moment === 'logout' ? 'Message at logout' : 'Notice at login'}
          </p>
          <h2 className="text-base font-semibold text-gray-900">
            {current.title || 'Club message'}
          </h2>
          <p className="text-xs text-gray-600">{current.clubName}</p>
          {current.enableFrom || current.enableTo || current.dismissKey ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              {current.enableFrom || current.enableTo ? (
                <p className="text-[11px] text-gray-500">
                  Valid {current.enableFrom || '…'} → {current.enableTo || '…'}
                </p>
              ) : (
                <span />
              )}
              {current.dismissKey ? (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-red-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-red-600"
                    checked={dismissedKeys.has(current.dismissKey)}
                    onChange={(e) => void toggleDismissed(current.dismissKey!, e.target.checked)}
                  />
                  Don&apos;t display at login/logout the next time
                </label>
              ) : null}
            </div>
          ) : null}
          {dismissError ? (
            <p className="mt-0.5 text-right text-[11px] text-red-700">{dismissError}</p>
          ) : null}
        </div>
        {current.bodyIsHtml ? (
          <div
            className="prose prose-sm max-h-[50vh] max-w-none overflow-y-auto px-4 py-3 text-gray-800 [&_img]:inline-block [&_img]:max-h-60 [&_img]:w-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_figure]:my-2"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.tagName !== 'IMG') return;
              const imgs = Array.from(e.currentTarget.querySelectorAll('img'));
              const picIdx = imgs.indexOf(target as HTMLImageElement);
              if (picIdx >= 0 && pictures[picIdx]) setPictureIndex(picIdx);
            }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
            {current.body}
          </div>
        )}
        {attachedPictures.length > 0 ? (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {attachedPictures.map((src, picIdx) => (
                <button
                  key={`${src}-${picIdx}`}
                  type="button"
                  onClick={() => setPictureIndex(inlinePictures.length + picIdx)}
                  className="overflow-hidden rounded border border-gray-300 hover:border-red-600 hover:ring-2 hover:ring-red-200"
                  aria-label={`Enlarge picture ${picIdx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-20 object-cover" />
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Click on a picture to enlarge</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <span className="text-xs text-gray-500">
            {index + 1} / {docs.length}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => goToMessage(Math.max(0, index - 1))}
                className="rounded border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Previous
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (isLast) closeAll();
                else goToMessage(index + 1);
              }}
              className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              {isLast ? (pendingLogout ? 'Continue logout' : 'Close') : 'Next'}
            </button>
          </div>
        </div>
      </div>
      {pictureIndex !== null && pictures[pictureIndex] ? (
        <ImageLightbox
          urls={pictures}
          index={pictureIndex}
          onIndexChange={setPictureIndex}
          onClose={() => setPictureIndex(null)}
          zIndexClassName="z-[10001]"
        />
      ) : null}
    </div>
  );
}

export const MEMBER_NOTE_LOGIN_FLAG = LOGIN_FLAG;
export const MEMBER_NOTE_LOGOUT_EVENT = LOGOUT_EVENT;
export const MEMBER_NOTE_LOGOUT_DONE_EVENT = LOGOUT_DONE_EVENT;
export const MEMBER_NOTE_LOGIN_EVENT = LOGIN_EVENT;
export const MEMBER_NOTE_LOGOUT_SHOWING_EVENT = LOGOUT_SHOWING_EVENT;

export default function MemberNotePopupHost() {
  return (
    <AutoTranslate>
      <MemberNotePopupHostView />
    </AutoTranslate>
  );
}
