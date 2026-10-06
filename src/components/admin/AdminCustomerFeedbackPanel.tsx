'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  RefreshCw,
  X,
} from 'lucide-react';
import type { SupportCategory, ThreadListSort } from '@/lib/messages/userThreads';
import { MAX_SUPPORT_IMAGES } from '@/lib/messages/supportImages';
import ThreadPathOpenLink from '@/components/messages/ThreadPathOpenLink';
import AdminPcuDatePicker from '@/components/admin/AdminPcuDatePicker';
import {
  SUPPORT_WORKFLOW_STATUS_CODES,
  SUPPORT_WORKFLOW_STATUS_LABELS,
  isSupportWorkflowCategory,
  normalizeSupportWorkflowStatus,
  supportWorkflowStatusLabel,
  type SupportWorkflowStatus,
} from '@/lib/messages/supportStatus';

type LangOption = { id: string; code: string; name: string };

type FeedItem = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  messageCount?: number;
  author?: string;
  imageUrls?: string[];
  status?: string | null;
  isInappropriate?: boolean;
  awaitingStaffReply?: boolean;
  supportCategory?: string | null;
  threadKind?: string;
};

const THREAD_SORT_OPTIONS: { value: ThreadListSort | ''; label: string }[] = [
  { value: '', label: 'Default (recent update)' },
  { value: 'date_asc', label: 'Date ascending' },
  { value: 'date_desc', label: 'Date descending' },
  { value: 'like', label: 'I like' },
  { value: 'dislike', label: 'I dislike' },
];

function replyCountFromMessageCount(messageCount?: number): number {
  return Math.max(0, (messageCount ?? 1) - 1);
}

type ThreadDetail = {
  thread: {
    id: string;
    subject: string;
    kind: string;
    createdAt: string;
    updatedAt: string;
    languageCode?: string | null;
    pathStaff?: string | null;
    realPath?: string | null;
    supportCategory?: string | null;
    errorMessage?: string | null;
    authorName?: string | null;
    imageUrls?: string[];
    status?: string | null;
  };
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    isStaff: boolean;
    sender: { id: string; name: string; username: string } | null;
  }>;
};

export type AdminFeedbackKind = 'review' | 'support';

type Props = {
  kind: AdminFeedbackKind;
  category?: SupportCategory;
  bugsOnly?: boolean;
  excludeBugs?: boolean;
  title: string;
  description: string;
  emptyMessage?: string;
  /** Force list to inappropriate-only (Comments inappropriate section) */
  inappropriateOnly?: boolean;
  /** Load all inappropriate review + support threads (Super Admin comments page) */
  aggregateInappropriate?: boolean;
};

