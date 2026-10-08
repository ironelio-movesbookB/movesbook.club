/**
 * Movesbook domains share the database but not the uploads folder, so an offer logo exists only
 * on the server where it was uploaded. Try the current domain first, then the other domains.
 */
export const MOVESBOOK_SITE_ORIGINS = [
  'https://movesbook.eu',
  'https://movesbook.it',
  'https://movesbook.com',
];

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

export function specialOfferLogoCandidates(logoUrl: string | null | undefined): string[] {
  const url = logoUrl?.trim();
  if (!url) return [];
  if (!url.startsWith('/') || url.startsWith('//')) return [url];

  const currentHost = typeof window !== 'undefined' ? bareHost(window.location.host) : '';
  const others = MOVESBOOK_SITE_ORIGINS.filter(
    (origin) => bareHost(new URL(origin).host) !== currentHost,
  ).map((origin) => `${origin}${url}`);
  return [url, ...others];
}
