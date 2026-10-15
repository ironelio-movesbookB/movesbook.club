'use client';

import { useCallback, useEffect, useState } from 'react';
import { SHARING_CHANGED_EVENT, type SharingSummary } from '@/lib/sharing/sharingTypes';

export function sharingAuthHeaders(json = false): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function sharingFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...sharingAuthHeaders(init.body !== undefined), ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}

/** Sharing limits / accepted sharings / company quota for the signed-in user. */
export function useSharingSummary(enabled = true) {
  const [summary, setSummary] = useState<SharingSummary | null>(null);

  const reload = useCallback(async () => {
    if (!enabled || typeof window === 'undefined' || !localStorage.getItem('token')) return;
    try {
      const data = await sharingFetch<{ summary: SharingSummary }>('/api/sharing/summary');
      setSummary(data.summary);
    } catch {
      /* keep previous summary */
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(SHARING_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHARING_CHANGED_EVENT, onChange);
  }, [reload]);

  return { summary, reload };
}
