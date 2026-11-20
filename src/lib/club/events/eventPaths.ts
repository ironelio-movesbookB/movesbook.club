/** Public event page paths (server + client safe). */

export function clubEventPublicPath(orgId: string, types: string[] = []): string {
  const base = `/club-events/${encodeURIComponent(orgId)}`;
  return types.length ? `${base}?types=${types.map(encodeURIComponent).join(',')}` : base;
}

/** Presentation page that lists only the given events (by public token). */
export function clubEventSelectionPath(orgId: string, tokens: string[]): string {
  return `/club-events/${encodeURIComponent(orgId)}?events=${tokens.map(encodeURIComponent).join(',')}`;
}

export function clubEventSubscribePath(orgId: string, token: string): string {
  return `/club-events/${encodeURIComponent(orgId)}/${encodeURIComponent(token)}`;
}
