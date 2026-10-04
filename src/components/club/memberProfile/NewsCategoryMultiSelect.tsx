'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AutoTranslate from '@/components/i18n/AutoTranslate';

type CategoryOption = { id: string; categoryName: string };

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export default function NewsCategoryMultiSelect({ value, onChange, disabled }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/public/news/categories');
        const json = await res.json().catch(() => []);
        if (cancelled) return;
        const list = Array.isArray(json) ? json : [];
        setCategories(
          list
            .map((c: { id?: string; categoryName?: string }) => ({
              id: String(c.id || ''),
              categoryName: String(c.categoryName || '').trim(),
            }))
            .filter((c) => c.id && c.categoryName),
        );
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const repositionMenu = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 224),
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    repositionMenu();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => repositionMenu();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const selectedSet = new Set(value);
  const selectedLabels = categories
    .filter((c) => selectedSet.has(c.id))
    .map((c) => c.categoryName);

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange(Array.from(new Set([...value, id])));
    } else {
      onChange(value.filter((v) => v !== id));
    }
  };

  const menu =
    open && !disabled ? (
      <div
        ref={menuRef}
        style={menuStyle}
        className="max-h-52 overflow-y-auto rounded border border-gray-300 bg-white p-2 shadow-lg"
      >
        {categories.length === 0 ? (
          <p className="px-2 py-1 text-sm text-gray-500">No categories available.</p>
        ) : (
          categories.map((cat) => (
            <label
              key={cat.id}
              className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-1 py-1.5 text-sm text-gray-900 last:border-b-0 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(cat.id)}
                onChange={(e) => toggle(cat.id, e.target.checked)}
                className="rounded border-gray-400"
              />
              <span>{cat.categoryName}</span>
            </label>
          ))
        )}
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className="relative min-w-[14rem] max-w-md flex-1">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded border border-gray-400 bg-[#fffde7] px-2 py-1.5 text-left text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        {loading
          ? 'Loading categories…'
          : selectedLabels.length > 0
            ? selectedLabels.join(', ')
            : 'Select categories'}
      </button>
      {typeof document !== 'undefined' && menu
        ? createPortal(<AutoTranslate>{menu}</AutoTranslate>, document.body)
        : null}
    </div>
  );
}
