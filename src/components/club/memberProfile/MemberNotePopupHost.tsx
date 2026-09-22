'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

type PopupDoc = {
  id: string;
  title: string;
  body: string;
  bodyIsHtml?: boolean;
  clubName: string;
  enableFrom: string;
  enableTo: string;
};

type Moment = 'login' | 'logout';

const LOGIN_FLAG = 'memberNotePopupMoment';
const LOGOUT_EVENT = 'member-note-check-logout';
const LOGOUT_DONE_EVENT = 'member-note-logout-done';
const LOGIN_EVENT = 'member-note-check-login';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function signalLogoutDone() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOGOUT_DONE_EVENT));
  }
}

/**
 * Shows staff / coach documents as popups at login / logout when scheduled.
 */
export default function MemberNotePopupHost() {
  const [docs, setDocs] = useState<PopupDoc[]>([]);
  const [index, setIndex] = useState(0);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [pendingLogout, setPendingLogout] = useState(false);
  const loadingRef = useRef(false);
  const queuedLogoutRef = useRef(false);
  const momentRef = useRef<Moment | null>(null);
  const pendingLogoutRef = useRef(false);

  momentRef.current = moment;
  pendingLogoutRef.current = pendingLogout;

  const closeAll = useCallback(() => {
    const wasLogout = momentRef.current === 'logout' || pendingLogoutRef.current;
    setDocs([]);
    setIndex(0);
    setMoment(null);
    setPendingLogout(false);
    momentRef.current = null;
    pendingLogoutRef.current = false;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(LOGIN_FLAG);
    }
    if (wasLogout) {
      signalLogoutDone();
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
        if (forLogout) signalLogoutDone();
        return;
      }

      const res = await fetch(`/api/user/member-note-popups?moment=${m}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[MemberNotePopupHost] API error', res.status, json);
        if (forLogout) signalLogoutDone();
        return;
      }
      const items = Array.isArray(json.items) ? (json.items as PopupDoc[]) : [];
      if (items.length === 0) {
        if (forLogout) signalLogoutDone();
        return;
      }
      setMoment(m);
      setPendingLogout(forLogout);
      momentRef.current = m;
      pendingLogoutRef.current = forLogout;
      setDocs(items);
      setIndex(0);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tryLoginFlag = () => {
      const flag = sessionStorage.getItem(LOGIN_FLAG);
      const token = localStorage.getItem('token');
      if (flag === 'login' && token) {
        sessionStorage.removeItem(LOGIN_FLAG);
        void load('login', false);
      }
    };

    tryLoginFlag();
    // After navigation from login, token/flag may settle a tick later.
    const t1 = window.setTimeout(tryLoginFlag, 300);
    const t2 = window.setTimeout(tryLoginFlag, 1200);

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
    };
  }, [load]);

  if (!docs.length) return null;
  const current = docs[index];
  if (!current) return null;

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
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            {moment === 'logout' ? 'Message at logout' : 'Notice at login'}
          </p>
          <h2 className="text-base font-semibold text-gray-900">
            {current.title || 'Club message'}
          </h2>
          <p className="text-xs text-gray-600">{current.clubName}</p>
          {current.enableFrom || current.enableTo ? (
            <p className="mt-1 text-[11px] text-gray-500">
              Valid {current.enableFrom || '…'} → {current.enableTo || '…'}
            </p>
          ) : null}
        </div>
        {current.bodyIsHtml ? (
          <div
            className="prose prose-sm max-h-[50vh] max-w-none overflow-y-auto px-4 py-3 text-gray-800"
            dangerouslySetInnerHTML={{ __html: current.body }}
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
            {current.body}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <span className="text-xs text-gray-500">
            {index + 1} / {docs.length}
          </span>
          <button
            type="button"
            onClick={() => {
              if (isLast) closeAll();
              else setIndex((i) => i + 1);
            }}
            className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            {isLast ? (pendingLogout ? 'Continue logout' : 'Close') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const MEMBER_NOTE_LOGIN_FLAG = LOGIN_FLAG;
export const MEMBER_NOTE_LOGOUT_EVENT = LOGOUT_EVENT;
export const MEMBER_NOTE_LOGOUT_DONE_EVENT = LOGOUT_DONE_EVENT;
export const MEMBER_NOTE_LOGIN_EVENT = LOGIN_EVENT;
