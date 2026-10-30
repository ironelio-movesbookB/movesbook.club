'use client';

import { clubWorkspaceApi } from '@/lib/club/sponsors/sponsorClient';

export function eventApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return clubWorkspaceApi<T>(`/api/club/events${path}`, init);
}

export function clubEventPublicPath(orgId: string): string {
  return `/club-events/${encodeURIComponent(orgId)}`;
}

export function clubEventSubscribePath(orgId: string, token: string): string {
  return `/club-events/${encodeURIComponent(orgId)}/${encodeURIComponent(token)}`;
}