export default function AdminCustomerFeedbackPanel({
  kind,
  category,
  bugsOnly = false,
  excludeBugs = false,
  title,
  description,
  emptyMessage = 'No user submissions yet.',
  inappropriateOnly = false,
  aggregateInappropriate = false,
}: Props) {
  const [langOptions, setLangOptions] = useState<LangOption[]>([]);
  const [filterLang, setFilterLang] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeeInappropriates, setFilterSeeInappropriates] = useState(inappropriateOnly);
  const [appliedSeeInappropriates, setAppliedSeeInappropriates] = useState(inappropriateOnly);
  const [listSort, setListSort] = useState<ThreadListSort | ''>('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeLang, setComposeLang] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composePath, setComposePath] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeErrorMsg, setComposeErrorMsg] = useState('');
  const [composeImages, setComposeImages] = useState<
    Array<{ id: string; url: string; preview: string }>
  >([]);
  const [composeUploadingImages, setComposeUploadingImages] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState('');
  const composeFileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [replyBody, setReplyBody] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState('');

  const [pictureLightbox, setPictureLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = localStorage.getItem('adminToken');
    if (!token) throw new Error('Admin session not found.');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(path, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || String(res.status));
    }
    return res.json();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/public/news/languages');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setLangOptions(data);
        }
      } catch {
        /* optional */
      }
    })();
  }, []);

  useEffect(() => {
    if (!pictureLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPictureLightbox(null);
      if (e.key === 'ArrowLeft') {
        setPictureLightbox((cur) => {
          if (!cur || cur.urls.length < 2) return cur;
          return { ...cur, index: (cur.index - 1 + cur.urls.length) % cur.urls.length };
        });
      }
      if (e.key === 'ArrowRight') {
        setPictureLightbox((cur) => {
          if (!cur || cur.urls.length < 2) return cur;
          return { ...cur, index: (cur.index + 1) % cur.urls.length };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pictureLightbox]);

  const openPictureLightbox = useCallback((urls: string[], index: number, e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const clean = urls.filter(Boolean).slice(0, MAX_SUPPORT_IMAGES);
    if (!clean.length) return;
    setPictureLightbox({
      urls: clean,
      index: Math.max(0, Math.min(index, clean.length - 1)),
    });
  }, []);

  const resetCompose = useCallback(() => {
    setComposeLang('');
    setComposeSubject('');
    setComposePath('');
    setComposeBody('');
    setComposeErrorMsg('');
    setComposeImages((prev) => {
      prev.forEach((img) => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      });
      return [];
    });
    setComposeError('');
  }, []);

  const removeComposeImage = useCallback((id: string) => {
    setComposeImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleComposeImagesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const remaining = MAX_SUPPORT_IMAGES - composeImages.length;
      if (remaining <= 0) {
        setComposeError(`Maximum ${MAX_SUPPORT_IMAGES} pictures.`);
        return;
      }
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setComposeError('Admin session not found.');
        return;
      }
      setComposeUploadingImages(true);
      setComposeError('');
      try {
        const picked = Array.from(files).slice(0, remaining);
        for (const file of picked) {
          if (!file.type.startsWith('image/')) continue;
          const form = new FormData();
          form.append('file', file);
          const res = await fetch('/api/messages/support/upload-image', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.path) {
            setComposeError('Picture upload failed.');
            continue;
          }
          const preview = URL.createObjectURL(file);
          setComposeImages((prev) => {
            if (prev.length >= MAX_SUPPORT_IMAGES) {
              URL.revokeObjectURL(preview);
              return prev;
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url: String(data.path),
                preview,
              },
            ];
          });
        }
      } catch {
        setComposeError('Picture upload failed.');
      } finally {
        setComposeUploadingImages(false);
        if (composeFileInputRef.current) composeFileInputRef.current.value = '';
      }
    },
    [composeImages.length],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (aggregateInappropriate) {
        const qs = new URLSearchParams({ pageSize: '50' });
        if (filterLang) qs.set('lang', filterLang);
        if (recentOnly) qs.set('recent', '1');
        if (appliedFromDate) qs.set('from', appliedFromDate);
        if (appliedToDate) qs.set('to', appliedToDate);
        if (listSort) qs.set('sort', listSort);
        const data = await authFetch(`/api/messages/inappropriate?${qs}`);
        setItems(data.items || []);
      } else if (kind === 'review') {
        const qs = new URLSearchParams({
          admin: '1',
          community: '1',
          pageSize: '50',
        });
        if (filterLang) qs.set('lang', filterLang);
        if (recentOnly) qs.set('recent', '1');
        if (appliedFromDate) qs.set('from', appliedFromDate);
        if (appliedToDate) qs.set('to', appliedToDate);
        if (appliedSeeInappropriates) qs.set('inappropriate', '1');
        if (listSort) qs.set('sort', listSort);
        const data = await authFetch(`/api/messages/reviews?${qs}`);
        setItems(data.items || []);
      } else {
        const qs = new URLSearchParams({ feed: '1', pageSize: '50' });
        if (category) qs.set('category', category);
        if (bugsOnly) qs.set('bugs', '1');
        if (excludeBugs) qs.set('excludeBugs', '1');
        if (filterLang) qs.set('lang', filterLang);
        if (recentOnly) qs.set('recent', '1');
        if (appliedFromDate) qs.set('from', appliedFromDate);
        if (appliedToDate) qs.set('to', appliedToDate);
        if (filterStatus) qs.set('status', filterStatus);
        if (appliedSeeInappropriates) qs.set('inappropriate', '1');
        if (listSort) qs.set('sort', listSort);
        const data = await authFetch(`/api/messages/support?${qs}`);
        setItems(data.items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFromDate,
    appliedToDate,
    authFetch,
    bugsOnly,
    category,
    excludeBugs,
    filterLang,
    filterStatus,
    appliedSeeInappropriates,
    listSort,
    kind,
    recentOnly,
    aggregateInappropriate,
  ]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const applyDateFilter = () => {
    setAppliedFromDate(filterFromDate);
    setAppliedToDate(filterToDate);
    setAppliedSeeInappropriates(filterSeeInappropriates);
    setFilterOpen(false);
  };

  const composeButtonLabel = (() => {
    if (kind === 'review') return 'Add a review';
    if (category === 'question') return 'Add a question';
    if (category === 'suggestion') return 'Add a suggestion';
    if (category === 'problem') return 'Add a problem';
    return 'Add feedback';
  })();

  const submitCompose = useCallback(async () => {
    if (!composeBody.trim()) return;
    setComposeSending(true);
    setComposeError('');
    try {
      const path = kind === 'review' ? '/api/messages/reviews' : '/api/messages/support';
      const payload: Record<string, unknown> = {
        body: composeBody.trim(),
        subject: composeSubject.trim(),
        languageCode: composeLang || undefined,
        pathStaff: composePath.trim() || undefined,
        realPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      };
      if (kind === 'support') {
        if (category) payload.supportCategory = category;
        if (category === 'problem') {
          payload.errorMessage = composeErrorMsg.trim() || undefined;
        }
        payload.imageUrls = composeImages.map((img) => img.url).slice(0, MAX_SUPPORT_IMAGES);
      }
      await authFetch(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setComposeOpen(false);
      resetCompose();
      await loadItems();
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setComposeSending(false);
    }
  }, [
    authFetch,
    category,
    composeBody,
    composeErrorMsg,
    composeImages,
    composeLang,
    composePath,
    composeSubject,
    kind,
    loadItems,
    resetCompose,
  ]);

  const markThreadInappropriate = useCallback(
    async (threadId: string, e: MouseEvent, next = true) => {
      e.stopPropagation();
      e.preventDefault();
      if (markingId) return;
      setMarkingId(threadId);
      try {
        await authFetch(`/api/messages/threads/${threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isInappropriate: next }),
        });
        setItems((prev) => {
          if (aggregateInappropriate && !next) {
            return prev.filter((item) => item.id !== threadId);
          }
          return prev.map((item) =>
            item.id === threadId ? { ...item, isInappropriate: next } : item,
          );
        });
      } catch {
        /* ignore */
      } finally {
        setMarkingId(null);
      }
    },
    [aggregateInappropriate, authFetch, markingId],
  );

  const deleteThread = useCallback(
    async (threadId: string, e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (deletingId) return;
      if (!window.confirm('Delete this submission? This cannot be undone.')) return;
      setDeletingId(threadId);
      try {
        await authFetch(`/api/messages/threads/${threadId}`, { method: 'DELETE' });
        setItems((prev) => prev.filter((item) => item.id !== threadId));
        if (selectedId === threadId) {
          setSelectedId(null);
          setThreadDetail(null);
        }
        await loadItems();
      } catch {
        setError('Failed to delete.');
      } finally {
        setDeletingId(null);
      }
    },
    [authFetch, deletingId, loadItems, selectedId],
  );

  const bulkDeleteByDateRange = useCallback(async () => {
    if (!filterFromDate || !filterToDate) return;
    if (!window.confirm('Delete all submissions in the selected date range? This cannot be undone.')) {
      return;
    }
    setBulkDeleting(true);
    setError('');
    try {
      const qs = new URLSearchParams({ from: filterFromDate, to: filterToDate });
      if (kind === 'support') {
        if (category) qs.set('category', category);
        if (bugsOnly) qs.set('bugs', '1');
        if (excludeBugs) qs.set('excludeBugs', '1');
      }
      const path =
        kind === 'support'
          ? `/api/messages/support?${qs}`
          : `/api/messages/reviews?${qs}`;
      await authFetch(path, { method: 'DELETE' });
      setFilterOpen(false);
      setAppliedFromDate(filterFromDate);
      setAppliedToDate(filterToDate);
      setSelectedId(null);
      setThreadDetail(null);
      await loadItems();
    } catch {
      setError('Bulk delete failed.');
    } finally {
      setBulkDeleting(false);
    }
  }, [
    authFetch,
    bugsOnly,
    category,
    excludeBugs,
    filterFromDate,
    filterToDate,
    kind,
    loadItems,
  ]);

  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailLoading(true);
      setReplyError('');
      try {
        const communityQs =
          !aggregateInappropriate && kind === 'review' ? '?communityReview=1' : '';
        const data = await authFetch(`/api/messages/threads/${id}${communityQs}`);
        setThreadDetail(data);
      } catch {
        setThreadDetail(null);
        setReplyError('Could not load this thread.');
      } finally {
        setDetailLoading(false);
      }
    },
    [aggregateInappropriate, authFetch, kind],
  );

  const submitReply = useCallback(async () => {
    if (!selectedId || !replyBody.trim()) return;
    setReplySending(true);
    setReplyError('');
    try {
      const data = await authFetch(`/api/messages/threads/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      setReplyBody('');
      setThreadDetail(data);
      await loadItems();
    } catch {
      setReplyError('Failed to send reply.');
    } finally {
      setReplySending(false);
    }
  }, [authFetch, loadItems, replyBody, selectedId]);

  const updateThreadStatus = useCallback(
    async (status: SupportWorkflowStatus) => {
      if (!selectedId) return;
      setStatusSaving(true);
      setReplyError('');
      try {
        const data = await authFetch(`/api/messages/threads/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        setThreadDetail(data);
        setItems((prev) =>
          prev.map((item) => (item.id === selectedId ? { ...item, status } : item)),
        );
      } catch {
        setReplyError('Failed to update status.');
      } finally {
        setStatusSaving(false);
      }
    },
    [authFetch, selectedId],
  );

  const showWorkflowStatus =
    !aggregateInappropriate && kind === 'support' && isSupportWorkflowCategory(category);
  const itemShowsWorkflowStatus = (item: FeedItem) =>
    aggregateInappropriate
      ? isSupportWorkflowCategory(
          (item.supportCategory || '') as SupportCategory,
        )
      : showWorkflowStatus;
  const filteredItems = items.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${item.title} ${item.excerpt} ${item.author || ''}`.toLowerCase().includes(q);
  });

  const showPictures = kind === 'support';
  const fieldClass =
    'w-full border border-slate-300 rounded px-2 py-2 text-sm bg-white text-slate-900';

  return (
    <div className="w-full p-2 sm:p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        {!aggregateInappropriate ? (
          <button
            type="button"
            onClick={() => {
              resetCompose();
              setComposeOpen(true);
            }}
            className="shrink-0 px-4 py-2 rounded bg-[#058592] text-white text-sm font-semibold hover:bg-[#047080]"
          >
            {composeButtonLabel}
          </button>
        ) : null}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="relative z-20 px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3 items-center justify-between overflow-visible">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or author…"
              className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56"
            />
            <select
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">All languages</option>
              {langOptions.map((l) => (
                <option key={l.id} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            {showWorkflowStatus ? (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                title="Filter by status"
              >
                <option value="">All status</option>
                {SUPPORT_WORKFLOW_STATUS_CODES.map((code) => (
                  <option key={code} value={code}>
                    {SUPPORT_WORKFLOW_STATUS_LABELS[code]}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => setRecentOnly(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                !recentOnly ? 'bg-[#058592] text-white' : 'bg-white border border-slate-300'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setRecentOnly(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded ${
                recentOnly ? 'bg-[#058592] text-white' : 'bg-white border border-slate-300'
              }`}
            >
              Recent (14 days)
            </button>
            <select
              value={listSort}
              onChange={(e) => setListSort(e.target.value as ThreadListSort | '')}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              aria-label="Sort by"
            >
              <option value="">Sort by</option>
              {THREAD_SORT_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                <option key={opt.value || 'default'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-[#292929] text-white"
              >
                Filter
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            {(appliedFromDate || appliedToDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterFromDate('');
                  setFilterToDate('');
                  setAppliedFromDate('');
                  setAppliedToDate('');
                }}
                className="px-2 py-1 text-xs text-slate-600 underline"
              >
                Clear dates
                {appliedFromDate || appliedToDate
                  ? ` (${[appliedFromDate, appliedToDate].filter(Boolean).join(' → ')})`
                  : ''}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="inline-flex items-center gap-1.5 text-sm text-[#058592] font-medium hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[520px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden rounded-b-lg">
          <div className="flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-280px)]">
            <div className="px-4 py-2 border-b border-slate-100 text-sm font-semibold text-slate-700">
              User submissions ({filteredItems.length})
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <p className="text-slate-500 text-sm">Loading…</p>
              ) : filteredItems.length === 0 ? (
                <p className="text-slate-500 text-sm py-8 text-center">{emptyMessage}</p>
              ) : (
                <ul className="space-y-2">
                  {filteredItems.map((item) => (
                    <li key={item.id}>
                      <div
                        className={`rounded border overflow-hidden transition ${
                          selectedId === item.id
                            ? 'border-[#058592] bg-teal-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start">
                        <button
                          type="button"
                          onClick={() => void openThread(item.id)}
                          className="flex-1 text-left p-3 min-w-0"
                        >
                          <div className="font-semibold text-slate-900 text-sm leading-snug">
                            {item.title}
                          </div>
                          {item.excerpt ? (
                            <p className="text-slate-600 text-xs mt-1 line-clamp-2">{item.excerpt}</p>
                          ) : null}
                          <div className="text-[11px] text-slate-500 mt-1.5">
                            {item.author || '—'} · {new Date(item.updatedAt).toLocaleString()}
                          </div>
                          {itemShowsWorkflowStatus(item) ? (
                            <div className="mt-1.5">
                              <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-red-600 border border-slate-200">
                                {supportWorkflowStatusLabel(item.status)}
                              </span>
                            </div>
                          ) : null}
                        </button>
                        </div>
                        <div className="px-3 pb-2 flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex flex-wrap items-center gap-x-1 min-w-0">
                            <span className="text-[#058592] font-medium">
                              Reply:{' '}
                              <span
                                className={
                                  item.awaitingStaffReply ? 'text-red-600 font-semibold' : 'text-slate-700'
                                }
                              >
                                {replyCountFromMessageCount(item.messageCount)}
                              </span>
                            </span>
                            <span className="text-slate-300">·</span>
                            {item.isInappropriate ? (
                              <button
                                type="button"
                                disabled={markingId === item.id}
                                onClick={(e) => void markThreadInappropriate(item.id, e, false)}
                                className="text-[#058592] hover:underline disabled:opacity-50"
                              >
                                Untag inappropriate
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={markingId === item.id}
                                onClick={(e) => void markThreadInappropriate(item.id, e, true)}
                                className="text-[#058592] hover:underline disabled:opacity-50"
                              >
                                Mark as inappropriate
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            title="Delete"
                            disabled={deletingId === item.id}
                            onClick={(e) => void deleteThread(item.id, e)}
                            className="shrink-0 text-red-700 font-medium hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                        {(showPictures || aggregateInappropriate) &&
                        item.imageUrls &&
                        item.imageUrls.length > 0 ? (
                          <div className="px-3 pb-3 flex gap-1.5 flex-wrap">
                            {item.imageUrls.slice(0, MAX_SUPPORT_IMAGES).map((src, imgIdx) => (
                              <button
                                key={src}
                                type="button"
                                title="View picture"
                                onClick={(e) => openPictureLightbox(item.imageUrls || [], imgIdx, e)}
                                className="p-0 rounded border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-[#058592]/40"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt=""
                                  className="h-14 w-14 object-cover pointer-events-none"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-280px)] bg-slate-50/50">
            <div className="px-4 py-2 border-b border-slate-100 text-sm font-semibold text-slate-700">
              Thread detail
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedId ? (
                <p className="text-slate-500 text-sm py-12 text-center">
                  Select a submission from the list to read and reply.
                </p>
              ) : detailLoading ? (
                <p className="text-slate-500 text-sm">Loading thread…</p>
              ) : threadDetail ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">{threadDetail.thread.subject || '—'}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {threadDetail.thread.authorName} ·{' '}
                      {new Date(threadDetail.thread.updatedAt).toLocaleString()}
                    </p>
                    {(aggregateInappropriate
                      ? isSupportWorkflowCategory(
                          (threadDetail.thread.supportCategory || '') as SupportCategory,
                        )
                      : showWorkflowStatus) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-xs font-semibold text-slate-700" htmlFor="edit-status">
                          Edit status
                        </label>
                        <select
                          id="edit-status"
                          disabled={statusSaving}
                          value={normalizeSupportWorkflowStatus(threadDetail.thread.status)}
                          onChange={(e) =>
                            void updateThreadStatus(e.target.value as SupportWorkflowStatus)
                          }
                          className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold bg-white text-red-600 disabled:opacity-50"
                        >
                          {SUPPORT_WORKFLOW_STATUS_CODES.map((code) => (
                            <option key={code} value={code}>
                              {SUPPORT_WORKFLOW_STATUS_LABELS[code]}
                            </option>
                          ))}
                        </select>
                        {statusSaving ? (
                          <span className="text-[11px] text-slate-500">Saving…</span>
                        ) : null}
                      </div>
                    ) : null}
                    {threadDetail.thread.languageCode ? (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Language: {threadDetail.thread.languageCode}
                      </p>
                    ) : null}
                    <ThreadPathOpenLink
                      pathStaff={threadDetail.thread.pathStaff}
                      realPath={threadDetail.thread.realPath}
                      pathLabel="Path"
                      openLabel="Open link"
                    />
                    {threadDetail.thread.errorMessage ? (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-2">
                        Error: {threadDetail.thread.errorMessage}
                      </p>
                    ) : null}
                    {(showPictures ||
                      (aggregateInappropriate && threadDetail.thread.kind === 'SUPPORT')) &&
                    threadDetail.thread.imageUrls &&
                    threadDetail.thread.imageUrls.length > 0 ? (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {threadDetail.thread.imageUrls
                          .slice(0, MAX_SUPPORT_IMAGES)
                          .map((src, imgIdx) => (
                            <button
                              key={src}
                              type="button"
                              title="View picture"
                              onClick={(e) =>
                                openPictureLightbox(threadDetail.thread.imageUrls || [], imgIdx, e)
                              }
                              className="p-0 rounded border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-[#058592]/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                className="h-20 w-20 object-cover pointer-events-none"
                              />
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <ul className="space-y-2">
                    {threadDetail.messages.map((m) => (
                      <li
                        key={m.id}
                        className={`rounded p-3 text-sm ${
                          m.isStaff
                            ? 'bg-teal-50 border border-teal-100'
                            : 'bg-white border border-slate-200'
                        }`}
                      >
                        <span className="font-semibold text-slate-700 text-xs">
                          {m.isStaff ? 'Staff' : m.sender?.name || m.sender?.username || 'User'}
                        </span>
                        <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.body}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Staff reply</label>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={4}
                      placeholder="Write a reply to the user…"
                      className={fieldClass}
                    />
                    {replyError ? (
                      <p className="text-xs text-red-600 mt-1">{replyError}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={replySending || !replyBody.trim()}
                      onClick={() => void submitReply()}
                      className="mt-2 px-4 py-2 rounded bg-[#058592] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Send reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setThreadDetail(null);
                    }}
                    className="inline-flex items-center gap-1 text-sm text-[#058592] font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <p className="text-slate-500 text-sm">{replyError || 'Thread not found.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {filterOpen ? (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Filter by date"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="w-full max-w-sm my-auto rounded-lg border border-slate-300 bg-white shadow-2xl p-4 text-sm text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h3 className="font-semibold text-slate-900">Filter by date</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFilterOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-3">
              <span className="text-slate-600 text-xs font-medium">From date</span>
              <div className="mt-1">
                <AdminPcuDatePicker
                  value={filterFromDate}
                  onChange={setFilterFromDate}
                  allowPastDates
                  inline
                  placeholder="mm/dd/yyyy"
                />
              </div>
            </div>
            <div className="mb-4">
              <span className="text-slate-600 text-xs font-medium">To date</span>
              <div className="mt-1">
                <AdminPcuDatePicker
                  value={filterToDate}
                  onChange={setFilterToDate}
                  allowPastDates
                  inline
                  placeholder="mm/dd/yyyy"
                />
              </div>
            </div>
            {!aggregateInappropriate ? (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterSeeInappropriates}
                  onChange={(e) => setFilterSeeInappropriates(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700">See the inappropriates</span>
              </label>
            ) : null}
            <button
              type="button"
              disabled={bulkDeleting || !filterFromDate || !filterToDate}
              onClick={() => void bulkDeleteByDateRange()}
              className="w-full mb-4 px-3 py-2 rounded bg-red-700 text-white text-xs font-semibold disabled:opacity-40"
            >
              Multiple deletion
            </button>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-xs font-medium"
              >
                Exit
              </button>
              <button
                type="button"
                onClick={applyDateFilter}
                className="px-3 py-1.5 rounded bg-[#058592] text-white text-xs font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composeOpen ? (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={composeButtonLabel}
          onClick={() => setComposeOpen(false)}
        >
          <div
            className="w-full max-w-lg my-auto rounded-lg border border-slate-300 bg-white shadow-2xl p-4 text-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <h3 className="font-semibold text-slate-900">{composeButtonLabel}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setComposeOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block mb-2">
              <span className="text-xs font-medium text-slate-600">Language</span>
              <select
                value={composeLang}
                onChange={(e) => setComposeLang(e.target.value)}
                className={`${fieldClass} mb-0`}
              >
                <option value="">Select language</option>
                {langOptions.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block mb-2">
              <span className="text-xs font-medium text-slate-600">Object / subject</span>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Object / subject"
                className={fieldClass}
              />
            </label>

            <label className="block mb-2">
              <span className="text-xs font-medium text-slate-600">Path (staff)</span>
              <input
                type="text"
                value={composePath}
                onChange={(e) => setComposePath(e.target.value)}
                placeholder="Path (staff)"
                className={fieldClass}
              />
            </label>

            {kind === 'support' && category === 'problem' ? (
              <label className="block mb-2">
                <span className="text-xs font-medium text-slate-600">Error message</span>
                <input
                  type="text"
                  value={composeErrorMsg}
                  onChange={(e) => setComposeErrorMsg(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : null}

            <label className="block mb-2">
              <span className="text-xs font-medium text-slate-600">Message</span>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={6}
                className={fieldClass}
                placeholder="Write your message…"
              />
            </label>

            {kind === 'support' ? (
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <button
                    type="button"
                    disabled={
                      composeUploadingImages || composeImages.length >= MAX_SUPPORT_IMAGES
                    }
                    onClick={() => composeFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-400 rounded bg-white hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4" />
                    {composeUploadingImages ? 'Uploading…' : 'Add pictures'}
                  </button>
                  <span className="text-[11px] text-slate-600">
                    Up to {MAX_SUPPORT_IMAGES} images ({composeImages.length}/{MAX_SUPPORT_IMAGES})
                  </span>
                  <input
                    ref={composeFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleComposeImagesSelected(e.target.files)}
                  />
                </div>
                {composeImages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {composeImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative h-20 w-20 rounded border border-slate-300 overflow-hidden bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.preview || img.url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          title="Remove picture"
                          aria-label="Remove picture"
                          onClick={() => removeComposeImage(img.id)}
                          className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {composeError ? (
              <p className="text-xs text-red-600 mb-2">{composeError}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  composeSending || composeUploadingImages || !composeBody.trim()
                }
                onClick={() => void submitCompose()}
                className="px-3 py-1.5 rounded bg-[#058592] text-white text-xs font-semibold disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pictureLightbox ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="View picture"
          onClick={() => setPictureLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            aria-label="Close"
            onClick={() => setPictureLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>

          {pictureLightbox.urls.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-3 sm:left-6 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Previous picture"
                onClick={(e) => {
                  e.stopPropagation();
                  setPictureLightbox((cur) => {
                    if (!cur) return cur;
                    return {
                      ...cur,
                      index: (cur.index - 1 + cur.urls.length) % cur.urls.length,
                    };
                  });
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                className="absolute right-3 sm:right-6 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Next picture"
                onClick={(e) => {
                  e.stopPropagation();
                  setPictureLightbox((cur) => {
                    if (!cur) return cur;
                    return {
                      ...cur,
                      index: (cur.index + 1) % cur.urls.length,
                    };
                  });
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          ) : null}

          <div
            className="relative max-h-[90vh] max-w-[min(96vw,56rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pictureLightbox.urls[pictureLightbox.index]}
              alt=""
              className="max-h-[85vh] max-w-full rounded object-contain shadow-2xl"
            />
            {pictureLightbox.urls.length > 1 ? (
              <p className="mt-2 text-center text-sm text-white/90">
                {pictureLightbox.index + 1} / {pictureLightbox.urls.length}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
