import { DEFAULT_ENTITY_SPORT } from '@/lib/sport/entitySportOptions';
import { normalizeSeasonStats, normalizeStringRecord } from '@/lib/sport/sportProfileTypes';
import type {
  EntitySportProfileData,
  TeamAdminSportData,
  TeamContacts,
  TeamFederalMembership,
  TeamLegalSite,
  TeamMainData,
  TeamProfileFormPayload,
  TeamProfileSections,
} from '@/lib/team/teamProfileTypes';

export function emptyTeamMainData(): TeamMainData {
  return {
    shortName: '',
    companyType: '',
    federationName: '',
    wholeFederationName: '',
    entity: '',
    registeredAt: '',
    idNumber: '',
    registrationDate: '',
    fiscalCode: '',
    foundationDate: '',
    socialColors: '',
  };
}

export function emptyTeamLegalSite(): TeamLegalSite {
  return {
    officeAddress: '',
    location: '',
    zipCode: '',
    province: '',
    country: 'Italy',
    region: '',
    mainPlayingField: '',
    fieldAddress: '',
    fieldType: '',
    approvalCheck: false,
    capacity: '',
    sportsScoreboards: '',
    basketsAndNets: '',
    geo: '',
    federationAffiliation: '',
    homologationNumber: '',
    homologationExpiry: '',
    courtType: '',
    courtSurface: '',
    backboards: '',
    hoopHeight: '',
  };
}

export function emptyTeamContacts(): TeamContacts {
  return {
    website: '',
    email: '',
    pec: '',
    phone1: '',
    phone2: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    telegram: '',
  };
}

export function emptyTeamFederal(): TeamFederalMembership {
  return {
    federation: '',
    sportsLeague: '',
    regionalCommittee: '',
    provincialDelegation: '',
    registrationNumber: '',
    affiliationDate: '',
    affiliationExpiry: '',
    promotionalBody: '',
    cioCode: '',
    mainCategory: '',
    group: '',
    sportsSeason: '',
    otherCategories: '',
    membershipNumber: '',
    expiringDate: '',
  };
}

export function emptyTeamAdminSport(): TeamAdminSportData {
  return {
    president: '',
    vicePresident: '',
    secretary: '',
    treasurer: '',
    youthSectorManager: '',
    iban: '',
    sdiInvoicingCode: '',
    headCoach: '',
    coachingLicenseNumber: '',
    assistantCoach: '',
    fitnessCoach: '',
    goalkeeperCoach: '',
    teamDoctor: '',
    mainSponsor: '',
    technicalSupplier: '',
  };
}

export function emptyTeamProfileSections(): TeamProfileSections {
  return {
    mainData: emptyTeamMainData(),
    legalSite: emptyTeamLegalSite(),
    contacts: emptyTeamContacts(),
    federal: emptyTeamFederal(),
    adminSport: emptyTeamAdminSport(),
    sportProfile: emptyEntitySportProfile(),
  };
}

export function emptyEntitySportProfile(): EntitySportProfileData {
  return { fields: {}, stats: {} };
}

export function normalizeEntitySportProfile(raw: unknown): EntitySportProfileData {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<EntitySportProfileData>) : {};
  const mapValues = <T,>(value: unknown, fn: (v: unknown) => T): Record<string, T> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fn(v)]))
      : {};
  return {
    fields: mapValues(obj.fields, normalizeStringRecord),
    stats: mapValues(obj.stats, normalizeSeasonStats),
  };
}

export function emptyTeamProfileForm(): TeamProfileFormPayload {
  return {
    sport: DEFAULT_ENTITY_SPORT,
    sports: [DEFAULT_ENTITY_SPORT],
    logoUrl: '',
    username: '',
    officialName: '',
    directAccess: '',
    directRegistrationCode: '',
    teamPassword: '',
    ...emptyTeamProfileSections(),
  };
}
