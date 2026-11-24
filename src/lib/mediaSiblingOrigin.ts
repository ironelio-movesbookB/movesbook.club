/**
 * .it / .eu / .com share MySQL but each app keeps its own `public/uploads` disk.
 * Media URLs stay relative (`/api/media/uploads/...`); when the file is missing locally,
 * the media route may redirect once to a sibling origin that has the bytes.
 */

export const MOVESBOOK_MEDIA_ORIGINS = [
  'https://movesbook.it',
  'https://movesbook.eu',
  'https://movesbook.com',
] as const;

/** Query flag: sibling must serve locally only (no further redirect). */
export const MEDIA_SIBLING_FALLBACK_PARAM = 'mb_fb';

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '').split(':')[0];
}

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function hostOfOrigin(origin: string): string {
  try {
    return bareHost(new URL(origin).host);
  } catch {
    return '';
  }
}

/** Current request host (no port) from Forwarded / Host headers. */
export function requestBareHost(request: { headers: { get(name: string): string | null }; nextUrl: { host: string } }): string {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return bareHost(forwarded || request.headers.get('host') || request.nextUrl.host || '');
}

/**
 * Other Movesbook origins to try when a local upload file is missing.
 * Override with `MOVESBOOK_SIBLING_ORIGIN` (single) or `MOVESBOOK_SIBLING_ORIGINS` (comma-separated).
 */
export function siblingMediaOrigins(currentHost: string): string[] {
  const current = bareHost(currentHost);
  const fromEnv = [
    ...(process.env.MOVESBOOK_SIBLING_ORIGIN ? [process.env.MOVESBOOK_SIBLING_ORIGIN] : []),
    ...(process.env.MOVESBOOK_SIBLING_ORIGINS?.split(',') ?? []),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  const pool = fromEnv.length > 0 ? fromEnv : [...MOVESBOOK_MEDIA_ORIGINS];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const origin of pool) {
    const host = hostOfOrigin(origin);
    if (!host || host === current || seen.has(host)) continue;
    seen.add(host);
    out.push(origin);
  }
  return out;
}

/** Absolute sibling URL for the same `/api/media/...` path (one-hop fallback). */
export function siblingMediaFallbackUrl(
  origin: string,
  segments: string[],
): string {
  const path = segments.map((s) => encodeURIComponent(s)).join('/');
  const url = new URL(`/api/media/${path}`, origin);
  url.searchParams.set(MEDIA_SIBLING_FALLBACK_PARAM, '1');
  return url.toString();
}
