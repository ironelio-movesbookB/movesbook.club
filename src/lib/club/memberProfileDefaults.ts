import type {
  ActivitiesData,
  ClubMemberScopedData,
  ContactsData,
  OwnerProfileData,
  ParentData,
} from '@/lib/club/memberProfileTypes';
import {
  TEAM_ATHLETE_STATUS_OPTIONS,
  TEAM_FOOTBALL_PAYMENT_METHOD_OPTIONS,
} from '@/lib/club/memberProfileTypes';
import { PAYMENT_STATUS_OPTIONS } from '@/lib/procedures/payModes';

function emptyParent(): ParentData {
  return {
    name: '',
    surname: '',
    fiscalCode: '',
    foreignerIdCode: false,
    invoiceHolder: false,
    kinship: '',
    birthDate: '',
    country: '',
    location: '',
    province: '',
    phone1: '',
    phone2: '',
    mainEmail: '',
    alternativeMail: '',
    residentialAddress: '',
    residenceLocation: '',
    residenceZip: '',
    residenceProvince: '',
    whatsappGroup: false,
    telegramGroup: false,
    linkedParentKey: '',
    otherChildrenMemberIds: [],
  };
}

function parseMemberIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeParentData(partial?: Partial<ParentData> & { otherChildrenTags?: string }): ParentData {
  const base = emptyParent();
  if (!partial) return base;
  const ids = parseMemberIds(
    partial.otherChildrenMemberIds ?? partial.otherChildrenTags ?? base.otherChildrenMemberIds,
  );
  return {
    ...base,
    ...partial,
    foreignerIdCode: Boolean(partial.foreignerIdCode ?? base.foreignerIdCode),
    invoiceHolder: Boolean(partial.invoiceHolder ?? base.invoiceHolder),
    otherChildrenMemberIds: ids,
    linkedParentKey: String(partial.linkedParentKey ?? base.linkedParentKey ?? ''),
  };
}


export function emptyOwnerProfile(partial?: Partial<OwnerProfileData>): OwnerProfileData {
  return {
    privateSettings: { disallowClubAdmins: false },
    photoUrl: '',
    qrCodeUrl: '',
    login: {
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      newPassword: '',
      repeatPassword: '',
    },
    address: {
      country: '',
      region: '',
      province: '',
      city: '',
      zipCode: '',
      address: '',
      geoCoordinates: '',
      alternativeMail: '',
      phone: '',
      phoneWhatsapp: false,
      phoneTelegram: false,
      mobile1: '',
      mobile1Whatsapp: false,
      mobile1Telegram: false,
      mobile2: '',
      mobile2Whatsapp: false,
      mobile2Telegram: false,
      whatsappGroupName: '',
      telegramGroupName: '',
    },
    personal: {
      gender: '',
      dateOfBirth: '',
      age: null,
      countryOfBirth: '',
      locationOfBirth: '',
      provinceOfBirth: '',
      nameDay: '',
      occupation: '',
      sinceDate: '',
      mainSport: '',
      otherSports: [],
    },
    administrative: {
      fiscalCode: '',
      foreignerIdCode: false,
      documentId: '',
      citizenship: '',
      carDrivingLicense: '',
      iban: '',
    },
    documents: {
      idCard: emptyPersonalDocument(),
      drivingLicence: emptyPersonalDocument(),
      healthInsuranceCard: emptyPersonalDocument(),
      passport: emptyPersonalDocument(),
      residencePermit: emptyPersonalDocument(),
    },
    medical: {
      bloodGroup: '',
      medicalExamination: '',
      releaseDate: '',
      expirationDate: '',
      alert30gg: false,
      outcome: '',
      doctorWhoIssued: '',
      emergencyContactPhone: '',
      emergencyContactName: '',
      allergies: '',
      intolerances: '',
      blsdExpiry: '',
      firstAidExpiry: '',
      imageUrl: '',
      pdfUrl: '',
      ecgUrl: '',
    },
    bodyMeasurements: {
      height: '',
      heightUnit: 'cm',
      weight: '',
      weightUnit: 'kg',
      jerseySize: '',
      shortsSize: '',
      shoeSize: '',
    },
    otherReferences: {
      language: 'en',
      timezone: 'Europe/Rome',
      unitOfMeasure: 'metric',
      theme: 'classic',
      notes: '',
    },
    ...partial,
  };
}

