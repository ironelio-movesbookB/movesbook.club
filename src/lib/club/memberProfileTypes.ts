/** Shared Owner-profile / contacts / activities (user DB). */
export type OwnerProfileData = {
  privateSettings: {
    disallowClubAdmins: boolean;
  };
  photoUrl: string;
  qrCodeUrl: string;
  login: {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    newPassword: string;
    repeatPassword: string;
  };
  address: {
    country: string;
    region: string;
    province: string;
    city: string;
    zipCode: string;
    address: string;
    geoCoordinates: string;
    alternativeMail: string;
    phone: string;
    phoneWhatsapp: boolean;
    phoneTelegram: boolean;
    mobile1: string;
    mobile1Whatsapp: boolean;
    mobile1Telegram: boolean;
    mobile2: string;
    mobile2Whatsapp: boolean;
    mobile2Telegram: boolean;
    whatsappGroupName: string;
    telegramGroupName: string;
  };
  personal: {
    gender: string;
    dateOfBirth: string;
    age: number | null;
    /** Birthday country */
    countryOfBirth: string;
    locationOfBirth: string;
    provinceOfBirth: string;
    nameDay: string;
    occupation: string;
    /** User/Member entry date */
    sinceDate: string;
    mainSport: string;
    otherSports: string[];
  };
  administrative: {
    fiscalCode: string;
    /** Check: Identification code for foreigners */
    foreignerIdCode: boolean;
    documentId: string;
    citizenship: string;
    carDrivingLicense: string;
    iban: string;
  };
  /** Personal documents: number + expiry + front/back photos */
  documents: {
    idCard: PersonalDocumentData;
    drivingLicence: PersonalDocumentData;
    healthInsuranceCard: PersonalDocumentData;
    passport: PersonalDocumentData;
    residencePermit: PersonalDocumentData;
  };
  medical: {
    bloodGroup: string;
    /** Medical certificate info */
    medicalExamination: string;
    releaseDate: string;
    expirationDate: string;
    alert30gg: boolean;
    outcome: string;
    doctorWhoIssued: string;
    emergencyContactPhone: string;
    emergencyContactName: string;
    allergies: string;
    intolerances: string;
    blsdExpiry: string;
    firstAidExpiry: string;
    imageUrl: string;
    pdfUrl: string;
    ecgUrl: string;
  };
  bodyMeasurements: {
    height: string;
    heightUnit: 'cm' | 'inches';
    weight: string;
    weightUnit: 'kg' | 'pounds';
    jerseySize: string;
    shortsSize: string;
    shoeSize: string;
  };
  otherReferences: {
    language: string;
    timezone: string;
    unitOfMeasure: string;
    theme: string;
    notes: string;
  };
};

export type PersonalDocumentData = {
  number: string;
  expiry: string;
  frontUrl: string;
  backUrl: string;
};

export type ContactsData = {
  alternateEmail: string;
  phonePrefix: string;
  phoneNumber: string;
  socialSites: [{ platform: string; url: string }, { platform: string; url: string }];
  myWebsite: { url: string; showInPublicInfo: boolean };
  whatsapp: { url: string; showInPublicInfo: boolean };
  instagram: { url: string; showInPublicInfo: boolean };
  youtube: { url: string; showInPublicInfo: boolean };
  linkedin: { url: string; showInPublicInfo: boolean };
  blogSite: { url: string; showInPublicInfo: boolean };
  googleMap: { url: string; showInPublicInfo: boolean };
  aboutMe: string;
  /** @deprecated legacy flat fields — migrated by normalizeContacts */
  website?: string;
};

export type ActivitiesData = {
  notes: string;
  preferredDays: string[];
  /** @deprecated was misused as free-time text; kept for migration */
  preferredTime: string;
  /** Selected free-time activity labels (from FREE_TIME_ACTIVITY_OPTIONS). */
  freeTimeActivities: string[];
};

export type ClubVisibilityFlags = {
  otherDetails: boolean;
  parents: boolean;
  settings: boolean;
  messagesStaff: boolean;
  notesCoach: boolean;
  notesCoachComments: boolean;
  presences: boolean;
  payFor: boolean;
};

