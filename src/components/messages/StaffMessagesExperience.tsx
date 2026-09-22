'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Clock,
  FileText,
  LifeBuoy,
  X,
  Lightbulb,
  Bug,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type { ThreadListSort } from '@/lib/messages/userThreads';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAuthToken } from '@/utils/auth.utils';
import VersionHistoryPanel, {
  type VersionHistoryPanelHandle,
} from '@/components/messages/VersionHistoryPanel';
import ListPageSelector from '@/components/ui/ListPageSelector';
import type { FeedbackScope } from '@/lib/messages/feedbackRoutes';
import { MAX_SUPPORT_IMAGES } from '@/lib/messages/supportImages';
import ThreadPathOpenLink from '@/components/messages/ThreadPathOpenLink';
import {
  SUPPORT_WORKFLOW_STATUS_CODES,
  isSupportWorkflowCategory,
  normalizeSupportWorkflowStatus,
} from '@/lib/messages/supportStatus';

export type MainTab = 'version' | 'review' | 'support';

type LangOption = { id: string; code: string; name: string };

type FeedItem = {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  messageCount?: number;
  author?: string;
  authorImage?: string | null;
  isMine?: boolean;
  likeCount?: number;
  dislikeCount?: number;
  myReaction?: 'L' | 'D' | null;
  status?: string | null;
  imageUrls?: string[];
  isInappropriate?: boolean;
};

const THREAD_SORT_OPTIONS: { value: ThreadListSort | ''; labelKey: string }[] = [
  { value: '', labelKey: 'staff_sort_date_desc' },
  { value: 'date_asc', labelKey: 'staff_sort_date_asc' },
  { value: 'date_desc', labelKey: 'staff_sort_date_desc' },
  { value: 'like', labelKey: 'staff_sort_like' },
  { value: 'dislike', labelKey: 'staff_sort_dislike' },
];

function replyCountFromMessageCount(messageCount?: number): number {
  return Math.max(0, (messageCount ?? 1) - 1);
}

type ComposerImage = {
  id: string;
  url: string;
  preview: string;
};