function emptyPersonalDocument(): import('@/lib/club/memberProfileTypes').PersonalDocumentData {
  return { number: '', expiry: '', frontUrl: '', backUrl: '' };
}

const EMPTY_CONTACT_LINK = { url: '', showInPublicInfo: false };

function parseCategoryIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function emptyContacts(): ContactsData {
  return {
    alternateEmail: '',
    phonePrefix: '',
    phoneNumber: '',
    socialSites: [
      { platform: 'Facebook', url: '' },
      { platform: 'Twitter', url: '' },
    ],
    myWebsite: { ...EMPTY_CONTACT_LINK },
    whatsapp: { ...EMPTY_CONTACT_LINK },
    instagram: { ...EMPTY_CONTACT_LINK },
    youtube: { ...EMPTY_CONTACT_LINK },
    linkedin: { ...EMPTY_CONTACT_LINK },
    blogSite: { ...EMPTY_CONTACT_LINK },
    googleMap: { ...EMPTY_CONTACT_LINK },
    aboutMe: '',
  };
}

function asContactLink(raw: unknown, legacyUrl?: unknown): ContactsData['myWebsite'] {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      url: typeof o.url === 'string' ? o.url : '',
      showInPublicInfo: Boolean(
        o.showInPublicInfo ?? o.showInClubAdminInfo ?? false,
      ),
    };
  }
  if (typeof raw === 'string') {
    return { url: raw, showInPublicInfo: false };
  }
  if (typeof legacyUrl === 'string') {
    return { url: legacyUrl, showInPublicInfo: false };
  }
  return { ...EMPTY_CONTACT_LINK };
}

function asSocialSite(
  raw: unknown,
  fallbackPlatform: string,
): { platform: string; url: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      platform:
        typeof o.platform === 'string' && o.platform.trim()
          ? o.platform.trim()
          : fallbackPlatform,
      url: typeof o.url === 'string' ? o.url : '',
    };
  }
  return { platform: fallbackPlatform, url: '' };
}

/** Normalize contacts JSON (supports legacy flat website/whatsapp string fields). */
export function normalizeContacts(raw: unknown): ContactsData {
  const base = emptyContacts();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const socialRaw = Array.isArray(o.socialSites) ? o.socialSites : [];
  return {
    alternateEmail: typeof o.alternateEmail === 'string' ? o.alternateEmail : '',
    phonePrefix: typeof o.phonePrefix === 'string' ? o.phonePrefix : '',
    phoneNumber: typeof o.phoneNumber === 'string' ? o.phoneNumber : '',
    socialSites: [
      asSocialSite(socialRaw[0], 'Facebook'),
      asSocialSite(socialRaw[1], 'Twitter'),
    ],
    myWebsite: asContactLink(o.myWebsite, o.website),
    whatsapp: asContactLink(o.whatsapp),
    instagram: asContactLink(o.instagram),
    youtube: asContactLink(o.youtube),
    linkedin: asContactLink(o.linkedin),
    blogSite: asContactLink(o.blogSite),
    googleMap: asContactLink(o.googleMap),
    aboutMe: typeof o.aboutMe === 'string' ? o.aboutMe : '',
  };
}

export function emptyActivities(): ActivitiesData {
  return {
    notes: '',
    preferredDays: [],
    preferredTime: '',
    freeTimeActivities: [],
  };
}

