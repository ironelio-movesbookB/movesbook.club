'use client';

import { toMediaApiPath } from '@/lib/uploadMediaUrl';

/**
 * Admin-panel token (Super Admin / admin / staff) saved by the admin login (`persistAdminLoginSession`).
 * Deliberately NOT the site `token`: a normal user's token is rejected by the FAQ admin APIs (403).
 */
export function getFaqAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('adminToken') || '';
  } catch {
    return '';
  }
}

export const FAQ_ADMIN_LOGIN_REQUIRED =
  'Admin access required: please log in to the Super Admin panel (/admin/login) and try again.';

/** fetch() for /api/admin/faqs/* with the admin bearer token; throws with the API error message. */
export async function faqAdminFetch<T = Record<string, unknown>>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getFaqAdminToken()}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (res.status === 401 || res.status === 403) {
    throw new Error(FAQ_ADMIN_LOGIN_REQUIRED);
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Upload an FAQ icon; returns the stored `/uploads/faqs/...` path. */
export async function uploadFaqIcon(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const data = await faqAdminFetch<{ path: string }>('/api/admin/faqs/upload-icon', {
    method: 'POST',
    body: form,
  });
  return data.path;
}

/** Display URL of a stored icon (runtime uploads are served by /api/media). */
export function faqIconSrc(path: string | null | undefined): string | null {
  return toMediaApiPath(path);
}
