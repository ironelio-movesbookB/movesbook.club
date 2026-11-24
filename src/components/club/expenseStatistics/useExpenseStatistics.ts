'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  parseAmountBasis,
  parseBranchMode,
  type ExpenseAmountBasis,
  type ExpenseBranchMode,
  type ExpenseStatisticsPayload,
  type ExpenseStatsView,
} from '@/lib/club/expenseStatisticsShared';

export type ExpenseStatisticsParams = {
  branchMode: ExpenseBranchMode;
  amountBasis: ExpenseAmountBasis;
  /** Selected type of expense (category key). Empty = server default. */
  type: string;
  /** 1-12, 0 = default (current month). */
  month: number;
  /** 0 = current year. */
  year: number;
};

/** Reads filters from the URL so they survive moving between graphs A–F. */
export function readExpenseStatisticsParams(sp: URLSearchParams | null): ExpenseStatisticsParams {
  const month = Number(sp?.get('month'));
  const year = Number(sp?.get('year'));
  return {
    branchMode: parseBranchMode(sp?.get('branch')),
    amountBasis: parseAmountBasis(sp?.get('amount')),
    type: sp?.get('type')?.trim() ?? '',
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0,
    year: Number.isInteger(year) && year > 1900 ? year : 0,
  };
}

/** Query string (branch/year/amount) carried by the left menu links. */
export function carryQuery(sp: URLSearchParams | null): string {
  const out = new URLSearchParams();
  for (const key of ['branch', 'year', 'amount']) {
    const value = sp?.get(key);
    if (value) out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

export function useExpenseStatistics(view: ExpenseStatsView) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? '';

  const params = useMemo(
    () => readExpenseStatisticsParams(new URLSearchParams(searchKey)),
    [searchKey],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExpenseStatisticsPayload | null>(null);

  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('view', view);
    qs.set('branchMode', params.branchMode);
    qs.set('amount', params.amountBasis);
    if (params.type) qs.set('expenseId', params.type);
    if (params.month) qs.set('month', String(params.month));
    if (params.year) qs.set('year', String(params.year));
    return qs.toString();
  }, [view, params]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    clubApiFetch<ExpenseStatisticsPayload>(`/api/club/procedures/expense/statistics?${apiQuery}`, {
      cache: 'no-store',
    })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e) => {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load statistics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiQuery]);

  /** Patch URL params. `branch` switch drops `type` because category keys differ per mode. */
  const update = useCallback(
    (patch: Partial<{ branch: ExpenseBranchMode; amount: ExpenseAmountBasis; type: string; month: number; year: number }>) => {
      const qs = new URLSearchParams(searchKey);
      const set = (key: string, value: string | number | undefined | null) => {
        if (value === undefined || value === null || value === '' || value === 0) qs.delete(key);
        else qs.set(key, String(value));
      };
      if ('branch' in patch) {
        set('branch', patch.branch === 'sub' ? 'sub' : '');
        qs.delete('type');
      }
      if ('amount' in patch) set('amount', patch.amount === 'paid' ? 'paid' : '');
      if ('type' in patch) set('type', patch.type);
      if ('month' in patch) set('month', patch.month);
      if ('year' in patch) set('year', patch.year);
      const query = qs.toString();
      const base = pathname ?? '';
      router.replace(query ? `${base}?${query}` : base, { scroll: false });
    },
    [pathname, router, searchKey],
  );

  return { loading, error, data, params, update };
}