export type ParentData = {
  name: string;
  surname: string;
  fiscalCode: string;
  /** Identification code for foreigners */
  foreignerIdCode: boolean;
  /** The holder of this tax code will receive the invoice */
  invoiceHolder: boolean;
  kinship: string;
  birthDate: string;
  country: string;
  location: string;
  province: string;
  phone1: string;
  phone2: string;
  mainEmail: string;
  alternativeMail: string;
  residentialAddress: string;
  residenceLocation: string;
  residenceZip: string;
  residenceProvince: string;
  whatsappGroup: boolean;
  telegramGroup: boolean;
  /**
   * Link key when chosen from club parents catalog:
   * `${memberId}:parent1|parent2`
   */
  linkedParentKey: string;
  /** Tagged club member ids (siblings); parent data is copied to their profiles on save. */
  otherChildrenMemberIds: string[];
};

/** Parent/tutor entry collected from club member profiles (for search/autofill). */
export type ClubParentCatalogEntry = {
  key: string;
  label: string;
  sourceMemberId: string;
  sourceMemberLabel: string;
  slot: 'parent1' | 'parent2';
  data: ParentData;
};

export type ClubMemberScopedData = {
  visibility: ClubVisibilityFlags;
  payForMemberIds: string[];
  otherDetails: {
    membershipFrom: string;
    membershipTo: string;
    /** Membership Registration to (org / federation) */
    membershipRegistrationTo: string;
    membershipRegistrationNumber: string;
    privacyDataTreatments: boolean;
    privacyThirdParty: boolean;
    userUnderage: boolean;
    underageCode: string;
    vendorsEnabled: boolean;
    /** Selected vendor option ids (PHP load_from_vendor; UI select, max 3). */
    vendors: string[];
    enableCommission: boolean;
    coachEnabled: boolean;
    /** Selected coach option id (PHP load_from_coach). */
    coachName: string;
    /** Athlete status radios */
    athleteStatus: string;
    /** Duplicate data from existing user id (admin create/edit helper). */
    duplicateFromUserId: string;
    /** Connect member to a trained group (blank = none). */
    groupTrainedId: string;
    insuranceCompany: string;
    insuranceNumber: string;
    insuranceDeadline: string;
    supplementaryInsuranceRequired: boolean;
    preferredPaymentMethods: string[];
    badges: Array<{ name: string; number: string; deadline: string }>;
    badgeFederationType: string;
    sportSeason: string;
    acceptanceRules: boolean;
    privacyPolicyRead: boolean;
    signatureDataUrl: string;
    newsReadEnabled: boolean;
    /** Selected news category ids (PHP new_cat_id). */
    newsReadCategories: string[];
    newsPostEnabled: boolean;
    /** Selected news category ids (PHP postnew_cat_id). */
    newsPostCategories: string[];
    genericAutoMessages: boolean;
    specificAlertMessages: boolean;
    /** Date of initial affiliation */
    initialAffiliationDate: string;
    photoVideoApproval: boolean;
    consentDate: string;
    /** Answers keyed by custom question id */
    customQuestionAnswers: Record<string, string | boolean>;
  };
  parents: {
    parent1: ParentData;
    parent2: ParentData;
    invoice: { fullName: string; fiscalCode: string; address: string };
    deduction: { enabled: boolean; year: string };
    acceptanceRules: boolean;
    privacyPolicyRead: boolean;
    signatureDataUrl: string;
  };
  settings: {
    /** Club radio — settings if the member is member of a Club. */
    clubGymEnabled: boolean;
    /** Team radio — settings if the member is member of a Team. */
    teamFootballEnabled: boolean;
    /** Active selection: club or team. */
    memberSettingKind: 'club' | 'team';
    /** Type of team / sport (dropdown). Defaults from Team/Club profile sport. */
    teamSport: string;
    /** Club setting member type id (PHP member_type_id). */
    memberTypeId: string;
    discounts: {
      subscript: string;
      service: string;
      barRest: string;
      supply: string;
      clothing: string;
      outfit: string;
    };
    debtPurchases: string;
    heartRate: string;
    athleticLevel: string;
    sharingDefault: string;
    followUpNotifications: string;
    informationUpdates: boolean;
    /**
     * Master switch for Access control / debt at access / secondary screen.
     * Sections stay visible for Club and Team; unchecked disables those functions.
     */
    accessFunctionsEnabled: boolean;
    accessControl: {
      activeBlockAccess: 'analyzes_all' | 'free_access' | 'access_from';
      freeAccessDate: string;
      activeBlockAccessFrom: string;
      activeBlockAccessTo: string;
      debtMax: string;
    };
    secondaryScreen: {
      enabled: boolean;
      memberName: boolean;
      expSubscription: boolean;
      memberPhoto: boolean;
      outcomeAccess: boolean;
      residualDebt: boolean;
      audioMessages: boolean;
      birthDay: boolean;
      otherManagementData: boolean;
      msgFromOtherMember: boolean;
    };
    /** Primary view: Club vs Team (derived from memberSettingKind for older UI). */
    sportMode: 'CLUB-GYM' | 'TEAM-FOOTBALL';
    football: {
      membershipNumber: string;
      expiringDate: string;
      annualMembershipFee: string;
      firstPayment: {
        amount: string;
        date: string;
        status: string;
      };
      secondPayment: {
        amount: string;
        date: string;
        status: string;
      };
      thirdPayment: {
        amount: string;
        date: string;
        status: string;
      };
      paymentMethod: string;
      /** Single overall payment status (Paid / Pending / Not paid). */
      paymentStatus: string;
      receiptIssued: boolean;
      imageRelease: boolean;
      travelAuthorization: boolean;
      athleteStatus: string;
      sportsPlayed: string[];
      teamNames: string;
      previousClub: string;
      releaseDate: string;
      playerRegistration: string;
      category: string;
      sportsSeason: string;
      position: string;
      specialty: string;
      footHand: string;
      jerseyNumber: string;
      shoesNumber: string;
      jerseySize: string;
      shortsSize: string;
      shoeSize: string;
      weight: string;
      height: string;
      reactionTime: string;
      verticalJump: string;
      coach: string;
      startDateWithTeam: string;
    };
  };
  staffMessage: {
    enableFrom: string;
    enableTo: string;
    showAtLogin: boolean;
    showAtLogout: boolean;
    html: string;
  };
};