type ThreadDetail = {
  thread: {
    id: string;
    subject: string;
    kind: string;
    createdAt: string;
    updatedAt: string;
    isOwner: boolean;
    languageCode?: string | null;
    pathStaff?: string | null;
    realPath?: string | null;
    supportCategory?: string | null;
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

type Props = {
  variant: 'drawer' | 'page';
  initialMainTab?: MainTab;
  initialCategory?: string;
  initialMineOnly?: boolean;
  initialRecentOnly?: boolean;
  initialScope?: FeedbackScope;
  initialSearchQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  hideMainTabs?: boolean;
  legacyMode?: boolean;
  legacyUserId?: string;
  onClose?: () => void;
};

const SUPPORT_CATS = [
  { id: 'feedback', labelKey: 'staff_cat_feedback' },
  { id: 'question', labelKey: 'staff_cat_question' },
  { id: 'suggestion', labelKey: 'staff_cat_suggestion' },
  { id: 'problem', labelKey: 'staff_cat_problem' },
] as const;

/** Default is Posted by me; only community scope starts unselected (all posts). */
function resolveInitialPostByMe(
  initialMineOnly?: boolean,
  initialScope?: FeedbackScope,
): boolean {
  if (initialScope === 'community') return false;
  if (initialScope === 'mine' || initialMineOnly) return true;
  return true;
}

export default function StaffMessagesExperience({
  variant,
  initialMainTab = 'support',
  initialCategory = 'feedback',
  initialMineOnly = false,
  initialRecentOnly = false,
  initialScope,
  initialSearchQuery = '',
  initialPage = 1,
  initialPageSize = 5,
  hideMainTabs = false,
  legacyMode = false,
  legacyUserId,
  onClose,
}: Props) {
  const { t, currentLanguage } = useLanguage();
  const [mainTab, setMainTab] = useState<MainTab>(initialMainTab);
  const versionPanelRef = useRef<VersionHistoryPanelHandle>(null);
  const [loading, setLoading] = useState(false);
  const [langOptions, setLangOptions] = useState<LangOption[]>([]);

  const [subPage, setSubPage] = useState<string>(initialCategory);
  const [filterLang, setFilterLang] = useState('');
  const [recentOnly, setRecentOnly] = useState(initialRecentOnly);
  const [postByMe, setPostByMe] = useState(() =>
    resolveInitialPostByMe(initialMineOnly, initialScope),
  );

  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [feedTotal, setFeedTotal] = useState(0);
  const [currentPageOnly, setCurrentPageOnly] = useState(false);
  const [sectionFilterOpen, setSectionFilterOpen] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [filterSeeInappropriates, setFilterSeeInappropriates] = useState(false);
  const [appliedSeeInappropriates, setAppliedSeeInappropriates] = useState(false);
  const [listSort, setListSort] = useState<ThreadListSort | ''>('');
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [supportItems, setSupportItems] = useState<FeedItem[]>([]);
  const [reviewItems, setReviewItems] = useState<FeedItem[]>([]);

  const [leftView, setLeftView] = useState<'list' | 'thread'>('list');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [composerLang, setComposerLang] = useState('');
  const [composerObject, setComposerObject] = useState('');
  const [composerPath, setComposerPath] = useState('');
  const [composerRealPath, setComposerRealPath] = useState('');
  const [composerErrorMsg, setComposerErrorMsg] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerImages, setComposerImages] = useState<ComposerImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** Your Supports (legacy): composer hidden until "Leave a new feedback"; hide again after successful post. */
  const [composerVisible, setComposerVisible] = useState(!legacyMode);

  const [replyBody, setReplyBody] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [pictureLightbox, setPictureLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const composerBodyRef = useRef<HTMLTextAreaElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);

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

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = typeof window !== 'undefined' ? getAuthToken() : null;
    if (!token) throw new Error('no_token');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(path, { ...init, headers });
    if (!res.ok) throw new Error(String(res.status));
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
    setSubPage(initialCategory);
    setPostByMe(resolveInitialPostByMe(initialMineOnly, initialScope));
    setRecentOnly(initialRecentOnly);
    setSearchInput(initialSearchQuery);
    setSearchQuery(initialSearchQuery);
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [
    initialCategory,
    initialMineOnly,
    initialRecentOnly,
    initialScope,
    initialSearchQuery,
    initialPage,
    initialPageSize,
  ]);

  useEffect(() => {
    if (legacyMode) setMainTab('support');
  }, [legacyMode]);

  const loadSupportFeed = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        feed: '1',
        category: subPage,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterLang) qs.set('lang', filterLang);
      if (postByMe) qs.set('mine', '1');
      if (recentOnly) qs.set('recent', '1');
      if (currentPageOnly && typeof window !== 'undefined') {
        qs.set('currentPage', '1');
        qs.set('path', window.location.pathname);
      }
      if (searchQuery) qs.set('q', searchQuery);
      if (appliedFromDate) qs.set('from', appliedFromDate);
      if (appliedToDate) qs.set('to', appliedToDate);
      if (appliedStatus) qs.set('status', appliedStatus);
      if (appliedSeeInappropriates) qs.set('inappropriate', '1');
      if (listSort) qs.set('sort', listSort);
      const data = await authFetch(`/api/messages/support?${qs}`);
      setSupportItems(data.items || []);
      setFeedTotal(data.total ?? 0);
    } catch {
      setSupportItems([]);
      setFeedTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFromDate,
    appliedStatus,
    appliedToDate,
    appliedSeeInappropriates,
    authFetch,
    currentPageOnly,
    filterLang,
    listSort,
    page,
    pageSize,
    postByMe,
    recentOnly,
    searchQuery,
    subPage,
  ]);

  const loadReviewsMine = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery) qs.set('q', searchQuery);
      // Default = Posted by me (mine); unselecting the button loads all posts
      if (postByMe) qs.set('mine', '1');
      else qs.set('community', '1');
      if (filterLang) qs.set('lang', filterLang);
      if (recentOnly) qs.set('recent', '1');
      if (currentPageOnly && typeof window !== 'undefined') {
        qs.set('currentPage', '1');
        qs.set('path', window.location.pathname);
      }
      if (appliedFromDate) qs.set('from', appliedFromDate);
      if (appliedToDate) qs.set('to', appliedToDate);
      if (appliedSeeInappropriates) qs.set('inappropriate', '1');
      if (listSort) qs.set('sort', listSort);
      const data = await authFetch(`/api/messages/reviews?${qs}`);
      setReviewItems(data.items || []);
      setFeedTotal(data.total ?? 0);
    } catch {
      setReviewItems([]);
      setFeedTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    appliedFromDate,
    appliedToDate,
    appliedSeeInappropriates,
    authFetch,
    currentPageOnly,
    filterLang,
    listSort,
    page,
    pageSize,
    postByMe,
    recentOnly,
    searchQuery,
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setComposerRealPath(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'support') void loadSupportFeed();
    if (mainTab === 'review') void loadReviewsMine();
  }, [mainTab, loadSupportFeed, loadReviewsMine]);

  const openThread = useCallback(
    async (id: string) => {
      setSelectedThreadId(id);
      setLeftView('thread');
      setDetailLoading(true);
      setSendError(null);
      try {
        const communityQs =
          mainTab === 'review' && !postByMe ? '?communityReview=1' : '';
        const data = await authFetch(`/api/messages/threads/${id}${communityQs}`);
        setThreadDetail(data);
      } catch {
        setThreadDetail(null);
        setSendError(t('messages_error_load_thread'));
      } finally {
        setDetailLoading(false);
      }
    },
    [authFetch, mainTab, postByMe, t],
  );

  const totalPages = Math.max(1, Math.ceil(feedTotal / pageSize));

  const applySearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const selectSupportCategory = (categoryId: string) => {
    if (!SUPPORT_CATS.some((c) => c.id === categoryId)) return;
    setSubPage(categoryId);
    setPage(1);
    setFilterStatus('');
    setAppliedStatus('');
    // When embedded in a dashboard, keep the current page shell (no full navigation).
    // Deep-link URL updates are optional and skipped here on purpose.
  };

  const backToList = () => {
    setLeftView('list');
    setSelectedThreadId(null);
    setThreadDetail(null);
    setReplyBody('');
  };

  const resetComposer = useCallback(() => {
    setComposerLang('');
    setComposerObject('');
    setComposerPath('');
    setComposerErrorMsg('');
    setComposerBody('');
    setComposerImages((prev) => {
      prev.forEach((img) => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      });
      return [];
    });
    setSendError(null);
    if (typeof window !== 'undefined') {
      setComposerRealPath(window.location.pathname);
    }
  }, []);

  const removeComposerImage = useCallback((id: string) => {
    setComposerImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleComposerImagesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const remaining = MAX_SUPPORT_IMAGES - composerImages.length;
      if (remaining <= 0) {
        setSendError(t('staff_pictures_max'));
        return;
      }
      const picked = Array.from(files).slice(0, remaining);
      const token = getAuthToken();
      if (!token) {
        setSendError(t('messages_error_send'));
        return;
      }
      setUploadingImages(true);
      setSendError(null);
      try {
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
            setSendError(t('staff_picture_upload_failed'));
            continue;
          }
          const preview = URL.createObjectURL(file);
          setComposerImages((prev) => {
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
        setSendError(t('staff_picture_upload_failed'));
      } finally {
        setUploadingImages(false);
        if (composerFileInputRef.current) composerFileInputRef.current.value = '';
      }
    },
    [composerImages.length, t],
  );

  const handlePostNew = useCallback(() => {
    resetComposer();
    setComposerVisible(true);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      composerBodyRef.current?.focus();
    });
  }, [resetComposer]);

  const submitComposer = useCallback(async () => {
    if (!composerBody.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const payload = {
        subject: composerObject.trim(),
        body: composerBody.trim(),
        languageCode: composerLang || undefined,
        pathStaff: composerPath.trim() || undefined,
        realPath: composerRealPath || undefined,
        errorMessage: subPage === 'problem' ? composerErrorMsg.trim() : undefined,
        supportCategory: mainTab === 'support' ? subPage : undefined,
        imageUrls: composerImages.map((img) => img.url).slice(0, MAX_SUPPORT_IMAGES),
      };
      const path = mainTab === 'review' ? '/api/messages/reviews' : '/api/messages/support';
      await authFetch(path, { method: 'POST', body: JSON.stringify(payload) });
      setComposerBody('');
      setComposerObject('');
      setComposerPath('');
      setComposerErrorMsg('');
      setComposerImages((prev) => {
        prev.forEach((img) => {
          if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
        });
        return [];
      });
      if (legacyMode) {
        setComposerVisible(false);
        resetComposer();
      }
      if (mainTab === 'support') await loadSupportFeed();
      else await loadReviewsMine();
    } catch {
      setSendError(t('messages_error_send'));
    } finally {
      setSending(false);
    }
  }, [
    authFetch,
    composerBody,
    composerErrorMsg,
    composerImages,
    composerLang,
    composerObject,
    composerPath,
    composerRealPath,
    legacyMode,
    mainTab,
    loadReviewsMine,
    loadSupportFeed,
    resetComposer,
    subPage,
    t,
  ]);

  const submitReply = useCallback(async () => {
    if (!selectedThreadId || !replyBody.trim()) return;
    setReplySending(true);
    setSendError(null);
    try {
      await authFetch(`/api/messages/threads/${selectedThreadId}`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      setReplyBody('');
      await openThread(selectedThreadId);
    } catch {
      setSendError(t('messages_error_send'));
    } finally {
      setReplySending(false);
    }
  }, [authFetch, openThread, replyBody, selectedThreadId, t]);

  const toggleReaction = useCallback(
    async (threadId: string, reaction: 'L' | 'D', e: MouseEvent) => {
      e.stopPropagation();
      if (reactingId) return;
      setReactingId(threadId);
      try {
        const data = await authFetch(`/api/messages/threads/${threadId}/like`, {
          method: 'POST',
          body: JSON.stringify({ reaction }),
        });
        setSupportItems((prev) =>
          prev.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  likeCount: data.likeCount ?? item.likeCount,
                  dislikeCount: data.dislikeCount ?? item.dislikeCount,
                  myReaction: data.myReaction ?? null,
                }
              : item,
          ),
        );
      } catch {
        /* ignore */
      } finally {
        setReactingId(null);
      }
    },
    [authFetch, reactingId],
  );

  const applySectionFilter = () => {
    setAppliedFromDate(filterFromDate);
    setAppliedToDate(filterToDate);
    setAppliedStatus(filterStatus);
    setAppliedSeeInappropriates(filterSeeInappropriates);
    setPage(1);
    setSectionFilterOpen(false);
  };

  const markThreadInappropriate = useCallback(
    async (threadId: string, e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (markingId) return;
      setMarkingId(threadId);
      try {
        await authFetch(`/api/messages/threads/${threadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isInappropriate: true }),
        });
        const markListed = (prev: FeedItem[]) =>
          prev.map((item) =>
            item.id === threadId ? { ...item, isInappropriate: true } : item,
          );
        setSupportItems(markListed);
        setReviewItems(markListed);
      } catch {
        /* staff-only or network */
      } finally {
        setMarkingId(null);
      }
    },
    [authFetch, markingId],
  );

  const deleteThread = useCallback(
    async (threadId: string, e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (deletingId) return;
      if (!window.confirm(t('staff_delete_confirm'))) return;
      setDeletingId(threadId);
      try {
        await authFetch(`/api/messages/threads/${threadId}`, { method: 'DELETE' });
        setSupportItems((prev) => prev.filter((item) => item.id !== threadId));
        setReviewItems((prev) => prev.filter((item) => item.id !== threadId));
        if (selectedThreadId === threadId) backToList();
        void (mainTab === 'support' ? loadSupportFeed() : loadReviewsMine());
      } catch {
        setSendError(t('messages_error_send'));
      } finally {
        setDeletingId(null);
      }
    },
    [
      authFetch,
      deletingId,
      loadReviewsMine,
      loadSupportFeed,
      mainTab,
      selectedThreadId,
      t,
    ],
  );

  const bulkDeleteByDateRange = useCallback(async () => {
    if (!filterFromDate || !filterToDate) return;
    if (!window.confirm(t('staff_bulk_delete_confirm'))) return;
    setBulkDeleting(true);
    setSendError(null);
    try {
      const qs = new URLSearchParams({
        from: filterFromDate,
        to: filterToDate,
      });
      if (mainTab === 'support') {
        qs.set('category', subPage);
      }
      const path =
        mainTab === 'support'
          ? `/api/messages/support?${qs}`
          : `/api/messages/reviews?${qs}`;
      await authFetch(path, { method: 'DELETE' });
      setSectionFilterOpen(false);
      setAppliedFromDate(filterFromDate);
      setAppliedToDate(filterToDate);
      setPage(1);
      if (mainTab === 'support') await loadSupportFeed();
      else await loadReviewsMine();
    } catch {
      setSendError(t('messages_error_send'));
    } finally {
      setBulkDeleting(false);
    }
  }, [
    authFetch,
    filterFromDate,
    filterToDate,
    loadReviewsMine,
    loadSupportFeed,
    mainTab,
    subPage,
    t,
  ]);

  const shellClass =
    variant === 'page'
      ? 'min-h-screen bg-transparent py-0 px-0 flex flex-col items-stretch'
      : 'flex flex-col h-full min-h-0';

  const cardClass =
    variant === 'page'
      ? 'staff-messages-panel w-full bg-white !text-black [color-scheme:light] rounded-lg shadow-xl border border-slate-300 overflow-hidden flex flex-col min-h-[85vh]'
      : 'staff-messages-panel flex flex-col h-full min-h-0 bg-white !text-black [color-scheme:light]';

  const newTabHref =
    mainTab === 'review'
      ? '/assistance/feedback?tab=reviews'
      : mainTab === 'support'
        ? '/assistance/feedback?tab=support'
        : '/assistance/feedback';

  const fieldClass =
    'w-full border border-slate-300 rounded px-2 py-2 text-sm bg-white !text-black placeholder:!text-slate-600';

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        <div className="bg-gradient-to-r from-[#7a1228] via-[#9b1d3d] to-[#6b0f22] text-white px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500 shrink-0 flex items-center justify-center text-white text-lg font-bold">
              M
            </div>
            <div className="min-w-0">
              <div className="font-bold text-amber-200 tracking-tight">Movesbook</div>
              <div className="text-[11px] text-white/85 leading-tight">
                The network for your sport life.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {variant === 'drawer' && (
              <a
                href={newTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold border border-amber-300 text-amber-100 px-3 py-1.5 rounded hover:bg-white/10 whitespace-nowrap"
              >
                {t('staff_open_new_tab')}
              </a>
            )}
            {variant === 'drawer' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded hover:bg-white/10 text-white"
                aria-label={t('messages_panel_close')}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex bg-slate-100 border-b border-slate-300 shrink-0">
          {hideMainTabs ? (
            <div className="w-full px-4 py-2.5">
              <span className="inline-block text-sm font-semibold text-slate-900 border-b-2 border-[#c43c54] pb-1">
                {t('staff_your_supports')}
              </span>
            </div>
          ) : (
            <>
          <MainTabBtn
            active={mainTab === 'version'}
            onClick={() => {
              setMainTab('version');
              setLeftView('list');
              setSelectedThreadId(null);
            }}
            onIconClick={() => versionPanelRef.current?.promptUnlock()}
            icon={<Clock className="w-4 h-4" />}
            label={t('messages_rail_version')}
          />
          <MainTabBtn
            active={mainTab === 'review'}
            onClick={() => {
              setMainTab('review');
              setLeftView('list');
              setSelectedThreadId(null);
            }}
            icon={<FileText className="w-4 h-4" />}
            label={t('messages_rail_reviews')}
          />
          <MainTabBtn
            active={mainTab === 'support'}
            onClick={() => {
              setMainTab('support');
              setLeftView('list');
              setSelectedThreadId(null);
            }}
            icon={<LifeBuoy className="w-4 h-4" />}
            label={t('messages_rail_support')}
          />
            </>
          )}
        </div>

        {sendError && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">{sendError}</div>
        )}

        {mainTab === 'version' && (
          <VersionHistoryPanel ref={versionPanelRef} currentLanguage={currentLanguage} />
        )}

        {(mainTab === 'review' || mainTab === 'support') && (
          <div
            className={`grid grid-cols-1 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 ${
              composerVisible ? 'lg:grid-cols-2' : ''
            }`}
          >
            <div className="flex flex-col min-h-[320px] max-h-[70vh] lg:max-h-none overflow-hidden bg-white">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                <div className="font-semibold text-slate-800 text-base flex items-center justify-between gap-2">
                  <span>
                    {mainTab === 'support'
                      ? postByMe
                        ? t('staff_my_contributions_list')
                        : t('staff_posted_by_users')
                      : postByMe
                        ? t('staff_my_reviews_list')
                        : t('staff_community_reviews_list')}
                  </span>
                  {mainTab === 'support' && legacyMode && (
                    <button
                      type="button"
                      onClick={handlePostNew}
                      className="shrink-0 text-[11px] font-semibold text-[#c43c54] border border-[#c43c54] rounded px-2 py-1 bg-white hover:bg-rose-50"
                    >
                      {t('staff_leave_new_feedback')}
                    </button>
                  )}
                </div>
                {mainTab === 'support' && (
                  <>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {SUPPORT_CATS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectSupportCategory(c.id)}
                          aria-pressed={subPage === c.id}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            subPage === c.id
                              ? 'bg-[#c43c54] text-white ring-2 ring-[#c43c54]/25'
                              : 'bg-white border border-slate-300 text-black'
                          }`}
                        >
                          {t(c.labelKey)}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center mt-3 text-xs">
                      <select
                        value={filterLang}
                        onChange={(e) => setFilterLang(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white !text-black max-w-[140px]"
                      >
                        <option value="">{t('staff_all_languages')}</option>
                        {langOptions.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentOnly(false);
                          setCurrentPageOnly(false);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          !recentOnly && !currentPageOnly
                            ? 'bg-[#c43c54] text-white'
                            : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_all')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentOnly(true);
                          setCurrentPageOnly(false);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          recentOnly ? 'bg-[#c43c54] text-white' : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_recent')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPageOnly((v) => !v);
                          setRecentOnly(false);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          currentPageOnly
                            ? 'bg-[#c43c54] text-white'
                            : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_current_page')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostByMe((v) => !v);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          postByMe ? 'bg-[#c43c54] text-white' : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_post_by_me')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center mt-3 text-xs relative">
                      <span className="text-red-700 font-medium">{t('staff_search_label')}</span>
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') applySearch();
                        }}
                        className="border border-slate-800 rounded px-2 py-1 text-xs bg-white flex-1 min-w-[120px] max-w-[200px]"
                        placeholder={t('staff_search_placeholder')}
                      />
                      <button
                        type="button"
                        onClick={applySearch}
                        className="px-2 py-1 rounded font-medium bg-[#c43c54] text-white"
                      >
                        {t('staff_search_proceed')}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSectionFilterOpen((v) => !v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium bg-[#292929] text-white"
                        >
                          {t('staff_section_filter')}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {sectionFilterOpen && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded border border-slate-300 bg-white shadow-xl p-3 text-xs text-black">
                            <div className="font-semibold text-sm mb-2 border-b border-slate-200 pb-1">
                              {t('staff_section_filter')}
                            </div>
                            <label className="block mb-2">
                              <span className="text-slate-600">{t('staff_filter_from')}</span>
                              <input
                                type="date"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
                              />
                            </label>
                            <label className="block mb-2">
                              <span className="text-slate-600">{t('staff_filter_to')}</span>
                              <input
                                type="date"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
                              />
                            </label>
                            <label className="block mb-3">
                              <span className="text-slate-600">{t('staff_filter_status')}</span>
                              <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1 bg-white"
                              >
                                <option value="">{t('staff_filter_status_all_workflow')}</option>
                                {isSupportWorkflowCategory(subPage) ? (
                                  SUPPORT_WORKFLOW_STATUS_CODES.map((code) => (
                                    <option key={code} value={code}>
                                      {t(`staff_status_${code}`)}
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value="S">{t('staff_filter_status_started')}</option>
                                    <option value="C">{t('staff_filter_status_completed')}</option>
                                    <option value="D">{t('staff_filter_status_decline')}</option>
                                  </>
                                )}
                              </select>
                            </label>
                            <label className="flex items-center gap-2 mb-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterSeeInappropriates}
                                onChange={(e) => setFilterSeeInappropriates(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span className="text-slate-700">{t('staff_filter_see_inappropriates')}</span>
                            </label>
                            <button
                              type="button"
                              disabled={bulkDeleting || !filterFromDate || !filterToDate}
                              onClick={() => void bulkDeleteByDateRange()}
                              className="w-full mb-3 px-2 py-1.5 rounded bg-red-700 text-white text-[11px] font-semibold disabled:opacity-40"
                            >
                              {t('staff_bulk_delete_range')}
                            </button>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={applySectionFilter}
                                className="px-3 py-1 rounded bg-slate-600 text-white"
                              >
                                {t('staff_filter_apply')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSectionFilterOpen(false)}
                                className="px-3 py-1 rounded bg-slate-300 text-slate-800"
                              >
                                {t('staff_filter_exit')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <select
                        value={listSort}
                        onChange={(e) => {
                          setListSort(e.target.value as ThreadListSort | '');
                          setPage(1);
                        }}
                        aria-label={t('staff_sort_by')}
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white max-w-[140px]"
                      >
                        <option value="">{t('staff_sort_by')}</option>
                        {THREAD_SORT_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                      {isSupportWorkflowCategory(subPage) ? (
                        <select
                          value={appliedStatus}
                          onChange={(e) => {
                            const status = e.target.value;
                            setFilterStatus(status);
                            setAppliedStatus(status);
                            setPage(1);
                          }}
                          aria-label={t('staff_filter_status')}
                          title={t('staff_filter_status')}
                          className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold bg-white text-red-600 min-w-[130px]"
                        >
                          <option value="">{t('staff_filter_status_all_workflow')}</option>
                          {SUPPORT_WORKFLOW_STATUS_CODES.map((code) => (
                            <option key={code} value={code}>
                              {t(`staff_status_${code}`)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    <ListPageSelector
                      page={page}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  </>
                )}
                {mainTab === 'review' && (
                  <>
                    <div className="flex flex-wrap gap-2 items-center mt-3 text-xs">
                      <select
                        value={filterLang}
                        onChange={(e) => {
                          setFilterLang(e.target.value);
                          setPage(1);
                        }}
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white !text-black max-w-[140px]"
                      >
                        <option value="">{t('staff_all_languages')}</option>
                        {langOptions.map((l) => (
                          <option key={l.id} value={l.code}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentOnly(false);
                          setCurrentPageOnly(false);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          !recentOnly && !currentPageOnly
                            ? 'bg-[#c43c54] text-white'
                            : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_all')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentOnly(true);
                          setCurrentPageOnly(false);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          recentOnly ? 'bg-[#c43c54] text-white' : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_recent')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPageOnly((v) => !v);
                          setRecentOnly(false);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          currentPageOnly
                            ? 'bg-[#c43c54] text-white'
                            : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_current_page')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostByMe((v) => !v);
                          setPage(1);
                        }}
                        className={`px-2 py-1 rounded font-medium ${
                          postByMe ? 'bg-[#c43c54] text-white' : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {t('staff_post_by_me')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center mt-2 text-xs relative">
                      <span className="text-red-700 font-medium">{t('staff_search_label')}</span>
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') applySearch();
                        }}
                        className="border border-slate-800 rounded px-2 py-1 text-xs bg-white flex-1 min-w-[120px] max-w-[200px]"
                      />
                      <button
                        type="button"
                        onClick={applySearch}
                        className="px-2 py-1 rounded font-medium bg-[#c43c54] text-white"
                      >
                        {t('staff_search_proceed')}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSectionFilterOpen((v) => !v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium bg-[#292929] text-white"
                        >
                          {t('staff_section_filter')}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {sectionFilterOpen && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded border border-slate-300 bg-white shadow-xl p-3 text-xs text-black">
                            <div className="font-semibold text-sm mb-2 border-b border-slate-200 pb-1">
                              {t('staff_section_filter')}
                            </div>
                            <label className="block mb-2">
                              <span className="text-slate-600">{t('staff_filter_from')}</span>
                              <input
                                type="date"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
                              />
                            </label>
                            <label className="block mb-3">
                              <span className="text-slate-600">{t('staff_filter_to')}</span>
                              <input
                                type="date"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                                className="mt-0.5 w-full border border-slate-300 rounded px-2 py-1"
                              />
                            </label>
                            <label className="flex items-center gap-2 mb-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={filterSeeInappropriates}
                                onChange={(e) => setFilterSeeInappropriates(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span className="text-slate-700">{t('staff_filter_see_inappropriates')}</span>
                            </label>
                            <button
                              type="button"
                              disabled={bulkDeleting || !filterFromDate || !filterToDate}
                              onClick={() => void bulkDeleteByDateRange()}
                              className="w-full mb-3 px-2 py-1.5 rounded bg-red-700 text-white text-[11px] font-semibold disabled:opacity-40"
                            >
                              {t('staff_bulk_delete_range')}
                            </button>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={applySectionFilter}
                                className="px-3 py-1 rounded bg-slate-600 text-white"
                              >
                                {t('staff_filter_apply')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSectionFilterOpen(false)}
                                className="px-3 py-1 rounded bg-slate-300 text-slate-800"
                              >
                                {t('staff_filter_exit')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <select
                        value={listSort}
                        onChange={(e) => {
                          setListSort(e.target.value as ThreadListSort | '');
                          setPage(1);
                        }}
                        aria-label={t('staff_sort_by')}
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white max-w-[140px]"
                      >
                        <option value="">{t('staff_sort_by')}</option>
                        {THREAD_SORT_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <ListPageSelector
                      page={page}
                      totalPages={totalPages}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 text-sm">
                {loading && leftView === 'list' ? (
                  <p className="text-slate-500">{t('messages_panel_loading')}</p>
                ) : leftView === 'list' ? (
                  <ul className="space-y-3">
                    {(mainTab === 'support' ? supportItems : reviewItems).length === 0 ? (
                      <p className="text-slate-500 text-sm py-4 text-center">
                        {mainTab === 'support' ? t('staff_empty_feed') : t('staff_empty_reviews')}
                      </p>
                    ) : null}
                    {(mainTab === 'support' ? supportItems : reviewItems).map((item) => (
                      <li key={item.id}>
                        <div className="w-full flex gap-2 p-2 rounded border border-slate-200 hover:bg-amber-50/50">
                          <div className="flex flex-1 min-w-0 gap-2">
                            <button
                              type="button"
                              onClick={() => void openThread(item.id)}
                              className="flex flex-1 min-w-0 gap-2 text-left"
                            >
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
                                  {item.title}
                                </div>
                                {item.excerpt ? (
                                  <p className="text-slate-600 text-xs mt-1 line-clamp-2">{item.excerpt}</p>
                                ) : null}
                                <div className="text-[11px] text-slate-500 mt-1">
                                  {t('staff_posted_by_label')}{' '}
                                  <span className="font-medium text-slate-700">{item.author || '—'}</span> —{' '}
                                  {new Date(item.updatedAt).toLocaleString()}
                                </div>
                                {mainTab === 'support' && isSupportWorkflowCategory(subPage) ? (
                                  <div className="mt-1">
                                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      {t('staff_status_label')}:{' '}
                                      <span className="text-red-600">
                                        {t(`staff_status_${normalizeSupportWorkflowStatus(item.status)}`)}
                                      </span>
                                    </span>
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[11px] font-medium flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                  <span className="text-[#c43c54]">
                                    {t('staff_reply')}:{' '}
                                    <span className="text-slate-700">
                                      {replyCountFromMessageCount(item.messageCount)}
                                    </span>
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  {item.isInappropriate ? (
                                    <span className="text-slate-500">{t('staff_marked_inappropriate')}</span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={markingId === item.id}
                                      onClick={(e) => void markThreadInappropriate(item.id, e)}
                                      className="text-[#c43c54] hover:underline disabled:opacity-50"
                                    >
                                      {t('staff_mark_spam')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </button>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 items-end justify-start pt-0.5">
                            <button
                              type="button"
                              title={t('staff_delete')}
                              disabled={deletingId === item.id}
                              onClick={(e) => void deleteThread(item.id, e)}
                              className="p-1 rounded text-slate-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {mainTab === 'support' && (
                            <div className="flex flex-col gap-1.5 shrink-0 items-end justify-start pt-0.5">
                              <button
                                type="button"
                                title={t('staff_i_like')}
                                disabled={reactingId === item.id}
                                onClick={(e) => void toggleReaction(item.id, 'L', e)}
                                className={`inline-flex items-center gap-1 text-[11px] ${
                                  item.myReaction === 'L' ? 'text-[#c43c54]' : 'text-slate-600'
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span className="min-w-[1.25rem] text-center border border-slate-300 bg-white px-1 py-0.5 rounded-sm">
                                  {item.likeCount ?? 0}
                                </span>
                              </button>
                              <button
                                type="button"
                                title={t('staff_dislike')}
                                disabled={reactingId === item.id}
                                onClick={(e) => void toggleReaction(item.id, 'D', e)}
                                className={`inline-flex items-center gap-1 text-[11px] ${
                                  item.myReaction === 'D' ? 'text-[#c43c54]' : 'text-slate-600'
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                <span className="min-w-[1.25rem] text-center border border-slate-300 bg-white px-1 py-0.5 rounded-sm">
                                  {item.dislikeCount ?? 0}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                        {mainTab === 'support' && item.imageUrls && item.imageUrls.length > 0 ? (
                          <div className="px-2 pb-2 -mt-1 flex gap-1.5 flex-wrap border border-t-0 border-slate-200 rounded-b bg-white">
                            {item.imageUrls.slice(0, MAX_SUPPORT_IMAGES).map((src, imgIdx) => (
                              <button
                                key={src}
                                type="button"
                                title={t('staff_view_picture')}
                                onClick={(e) => openPictureLightbox(item.imageUrls || [], imgIdx, e)}
                                className="p-0 rounded border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-[#c43c54]/40 focus:outline-none focus:ring-2 focus:ring-[#c43c54]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt=""
                                  className="h-16 w-16 object-cover pointer-events-none"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={backToList}
                      className="inline-flex items-center gap-1 text-sm text-[#9b1d3d] font-medium"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('messages_back_to_list')}
                    </button>
                    {detailLoading ? (
                      <p className="text-slate-500">{t('messages_panel_loading')}</p>
                    ) : threadDetail ? (
                      <>
                        <div>
                          <h4 className="font-semibold text-slate-900">{threadDetail.thread.subject}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {threadDetail.thread.authorName} ·{' '}
                            {new Date(threadDetail.thread.updatedAt).toLocaleString()}
                          </p>
                          {mainTab === 'support' &&
                          isSupportWorkflowCategory(
                            threadDetail.thread.supportCategory || subPage,
                          ) ? (
                            <p className="mt-1.5">
                              <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                {t('staff_status_label')}:{' '}
                                <span className="text-red-600">
                                  {t(
                                    `staff_status_${normalizeSupportWorkflowStatus(threadDetail.thread.status)}`,
                                  )}
                                </span>
                              </span>
                            </p>
                          ) : null}
                          <ThreadPathOpenLink
                            pathStaff={threadDetail.thread.pathStaff}
                            realPath={threadDetail.thread.realPath}
                            pathLabel={t('staff_path_label')}
                            openLabel={t('staff_open_link')}
                          />
                          {threadDetail.thread.imageUrls && threadDetail.thread.imageUrls.length > 0 ? (
                            <div className="mt-2 flex gap-1.5 flex-wrap">
                              {threadDetail.thread.imageUrls.slice(0, MAX_SUPPORT_IMAGES).map((src, imgIdx) => (
                                <button
                                  key={src}
                                  type="button"
                                  title={t('staff_view_picture')}
                                  onClick={(e) =>
                                    openPictureLightbox(threadDetail.thread.imageUrls || [], imgIdx, e)
                                  }
                                  className="p-0 rounded border border-slate-200 overflow-hidden bg-slate-100 hover:ring-2 hover:ring-[#c43c54]/40 focus:outline-none focus:ring-2 focus:ring-[#c43c54]"
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
                              className={`rounded p-2 text-xs ${
                                m.isStaff
                                  ? '!bg-[#fff8cc] border border-[#eadb88]'
                                  : 'bg-slate-50 border border-slate-200'
                              }`}
                            >
                              <span
                                className={`font-semibold ${
                                  m.isStaff ? 'text-amber-900' : 'text-slate-600'
                                }`}
                              >
                                {m.isStaff
                                  ? t('messages_staff_badge')
                                  : m.sender?.name || m.sender?.username || '—'}
                              </span>
                              <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.body}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(m.createdAt).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t border-slate-200">
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={3}
                            placeholder={t('messages_reply_placeholder')}
                            className={`${fieldClass} text-xs py-1`}
                          />
                          <button
                            type="button"
                            disabled={replySending || !replyBody.trim()}
                            onClick={() => void submitReply()}
                            className="mt-2 w-full py-2 rounded bg-[#c43c54] text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {t('messages_send')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500">{t('messages_error_load_thread')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {composerVisible ? (
            <div
              ref={composerRef}
              className="staff-messages-composer flex flex-col min-h-[320px] overflow-y-auto bg-slate-50 p-4 !text-black"
            >
              <div className="relative flex justify-center mb-2">
                <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                  <Bug className="w-8 h-8 shrink-0 text-amber-800" strokeWidth={1.75} />
                </div>
                <button
                  type="button"
                  onClick={handlePostNew}
                  className="absolute right-0 top-0 shrink-0 text-xs flex items-center gap-1 text-amber-800 font-semibold border border-amber-300 rounded px-2 py-1 bg-amber-50 hover:bg-amber-100"
                >
                  <Lightbulb className="w-4 h-4" />
                  {t('staff_post_new')}
                </button>
              </div>
              <div className="text-center font-bold !text-black mb-3">{t('staff_send_to_movesbook')}</div>

              {mainTab === 'support' && (
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs !text-black mb-4">
                  {SUPPORT_CATS.map((c) => (
                    <label
                      key={c.id}
                      className={`inline-flex items-center gap-1 cursor-pointer font-medium ${
                        subPage === c.id ? 'text-[#c43c54]' : '!text-black'
                      }`}
                    >
                      <input
                        type="radio"
                        name="staff_composer_category"
                        checked={subPage === c.id}
                        onChange={() => selectSupportCategory(c.id)}
                        className="accent-[#c43c54]"
                      />
                      {t(c.labelKey)}
                    </label>
                  ))}
                </div>
              )}

              <label className="block text-xs font-medium !text-black mb-1">{t('staff_select_language')}</label>
              <select value={composerLang} onChange={(e) => setComposerLang(e.target.value)} className={`${fieldClass} mb-3`}>
                <option value="">{t('staff_select_language_placeholder')}</option>
                {langOptions.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-medium !text-black mb-1">{t('staff_object')}</label>
              <input
                type="text"
                value={composerObject}
                onChange={(e) => setComposerObject(e.target.value)}
                placeholder={t('staff_object')}
                className={`${fieldClass} mb-3`}
              />

              <label className="block text-xs font-medium !text-black mb-1">{t('staff_path_staff')}</label>
              <input
                type="text"
                value={composerPath}
                onChange={(e) => setComposerPath(e.target.value)}
                placeholder={t('staff_path_staff')}
                className={`${fieldClass} mb-2`}
              />
              <input type="hidden" value={composerRealPath} readOnly />

              {mainTab === 'support' && subPage === 'problem' && (
                <>
                  <label className="block text-xs font-medium !text-black mb-1">{t('staff_error_message')}</label>
                  <input
                    type="text"
                    value={composerErrorMsg}
                    onChange={(e) => setComposerErrorMsg(e.target.value)}
                    className={`${fieldClass} mb-3`}
                  />
                </>
              )}

              <label className="block text-xs font-medium !text-black mb-1">{t('staff_communicate_note')}</label>
              <textarea
                ref={composerBodyRef}
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
                rows={6}
                placeholder={t('staff_communicate_placeholder')}
                className={`${fieldClass} mb-3 [caret-color:#000]`}
              />

              {mainTab === 'support' ? (
                <div className="mb-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <button
                      type="button"
                      disabled={uploadingImages || composerImages.length >= MAX_SUPPORT_IMAGES}
                      onClick={() => composerFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-400 rounded bg-white text-black hover:bg-slate-100 disabled:opacity-50"
                    >
                      <ImagePlus className="w-4 h-4" />
                      {uploadingImages ? t('messages_panel_loading') : t('staff_add_pictures')}
                    </button>
                    <span className="text-[11px] text-slate-600">
                      {t('staff_add_pictures_hint')} ({composerImages.length}/{MAX_SUPPORT_IMAGES})
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
                            title={t('staff_remove_picture')}
                            aria-label={t('staff_remove_picture')}
                            onClick={() => removeComposerImage(img.id)}
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

              <button
                type="button"
                disabled={sending || uploadingImages || !composerBody.trim()}
                onClick={() => void submitComposer()}
                className="w-full py-2.5 rounded font-semibold text-white bg-[#c43c54] hover:bg-[#a83249] disabled:opacity-50"
              >
                {t('staff_post_button')}
              </button>
            </div>
            ) : null}
          </div>
        )}
      </div>

      {pictureLightbox ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('staff_view_picture')}
          onClick={() => setPictureLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            aria-label={t('messages_panel_close')}
            onClick={() => setPictureLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>

          {pictureLightbox.urls.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-3 sm:left-6 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label={t('staff_picture_prev')}
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
                aria-label={t('staff_picture_next')}
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

function MainTabBtn({
  active,
  onClick,
  onIconClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  onIconClick?: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'bg-white border-[#c43c54] text-slate-900'
          : 'border-transparent text-slate-600 hover:bg-slate-200/80'
      }`}
    >
      <span
        className={`inline-flex ${onIconClick ? 'cursor-pointer rounded p-0.5 hover:bg-slate-200/80' : ''}`}
        onClick={(e) => {
          if (!onIconClick) return;
          e.stopPropagation();
          onIconClick();
        }}
        onKeyDown={(e) => {
          if (!onIconClick) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            onIconClick();
          }
        }}
        role={onIconClick ? 'button' : undefined}
        tabIndex={onIconClick ? 0 : undefined}
        aria-label={onIconClick ? label : undefined}
      >
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
