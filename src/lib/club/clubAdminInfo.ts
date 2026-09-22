export const CLUB_ADMIN_INFO_SETTINGS_KEY = 'clubAdminInfo';

export const CLUB_ADMIN_SOCIAL_PLATFORMS = [
  'Facebook',
  'Twitter',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'WhatsApp',
  'Telegram',
  'TikTok',
  'Other',
] as const;

export type ClubAdminSocialPlatform = (typeof CLUB_ADMIN_SOCIAL_PLATFORMS)[number];

export type ClubAdminSocialSite = {
  platform: string;
  url: string;
};

export type ClubAdminPublicLink = {
  url: string;
  showInClubAdminInfo: boolean;
};

export type ClubAdminInfo = {
  alternateEmail: string;
  phonePrefix: string;
  phoneNumber: string;
  socialSites: [ClubAdminSocialSite, ClubAdminSocialSite];
  myWebsite: ClubAdminPublicLink;
  whatsapp: ClubAdminPublicLink;
  instagram: ClubAdminPublicLink;
  youtube: ClubAdminPublicLink;
  linkedin: ClubAdminPublicLink;
  blogSite: ClubAdminPublicLink;
  googleMap: ClubAdminPublicLink;
  telegram: ClubAdminPublicLink;
  aboutMe: string;
};

export const EMPTY_CLUB_ADMIN_PUBLIC_LINK: ClubAdminPublicLink = {
  url: '',
  showInClubAdminInfo: false,
};

export const EMPTY_CLUB_ADMIN_INFO: ClubAdminInfo = {
  alternateEmail: '',
  phonePrefix: '',
  phoneNumber: '',
  socialSites: [
    { platform: 'Facebook', url: '' },
    { platform: 'Twitter', url: '' },
  ],
  myWebsite: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  whatsapp: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  instagram: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  youtube: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  linkedin: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  blogSite: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  googleMap: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  telegram: { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK },
  aboutMe: '',
};

function parsePublicLink(raw: unknown): ClubAdminPublicLink {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_CLUB_ADMIN_PUBLIC_LINK };
  }
  const o = raw as Record<string, unknown>;
  return {
    url: typeof o.url === 'string' ? o.url : '',
    showInClubAdminInfo: Boolean(o.showInClubAdminInfo),
  };
}

function parseSocialSite(raw: unknown, fallbackPlatform: string): ClubAdminSocialSite {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { platform: fallbackPlatform, url: '' };
  }
  const o = raw as Record<string, unknown>;
  const platform =
    typeof o.platform === 'string' && o.platform.trim() ? o.platform.trim() : fallbackPlatform;
  return {
    platform,
    url: typeof o.url === 'string' ? o.url : '',
  };
}

export function parseClubAdminInfo(raw: unknown): ClubAdminInfo {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_CLUB_ADMIN_INFO };
  }
  const o = raw as Record<string, unknown>;
  const socialRaw = Array.isArray(o.socialSites) ? o.socialSites : [];
  return {
    alternateEmail: typeof o.alternateEmail === 'string' ? o.alternateEmail : '',
    phonePrefix: typeof o.phonePrefix === 'string' ? o.phonePrefix : '',
    phoneNumber: typeof o.phoneNumber === 'string' ? o.phoneNumber : '',
    socialSites: [
      parseSocialSite(socialRaw[0], 'Facebook'),
      parseSocialSite(socialRaw[1], 'Twitter'),
    ],
    myWebsite: parsePublicLink(o.myWebsite),
    whatsapp: parsePublicLink(o.whatsapp),
    instagram: parsePublicLink(o.instagram),
    youtube: parsePublicLink(o.youtube),
    linkedin: parsePublicLink(o.linkedin),
    blogSite: parsePublicLink(o.blogSite),
    googleMap: parsePublicLink(o.googleMap),
    telegram: parsePublicLink(o.telegram),
    aboutMe: typeof o.aboutMe === 'string' ? o.aboutMe : '',
  };
}

export function readClubAdminInfoFromSocialSettings(
  socialSettings: unknown,
): ClubAdminInfo {
  if (!socialSettings || typeof socialSettings !== 'object' || Array.isArray(socialSettings)) {
    return { ...EMPTY_CLUB_ADMIN_INFO };
  }
  const key = CLUB_ADMIN_INFO_SETTINGS_KEY;
  return parseClubAdminInfo((socialSettings as Record<string, unknown>)[key]);
}

export function mergeClubAdminInfoIntoSocialSettings(
  socialSettings: Record<string, unknown>,
  clubAdminInfo: ClubAdminInfo,
): Record<string, unknown> {
  return {
    ...socialSettings,
    [CLUB_ADMIN_INFO_SETTINGS_KEY]: clubAdminInfo,
  };
}

export const CLUB_ADMIN_PUBLIC_LINK_FIELDS: {
  key: keyof Pick<
    ClubAdminInfo,
    | 'myWebsite'
    | 'whatsapp'
    | 'instagram'
    | 'youtube'
    | 'linkedin'
    | 'blogSite'
    | 'googleMap'
    | 'telegram'
  >;
  label: string;
}[] = [
  { key: 'myWebsite', label: 'My Website' },
  { key: 'whatsapp', label: 'Whatsapp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'You tube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'blogSite', label: 'My blog site' },
  { key: 'googleMap', label: 'Google map' },
  { key: 'telegram', label: 'Telegram' },
];

export type ClubAdminPublicContactRow = {
  label: string;
  value: string;
  href?: string;
};

function toExternalHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Rows safe to show on my-club Contact Info (respects showInClubAdminInfo on link fields). */
export function getClubAdminPublicContactRows(info: ClubAdminInfo): ClubAdminPublicContactRow[] {
  const rows: ClubAdminPublicContactRow[] = [];

  const alternateEmail = info.alternateEmail.trim();
  if (alternateEmail) {
    rows.push({
      label: 'Alternate email',
      value: alternateEmail,
      href: `mailto:${alternateEmail}`,
    });
  }

  const phone = [info.phonePrefix.trim(), info.phoneNumber.trim()].filter(Boolean).join(' ');
  if (phone) {
    rows.push({
      label: 'Phone',
      value: phone,
      href: `tel:${phone.replace(/\s/g, '')}`,
    });
  }

  for (const site of info.socialSites) {
    const url = site.url.trim();
    if (!url) continue;
    rows.push({
      label: site.platform.trim() || 'Social',
      value: url,
      href: toExternalHref(url),
    });
  }

  for (const { key, label } of CLUB_ADMIN_PUBLIC_LINK_FIELDS) {
    const link = info[key];
    const url = link.url.trim();
    if (!url || !link.showInClubAdminInfo) continue;
    rows.push({
      label,
      value: url,
      href: toExternalHref(url),
    });
  }

  const aboutMe = info.aboutMe.trim();
  if (aboutMe) {
    rows.push({ label: 'About me', value: aboutMe });
  }

  return rows;
}