/** Fixed free-time activities shown as check buttons (with icons in the UI). */
export const FREE_TIME_ACTIVITY_OPTIONS = [
  { id: 'Music', label: 'Music', icon: 'Music' },
  { id: 'Tv', label: 'Tv', icon: 'Tv' },
  { id: 'Radio', label: 'Radio', icon: 'Radio' },
  { id: 'Gardening', label: 'Gardening', icon: 'Flower2' },
  { id: 'Reading', label: 'Reading', icon: 'BookOpen' },
  { id: 'Walking', label: 'Walking', icon: 'Footprints' },
  { id: 'Painting', label: 'Painting', icon: 'Palette' },
  { id: 'Fishing', label: 'Fishing', icon: 'Fish' },
  { id: 'Hunting', label: 'Hunting', icon: 'Crosshair' },
  { id: 'Orientering', label: 'Orientering', icon: 'Compass' },
  { id: 'Travels', label: 'Travels', icon: 'Plane' },
  { id: 'Kitchen', label: 'Kitchen', icon: 'UtensilsCrossed' },
  { id: 'Chat', label: 'Chat', icon: 'MessageCircle' },
  { id: 'Internet', label: 'Internet', icon: 'Globe' },
  { id: 'Sport', label: 'Sport', icon: 'Dumbbell' },
  { id: 'Mountain', label: 'Mountain', icon: 'Mountain' },
  { id: 'Sea', label: 'Sea', icon: 'Waves' },
  { id: 'Countryside', label: 'Countryside', icon: 'TreePine' },
  { id: 'Other activities', label: 'Other activities', icon: 'MoreHorizontal' },
] as const;

const FREE_TIME_LABEL_BY_LOWER = new Map(
  FREE_TIME_ACTIVITY_OPTIONS.map((o) => [o.label.toLowerCase(), o.label]),
);

function resolveFreeTimeLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return FREE_TIME_LABEL_BY_LOWER.get(trimmed.toLowerCase()) ?? null;
}

export function normalizeActivities(raw: Partial<ActivitiesData> | null | undefined): ActivitiesData {
  const base = emptyActivities();
  if (!raw || typeof raw !== 'object') return base;

  const preferredDays = Array.isArray(raw.preferredDays)
    ? raw.preferredDays.map((d) => String(d)).filter(Boolean)
    : [];

  const selected = new Set<string>();
  if (Array.isArray(raw.freeTimeActivities)) {
    for (const item of raw.freeTimeActivities) {
      if (typeof item === 'string') {
        const label = resolveFreeTimeLabel(item);
        if (label) selected.add(label);
        continue;
      }
      if (item && typeof item === 'object') {
        const name = String((item as { name?: unknown }).name || '').trim();
        const label = resolveFreeTimeLabel(name);
        if (label) selected.add(label);
        else if (name) selected.add('Other activities');
      }
    }
  }

  const preferredTime = typeof raw.preferredTime === 'string' ? raw.preferredTime : '';
  if (selected.size === 0 && preferredTime.trim()) {
    for (const part of preferredTime.split(/[,;|/]+/)) {
      const label = resolveFreeTimeLabel(part);
      if (label) selected.add(label);
      else if (part.trim()) selected.add('Other activities');
    }
  }

  return {
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    preferredDays,
    preferredTime,
    freeTimeActivities: FREE_TIME_ACTIVITY_OPTIONS.map((o) => o.label).filter((l) =>
      selected.has(l),
    ),
  };
}

