'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Dumbbell, ExternalLink, Globe2, Loader2, X } from 'lucide-react';
import NewsFeedMetaLine from '@/components/news/NewsFeedMetaLine';
import SharedNewsItemPreviewModal, {
  previewPayloadFromFeedItem,
  type SharedNewsPreviewPayload,
} from '@/components/news/SharedNewsItemPreviewModal';
import type { ExerciseOgpLibraryItem } from '@/app/api/exercises/ogp/library/route';

export type ClubExerciseOgpLibraryMode = 'global-library' | 'mine';

type ClubExerciseOgpLibraryPanelProps = {
  mode: ClubExerciseOgpLibraryMode;
  title?: string;
  onClose?: () => void;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function itemTitle(item: ExerciseOgpLibraryItem) {
  return (
    item.title?.trim() ||
    item.customDescription?.trim() ||
    item.description?.trim() ||
    item.url ||
    'Untitled'
  );
}

/**
 * Club → Libraries of exercises: Global News–style list for
 * - My Global library of exercises (Global + own Shared)
 * - My library of OGP Exercises (own creations)
 */
export default function ClubExerciseOgpLibraryPanel({
  mode,
  title,
  onClose,
}: ClubExerciseOgpLibraryPanelProps) {
  const resolvedTitle =
    title ??
    (mode === 'global-library'
      ? 'My Global library of exercises'
      : 'My library of OGP Exercises');
  const subtitle =
    mode === 'global-library'
      ? 'Global exercises from Movesbook plus exercises you shared, sorted by date'
      : 'OGP exercises you created, sorted by date';
  const HeaderIcon = mode === 'global-library' ? Globe2 : BookMarked;

  const [items, setItems] = useState<ExerciseOgpLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SharedNewsPreviewPayload | null>(null);

  const loadItems = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/exercises/ogp/library?scope=${encodeURIComponent(mode)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      if (!res.ok) throw new Error('Failed to load exercise library');
      const data = (await res.json()) as { items?: ExerciseOgpLibraryItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError('Could not load exercise library.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const openPreview = useCallback((item: ExerciseOgpLibraryItem) => {
    setPreview(
      previewPayloadFromFeedItem({
        kind: 'ogp',
        id: item.id,
        title: item.title,
        date: item.savedAt,
        image: item.image,
        topic: item.topic,
        creatorUsername: item.creatorUsername,
        url: item.url,
        description: item.description,
        customDescription: item.customDescription,
      })
    );
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <HeaderIcon className="h-5 w-5 shrink-0 text-teal-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{resolvedTitle}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <Dumbbell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-600">No OGP exercises yet</p>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'global-library'
                ? 'Global exercises from Movesbook and exercises you share will appear here.'
                : 'OGP exercises you create will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="mx-auto max-w-5xl space-y-3">
            {items.map((item) => {
              const titleText = itemTitle(item);
              const modeLabel =
                item.inGlobalNews
                  ? 'Global'
                  : item.sharedInMovesbookLibrary
                    ? 'Shared'
                    : item.createdByCurrentUser
                      ? 'Mine'
                      : null;

              return (
                <li key={item.id}>
                  <div className="relative flex w-full gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                    <button
                      type="button"
                      onClick={() => openPreview(item)}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`Preview ${titleText}`}
                    />

                    <div className="pointer-events-none relative z-10 h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <Dumbbell className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-teal-800">
                          OGP Exercise
                        </span>
                        {modeLabel ? (
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                              modeLabel === 'Global'
                                ? 'bg-amber-100 text-amber-800'
                                : modeLabel === 'Shared'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {modeLabel}
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {formatDate(item.savedAt)}
                        </span>
                      </div>

                      <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
                        {titleText}
                      </h3>

                      <NewsFeedMetaLine
                        kind="ogp"
                        sector={item.topic}
                        postedBy={item.creatorUsername}
                      />

                      <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openPreview(item)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
                        >
                          Open link
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SharedNewsItemPreviewModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
