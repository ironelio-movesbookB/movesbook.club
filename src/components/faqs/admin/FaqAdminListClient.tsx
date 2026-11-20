'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, Link2, Menu, MoreVertical, Trash2, X } from 'lucide-react';
import { useFaqAdminGate } from '@/components/faqs/admin/useFaqAdminGate';
import FaqAdminPreview from '@/components/faqs/admin/FaqAdminPreview';
import {
  FaqChapterModal,
  FaqConfirmModal,
  FaqEditModal,
  FaqNoticeModal,
  FaqPagesModal,
} from '@/components/faqs/admin/FaqAdminModals';
import { faqAdminFetch, faqIconSrc } from '@/lib/faqs/faqClient';
import {
  FAQ_LANGUAGES,
  FAQ_SECTIONS,
  FAQ_SUBSECTIONS,
  faqSectionLabel,
  faqSubsectionLabel,
  type FaqAdminRowDto,
  type FaqLanguageCode,
  type FaqListEntryDto,
  type FaqSectionKey,
  type FaqSubsectionKey,
} from '@/lib/faqs/faqConstants';

type Sort = 'manual' | 'date' | 'code' | 'title';

const PAGE_SIZES = [10, 25, 50, 100];
const COLS = 11;

const blackBtn = 'rounded bg-black px-4 py-2 text-[15px] text-white hover:bg-gray-800 disabled:opacity-50';
const mintBtn = 'rounded bg-[#e3f4ef] px-2 py-1.5 text-[13px] text-gray-800 hover:bg-[#cfece3]';
const filterBtn = 'rounded border-2 border-black bg-white px-4 py-0.5 text-sm font-bold text-black';

function RadioChip({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span className={`${filterBtn} ${checked ? 'bg-gray-200' : ''}`}>{label}</span>
    </label>
  );
}

