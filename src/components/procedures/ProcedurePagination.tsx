'use client';

export const ARCHIVE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
};

function visiblePages(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 9) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(pageCount);
  for (let i = page - 2; i <= page + 2; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

const navBtn =
  'min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40';
const navOutline = `${navBtn} border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
const navActive = `${navBtn} border-gray-900 bg-gray-900 text-white`;

/**
 * Legacy-style page selector: page-size dropdown · prev · numbered pages · next.
 */
export default function ProcedurePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ARCHIVE_PAGE_SIZE_OPTIONS,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pages = visiblePages(safePage, pageCount);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onPageSizeChange && (
        <select
          className="h-8 rounded border border-gray-400 bg-white px-1.5 text-[13px] text-gray-800"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
          }}
          aria-label="Rows per page"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        className={navOutline}
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`e-${idx}`} className="px-1 text-sm text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={p === safePage ? navActive : navOutline}
            aria-current={p === safePage ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
        className={navOutline}
      >
        Next
      </button>
    </div>
  );
}
