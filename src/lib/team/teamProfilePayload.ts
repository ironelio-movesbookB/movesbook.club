import { defaultClubSubscriptionEndDate } from '@/lib/admin/clubSubscriptionStatus';
import {
  parseClubDescriptionMeta,
  type ClubDescriptionMeta,
} from '@/lib/club/clubSidebarLabel';
import { DEFAULT_ENTITY_SPORT } from '@/lib/sport/entitySportOptions';
import {
  emptyTeamAdminSport,
  emptyTeamContacts,
  emptyTeamFederal,
  emptyTeamLegalSite,
  emptyTeamMainData,
} from '@/lib/team/teamProfileDefaults';
import type {
  TeamAdminSportData,
  TeamContacts,
  TeamFederalMembership,
  TeamLegalSite,
  TeamMainData,
  TeamProfileFormPayload,
  TeamProfileSections,
} from '@/lib/team/teamProfileTypes';

function trimOrEmpty(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function mergeSection<T extends Record<string, unknown>>(
  defaults: T,
  partial: Partial<T> | undefined,
): T {
  if (!partial) return defaults;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = partial[key];
    if (value === undefined) continue;
    out[key] = value as T[keyof T];
  }
  return out;
}

export function parseTeamProfileSections(
  description: string | null | undefined,
): TeamProfileSections {
  const meta = parseClubDescriptionMeta(description);
  const stored = meta.teamProfile;

  const legalSite = mergeSection(emptyTeamLegalSite(), stored?.legalSite);
  legalSite.country = legalSite.country || trimOrEmpty(meta.country) || 'Italy';
  legalSite.region = legalSite.region || trimOrEmpty(meta.region);
  legalSite.location = legalSite.location || trimOrEmpty(meta.location);
  legalSite.zipCode = legalSite.zipCode || trimOrEmpty(meta.zipCode);
  legalSite.officeAddress = legalSite.officeAddress || trimOrEmpty(meta.address);
  legalSite.geo = legalSite.geo || trimOrEmpty(meta.geo);

  const contacts = mergeSection(emptyTeamContacts(), stored?.contacts);
  contacts.email = contacts.email || trimOrEmpty(meta.mail);

  return {
    mainData: mergeSection(emptyTeamMainData(), stored?.mainData),
    legalSite,
    contacts,
    federal: mergeSection(emptyTeamFederal(), stored?.federal),
    adminSport: mergeSection(emptyTeamAdminSport(), stored?.adminSport),
  };
}

export function teamToFormPayload(team: {
  name: string;
  description?: string | null;
  sport?: string | null;
}): TeamProfileFormPayload {
  const meta = parseClubDescriptionMeta(team.description);
  const sections = parseTeamProfileSections(team.description);
  const sports =
    Array.isArray(meta.sports) && meta.sports.length > 0
      ? meta.sports.map(String).filter(Boolean)
      : trimOrEmpty(team.sport) || trimOrEmpty(meta.category)
        ? [trimOrEmpty(team.sport) || trimOrEmpty(meta.category)]
        : [DEFAULT_ENTITY_SPORT];

  return {
    sport: sports[0] || DEFAULT_ENTITY_SPORT,
    sports,
    logoUrl: trimOrEmpty(meta.logoUrl),
    username: trimOrEmpty(meta.username),
    officialName: trimOrEmpty(team.name),
    directAccess: trimOrEmpty(meta.directAccess),
    directRegistrationCode: trimOrEmpty(meta.directRegistrationCode),
    teamPassword: '',
    ...sections,
  };
}

function compactTeamProfileSections(payload: TeamProfileFormPayload): TeamProfileSections {
  return {
    mainData: payload.mainData,
    legalSite: payload.legalSite,
    contacts: payload.contacts,
    federal: payload.federal,
    adminSport: payload.adminSport,
  };
}

export function mergeTeamDescriptionForSave(
  existingDescription: string | null | undefined,
  payload: TeamProfileFormPayload,
  options?: { clubPasswordHash?: string; isCreate?: boolean },
): string {
  const prev = parseClubDescriptionMeta(existingDescription);
  const sports =
    Array.isArray(payload.sports) && payload.sports.length > 0
      ? payload.sports.map((s) => s.trim()).filter(Boolean)
      : trimOrEmpty(payload.sport)
        ? [trimOrEmpty(payload.sport)]
        : [DEFAULT_ENTITY_SPORT];
  const sport = sports[0] || DEFAULT_ENTITY_SPORT;

  const meta: ClubDescriptionMeta = {
    ...prev,
    createdViaForm: true,
    subscriptionEnd:
      prev.subscriptionEnd?.trim() ||
      (options?.isCreate ? defaultClubSubscriptionEndDate() : undefined),
    username: trimOrEmpty(payload.username) || undefined,
    category: sport,
    sports,
    // Keep existing logo when blank (blob/data preview not yet uploaded).
    // Never persist data:/blob: URLs into description JSON.
    logoUrl: (() => {
      const next = trimOrEmpty(payload.logoUrl);
      if (!next) return trimOrEmpty(prev.logoUrl) || undefined;
      if (next.startsWith('data:') || next.startsWith('blob:')) {
        return trimOrEmpty(prev.logoUrl) || undefined;
      }
      return next;
    })(),
    phone: trimOrEmpty(payload.contacts.phone1) || undefined,
    website: trimOrEmpty(payload.contacts.website) || undefined,
    province: trimOrEmpty(payload.legalSite.province) || undefined,
    country: trimOrEmpty(payload.legalSite.country) || undefined,
    region: trimOrEmpty(payload.legalSite.region) || undefined,
    location: trimOrEmpty(payload.legalSite.location) || undefined,
    zipCode: trimOrEmpty(payload.legalSite.zipCode) || undefined,
    address:
      trimOrEmpty(payload.legalSite.officeAddress) ||
      trimOrEmpty(payload.legalSite.fieldAddress) ||
      undefined,
    geo: trimOrEmpty(payload.legalSite.geo) || undefined,
    mail: trimOrEmpty(payload.contacts.email) || undefined,
    directAccess: trimOrEmpty(payload.directAccess) || undefined,
    directRegistrationCode: trimOrEmpty(payload.directRegistrationCode) || undefined,
    clubPasswordHash: options?.clubPasswordHash ?? prev.clubPasswordHash,
    teamProfile: compactTeamProfileSections(payload),
  };

  return JSON.stringify(meta);
}

export function isTeamProfilePayload(body: Record<string, unknown>): boolean {
  return 'sport' in body || 'mainData' in body || 'legalSite' in body;
}

export type { TeamMainData, TeamLegalSite, TeamContacts, TeamFederalMembership, TeamAdminSportData };
