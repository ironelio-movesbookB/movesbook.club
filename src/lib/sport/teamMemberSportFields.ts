import { normalizeEntitySport, type EntitySportOption } from '@/lib/sport/entitySportOptions';

/** Which extra TEAM fields a team sport shows in the member profile Settings tab. */
export type TeamMemberSportFields = {
  /** Registered / On loan / On trial, shown first in the block. */
  registrationStatus: boolean;
  registrationType: boolean;
  /** Fiscal code, citizenship and IBAN read from the owner's administrative data. */
  administrativeSummary: boolean;
  labels: {
    membershipNumber: string;
    expiringDate: string;
    athleteStatus: string;
    footHand: string;
    /** Overrides the Super Admin parameter title when set. */
    category?: string;
    position?: string;
  };
};

const FOOTBALL: TeamMemberSportFields = {
  registrationStatus: false,
  registrationType: false,
  administrativeSummary: false,
  labels: {
    membershipNumber: 'Membership number',
    expiringDate: 'Expiring date',
    athleteStatus: 'Athlete status',
    footHand: 'Foot/Hand',
  },
};

const BASKET: TeamMemberSportFields = {
  registrationStatus: true,
  registrationType: true,
  administrativeSummary: true,
  labels: {
    membershipNumber: 'Number of membership',
    expiringDate: 'Membership expiration',
    athleteStatus: 'Availability',
    footHand: 'Dominant hand',
    category: 'Athlete category',
    position: 'Positions',
  },
};

const BY_SPORT: Partial<Record<EntitySportOption, TeamMemberSportFields>> = {
  Football: FOOTBALL,
  Basket: BASKET,
};

/** Administrative TEAM field labels; sports without their own set use the Football one. */
export function teamMemberSportFields(sport: string | null | undefined): TeamMemberSportFields {
  return BY_SPORT[normalizeEntitySport(sport)] ?? FOOTBALL;
}
