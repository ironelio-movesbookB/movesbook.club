'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Loader2, Menu } from 'lucide-react';
import { moodMusicEmbedUrl } from '@/lib/music/moodMusicEmbed';

export type MoodMusicItem = {
  id: number;
  title: string;
  image_url: string;
  playlistid: string;
  update_order: number;
};

type MoodMusicPanelProps = {
  onClose?: () => void;
};

/** YouTube hqdefault thumb from a video id (not a playlist id). */
function youtubeThumbFromId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (/^(PL|UU|LL|FL|OL|RD)/i.test(trimmed) || trimmed.length > 20) return null;
  return `https://i.ytimg.com/vi/${encodeURIComponent(trimmed)}/hqdefault.jpg`;
}

function SortableMoodRow({
  item,
  onOpen,
}: {
  item: MoodMusicItem;
  onOpen: (item: MoodMusicItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.id),
  });
  const [imgSrc, setImgSrc] = useState(
    () => item.image_url || youtubeThumbFromId(item.playlistid) || ''
  );

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-4 w-full max-w-[72%]" id={String(item.id)}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full text-left"
        aria-label={`Play ${item.title}`}
      >
        <div className="flex items-center gap-2 border border-black bg-[#f5eecd] px-2.5 py-2.5">
          <span
            className="inline-flex shrink-0 cursor-grab text-gray-800 active:cursor-grabbing"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            role="button"
            tabIndex={0}
          >
            <Menu className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
          <span className="font-[Arial,Helvetica,sans-serif] text-sm text-black">{item.title}</span>
        </div>
        <div className="mt-0.5 flex w-full justify-center">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={item.title}
              width={560}
              height={315}
              className="h-auto w-full max-w-[560px] object-cover"
              onError={() => {
                const fallback = youtubeThumbFromId(item.playlistid);
                if (fallback && fallback !== imgSrc) {
                  setImgSrc(fallback);
                  return;
                }
                setImgSrc('');
              }}
            />
          ) : (
            <div
              className="flex h-[315px] w-full max-w-[560px] items-center justify-center bg-black/40 text-sm text-white/70"
              aria-hidden
            >
              No preview
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

/**
 * Legacy PHP clubs/mood_music → clubs/show_video flow:
 * list of cream bars + thumbs; click opens full-width YouTube playlist embed.
 */
export default function MoodMusicPanel({ onClose }: MoodMusicPanelProps) {
  const [items, setItems] = useState<MoodMusicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  /** Selected row → inline show_video player (legacy click behavior). */
  const [playing, setPlaying] = useState<MoodMusicItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const ids = useMemo(() => items.map((item) => String(item.id)), [items]);

  const embedSrc = useMemo(
    () => (playing ? moodMusicEmbedUrl(playing.playlistid) : ''),
    [playing]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/music/mood', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to load mood music');
      }
      const data = (await res.json()) as { items?: MoodMusicItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      setError('Could not load Mood Music.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(
    async (next: MoodMusicItem[]) => {
      setSavingOrder(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch('/api/music/mood', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order: next.map((item) => item.id) }),
        });
        if (!res.ok) {
          throw new Error('Failed to save order');
        }
      } catch (e) {
        console.error(e);
        void load();
      } finally {
        setSavingOrder(false);
      }
    },
    [load]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setItems((prev) => {
        const oldIndex = prev.findIndex((item) => String(item.id) === String(active.id));
        const newIndex = prev.findIndex((item) => String(item.id) === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        void persistOrder(next);
        return next;
      });
    },
    [persistOrder]
  );

  // —— Player view (legacy clubs/show_video) ——
  if (playing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-[#1F2C4C] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying(null)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h2 className="truncate font-[Arial,Helvetica,sans-serif] text-lg font-semibold text-white">
              {playing.title}
            </h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded px-2 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              Close
            </button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-black">
          {embedSrc ? (
            <iframe
              title={playing.title}
              width="100%"
              height="550"
              src={embedSrc}
              className="min-h-[550px] w-full flex-1 border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <p className="p-8 text-center text-sm text-white/70">Missing video link.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-[#1F2C4C] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-[Arial,Helvetica,sans-serif] text-lg font-semibold text-white">
          Mood Music
        </h2>
        <div className="flex items-center gap-3">
          {savingOrder ? (
            <span className="inline-flex items-center gap-1 text-xs text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving order…
            </span>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/80">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-red-200">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/70">No mood music entries yet.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col items-center">
                {items.map((item) => (
                  <SortableMoodRow key={item.id} item={item} onOpen={setPlaying} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
