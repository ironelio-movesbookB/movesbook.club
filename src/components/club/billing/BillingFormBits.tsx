'use client';

import type { ReactNode } from 'react';

export const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100';

export function Field({
  label,
  required,
  children,
  className = '',
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className}`}>
      <span>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-gray-500">{hint}</span> : null}
    </label>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
