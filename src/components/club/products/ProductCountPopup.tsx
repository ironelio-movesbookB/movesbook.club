'use client';

import { useState } from 'react';

export type ProductCountLine = {
  name: string;
  quantity: number;
};

export default function ProductCountPopup({
  count,
  lines,
}: {
  count: number;
  lines: ProductCountLine[];
}) {
  const [open, setOpen] = useState(false);
  const total = count || lines.reduce((sum, line) => sum + line.quantity, 0);
  if (!total && lines.length === 0) return <span>-</span>;

  return (
    <>
      <button
        type="button"
        className="font-semibold text-teal-800 underline"
        onClick={() => setOpen(true)}
      >
        {total}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Products purchased</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm text-gray-800">
              {lines.map((line, index) => (
                <li key={`${line.name}-${index}`} className="flex justify-between gap-3">
                  <span>{line.name}</span>
                  <span>× {line.quantity}</span>
                </li>
              ))}
              {lines.length === 0 && <li>No product lines were stored for this selling.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
