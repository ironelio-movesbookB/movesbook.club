'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import TablesTabs from '@/components/club-settings/TablesTabs';

type SubCategoryItem = {
  id: string;
  name: string;
  parentId: string;
  created: string | null;
  modified: string | null;
};

type CategoryGroup = {
  id: string;
  name: string;
  parentId: string;
  created: string | null;
  modified: string | null;
  children: SubCategoryItem[];
};

type CategoryDraft = {
  id?: string;
  name: string;
  parentId: string;
  isSubCategory: boolean;
};

type FieldErrors = Partial<Record<'name' | 'parentId', string>>;
type PageItem = number | 'ellipsis-left' | 'ellipsis-right';
type SortKey = 'name' | 'modified';
type SortDirection = 'asc' | 'desc';

const API_PATH = '/api/club/settings/tables/categories';
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20] as const;

function getSmartPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages];
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date);
}

function validateDraft(draft: CategoryDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) {
    errors.name = 'Please enter category name.';
  } else if (draft.name.trim().length > 250) {
    errors.name = 'Category name must be 250 characters or fewer.';
  }
  return errors;
}

export default function ClubTablesCategoryPage() {
  const [items, setItems] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('modified');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; isSubCategory: boolean } | null>(null);

  const loadItems = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_PATH, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load categories.');
      }

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadItems(controller.signal);
    return () => controller.abort();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? items.filter((group) =>
        group.name.toLowerCase().includes(term)
        || group.children.some((child) => child.name.toLowerCase().includes(term))
      )
      : items;

    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        const result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? result : -result;
      }

      const aTime = new Date(a.modified || a.created || 0).getTime();
      const bTime = new Date(b.modified || b.created || 0).getTime();
      const result = aTime - bTime;
      return sortDirection === 'asc' ? result : -result;
    });
  }, [items, search, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(currentPage * pageSize, filteredItems.length);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search]);

  const updateSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedIds(new Set());
      setExpandAll(false);
      return;
    }

    setExpandedIds(new Set(filteredItems.map((group) => group.id)));
    setExpandAll(true);
  };

  const isExpanded = (id: string) => expandAll || expandedIds.has(id);

  const openAddParentModal = () => {
    setDraft({ name: '', parentId: '0', isSubCategory: false });
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  };

  const openAddSubModal = (parentId: string) => {
    setDraft({ name: '', parentId, isSubCategory: true });
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  };

  const openEditModal = (item: CategoryGroup | SubCategoryItem, isSubCategory: boolean) => {
    setDraft({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      isSubCategory
    });
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  };

  const closeModal = () => {
    setDraft(null);
    setFieldErrors({});
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const nextErrors = validateDraft(draft);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('token');
      const response = await fetch(API_PATH, {
        method: draft.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name.trim(),
          parentId: draft.isSubCategory ? draft.parentId : '0',
          isSubCategory: draft.isSubCategory
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors(data.fieldErrors);
          return;
        }
        throw new Error(data?.error || 'Unable to save category.');
      }

      await loadItems();
      if (draft.isSubCategory && draft.parentId) {
        setExpandedIds((current) => new Set(current).add(draft.parentId));
      }
      closeModal();
      setSuccess(
        draft.id
          ? draft.isSubCategory ? 'Sub category has been updated.' : 'Category edited successfully.'
          : draft.isSubCategory ? 'Sub Category added successfully.' : 'Category added successfully.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_PATH}?id=${encodeURIComponent(deleteTarget.id)}&isSubCategory=${deleteTarget.isSubCategory ? '1' : '0'}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to delete category.');
      }

      await loadItems();
      setDeleteTarget(null);
      setSuccess(deleteTarget.isSubCategory ? 'Delete sub category successfully.' : 'Category deleted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete category.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-950">Tables</h1>
              <p className="mt-1 text-sm text-gray-500">Club&apos;s management / General settings / Category</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search categories"
                  className="h-9 w-60 rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-500"
                />
              </div>
              <ToolbarButton
                icon={expandAll ? ChevronUp : ChevronDown}
                label={expandAll ? 'Collapse all' : 'Expand all'}
                onClick={toggleExpandAll}
              />
              <ToolbarButton icon={Plus} label="Add category" onClick={openAddParentModal} variant="dark" />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-gray-500"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>per page</span>
              <span className="ml-1 text-gray-400">|</span>
              <span>
                Showing <strong className="font-semibold text-gray-900">{visibleStart}-{visibleEnd}</strong> of{' '}
                <strong className="font-semibold text-gray-900">{filteredItems.length}</strong>
              </span>
            </div>
            <SmartPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </div>

          {(error || success) && (
            <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${
              error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {error || success}
            </div>
          )}
        </div>

        <TablesTabs active="category" />

        <div className="min-h-[360px]">
          {loading ? (
            <div className="flex h-72 items-center justify-center text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading categories
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex h-72 items-center justify-center px-4 text-center text-sm text-red-600">
              {error}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-gray-500">
              No categories found.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-[1fr_9rem_8rem] gap-2 border-b border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <SortHeader label="Category name" active={sortKey === 'name'} direction={sortDirection} onClick={() => updateSort('name')} />
                <SortHeader label="Modified" active={sortKey === 'modified'} direction={sortDirection} onClick={() => updateSort('modified')} />
                <span className="text-right">Actions</span>
              </div>

              {pageItems.map((group) => (
                <div key={group.id}>
                  <div className="grid grid-cols-[1fr_9rem_8rem] items-center gap-2 bg-white px-4 py-4 transition hover:bg-gray-50">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(group.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                        aria-label={isExpanded(group.id) ? 'Collapse sub-categories' : 'Expand sub-categories'}
                        title={isExpanded(group.id) ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded(group.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <span className="truncate font-semibold text-gray-950">{group.name}</span>
                      {group.children.length > 0 && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {group.children.length}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">{formatDate(group.modified || group.created)}</span>
                    <div className="flex justify-end gap-2">
                      <IconButton label="Add sub-category" onClick={() => openAddSubModal(group.id)} icon={<Plus className="h-4 w-4" />} />
                      <IconButton label="Edit category" onClick={() => openEditModal(group, false)} icon={<Pencil className="h-4 w-4" />} />
                      <IconButton
                        label="Delete category"
                        onClick={() => setDeleteTarget({ id: group.id, name: group.name, isSubCategory: false })}
                        icon={<Trash2 className="h-4 w-4" />}
                        danger
                      />
                    </div>
                  </div>

                  {isExpanded(group.id) && group.children.length > 0 && (
                    <div className="space-y-2 bg-gray-50 px-4 pb-4 pl-14">
                      {group.children.map((child) => (
                        <div
                          key={child.id}
                          className="grid grid-cols-[1fr_9rem_8rem] items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-3"
                        >
                          <span className="truncate text-sm font-medium text-gray-900">{child.name}</span>
                          <span className="text-sm text-gray-600">{formatDate(child.modified || child.created)}</span>
                          <div className="flex justify-end gap-2">
                            <IconButton label="Edit sub-category" onClick={() => openEditModal(child, true)} icon={<Pencil className="h-4 w-4" />} />
                            <IconButton
                              label="Delete sub-category"
                              onClick={() => setDeleteTarget({ id: child.id, name: child.name, isSubCategory: true })}
                              icon={<Trash2 className="h-4 w-4" />}
                              danger
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4 py-6" role="dialog" aria-modal="true">
          <form onSubmit={saveDraft} className="w-full max-w-xl rounded-md bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-950">
                {draft.id
                  ? draft.isSubCategory ? 'Edit sub-category' : 'Edit category'
                  : draft.isSubCategory ? 'Add sub-category' : 'Add category'}
              </h2>
              <button type="button" onClick={closeModal} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-5">
              <Field
                label={draft.isSubCategory ? 'Sub category' : 'Name'}
                value={draft.name}
                error={fieldErrors.name}
                placeholder={draft.isSubCategory ? 'Sub category name' : 'Category name'}
                onChange={(value) => {
                  setDraft({ ...draft, name: value });
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={closeModal} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4 py-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-md bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-950">Delete category</h2>
            </div>
            <div className="space-y-3 px-5 py-5 text-sm text-gray-700">
              <p className="font-medium text-gray-950">{deleteTarget.name}</p>
              <p>
                {deleteTarget.isSubCategory
                  ? 'This sub-category will be removed from the list.'
                  : 'This category will be removed. Sub-categorys linked to it may remain in the database.'}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default'
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'dark';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
        variant === 'dark'
          ? 'border-gray-800 bg-gray-900 text-white hover:bg-gray-800'
          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  danger = false
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function SortHeader({
  label,
  active,
  direction,
  onClick
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-wide text-gray-600 transition hover:text-gray-950"
    >
      <span>{label}</span>
      <span className={`text-[10px] ${active ? 'text-gray-950' : 'text-gray-300'}`}>
        {active ? direction === 'asc' ? '▲' : '▼' : '↕'}
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-gray-900 outline-none transition ${
          error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-gray-500'
        }`}
      />
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function SmartPagination({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pageItems = getSmartPageItems(currentPage, totalPages);
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;

  const goToPage = (nextPage: number) => {
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  };

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Categories pagination">
      <PaginationIconButton label="First page" disabled={!canGoBack} onClick={() => goToPage(1)} icon={<ChevronsLeft className="h-4 w-4" />} />
      <PaginationIconButton label="Previous page" disabled={!canGoBack} onClick={() => goToPage(currentPage - 1)} icon={<ChevronLeft className="h-4 w-4" />} />
      {pageItems.map((item) => {
        if (typeof item !== 'number') {
          return (
            <span key={item} className="flex h-9 w-9 items-center justify-center text-gray-400">
              ...
            </span>
          );
        }

        return (
          <button
            key={item}
            type="button"
            onClick={() => goToPage(item)}
            className={`h-9 min-w-9 rounded-md border px-3 text-sm font-semibold ${
              item === currentPage
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item}
          </button>
        );
      })}
      <PaginationIconButton label="Next page" disabled={!canGoForward} onClick={() => goToPage(currentPage + 1)} icon={<ChevronRight className="h-4 w-4" />} />
      <PaginationIconButton label="Last page" disabled={!canGoForward} onClick={() => goToPage(totalPages)} icon={<ChevronsRight className="h-4 w-4" />} />
    </nav>
  );
}

function PaginationIconButton({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}
