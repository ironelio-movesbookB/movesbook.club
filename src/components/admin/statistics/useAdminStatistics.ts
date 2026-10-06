'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAdminBearerToken } from '@/lib/admin/clientAdminAuth';
import type { StatisticsPayload } from '@/lib/admin/buildStatistics';
import {
  STATS_KIND_LABELS,
  STATS_TYPE_KIND_FILTER_LABELS,
  STATS_USER_KINDS,
  type StatsTypeKindFilter,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';

export type StatisticsFilters = {
  country: string;
  userType: StatsUserKind | 'all' | 'except_groups';
  typeKind: StatsTypeKindFilter;
};

const DEFAULT_FILTERS: StatisticsFilters = {
  country: '',
  userType: 'all',
  typeKind: 'single',
};

export function useAdminStatistics(options?: {
  /** Extra query params always sent */
  topCountriesN?: number;
  typeCountriesN?: number;
  /** Which filters to show / send */
  enableCountry?: boolean;
  enableUserType?: boolean;
  enableTypeKind?: boolean;
  initial?: Partial<StatisticsFilters>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const countryFromUrl = searchParams.get('country')?.trim() || '';
  const specialOffersOnly = searchParams?.get('offers') === 'special';
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatisticsPayload | null>(null);
  const [filters, setFilters] = useState<StatisticsFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...options?.initial,
    ...(countryFromUrl ? { country: countryFromUrl } : {}),
  }));

  // Keep country filter in sync when sidebar links change ?country=…
  useEffect(() => {
    setFilters((prev) =>
      prev.country === countryFromUrl ? prev : { ...prev, country: countryFromUrl },
    );
  }, [countryFromUrl]);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    if (options?.enableCountry !== false && filters.country) {
      qs.set('country', filters.country);
    }
    if (options?.enableUserType && filters.userType !== 'all') {
      qs.set('userType', filters.userType);
    }
    // When selecting a type for type-pies, align income/users totals to that filter
    if (options?.enableTypeKind) {
      qs.set('typeKind', filters.typeKind);
      if (!options?.enableUserType) {
        qs.set('userType', filters.typeKind);
      }
    }
    if (options?.topCountriesN) qs.set('topCountriesN', String(options.topCountriesN));
    if (options?.typeCountriesN) qs.set('typeCountriesN', String(options.typeCountriesN));
    if (specialOffersOnly) qs.set('offers', 'special');
    return qs.toString();
  }, [filters, specialOffersOnly, options?.enableCountry, options?.enableUserType, options?.enableTypeKind, options?.topCountriesN, options?.typeCountriesN]);

  const load = useCallback(async () => {
    const token = getAdminBearerToken();
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/statistics${queryString ? `?${queryString}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const payload = (await res.json()) as StatisticsPayload;
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load statistics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!authChecked) return;
    void load();
  }, [authChecked, load]);

  return {
    authChecked,
    loading,
    error,
    data,
    filters,
    setFilters,
    reload: load,
  };
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

export { STATS_KIND_LABELS, STATS_USER_KINDS, STATS_TYPE_KIND_FILTER_LABELS };
export type { StatsUserKind, StatsTypeKindFilter };
