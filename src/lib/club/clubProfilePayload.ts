import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { defaultClubSubscriptionEndDate } from '@/lib/admin/clubSubscriptionStatus';

import { DEFAULT_ENTITY_SPORT, normalizeEntitySport } from '@/lib/sport/entitySportOptions';

export type ClubProfileFormPayload = {
  username: string;
  /** Single main sport — drives sport-specific fields and behaviour. */
  category: string;
  /**
   * Other sports (multicheck). May still include the main sport as index 0 for
   * older rows; loaders treat `category` as the authority for main sport.
   */
  sports: string[];
  country: string;
  region: string;
  province: string;
  location: string;
  zipCode: string;
  address: string;
  geo: string;
  mail: string;
  phone: string;
  website: string;
  logoUrl: string;
  /** Wide banner shown on the club main page. */
  bannerUrl?: string;
  directAccess: string;
  officialName: string;
  directRegistrationCode: string;
  /** Empty when not changing password (edit mode). */
  clubPassword: string;
  /** Club-specific references (separate from the club admin account). */
  referencesHtml: string;
  referencesLevel: string;
};

export type ClubProfileSavePayload = ClubProfileFormPayload & {
  logoFile?: File | null;
  removeLogo?: boolean;
  bannerFile?: File | null;
  removeBanner?: boolean;
};

export function clubProfilePayloadForApi(
  payload: ClubProfileSavePayload,
): ClubProfileFormPayload {
  const {
    logoFile: _logoFile,
    removeLogo: _removeLogo,
    bannerFile: _bannerFile,
    removeBanner: _removeBanner,
    ...rest
  } = payload;
  return rest;
}

export function clubToFormPayload(club: {
  name: string;
  description?: string | null;
  location?: string | null;
}): ClubProfileFormPayload {
  const meta = parseClubDescriptionMeta(club.description);
  const storedSports =
    Array.isArray(meta.sports) && meta.sports.length > 0
      ? meta.sports.map(String).filter(Boolean)
      : [];
  const mainSport = normalizeEntitySport(
    meta.category?.trim() || storedSports[0] || DEFAULT_ENTITY_SPORT,
  );
  const otherSports = storedSports
    .map((s) => normalizeEntitySport(s, mainSport))
    .filter((s, i, arr) => s !== mainSport && arr.indexOf(s) === i);
  // Persist shape keeps main first for legacy readers of sports[0].
  const sports = [mainSport, ...otherSports];
  const teamContacts =
    meta.teamProfile &&
    typeof meta.teamProfile === 'object' &&
    'contacts' in meta.teamProfile &&
    meta.teamProfile.contacts &&
    typeof meta.teamProfile.contacts === 'object'
      ? (meta.teamProfile.contacts as { website?: string })
      : null;
  const teamWebsite = String(teamContacts?.website ?? '').trim();
  return {
    username: meta.username?.trim() ?? '',
    category: mainSport,
    sports,
    country: meta.country?.trim() ?? 'Italy',
    region: meta.region?.trim() ?? '',
    province: meta.province?.trim() ?? '',
    location: club.location?.trim() ?? '',
    zipCode: meta.zipCode?.trim() ?? '',
    address: meta.address?.trim() ?? '',
    geo: meta.geo?.trim() ?? '',
    mail: meta.mail?.trim() ?? '',
    phone: meta.phone?.trim() ?? '',
    website: meta.website?.trim() || teamWebsite,
    logoUrl: meta.logoUrl?.trim() ?? '',
    bannerUrl: meta.bannerUrl?.trim() ?? '',
    directAccess: meta.directAccess?.trim() ?? '',
    officialName: club.name?.trim() ?? '',
    directRegistrationCode: meta.directRegistrationCode?.trim() ?? '',
    clubPassword: '',
    referencesHtml: meta.referencesHtml?.trim() ?? '',
    referencesLevel: meta.referencesLevel?.trim() || '1',
  };
}

