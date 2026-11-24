'use client';

import { clubWorkspaceApi } from '@/lib/club/sponsors/sponsorClient';

export { clubEventPublicPath, clubEventSelectionPath, clubEventSubscribePath } from '@/lib/club/events/eventPaths';

export function eventApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return clubWorkspaceApi<T>(`/api/club/events${path}`, init);
}
