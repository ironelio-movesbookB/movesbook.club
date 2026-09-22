'use client';

export const PROMOCODE_PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50, 100] as const;

type PromocodePageSizeSelectProps = {
  value: number;
  onChange: (size: number) => void;
  className?: string;
};

/** Dropdown to choose how many grid records to show per page. */
export default function PromocodePageSizeSelect({
  value,
  onChange,
  className,
}: PromocodePageSizeSelectProps) {
  return (
    <label className={className ?? 'inline-flex items-center gap-2 text-sm text-gray-700'}>
      <span>Show</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Records per page"
        className="px-2 py-1 border text-sm bg-white"
      >
        {PROMOCODE_PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span>per page</span>
    </label>
  );
}
