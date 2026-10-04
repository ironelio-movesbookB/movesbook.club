'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function SectionCard({
  title,
  children,
  tone = 'slate',
  titleClassName,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  tone?: 'slate' | 'red' | 'blue' | 'purple';
  titleClassName?: string;
  /** Header becomes a show/hide toggle. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bar =
    tone === 'red'
      ? 'bg-red-700'
      : tone === 'blue'
        ? 'bg-[#2f6fb5]'
        : tone === 'purple'
          ? 'bg-[#6b4c9a]'
          : 'bg-gray-700';
  const headerClass = `${bar} px-3 py-2 font-semibold text-white ${titleClassName || 'text-sm'}`;
  const isOpen = !collapsible || open;
  return (
    <section className="mb-4 overflow-hidden rounded border border-gray-300 bg-white">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${headerClass} flex w-full items-center justify-between gap-2 text-left`}
        >
          <span>{title}</span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
          <span className="sr-only">{open ? 'Hide section' : 'Show section'}</span>
        </button>
      ) : (
        <div className={headerClass}>{title}</div>
      )}
      {isOpen ? <div className="space-y-3 p-3 md:p-4">{children}</div> : null}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
  action,
  labelExtra,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  /** Optional control aligned to the right of the label (e.g. Open on Map). */
  action?: ReactNode;
  /** Optional controls placed right after the label text. */
  labelExtra?: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className="block text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        {labelExtra ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className={`font-semibold text-gray-800 ${labelClassName || ''}`}>{label}</label>
            {labelExtra}
          </div>
        ) : (
          <label className={`font-semibold text-gray-800 ${labelClassName || ''}`}>{label}</label>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-gray-400 bg-[#fffde7] px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 ${props.className || ''}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-gray-400 bg-[#fffde7] px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 ${props.className || ''}`}
    />
  );
}

export function TextSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-gray-400 bg-[#fffde7] px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 ${props.className || ''}`}
    />
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-gray-800">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function Row2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${className}`}>{children}</div>;
}

export function Row3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>;
}

export function Row4({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
  );
}