export default function FaqAdminListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ready = useFaqAdminGate();

  // Filters (Sections / Subsections apply on "Apply Filters"; language applies at once).
  const [sectionDraft, setSectionDraft] = useState<FaqSectionKey | null>(null);
  const [subDraft, setSubDraft] = useState<FaqSubsectionKey | null>(null);
  const [section, setSection] = useState<FaqSectionKey | null>(null);
  const [subsection, setSubsection] = useState<FaqSubsectionKey | null>(null);
  const [langFilter, setLangFilter] = useState<FaqLanguageCode | null>(null);
  const [sort, setSort] = useState<Sort>('manual');
  const [searchField, setSearchField] = useState<'code' | 'title'>('code');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [titleLang, setTitleLang] = useState<FaqLanguageCode | ''>('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<FaqListEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<FaqAdminRowDto | null>(null);
  const [pagesFor, setPagesFor] = useState<string | null>(null);
  const [chapterBefore, setChapterBefore] = useState<string | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ text: string; run: () => Promise<void> } | null>(null);

  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ sort, searchField });
      if (section) params.set('section', section);
      if (subsection) params.set('subsection', subsection);
      if (langFilter) params.set('lang', langFilter);
      if (search) params.set('search', search);
      const d = await faqAdminFetch<{ entries: FaqListEntryDto[] }>(`/api/admin/faqs?${params}`);
      if (seq !== requestSeq.current) return;
      setEntries(d.entries);
      const ids = new Set(d.entries.flatMap((e) => (e.kind === 'faq' ? [e.faq.id] : [])));
      setSelected((s) => new Set([...s].filter((id) => ids.has(id))));
    } catch (e) {
      if (seq === requestSeq.current) setError(e instanceof Error ? e.message : 'Unable to load FAQs');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [sort, searchField, section, subsection, langFilter, search]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => setPage(1), [sort, section, subsection, langFilter, search, pageSize]);

  // Redirect from "Create a New FAQ" → success popup (PHP behaviour).
  useEffect(() => {
    if (searchParams?.get('added') === '1') {
      setNotice('The FAQ added successfully.');
      router.replace(pathname ?? '/admin/faqs');
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = useMemo(
    () => entries.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [entries, currentPage, pageSize],
  );
  const pageFaqIds = pageEntries.flatMap((e) => (e.kind === 'faq' ? [e.faq.id] : []));
  const manual = sort === 'manual';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!manual || !over || active.id === over.id) return;
    const from = pageEntries.findIndex((e) => e.itemId === active.id);
    const to = pageEntries.findIndex((e) => e.itemId === over.id);
    if (from < 0 || to < 0) return;
    const moved = arrayMove(pageEntries, from, to);
    const start = (currentPage - 1) * pageSize;
    setEntries((all) => [...all.slice(0, start), ...moved, ...all.slice(start + moved.length)]);
    try {
      await faqAdminFetch('/api/admin/faqs/order', { method: 'PUT', json: { itemIds: moved.map((e) => e.itemId) } });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to save the order');
      void load();
    }
  };

  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const togglePreview = (id: string) =>
    setPreviews((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const askDelete = (ids: string[]) => {
    if (!ids.length) {
      setNotice('Select the FAQs to delete.');
      return;
    }
    setConfirm({
      text: ids.length === 1 ? 'Delete the selected FAQ?' : `Delete the ${ids.length} selected FAQs?`,
      run: async () => {
        await faqAdminFetch('/api/admin/faqs', { method: 'DELETE', json: { ids } });
        setConfirm(null);
        setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
        void load();
      },
    });
  };

  const addChapter = () => {
    if (!manual) {
      setNotice('Press "Return to set" first: chapters are part of the order set by the operator.');
      return;
    }
    const firstSelected = entries.find((e) => e.kind === 'faq' && selected.has(e.faq.id));
    setChapterBefore(firstSelected && firstSelected.kind === 'faq' ? firstSelected.faq.id : null);
  };

  const removeChapter = async (id: string) => {
    try {
      await faqAdminFetch(`/api/admin/faqs/chapters/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setEntries((all) => all.filter((e) => e.itemId !== id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to remove the chapter');
    }
  };

  if (!ready) return null;

  const allOnPageSelected = pageFaqIds.length > 0 && pageFaqIds.every((id) => selected.has(id));

  return (
    <div className="p-4">
      <h1 className="mb-3 bg-[#d9d9d9] px-5 py-4 text-2xl text-gray-800">FAQ LIST</h1>

      {/* Sections / Subsections filter */}
      <div className="mx-auto max-w-5xl border-2 border-gray-800 bg-[#e8f6f3] px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-bold">Sections</span>
          <RadioChip name="faq-sec" label="All" checked={sectionDraft === null} onSelect={() => setSectionDraft(null)} />
          {FAQ_SECTIONS.map((s) => (
            <RadioChip
              key={s.key}
              name="faq-sec"
              label={s.label}
              checked={sectionDraft === s.key}
              onSelect={() => setSectionDraft(s.key)}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-bold">Subsections</span>
          <RadioChip name="faq-sub" label="All" checked={subDraft === null} onSelect={() => setSubDraft(null)} />
          {FAQ_SUBSECTIONS.map((s) => (
            <RadioChip
              key={s.key}
              name="faq-sub"
              label={s.key === 'workouts' ? 'Workout' : s.label}
              checked={subDraft === s.key}
              onSelect={() => setSubDraft(s.key)}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              setSection(sectionDraft);
              setSubsection(subDraft);
            }}
            className="rounded bg-[#e53935] px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setSectionDraft(null);
              setSubDraft(null);
              setSection(null);
              setSubsection(null);
              setLangFilter(null);
              setSearch('');
              setSearchText('');
            }}
            className="rounded bg-[#e53935] px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Language filter: only FAQs with content in that language */}
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-3 border-2 border-gray-800 bg-[#ffffe0] px-4 py-5">
        {FAQ_LANGUAGES.map((l) => (
          <label key={l.code} className="inline-flex cursor-pointer items-center gap-1.5" title={l.name}>
            <input
              type="radio"
              name="faq-lang"
              checked={langFilter === l.code}
              onChange={() => setLangFilter(l.code)}
              onClick={() => langFilter === l.code && setLangFilter(null)}
            />
            <span className={`${filterBtn} ${langFilter === l.code ? 'bg-gray-200' : ''}`}>{l.label}</span>
          </label>
        ))}
      </div>

      {/* Sorting */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
        <button type="button" className={blackBtn} onClick={() => setSort('date')}>Sort for date</button>
        <button type="button" className={blackBtn} onClick={() => setSort('code')}>Sort for code</button>
        <button type="button" className={blackBtn} onClick={() => setSort('title')}>Sort for title</button>
        <span
          className={`h-8 w-8 rounded-full ${manual ? 'bg-green-700' : 'bg-red-600'}`}
          title={manual ? 'Order set by the operator (drag enabled)' : 'Sorted: dragging disabled'}
          aria-label={manual ? 'Manual order' : 'Sorted'}
        />
        <button type="button" className={blackBtn} onClick={() => setSort('manual')}>Return to set</button>
        <button type="button" className={blackBtn} onClick={() => askDelete([...selected])}>Delete</button>
      </div>

      {/* Search + actions + pagination */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[15px]">Search</span>
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value as 'code' | 'title')}
          aria-label="Search field"
          className="rounded-sm border border-gray-500 px-2 py-1.5 text-[15px] text-gray-600"
        >
          <option value="code">Search by Code</option>
          <option value="title">Search by Title</option>
        </select>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(searchText.trim())}
          placeholder="Enter search text"
          className="w-72 rounded-sm border border-gray-300 px-2 py-1.5 text-[15px]"
        />
        <button
          type="button"
          onClick={() => setSearch(searchText.trim())}
          className="rounded bg-[#bdbdbd] px-5 py-1.5 text-[15px] text-gray-800 hover:bg-gray-400"
        >
          Apply
        </button>
        <Link href="/admin/faqs/new" className={mintBtn}>Create New FAQ</Link>
        <button type="button" onClick={addChapter} className={mintBtn}>Add Chapter</button>
        <Link href="/admin/faqs/settings" className={mintBtn}>Settings</Link>
        <Link href="/admin/dashboard" className={mintBtn}>Dashboard</Link>
        <select
          value={titleLang}
          onChange={(e) => setTitleLang(e.target.value as FaqLanguageCode | '')}
          aria-label="Language of the titles"
          className={`${mintBtn} border-0`}
        >
          <option value="">Select Language</option>
          {FAQ_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="rounded-sm border border-gray-400 px-1 py-1 text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 disabled:text-gray-400"
          >
            Prev
          </button>
          <span className="rounded bg-gray-300 px-2 py-1 text-sm">{currentPage}</span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
            className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse border border-gray-200 bg-white text-[15px] text-gray-800">
          <thead>
            <tr className="text-center">
              <th className="border border-gray-200 px-2 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allOnPageSelected}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      pageFaqIds.forEach((id) => (allOnPageSelected ? n.delete(id) : n.add(id)));
                      return n;
                    })
                  }
                />
              </th>
              <th className="border border-gray-200 px-2 py-2 font-normal">Move</th>
              <th className="border border-gray-200 px-2 py-2">Code</th>
              <th className="border border-gray-200 px-2 py-2">Section</th>
              <th className="border border-gray-200 px-2 py-2">Subsection</th>
              <th className="border border-gray-200 px-2 py-2">Icon</th>
              <th className="border border-gray-200 px-2 py-2">Doc Type</th>
              <th className="border border-gray-200 px-2 py-2">Title</th>
              <th className="border border-gray-200 px-2 py-2">Sub Title</th>
              <th className="border border-gray-200 px-2 py-2">Date</th>
              <th className="border border-gray-200 px-2 py-2">Options</th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pageEntries.map((e) => e.itemId)} strategy={verticalListSortingStrategy}>
              <tbody>
                {loading && !entries.length ? (
                  <tr>
                    <td colSpan={COLS} className="px-3 py-6 text-center text-gray-500">Loading…</td>
                  </tr>
                ) : null}
                {!loading && !entries.length ? (
                  <tr>
                    <td colSpan={COLS} className="px-3 py-6 text-center text-gray-500">No FAQs found.</td>
                  </tr>
                ) : null}
                {pageEntries.map((entry) =>
                  entry.kind === 'chapter' ? (
                    <ChapterRow
                      key={entry.itemId}
                      entry={entry}
                      draggable={manual}
                      onRemove={() =>
                        setConfirm({
                          text: `Remove the chapter "${entry.chapter.title}"?`,
                          run: async () => {
                            await removeChapter(entry.chapter.id);
                            setConfirm(null);
                          },
                        })
                      }
                    />
                  ) : (
                    <Fragment key={entry.itemId}>
                      <FaqRow
                        itemId={entry.itemId}
                        faq={entry.faq}
                        draggable={manual}
                        titleLang={titleLang}
                        checked={selected.has(entry.faq.id)}
                        previewOpen={previews.has(entry.faq.id)}
                        menuOpen={menuFor === entry.faq.id}
                        onCheck={() => toggleSelected(entry.faq.id)}
                        onPreview={() => togglePreview(entry.faq.id)}
                        onDelete={() => askDelete([entry.faq.id])}
                        onPages={() => setPagesFor(entry.faq.id)}
                        onMenu={() => setMenuFor((m) => (m === entry.faq.id ? null : entry.faq.id))}
                        onEdit={() => {
                          setMenuFor(null);
                          setEditRow(entry.faq);
                        }}
                      />
                      {previews.has(entry.faq.id) ? (
                        <tr>
                          <td colSpan={COLS} className="border border-gray-200 p-0">
                            <FaqAdminPreview faqId={entry.faq.id} initialLang={titleLang || langFilter || 'en'} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ),
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {notice ? <FaqNoticeModal text={notice} onClose={() => setNotice(null)} /> : null}
      {confirm ? <FaqConfirmModal text={confirm.text} onConfirm={confirm.run} onClose={() => setConfirm(null)} /> : null}
      {editRow ? (
        <FaqEditModal
          faq={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            void load();
          }}
        />
      ) : null}
      {pagesFor ? <FaqPagesModal faqId={pagesFor} onClose={() => setPagesFor(null)} /> : null}
      {chapterBefore !== undefined ? (
        <FaqChapterModal
          beforeFaqId={chapterBefore}
          onClose={() => setChapterBefore(undefined)}
          onCreated={() => {
            setChapterBefore(undefined);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function useRowSortable(id: string, draggable: boolean) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable,
  });
  return {
    setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      position: 'relative' as const,
      zIndex: isDragging ? 10 : undefined,
      opacity: isDragging ? 0.85 : undefined,
    },
    handleProps: draggable ? { ...attributes, ...listeners } : {},
  };
}

function DragHandle({ draggable, handleProps }: { draggable: boolean; handleProps: Record<string, unknown> }) {
  return (
    <button
      type="button"
      aria-label={draggable ? 'Drag to move' : 'Dragging disabled while a sort is applied'}
      title={draggable ? 'Drag to move' : 'Press "Return to set" to drag'}
      className={`touch-none ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-40'}`}
      {...handleProps}
    >
      <Menu className="h-8 w-8" strokeWidth={3} />
    </button>
  );
}

function ChapterRow({
  entry,
  draggable,
  onRemove,
}: {
  entry: Extract<FaqListEntryDto, { kind: 'chapter' }>;
  draggable: boolean;
  onRemove: () => void;
}) {
  const { setNodeRef, style, handleProps } = useRowSortable(entry.itemId, draggable);
  return (
    <tr ref={setNodeRef} style={{ ...style, backgroundColor: entry.chapter.bg, color: entry.chapter.fg }}>
      <td className="px-2 py-4" />
      <td className="px-2 py-4 text-center">
        <DragHandle draggable={draggable} handleProps={handleProps} />
      </td>
      <td colSpan={COLS - 3} className="px-2 py-4 text-center text-lg">{entry.chapter.title}</td>
      <td className="px-2 py-4 text-right">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove chapter"
          className="rounded bg-white px-4 py-2 text-black shadow hover:bg-gray-100"
        >
          <X className="h-4 w-4" strokeWidth={3} />
        </button>
      </td>
    </tr>
  );
}

function FaqRow({
  itemId,
  faq,
  draggable,
  titleLang,
  checked,
  previewOpen,
  menuOpen,
  onCheck,
  onPreview,
  onDelete,
  onPages,
  onMenu,
  onEdit,
}: {
  itemId: string;
  faq: FaqAdminRowDto;
  draggable: boolean;
  titleLang: FaqLanguageCode | '';
  checked: boolean;
  previewOpen: boolean;
  menuOpen: boolean;
  onCheck: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onPages: () => void;
  onMenu: () => void;
  onEdit: () => void;
}) {
  const { setNodeRef, style, handleProps } = useRowSortable(itemId, draggable);
  const translated = titleLang ? faq.titles[titleLang] : undefined;
  const title = translated?.title || faq.title || '(no title)';
  const subtitle = translated ? translated.subtitle : faq.subtitle;
  const icon = faqIconSrc(faq.iconPath);
  const cell = 'border border-gray-200 px-2 py-2 text-center align-middle';

  return (
    <tr ref={setNodeRef} style={style} className="bg-[#f7f7f7] even:bg-white">
      <td className={`${cell} text-center`}>
        <input type="checkbox" aria-label={`Select ${faq.code}`} checked={checked} onChange={onCheck} />
      </td>
      <td className={`${cell} text-center`}>
        <DragHandle draggable={draggable} handleProps={handleProps} />
      </td>
      <td className={cell}>{faq.code}</td>
      <td className={cell}>
        {faq.pairs.map((p) => (
          <div key={`${p.section}:${p.subsection}`}>{faqSectionLabel(p.section)}</div>
        ))}
      </td>
      <td className={cell}>
        {faq.pairs.map((p) => (
          <div key={`${p.section}:${p.subsection}`}>{faqSubsectionLabel(p.subsection)}</div>
        ))}
      </td>
      <td className={cell}>
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="mx-auto block h-[50px] w-[50px] object-cover" />
        ) : null}
      </td>
      <td className={cell}>
        {faq.docType === 'link' ? 'Link' : 'Document'}{' '}
        {faq.url ? (
          <a
            href={faq.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${faq.url}`}
            aria-label="Open the linked URL"
            className="inline-block align-middle text-gray-800 hover:text-blue-700"
          >
            <Link2 className="h-4 w-4" />
          </a>
        ) : null}
      </td>
      <td className={cell}>
        <Link href={`/admin/faqs/content/${encodeURIComponent(faq.id)}`} className="hover:text-blue-700 hover:underline">
          {title}
        </Link>
        {faq.filledLangs.length ? (
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-green-700">
            {faq.filledLangs.map((c) => FAQ_LANGUAGES.find((l) => l.code === c)?.label).join(' · ')}
          </div>
        ) : (
          <div className="mt-0.5 text-[11px] text-orange-600">no content yet</div>
        )}
      </td>
      <td className={cell}>{subtitle}</td>
      <td className={`${cell} whitespace-nowrap`}>{faq.createdAt.slice(0, 10)}</td>
      <td className={`${cell} whitespace-nowrap`}>
        <div className="relative flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onPreview}
            aria-label={previewOpen ? 'Hide content' : 'Show content'}
            title={previewOpen ? 'Hide content' : 'Show content'}
            className="rounded bg-gray-100 p-1.5 hover:bg-gray-200"
          >
            {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete FAQ"
            title="Delete"
            className="rounded bg-gray-100 p-1.5 hover:bg-gray-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPages}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px] leading-tight hover:bg-gray-200"
          >
            Pages
            <br />
            Linked
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
            aria-label="More options"
            aria-expanded={menuOpen}
            className="rounded bg-gray-100 px-0.5 py-1.5 hover:bg-gray-200"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded bg-white py-1 shadow-lg ring-1 ring-black/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={onEdit} className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100">
                Edit
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