export function mergeClubSubscriptionDates(
  existingDescription: string | null | undefined,
  subscriptionStart: string,
  subscriptionEnd: string,
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta: ClubDescriptionMeta = {
    ...prev,
    subscriptionStart: subscriptionStart.trim().slice(0, 10) || undefined,
    subscriptionEnd: subscriptionEnd.trim().slice(0, 10) || undefined,
  };
  return JSON.stringify(meta);
}

function storedPublicUrl(value: string | null | undefined): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  // Never persist inline data/blob URLs into description JSON (truncates / corrupts meta).
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return undefined;
  return raw;
}

export function mergeClubDescriptionForSave(
  existingDescription: string | null | undefined,
  payload: ClubProfileFormPayload,
  options?: { clubPasswordHash?: string; isCreate?: boolean },
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const mainSport = normalizeEntitySport(
    payload.category.trim() || payload.sports[0] || DEFAULT_ENTITY_SPORT,
  );
  const otherSports = (Array.isArray(payload.sports) ? payload.sports : [])
    .map((s) => normalizeEntitySport(s, mainSport))
    .filter((s, i, arr) => s !== mainSport && arr.indexOf(s) === i);
  const sports = [mainSport, ...otherSports];
  const meta: ClubDescriptionMeta = {
    ...prev,
    createdViaForm: true,
    subscriptionStart: prev.subscriptionStart?.trim() || undefined,
    subscriptionEnd:
      prev.subscriptionEnd?.trim() ||
      (options?.isCreate ? defaultClubSubscriptionEndDate() : undefined),
    username: payload.username.trim() || undefined,
    category: mainSport,
    sports,
    country: payload.country.trim() || undefined,
    region: payload.region.trim() || undefined,
    province: payload.province.trim() || undefined,
    zipCode: payload.zipCode.trim() || undefined,
    address: payload.address.trim() || undefined,
    geo: payload.geo.trim() || undefined,
    mail: payload.mail.trim() || undefined,
    phone: payload.phone.trim() || undefined,
    website: payload.website.trim() || undefined,
    // Keep existing logo/banner when the form sends a blank (e.g. blob preview
    // not yet written into payload). Explicit removal is done via the logo/banner
    // DELETE API before this merge, which clears prev.logoUrl / prev.bannerUrl.
    // Never write data:/blob: URLs — those come from local previews only.
    logoUrl:
      storedPublicUrl(payload.logoUrl) ||
      storedPublicUrl(prev.logoUrl) ||
      undefined,
    bannerUrl:
      storedPublicUrl(payload.bannerUrl) ||
      storedPublicUrl(prev.bannerUrl) ||
      undefined,
    directAccess: payload.directAccess.trim() || undefined,
    directRegistrationCode: payload.directRegistrationCode.trim() || undefined,
    clubPasswordHash: options?.clubPasswordHash ?? prev.clubPasswordHash,
    referencesHtml: payload.referencesHtml.trim() || undefined,
    referencesLevel: payload.referencesLevel.trim() || undefined,
    legalDocuments: prev.legalDocuments,
    defaultPaymentMethods: prev.defaultPaymentMethods,
    customQuestions: prev.customQuestions,
    // Club account form — do not keep team-tab payload on club saves.
    teamProfile: undefined,
  };
  const hasMeta = Object.values(meta).some((v) => v !== undefined && v !== '');
  return hasMeta ? JSON.stringify(meta) : JSON.stringify({ createdViaForm: true });
}

/** Update only club references inside `clubs_new.description` JSON. */
export function mergeClubReferencesForSave(
  existingDescription: string | null | undefined,
  references: { referencesHtml: string; referencesLevel: string },
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const meta: ClubDescriptionMeta = {
    ...prev,
    createdViaForm: prev.createdViaForm ?? true,
    referencesHtml: references.referencesHtml.trim() || undefined,
    referencesLevel: references.referencesLevel.trim() || '1',
  };
  return JSON.stringify(meta);
}
