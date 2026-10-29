'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface AutoDeleteConfig {
  olderThanDays: number;
  lastDeletion?: string;
  nextDeletion?: string;
}

interface NewsTopicSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: string[];
  onSave: (
    orderedTopics: string[],
    genreOrder?: Record<string, string[]>,
    hidden?: { topics: string[]; genres?: Record<string, string[]> }
  ) => void | Promise<void>;
  isSuperAdmin?: boolean;
  /** Called after OGPs are deleted so parent can refresh the list. */
  onAfterDeleteOgNews?: () => void | Promise<void>;
  /** API prefix for delete-by-topics. Defaults to `/api/news`; Music uses `/api/music`. */
  apiBase?: string;
  /** My Library of Exercises: library category for scoped delete-by-topics. */
  category?: string | null;
  /** Music: genres grouped by topic (from articles). Enables nested genre sorting. */
  topicGenres?: Record<string, string[]>;
  /** Music: saved genre order per topic from user settings. */
  savedGenreOrder?: Record<string, string[]>;
  /** Saved hidden topic names from user settings. */
  savedHiddenTopics?: string[];
  /** Music: saved hidden genre names per topic from user settings. */
  savedHiddenGenres?: Record<string, string[]>;
}

const TOPIC_ID_PREFIX = 'topic:';
const GENRE_ID_PREFIX = 'genre:';

/** Stable empty defaults so useEffect deps do not thrash when props are omitted (News path). */
const EMPTY_HIDDEN_TOPICS: string[] = [];
const EMPTY_HIDDEN_GENRES: Record<string, string[]> = {};
const EMPTY_GENRE_ORDER: Record<string, string[]> = {};

function topicSortId(name: string) {
  return `${TOPIC_ID_PREFIX}${encodeURIComponent(name)}`;
}

function genreSortId(topic: string, genre: string) {
  return `${GENRE_ID_PREFIX}${encodeURIComponent(topic)}:${encodeURIComponent(genre)}`;
}

function parseTopicSortId(id: string): string | null {
  if (!id.startsWith(TOPIC_ID_PREFIX)) return null;
  return decodeURIComponent(id.slice(TOPIC_ID_PREFIX.length));
}

function parseGenreSortId(id: string): { topic: string; genre: string } | null {
  if (!id.startsWith(GENRE_ID_PREFIX)) return null;
  const rest = id.slice(GENRE_ID_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep === -1) return null;
  return {
    topic: decodeURIComponent(rest.slice(0, sep)),
    genre: decodeURIComponent(rest.slice(sep + 1)),
  };
}

function mergeGenreOrder(
  topicGenres: Record<string, string[]>,
  saved: Record<string, string[]> | undefined
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [topic, genres] of Object.entries(topicGenres)) {
    const savedList = saved?.[topic] ?? [];
    const ordered = savedList.filter((g) => genres.includes(g));
    for (const g of genres) {
      if (!ordered.includes(g)) ordered.push(g);
    }
    result[topic] = ordered;
  }
  return result;
}

function HideCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className="ml-auto flex items-center gap-1.5 shrink-0 cursor-pointer select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
        aria-label={`Hide ${label}`}
      />
      <span className="text-sm font-medium text-red-600">hide</span>
    </label>
  );
}

function SortableGenreItem({
  topic,
  genre,
  hidden,
  onToggleHide,
}: {
  topic: string;
  genre: string;
  hidden: boolean;
  onToggleHide: () => void;
}) {
  const id = genreSortId(topic, genre);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-3 ml-8 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100"
    >
      <button
        type="button"
        className="flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder genre ${genre}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-700 flex-1 min-w-0">{genre}</span>
      <HideCheckbox checked={hidden} onChange={onToggleHide} label={genre} />
    </div>
  );
}

