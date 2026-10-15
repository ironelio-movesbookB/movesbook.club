'use client';

import { getAuthToken } from '@/utils/auth.utils';

export function sponsorWorkspaceId(): string {
  if (typeof window === 'undefined') return '';
  const fromUrl = new URLSearchParams(window.location.search).get('clubId');
  return fromUrl || localStorage.getItem('selectedClub') || '';
}

/** Calls `/api/club/sponsors…` for the selected club/team; throws the API error message. */
export function sponsorApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return clubWorkspaceApi<T>(`/api/club/sponsors${path}`, init);
}

/** Calls a club/team owner API for the selected workspace (`clubId`); throws the API error message. */
export async function clubWorkspaceApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const clubId = sponsorWorkspaceId();
  const url = `${path}${path.includes('?') ? '&' : '?'}clubId=${encodeURIComponent(clubId)}`;
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  return data as T;
}

export function sponsorKitPath(workspaceId: string): string {
  return `/sponsor-kit/${encodeURIComponent(workspaceId)}`;
}

export function sponsorReportPath(token: string): string {
  return `/sponsor-report/${encodeURIComponent(token)}`;
}

export function qrImageUrl(text: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
