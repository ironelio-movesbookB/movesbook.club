'use client';

import type { ReactNode } from 'react';

export function SectionCard({
  title,
  children,
  tone = 'slate',
  titleClassName,
}: {
  title: string;
  children: ReactNode;
  tone?: 'slate' | 'red' | 'blue' | 'purple';
  titleClassName?: string;
}) {
  const bar =
    tone === 'red'
      ? 'bg-red-700'
      : tone === 'blue'
        ? 'bg-[#2f6fb5]'
        : tone === 'purple'
          ? 'bg-[#6b4c9a]'
          : 'bg-gray-700';
  return (
    <section className="mb-4 overflow-hidden rounded border border-gray-300 bg-white">
      <div
        className={`${bar} px-3 py-2 font-semibold text-white ${titleClassName || 'text-sm'}`}
      >
        {title}
      </div>
      <div className="space-y-3 p-3 md:p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
  action,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  /** Optional control aligned to the right of the label (e.g. Open on Map). */
  action?: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className="block text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className={`font-semibold text-gray-800 ${labelClassName || ''}`}>{label}</label>
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
  label: string;
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

export function Row2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}

export function Row3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{children}</div>;
}

export function Row4({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
  );
}