export type MemberProfileBundle = {
  /** Club id, or team id when `workspaceKind` is `team`. */
  clubId: string;
  /** `team` when opened from Team Admin Archive of Users. */
  workspaceKind?: 'club' | 'team';
  clubName: string;
  /** Sport from Club/Team profile (category) — default for Settings team-type dropdown. */
  entitySportDefault: string;
  clubMemberId: string;
  memberId: string;
  role: string | null;
  membershipType: string | null;
  viewer: {
    isClubAdmin: boolean;
    isSelf: boolean;
    canEditOwner: boolean;
    canEditContactsActivitiesReferences: boolean;
    canEditClubScoped: boolean;
    /** Member may save their own signature / acceptance fields. */
    canEditMemberSignature: boolean;
  };
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    firstName: string | null;
    surname: string | null;
    gender: string | null;
    birthdate: string | null;
    country: string | null;
    image: string | null;
  };
  owner: OwnerProfileData;
  contacts: ContactsData;
  activities: ActivitiesData;
  referencesHtml: string;
  /** 1–6, same as PHP / club references level. */
  referencesLevel: string;
  club: ClubMemberScopedData;
  clubMembersForPayFor: Array<{ id: string; label: string }>;
  /** Options for Vendors select (club operators + members). */
  vendorCoachOptions: Array<{ id: string; label: string }>;
  /** Coach select: Staff\\Operators who are Instructors or Personal Trainers. */
  coachOptions: Array<{ id: string; label: string }>;
  /** Parents/tutors already filled on club members (for search + autofill). */
  clubParentsCatalog: import('@/lib/club/memberProfileTypes').ClubParentCatalogEntry[];
  /** Club customized questions (admin-defined). */
  customQuestions: CustomQuestionDef[];
  staffNotes: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    authorLabel: string;
    /** Inherited from the Messages document schedule when the post was created. */
    showAtLogin: boolean;
    showAtLogout: boolean;
    replies: Array<{ id: string; body: string; createdAt: string; authorLabel: string }>;
  }>;
  coachNotes: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    authorLabel: string;
    visibleToMember: boolean;
    commentsEnabled: boolean;
    imageUrls: string[];
    authorImage?: string | null;
    enableFrom: string;
    enableTo: string;
    showAtLogin: boolean;
    showAtLogout: boolean;
    replies: Array<{ id: string; body: string; createdAt: string; authorLabel: string }>;
  }>;
};