export function emptyClubScoped(): ClubMemberScopedData {
  return {
    visibility: {
      otherDetails: true,
      parents: true,
      settings: true,
      messagesStaff: true,
      notesCoach: false,
      notesCoachComments: false,
      presences: false,
      payFor: false,
    },
    payForMemberIds: [],
    otherDetails: {
      membershipFrom: '',
      membershipTo: '',
      membershipRegistrationTo: '',
      membershipRegistrationNumber: '',
      privacyDataTreatments: false,
      privacyThirdParty: false,
      userUnderage: false,
      underageCode: '',
      vendorsEnabled: false,
      vendors: [],
      enableCommission: false,
      coachEnabled: false,
      coachName: '',
      athleteStatus: 'Member',
      duplicateFromUserId: '',
      groupTrainedId: '',
      insuranceCompany: '',
      insuranceNumber: '',
      insuranceDeadline: '',
      supplementaryInsuranceRequired: false,
      preferredPaymentMethods: [],
      badges: [
        { name: '', number: '', deadline: '' },
        { name: '', number: '', deadline: '' },
        { name: '', number: '', deadline: '' },
      ],
      badgeFederationType: '',
      sportSeason: String(new Date().getFullYear()),
      acceptanceRules: false,
      privacyPolicyRead: false,
      signatureDataUrl: '',
      newsReadEnabled: false,
      newsReadCategories: [],
      newsPostEnabled: false,
      newsPostCategories: [],
      genericAutoMessages: false,
      specificAlertMessages: false,
      initialAffiliationDate: '',
      photoVideoApproval: false,
      consentDate: '',
      customQuestionAnswers: {},
    },
    parents: {
      parent1: emptyParent(),
      parent2: emptyParent(),
      invoice: { fullName: '', fiscalCode: '', address: '' },
      deduction: { enabled: false, year: String(new Date().getFullYear()) },
      acceptanceRules: false,
      privacyPolicyRead: false,
      signatureDataUrl: '',
    },
    settings: {
      clubGymEnabled: true,
      teamFootballEnabled: false,
      memberSettingKind: 'club',
      teamSport: 'Football',
      sportMode: 'CLUB-GYM',
      memberTypeId: '',
      discounts: {
        subscript: '',
        service: '',
        barRest: '',
        supply: '',
        clothing: '',
        outfit: '',
      },
      debtPurchases: '',
      heartRate: '',
      athleticLevel: '',
      sharingDefault: 'Coaches & team friends',
      followUpNotifications: 'No notifications',
      informationUpdates: false,
      accessFunctionsEnabled: true,
      accessControl: {
        activeBlockAccess: 'analyzes_all',
        freeAccessDate: '',
        activeBlockAccessFrom: '',
        activeBlockAccessTo: '',
        debtMax: '',
      },
      secondaryScreen: {
        enabled: false,
        memberName: false,
        expSubscription: false,
        memberPhoto: false,
        outcomeAccess: false,
        residualDebt: false,
        audioMessages: false,
        birthDay: false,
        otherManagementData: false,
        msgFromOtherMember: false,
      },
      football: {
        membershipNumber: '',
        expiringDate: '',
        annualMembershipFee: '',
        firstPayment: { amount: '', date: '', status: '' },
        secondPayment: { amount: '', date: '', status: '' },
        thirdPayment: { amount: '', date: '', status: '' },
        paymentMethod: '',
        paymentStatus: '',
        receiptIssued: false,
        imageRelease: false,
        travelAuthorization: false,
        athleteStatus: 'Active',
        sportsPlayed: [],
        teamNames: '',
        previousClub: '',
        releaseDate: '',
        playerRegistration: 'No',
        category: '',
        sportsSeason: String(new Date().getFullYear()),
        position: '',
        specialty: '',
        footHand: '',
        jerseyNumber: '',
        shoesNumber: '',
        jerseySize: '',
        shortsSize: '',
        shoeSize: '',
        weight: '',
        height: '',
        reactionTime: '',
        verticalJump: '',
        coach: '',
        startDateWithTeam: '',
      },
    },
    staffMessage: {
      enableFrom: '',
      enableTo: '',
      showAtLogin: false,
      showAtLogout: false,
      html: '',
    },
  };
}

