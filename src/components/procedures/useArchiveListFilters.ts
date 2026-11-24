'use client';

import { useCallback, useState } from 'react';
import {
  emptyArchiveFilterValues,
  toArchiveFilterParams,
  validateArchiveDateRange,
  type ArchiveListFilterParams,
  type ArchiveListFilterValues,
} from '@/components/procedures/ArchiveListToolbar';

/** Draft + applied filter state shared by every procedure/club archive list. */
export function useArchiveListFilters() {
  const [draft, setDraft] = useState<ArchiveListFilterValues>(emptyArchiveFilterValues);
  const [applied, setApplied] = useState<ArchiveListFilterParams>({});
  const [dateRangeError, setDateRangeError] = useState('');

  const onChange = useCallback((patch: Partial<ArchiveListFilterValues>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      setDateRangeError(validateArchiveDateRange(next.fromDate, next.toDate));
      return next;
    });
  }, []);

  const apply = useCallback(() => {
    const err = validateArchiveDateRange(draft.fromDate, draft.toDate);
    setDateRangeError(err);
    if (err) return false;
    setApplied(toArchiveFilterParams(draft));
    return true;
  }, [draft]);

  const clear = useCallback(() => {
    setDraft(emptyArchiveFilterValues());
    setApplied({});
    setDateRangeError('');
  }, []);

  return { draft, applied, dateRangeError, onChange, apply, clear };
}