function SortableTopicItem({
  id,
  name,
  showCheckbox,
  checked,
  onToggle,
  genres,
  hidden,
  onToggleHide,
  hiddenGenres,
  onToggleGenreHide,
}: {
  id: string;
  name: string;
  showCheckbox?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  genres?: string[];
  hidden: boolean;
  onToggleHide: () => void;
  hiddenGenres: string[];
  onToggleGenreHide: (genre: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const genreIds = (genres ?? []).map((g) => genreSortId(name, g));

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-100 border border-gray-200 hover:bg-gray-200">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={!!checked}
            onChange={onToggle}
            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            aria-label={`Select topic ${name}`}
          />
        )}
        <button
          type="button"
          className="flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <span className="font-medium text-gray-800 flex-1 min-w-0">{name}</span>
        <HideCheckbox checked={hidden} onChange={onToggleHide} label={name} />
      </div>
      {genreIds.length > 0 && (
        <SortableContext items={genreIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {(genres ?? []).map((genre) => (
              <SortableGenreItem
                key={genreSortId(name, genre)}
                topic={name}
                genre={genre}
                hidden={hiddenGenres.includes(genre)}
                onToggleHide={() => onToggleGenreHide(genre)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function SortableTopicItemLegacy({
  id,
  name,
  showCheckbox,
  checked,
  onToggle,
  hidden,
  onToggleHide,
}: {
  id: string;
  name: string;
  showCheckbox?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  hidden: boolean;
  onToggleHide: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-100 border border-gray-200 hover:bg-gray-200"
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          aria-label={`Select topic ${name}`}
        />
      )}
      <button
        type="button"
        className="flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <span className="font-medium text-gray-800 flex-1 min-w-0">{name}</span>
      <HideCheckbox checked={hidden} onChange={onToggleHide} label={name} />
    </div>
  );
}

export default function NewsTopicSortModal({
  isOpen,
  onClose,
  topics,
  onSave,
  isSuperAdmin = false,
  onAfterDeleteOgNews,
  apiBase = '/api/news',
  category = null,
  topicGenres,
  savedGenreOrder,
  savedHiddenTopics = EMPTY_HIDDEN_TOPICS,
  savedHiddenGenres = EMPTY_HIDDEN_GENRES,
}: NewsTopicSortModalProps) {
  const musicMode = topicGenres != null;
  const [ordered, setOrdered] = useState<string[]>([]);
  const [genreOrder, setGenreOrder] = useState<Record<string, string[]>>(EMPTY_GENRE_ORDER);
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([]);
  const [hiddenGenres, setHiddenGenres] = useState<Record<string, string[]>>(EMPTY_HIDDEN_GENRES);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [deleteWarning, setDeleteWarning] = useState('');
  const [isDeletingOg, setIsDeletingOg] = useState(false);
  const [showAutoDeleteModal, setShowAutoDeleteModal] = useState(false);
  const [olderThanDays, setOlderThanDays] = useState('180');
  const [lastDeletion, setLastDeletion] = useState('');
  const [nextDeletion, setNextDeletion] = useState('');
  const [autoDeleteConfig, setAutoDeleteConfig] = useState<AutoDeleteConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize only when the modal opens so hide/drag local state is not wiped on re-render.
  useEffect(() => {
    if (!isOpen) return;
    setOrdered([...topics]);
    if (musicMode && topicGenres) {
      setGenreOrder(mergeGenreOrder(topicGenres, savedGenreOrder));
    } else {
      setGenreOrder(EMPTY_GENRE_ORDER);
    }
    setHiddenTopics([...savedHiddenTopics]);
    setHiddenGenres(
      Object.fromEntries(
        Object.entries(savedHiddenGenres).map(([topic, genres]) => [topic, [...genres]])
      )
    );
    setSelectedTopics([]);
    setDeleteWarning('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-seed only on open
  }, [isOpen]);

  // If topics arrive after the modal was already open (slow fetch), seed once when empty.
  useEffect(() => {
    if (!isOpen || ordered.length > 0 || topics.length === 0) return;
    setOrdered([...topics]);
    setHiddenTopics([...savedHiddenTopics]);
  }, [isOpen, ordered.length, topics, savedHiddenTopics]);

  const toggleTopicHidden = (topic: string) => {
    setHiddenTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleGenreHidden = (topic: string, genre: string) => {
    setHiddenGenres((prev) => {
      const current = prev[topic] ?? [];
      const next = current.includes(genre)
        ? current.filter((g) => g !== genre)
        : [...current, genre];
      const updated = { ...prev };
      if (next.length > 0) updated[topic] = next;
      else delete updated[topic];
      return updated;
    });
  };

  const toggleSelected = (topic: string) => {
    setDeleteWarning('');
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (musicMode && activeId.startsWith(GENRE_ID_PREFIX) && overId.startsWith(GENRE_ID_PREFIX)) {
      const from = parseGenreSortId(activeId);
      const to = parseGenreSortId(overId);
      if (!from || !to || from.topic !== to.topic) return;
      setGenreOrder((prev) => {
        const list = [...(prev[from.topic] ?? [])];
        const oldIndex = list.indexOf(from.genre);
        const newIndex = list.indexOf(to.genre);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return { ...prev, [from.topic]: arrayMove(list, oldIndex, newIndex) };
      });
      return;
    }

    // Prefer prefixed topic IDs (Music + News); fall back to raw id for safety.
    const activeTopic = parseTopicSortId(activeId) ?? activeId;
    const overTopic = parseTopicSortId(overId) ?? overId;
    if (!activeTopic || !overTopic) return;

    setOrdered((prev) => {
      const oldIndex = prev.indexOf(activeTopic);
      const newIndex = prev.indexOf(overTopic);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const parseYmd = (value: string): Date | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split('-').map((p) => Number(p));
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  };

  const addDays = (date: Date, days: number): Date => {
    const dt = new Date(date.getTime());
    dt.setDate(dt.getDate() + days);
    return dt;
  };

  const formatYmd = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const runAutomaticOgpDeletion = async (config: AutoDeleteConfig): Promise<boolean> => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Run only when nextDeletion is set and today >= nextDeletion
      if (config.nextDeletion) {
        const nextDate = parseYmd(config.nextDeletion);
        if (nextDate && today < nextDate) {
          // Not yet time to run – treat as success with no-op
          return true;
        }
      }

      const cutoffDate = addDays(today, -config.olderThanDays);
      const toDate = formatYmd(cutoffDate);

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const body: { topics: string[]; toDate: string; category?: string } = {
        topics,
        toDate,
      };
      if (category) body.category = category;

      const res = await fetch(`${apiBase}/ogp/delete-by-topics`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteWarning(data.error || 'Failed to run automatic OGP deletion.');
        return false;
      }

      // After successful run, update Last deletion to the Next deletion date (no longer user-editable)
      if (config.nextDeletion) {
        setLastDeletion(config.nextDeletion);
      }
      await onAfterDeleteOgNews?.();
      return true;
    } catch {
      setDeleteWarning('Failed to run automatic OGP deletion.');
      return false;
    }
  };

  const handleSave = async () => {
    setDeleteWarning('');
    setIsSaving(true);
    try {
      await onSave(ordered, musicMode ? genreOrder : undefined, {
        topics: hiddenTopics,
        genres: musicMode ? hiddenGenres : undefined,
      });
      let autoOk = true;
      if (isSuperAdmin && autoDeleteConfig) {
        autoOk = await runAutomaticOgpDeletion(autoDeleteConfig);
      }
      if (autoOk) {
        onClose();
      }
    } catch {
      setDeleteWarning('Failed to save topic order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOgNewsSelected = async () => {
    setDeleteWarning('');
    if (selectedTopics.length === 0) {
      setDeleteWarning('Please select at least one topic.');
      return;
    }
    setIsDeletingOg(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body: { topics: string[]; fromDate?: string; toDate?: string; category?: string } = {
        topics: selectedTopics,
      };
      if (fromDate.trim()) body.fromDate = fromDate.trim();
      if (toDate.trim()) body.toDate = toDate.trim();
      if (category) body.category = category;
      const res = await fetch(`${apiBase}/ogp/delete-by-topics`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteWarning(data.error || 'Failed to delete OGPs.');
        return;
      }
      setSelectedTopics([]);
      setFromDate('');
      setToDate('');
      await onAfterDeleteOgNews?.();
    } catch {
      setDeleteWarning('Failed to delete OGPs.');
    } finally {
      setIsDeletingOg(false);
    }
  };

  const handleApplyAutoDelete = () => {
    const older = Number(olderThanDays);

    if (!Number.isFinite(older) || older <= 0) {
      setDeleteWarning('Please enter valid automatic deletion values.');
      return;
    }

    setAutoDeleteConfig({
      olderThanDays: Math.round(older),
      lastDeletion: lastDeletion.trim() || undefined,
      nextDeletion: nextDeletion.trim() || undefined,
    });

    setShowAutoDeleteModal(false);
  };

  const sortableTopicIds = ordered.map((name) => topicSortId(name));

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-sort-modal-title"
    >
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="topic-sort-modal-title"
          className="bg-red-600 text-white px-4 py-3 text-center font-semibold text-lg"
        >
          Your favorite sorting
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableTopicIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {ordered.map((name) =>
                  musicMode ? (
                    <SortableTopicItem
                      key={topicSortId(name)}
                      id={topicSortId(name)}
                      name={name}
                      showCheckbox={isSuperAdmin}
                      checked={isSuperAdmin ? selectedTopics.includes(name) : undefined}
                      onToggle={isSuperAdmin ? () => toggleSelected(name) : undefined}
                      genres={genreOrder[name] ?? []}
                      hidden={hiddenTopics.includes(name)}
                      onToggleHide={() => toggleTopicHidden(name)}
                      hiddenGenres={hiddenGenres[name] ?? []}
                      onToggleGenreHide={(genre) => toggleGenreHidden(name, genre)}
                    />
                  ) : (
                    <SortableTopicItemLegacy
                      key={topicSortId(name)}
                      id={topicSortId(name)}
                      name={name}
                      showCheckbox={isSuperAdmin}
                      checked={isSuperAdmin ? selectedTopics.includes(name) : undefined}
                      onToggle={isSuperAdmin ? () => toggleSelected(name) : undefined}
                      hidden={hiddenTopics.includes(name)}
                      onToggleHide={() => toggleTopicHidden(name)}
                    />
                  )
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        {isSuperAdmin ? (
          <div className="border-t border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
              <button
                type="button"
                className="h-9 w-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50"
                aria-label="Settings"
                onClick={() => setShowAutoDeleteModal(true)}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-end justify-center gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  From date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  To date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <button
                type="button"
                onClick={handleDeleteOgNewsSelected}
                disabled={isDeletingOg}
                className="px-2 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingOg
                  ? 'Deleting…'
                  : apiBase === '/api/music'
                    ? 'Delete OG Music selected'
                    : 'Delete OG News selected'}
              </button>
            </div>
            {deleteWarning && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="alert">
                {deleteWarning}
              </p>
            )}
          </div>
        ) : (
          <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Save
            </button>
          </div>
        )}

        {isSuperAdmin && showAutoDeleteModal && (
          <div
            className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auto-delete-modal-title"
            onClick={() => setShowAutoDeleteModal(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="auto-delete-modal-title"
                className="text-base font-semibold text-red-600 mb-3 text-center"
              >
                Automatic deletion of OGPs
              </h3>
              <p className="mb-4 text-gray-800">
                Remove all the OGPs posted from more than{' '}
                <select
                  value={olderThanDays}
                  onChange={(e) => setOlderThanDays(e.target.value)}
                  className="mx-1 w-24 px-1 py-0.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="30">30</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="180">180</option>
                  <option value="360">360</option>
                </select>{' '}
                days.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-28 text-gray-700">Last deletion</span>
                  <input
                    type="date"
                    value={lastDeletion}
                    readOnly
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm min-w-0 bg-gray-100 text-gray-600"
                    aria-label="Last deletion (auto-updated, read-only)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-28 text-gray-700">Next deletion</span>
                  <input
                    type="date"
                    value={nextDeletion}
                    onChange={(e) => setNextDeletion(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm min-w-0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                  onClick={handleApplyAutoDelete}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowAutoDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