export function calcAge(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const birth = new Date(isoDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function isMemberUnderage(dateOfBirth: string | null | undefined): boolean {
  const age = calcAge(dateOfBirth || '');
  return age != null && age < 18;
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

/** Deep-merge club-scoped JSON so older/partial rows still have every nested field. */
export function mergeClubScoped(partial?: Partial<ClubMemberScopedData> | null): ClubMemberScopedData {
  const base = emptyClubScoped();
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    visibility: { ...base.visibility, ...(partial.visibility || {}) },
    payForMemberIds: Array.isArray(partial.payForMemberIds)
      ? partial.payForMemberIds
      : base.payForMemberIds,
    otherDetails: {
      ...base.otherDetails,
      ...(partial.otherDetails || {}),
      badges: (() => {
        const emptyBadge = { name: '', number: '', deadline: '' };
        const mapped =
          Array.isArray(partial.otherDetails?.badges) && partial.otherDetails!.badges.length
            ? partial.otherDetails!.badges.map((b) => ({
                name: b?.name ?? '',
                number: (b as { number?: string })?.number ?? '',
                deadline: b?.deadline ?? '',
              }))
            : base.otherDetails.badges;
        const padded = [...mapped];
        while (padded.length < 3) padded.push({ ...emptyBadge });
        return padded.slice(0, Math.max(3, mapped.length));
      })(),
      vendors: Array.isArray(partial.otherDetails?.vendors)
        ? partial.otherDetails!.vendors
        : base.otherDetails.vendors,
      preferredPaymentMethods: Array.isArray(partial.otherDetails?.preferredPaymentMethods)
        ? partial.otherDetails!.preferredPaymentMethods.map(String)
        : base.otherDetails.preferredPaymentMethods,
      customQuestionAnswers:
        partial.otherDetails?.customQuestionAnswers &&
        typeof partial.otherDetails.customQuestionAnswers === 'object'
          ? partial.otherDetails.customQuestionAnswers
          : base.otherDetails.customQuestionAnswers,
      newsReadCategories: parseCategoryIds(
        partial.otherDetails?.newsReadCategories ?? base.otherDetails.newsReadCategories,
      ),
      newsPostCategories: parseCategoryIds(
        partial.otherDetails?.newsPostCategories ?? base.otherDetails.newsPostCategories,
      ),
    },
    parents: {
      ...base.parents,
      ...(partial.parents || {}),
      parent1: normalizeParentData({
        ...base.parents.parent1,
        ...(partial.parents?.parent1 || {}),
      }),
      parent2: normalizeParentData({
        ...base.parents.parent2,
        ...(partial.parents?.parent2 || {}),
      }),
      invoice: { ...base.parents.invoice, ...(partial.parents?.invoice || {}) },
      deduction: { ...base.parents.deduction, ...(partial.parents?.deduction || {}) },
    },
    settings: {
      ...base.settings,
      ...(partial.settings || {}),
      debtPurchases: (() => {
        const raw = String(
          partial.settings?.debtPurchases ?? base.settings.debtPurchases ?? '',
        ).replace(/\D/g, '');
        if (!raw) return '';
        const n = Math.min(9999, Math.max(0, Number.parseInt(raw, 10)));
        return Number.isFinite(n) ? String(n) : '';
      })(),
      heartRate: (() => {
        const raw = String(
          partial.settings?.heartRate ?? base.settings.heartRate ?? '',
        ).replace(/\D/g, '');
        if (!raw) return '';
        const n = Math.min(199, Math.max(30, Number.parseInt(raw, 10)));
        return Number.isFinite(n) ? String(n) : '';
      })(),
      clubGymEnabled:
        partial.settings?.memberSettingKind === 'club'
          ? true
          : partial.settings?.memberSettingKind === 'team'
            ? false
            : (partial.settings?.clubGymEnabled ??
              (partial.settings?.sportMode !== 'TEAM-FOOTBALL')),
      teamFootballEnabled:
        partial.settings?.memberSettingKind === 'team'
          ? true
          : partial.settings?.memberSettingKind === 'club'
            ? false
            : (partial.settings?.teamFootballEnabled ??
              partial.settings?.sportMode === 'TEAM-FOOTBALL'),
      memberSettingKind:
        partial.settings?.memberSettingKind ??
        (partial.settings?.teamFootballEnabled && !partial.settings?.clubGymEnabled
          ? 'team'
          : partial.settings?.sportMode === 'TEAM-FOOTBALL'
            ? 'team'
            : 'club'),
      teamSport: String(
        partial.settings?.teamSport ||
          base.settings.teamSport ||
          'Football',
      ),
      sportMode:
        (partial.settings?.memberSettingKind ??
          (partial.settings?.teamFootballEnabled && !partial.settings?.clubGymEnabled
            ? 'team'
            : partial.settings?.sportMode === 'TEAM-FOOTBALL'
              ? 'team'
              : 'club')) === 'team'
          ? 'TEAM-FOOTBALL'
          : 'CLUB-GYM',
      accessFunctionsEnabled:
        partial.settings?.accessFunctionsEnabled ??
        ((partial.settings?.memberSettingKind ??
          (partial.settings?.teamFootballEnabled && !partial.settings?.clubGymEnabled
            ? 'team'
            : partial.settings?.sportMode === 'TEAM-FOOTBALL'
              ? 'team'
              : 'club')) === 'club'),
      memberTypeId:
        partial.settings?.memberTypeId ??
        ((partial.settings as { memberType?: string } | undefined)?.memberType &&
        /^\d+$/.test(String((partial.settings as { memberType?: string }).memberType))
          ? String((partial.settings as { memberType?: string }).memberType)
          : base.settings.memberTypeId),
      discounts: {
        ...base.settings.discounts,
        ...(partial.settings?.discounts || {}),
      },
      accessControl: {
        ...base.settings.accessControl,
        ...(partial.settings?.accessControl || {}),
      },
      secondaryScreen: {
        ...base.settings.secondaryScreen,
        ...(partial.settings?.secondaryScreen || {}),
      },
      football: (() => {
        const incoming = (partial.settings?.football || {}) as Record<string, unknown>;
        const merged = {
          ...base.settings.football,
          ...(partial.settings?.football || {}),
        };
        const migrateInstallment = (
          key: 'firstPayment' | 'secondPayment' | 'thirdPayment',
          legacyDateKey: string,
        ) => {
          const current = merged[key];
          if (current && typeof current === 'object') {
            return {
              amount: String((current as { amount?: string }).amount ?? ''),
              date: String((current as { date?: string }).date ?? ''),
              status: String((current as { status?: string }).status ?? ''),
            };
          }
          return {
            amount: '',
            date: String(incoming[legacyDateKey] ?? ''),
            status: String(incoming.paymentStatus ?? ''),
          };
        };
        // Older records mirrored the Club\Gym membership status in here
        // ('Member', 'On probation', ...). Those are not TEAM statuses.
        const athleteStatus = (
          TEAM_ATHLETE_STATUS_OPTIONS as readonly string[]
        ).includes(String(merged.athleteStatus))
          ? String(merged.athleteStatus)
          : 'Active';

        const firstPayment = migrateInstallment('firstPayment', 'firstPaymentDate');
        const secondPayment = migrateInstallment('secondPayment', 'secondPaymentDate');
        const thirdPayment = migrateInstallment('thirdPayment', 'thirdPaymentDate');

        const rawPaymentStatus = String(
          merged.paymentStatus ||
            incoming.paymentStatus ||
            firstPayment.status ||
            secondPayment.status ||
            thirdPayment.status ||
            '',
        );
        const paymentStatus = (PAYMENT_STATUS_OPTIONS as readonly string[]).includes(
          rawPaymentStatus,
        )
          ? rawPaymentStatus
          : '';

        const rawMethod = String(merged.paymentMethod || '').trim();
        const methodAliases: Record<string, string> = {
          cash: 'Cash',
          bank_transfer: 'Bank transfer',
          'bank transfer': 'Bank transfer',
          pos: 'POS',
          sepa: 'SEPA',
          'sepa **': 'SEPA',
        };
        const aliased =
          methodAliases[rawMethod.toLowerCase()] ||
          ((TEAM_FOOTBALL_PAYMENT_METHOD_OPTIONS as readonly string[]).includes(rawMethod)
            ? rawMethod
            : '');

        return {
          ...merged,
          athleteStatus,
          paymentMethod: aliased,
          paymentStatus,
          firstPayment,
          secondPayment,
          thirdPayment,
          sportsPlayed: Array.isArray(partial.settings?.football?.sportsPlayed)
            ? partial.settings!.football!.sportsPlayed
            : base.settings.football.sportsPlayed,
        };
      })(),
    },
    staffMessage: {
      ...base.staffMessage,
      ...(partial.staffMessage || {}),
    },
  };
}
