'use client';

import { Minus, Plus } from 'lucide-react';
import { VARIANCE_MAX, VARIANCE_MIN, type VariableModeCode } from '@/lib/subscriptions/paymentModalities';

/** −/+ buttons, slider and number for the % variance of a modality from D. */
export default function ModalityVarianceControl({
  code,
  value,
  onChange,
}: {
  code: VariableModeCode;
  value: number;
  onChange: (code: VariableModeCode, value: unknown) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(code, value - 1)}
        className="flex h-8 w-8 items-center justify-center rounded border border-gray-400 hover:bg-gray-100"
        aria-label={`Decrease ${code}`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={VARIANCE_MIN}
        max={VARIANCE_MAX}
        value={value}
        onChange={(e) => onChange(code, e.target.value)}
        className="w-28"
        aria-label={`% variance of ${code}`}
      />
      <button
        type="button"
        onClick={() => onChange(code, value + 1)}
        className="flex h-8 w-8 items-center justify-center rounded border border-gray-400 hover:bg-gray-100"
        aria-label={`Increase ${code}`}
      >
        <Plus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={VARIANCE_MIN}
        max={VARIANCE_MAX}
        value={value}
        onChange={(e) => onChange(code, e.target.value)}
        className="h-8 w-16 rounded border border-gray-300 px-2 text-right"
      />
      <span className="text-sm">%</span>
    </div>
  );
}
