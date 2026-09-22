export type TeamMainData = {
  shortName: string;
  /** Super Admin → Sport settings → Teams parameter settings */
  companyType: string;
  federationName: string;
  wholeFederationName: string;
  entity: string;
  registeredAt: string;
  idNumber: string;
  /** Registration / ID date */
  registrationDate: string;
  fiscalCode: string;
  foundationDate: string;
  socialColors: string;
};

export type TeamLegalSite = {
  officeAddress: string;
  location: string;
  zipCode: string;
  province: string;
  country: string;
  region: string;
  mainPlayingField: string;
  fieldAddress: string;
  fieldType: string;
  approvalCheck: boolean;
  capacity: string;
  sportsScoreboards: string;
  basketsAndNets: string;
  /** Geographic coordinate of the team site (latitude, longitude). */
  geo?: string;
};

export type TeamContacts = {
  website: string;
  email: string;
  pec: string;
  phone1: string;
  phone2: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  telegram: string;
};

export type TeamFederalMembership = {
  federation: string;
  sportsLeague: string;
  regionalCommittee: string;
  provincialDelegation: string;
  registrationNumber: string;
  affiliationDate: string;
  affiliationExpiry: string;
  promotionalBody: string;
  cioCode: string;
  mainCategory: string;
  group: string;
  sportsSeason: string;
  otherCategories: string;
  /** @deprecated kept for older saved profiles */
  membershipNumber?: string;
  expiringDate?: string;
};

export type TeamAdminSportData = {
  president: string;
  vicePresident: string;
  secretary: string;
  treasurer: string;
  youthSectorManager: string;
  iban: string;
  sdiInvoicingCode: string;
  /** Main coach */
  headCoach: string;
  coachingLicenseNumber: string;
  assistantCoach: string;
  fitnessCoach: string;
  goalkeeperCoach: string;
  teamDoctor: string;
  mainSponsor: string;
  technicalSupplier: string;
};

export type TeamProfileSections = {
  mainData: TeamMainData;
  legalSite: TeamLegalSite;
  contacts: TeamContacts;
  federal: TeamFederalMembership;
  adminSport: TeamAdminSportData;
};

export type TeamProfileFormPayload = {
  sport: string;
  /** Multicheck sports; sport stays the primary (first) for teams_new.sport. */
  sports: string[];
  logoUrl: string;
  username: string;
  officialName: string;
  directAccess: string;
  directRegistrationCode: string;
  /** Empty when not changing password (edit mode). */
  teamPassword: string;
} & TeamProfileSections;

/** Edit/create save payload — may include a new logo file. */
export type TeamProfileSavePayload = TeamProfileFormPayload & {
  logoFile?: File | null;
  removeLogo?: boolean;
};

export type TeamProfileTabId =
  | 'team-profile'
  | 'contacts'
  | 'federal'
  | 'subteams'
  | 'admin-sport'
  | 'passwords';

export const TEAM_PROFILE_TABS: { id: TeamProfileTabId; label: string }[] = [
  { id: 'team-profile', label: 'Team Profile' },
  { id: 'contacts', label: 'Team contacts' },
  { id: 'federal', label: 'Federal membership' },
  { id: 'subteams', label: 'Subteams and Categories' },
  { id: 'admin-sport', label: 'Administrative & Sport data' },
  { id: 'passwords', label: 'Passwords' },
];