export const MAIN_SPORTS = [
  'Basket',
  'Body Building',
  'Cycling',
  'Football',
  'Gymnastic',
  'Martial arts',
  'Swimming',
  'Volley',
  'Gym',
  'Running',
  'Dance',
] as const;

/** Club\Gym membership status (Other details → Athlete status). */
export const ATHLETE_STATUS_OPTIONS = [
  'Member',
  'Not a member',
  'On probation',
  'Non-member Associate',
] as const;

/** Athlete status when the member belongs to a TEAM instead of a Club\Gym. */
export const TEAM_ATHLETE_STATUS_OPTIONS = [
  'Active',
  'Inactive',
  'Injured',
  'Suspended',
] as const;

/** TEAM-FOOTBALL Settings → Payment method (spec list). */
export const TEAM_FOOTBALL_PAYMENT_METHOD_OPTIONS = [
  'Cash',
  'Bank transfer',
  'POS',
  'SEPA',
] as const;

/** Sections an admin can copy when duplicating another member's dossier. */
export type DuplicateMemberSection =
  | 'member-profile'
  | 'parents'
  | 'other-data'
  | 'settings'
  | 'alert-posted'
  | 'coach-notes';

export const INSURANCE_COMPANY_OPTIONS = [
  'ACSI SPORT',
  'AICS',
  'ALLEANZA ASSICURAZIONI',
  'ALLIANZ',
  'ASC',
  'ASI',
  'AXA',
  'CATTOLICA ASSICURAZIONI',
  'ConTe.it',
  'Credit Agricole Assicurazioni',
  'CSAIN',
  'CSEN',
  'CSI',
  'DAN',
  'DIRECT ASSICURAZIONI',
  'ENDAS',
  'FEDERKOMBAT',
  'FGI',
  'FIE',
  'FIGC',
  'Fijlkam',
  'FIPAV',
  'FISI',
  'FITW',
  'GENERALI ITALIA',
  'GENIALLIFE',
  'GROUPAMA',
  'LIBERTAS',
  'LINEAR ASSICURAZIONI',
  'OPES',
  'PGS',
  'Poste Assicura',
  'Posteassicura',
  'Prima.it',
  'Reale Mutua Assicurazioni',
  'SciSicuro',
  'UBI Assicurazioni',
  'UISP',
  'UNIPOL Sai',
  'US ACLI',
  'Verti Assicurazioni',
  'Vittoria Assicurazioni spa',
  'Vittoria Assicurazioni PGS FGI',
  'Zurich',
  'Zurich Connect',
] as const;

export type CustomQuestionAnswerType =
  | 'free'
  | 'checkbox'
  | 'yes_no'
  | 'list';

export type CustomQuestionDef = {
  id: string;
  question: string;
  answerType: CustomQuestionAnswerType;
  visibleInRegistration: boolean;
  mandatory: boolean;
  /** Comma-separated options when answerType is list */
  listOptions: string;
};

export const PARENTS_TAB_LABEL = 'Parents';

export const SHARING_DEFAULT_OPTIONS = [
  'Only friends',
  'Coaches & team friends',
  'All members',
  'No one',
] as const;

export const FOLLOW_UP_NOTIFICATION_OPTIONS = [
  'No notifications',
  'Only friends',
  'All members',
  'Email only',
] as const;

export const ATHLETIC_LEVEL_OPTIONS = ['1', '2', '3', '4', '5'] as const;

export const KINSHIP_OPTIONS = [
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Uncle',
  'Tutor',
] as const;

export const THEME_OPTIONS = [
  { id: 'classic', label: 'Classic', color: '#058592' },
  { id: 'ocean', label: 'Ocean', color: '#0d9488' },
  { id: 'ember', label: 'Ember', color: '#c2410c' },
  { id: 'forest', label: 'Forest', color: '#15803d' },
  { id: 'slate', label: 'Slate', color: '#334155' },
] as const;

export function getThemeColorById(themeId: string | null | undefined): string {
  const id = String(themeId || '').trim();
  const found = THEME_OPTIONS.find((t) => t.id === id);
  return found?.color || THEME_OPTIONS[0].color;
}
