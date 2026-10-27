/** Club / team public website (Marketing → Website). Client-safe. */

export const WEBSITE_SECTIONS = [
  { key: 'registrations', label: 'Registrations and renewals', linkHint: 'Link of your registration form' },
  { key: 'documents', label: 'Document archive', linkHint: 'Club rules and privacy policy are shown automatically' },
  { key: 'shop', label: 'Online shop', linkHint: 'Your services and products are shown automatically' },
  { key: 'events', label: 'Events and tournaments', linkHint: 'Upcoming events are shown automatically' },
  { key: 'medical_visit', label: 'Medical certificate', linkHint: 'Link to update the medical certificate' },
  { key: 'calendar', label: 'Activity calendar', linkHint: 'Link of your public calendar' },
  { key: 'sponsors', label: 'Sponsors', linkHint: 'Visible sponsors are shown automatically' },
  { key: 'online_payments', label: 'Digital payments (deadlines)', linkHint: 'Link to pay the deadlines online' },
] as const;

export type WebsiteSectionKey = (typeof WEBSITE_SECTIONS)[number]['key'];

/** Sections whose public card is only a button to the link the admin enters. */
export const WEBSITE_LINK_SECTIONS: readonly WebsiteSectionKey[] = [
  'registrations',
  'medical_visit',
  'calendar',
  'online_payments',
];

export type WebsiteSectionSetting = { enabled: boolean; url: string };

export const WEBSITE_SOCIALS = ['facebook', 'instagram', 'youtube', 'tiktok'] as const;
export type WebsiteSocialKey = (typeof WEBSITE_SOCIALS)[number];

export type WebsiteSettings = {
  enabled: boolean;
  slug: string;
  coverUrl: string | null;
  about: string;
  sections: Record<WebsiteSectionKey, WebsiteSectionSetting>;
  season: string;
  donationEnabled: boolean;
  donationText: string;
  donationTaxCode: string;
  /** Promotional image of the 5x1000 block (https URL or site path); empty = the standard illustration. */
  donationImage: string;
  socials: Record<WebsiteSocialKey, string>;
};

/** Static illustrations used when the club has not set its own image. */
export const WEBSITE_DONATION_PLACEHOLDER = '/img/donation-promo.svg';
export const WEBSITE_SHOP_PLACEHOLDER = '/img/shop-promo.svg';

export const WEBSITE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
export const WEBSITE_MAX_COVER_BYTES = 8 * 1024 * 1024;

export function slugifyWebsite(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function isWebsiteSectionKey(value: unknown): value is WebsiteSectionKey {
  return WEBSITE_SECTIONS.some((s) => s.key === value);
}

export function emptyWebsiteSections(): Record<WebsiteSectionKey, WebsiteSectionSetting> {
  return Object.fromEntries(WEBSITE_SECTIONS.map((s) => [s.key, { enabled: true, url: '' }])) as Record<
    WebsiteSectionKey,
    WebsiteSectionSetting
  >;
}

/** Sport season starting in July, e.g. `2026/2027`. */
export function currentWebsiteSeason(date = new Date()): string {
  const start = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

export function websiteSeasonOptions(extra = ''): string[] {
  const start = Number(currentWebsiteSeason().slice(0, 4));
  const list = Array.from({ length: 4 }, (_, i) => `${start - 1 + i}/${start + i}`);
  return Array.from(new Set([extra, ...list].filter(Boolean))).sort();
}

export function websitePath(slug: string): string {
  return `/site/${encodeURIComponent(slug)}`;
}
