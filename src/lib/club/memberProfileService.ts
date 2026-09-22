import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { randomBytes } from 'crypto';
import {
  calcAge,
  emptyActivities,
  emptyClubScoped,
  emptyContacts,
  emptyOwnerProfile,
  mergeClubScoped,
  normalizeActivities,
  normalizeContacts,
  safeJsonParse,
} from '@/lib/club/memberProfileDefaults';
import { getLatestMembershipDates } from '@/lib/club/memberMembershipArchive';
import { parseClubDescriptionMeta } from '@/lib/club/clubSidebarLabel';
import { normalizeEntitySport } from '@/lib/sport/entitySportOptions';
import {
  fetchClubCoachOptions,
  fetchClubOperatorOptions,
} from '@/lib/procedures/clubOperators';
import {
  normalizeSupportImageUrls,
  parseSupportImageUrlsJson,
} from '@/lib/messages/supportImages';
import type {
  ActivitiesData,
  ClubMemberScopedData,
  ContactsData,
  DuplicateMemberSection,
  MemberProfileBundle,
  OwnerProfileData,
  ParentData,
} from '@/lib/club/memberProfileTypes';

function cuid() {
  return `c${randomBytes(12).toString('hex')}`;
}

/** Only keep real http(s) links; ignore junk like "2" left in older saves. */
function normalizeStoredQrCodeUrl(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return '';
}

function resolveSignatureDataUrl(
  clubData: ClubMemberScopedData,
  underage: boolean,
): string | null {
  if (underage) {
    return (
      clubData.parents.signatureDataUrl?.trim() ||
      clubData.otherDetails.signatureDataUrl?.trim() ||
      null
    );
  }
  return (
    clubData.otherDetails.signatureDataUrl?.trim() ||
    clubData.parents.signatureDataUrl?.trim() ||
    null
  );
}

/** Keep the PNG data-URL only in signatureDataUrl column — not duplicated in profileJson. */
function clubScopedForProfileJson(clubData: ClubMemberScopedData): ClubMemberScopedData {
  return {
    ...clubData,
    otherDetails: { ...clubData.otherDetails, signatureDataUrl: '' },
    parents: { ...clubData.parents, signatureDataUrl: '' },
  };
}

function syncSignatureFromColumn(
  clubScoped: ClubMemberScopedData,
  signatureDataUrl: string | null | undefined,
  underage: boolean,
) {
  if (!signatureDataUrl?.trim()) return;
  const sig = signatureDataUrl.trim();
  if (underage) {
    clubScoped.parents.signatureDataUrl = sig;
  } else {
    clubScoped.otherDetails.signatureDataUrl = sig;
  }
}

/** Members may only update signature / acceptance fields on their own profile. */
function mergeMemberSelfClubSave(
  loaded: ClubMemberScopedData,
  incoming: ClubMemberScopedData,
): ClubMemberScopedData {
  const merged = mergeClubScoped(loaded);
  merged.otherDetails = {
    ...merged.otherDetails,
    signatureDataUrl: incoming.otherDetails.signatureDataUrl,
    acceptanceRules: incoming.otherDetails.acceptanceRules,
    privacyPolicyRead: incoming.otherDetails.privacyPolicyRead,
  };
  merged.parents = {
    ...merged.parents,
    signatureDataUrl: incoming.parents.signatureDataUrl,
    acceptanceRules: incoming.parents.acceptanceRules,
    privacyPolicyRead: incoming.parents.privacyPolicyRead,
  };
  return merged;
}

function parentDataForCopy(source: ParentData): ParentData {
  return {
    ...source,
    otherChildrenMemberIds: [],
  };
}

async function copyParentDataToTaggedMembers(opts: {
  clubId: string;
  sourceMemberId: string;
  parentSlot: 'parent1' | 'parent2';
  parentData: ParentData;
}) {
  const taggedIds = opts.parentData.otherChildrenMemberIds.filter(
    (id) => id && id !== opts.sourceMemberId,
  );
  if (taggedIds.length === 0) return;

  const payload = parentDataForCopy(opts.parentData);
  const now = new Date();

  for (const memberId of taggedIds) {
    const clubMember = await prisma.clubMember.findUnique({
      where: {
        clubId_memberId: { clubId: opts.clubId, memberId },
      },
      select: { id: true },
    });
    if (!clubMember) continue;

    const existing = await getClubProfile(clubMember.id);
    const clubScoped = mergeClubScoped(
      existing?.profileJson
        ? (safeJsonParse(existing.profileJson, {}) as Partial<ClubMemberScopedData>)
        : null,
    );
    clubScoped.parents = {
      ...clubScoped.parents,
      [opts.parentSlot]: {
        ...clubScoped.parents[opts.parentSlot],
        ...payload,
      },
    };

    if (existing) {
      await prisma.$executeRawUnsafe(
        `UPDATE club_member_profiles SET profileJson=?, updatedAt=? WHERE clubMemberId=?`,
        JSON.stringify(clubScoped),
        now,
        clubMember.id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO club_member_profiles (id, clubMemberId, profileJson, medicalImageUrl, medicalPdfUrl, signatureDataUrl, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
        cuid(),
        clubMember.id,
        JSON.stringify(clubScoped),
        null,
        null,
        null,
        now,
        now,
      );
    }
  }
}

function formatName(first?: string | null, surname?: string | null, name?: string | null) {
  const parts = [first, surname].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return name || '';
}

type ExtrasRow = {
  id: string;
  userId: string;
  disallowClubAdmins: number | boolean;
  qrCodeUrl: string | null;
  ownerJson: string;
  contactsJson: string;
  activitiesJson: string;
  referencesHtml: string | null;
  referencesLevel?: string | null;
};

type ProfileRow = {
  id: string;
  clubMemberId: string;
  profileJson: string;
  medicalImageUrl: string | null;
  medicalPdfUrl: string | null;
  signatureDataUrl: string | null;
};

type TeamProfileRow = {
  id: string;
  teamMemberId: string;
  profileJson: string;
  medicalImageUrl: string | null;
  medicalPdfUrl: string | null;
  signatureDataUrl: string | null;
};

type NoteRow = {
  id: string;
  clubMemberId: string;
  kind: string;
  title: string;
  body: string;
  authorId: string | null;
  parentId: string | null;
  visibleToMember: number | boolean;
  commentsEnabled: number | boolean;
  enableFrom: Date | null;
  enableTo: Date | null;
  showAtLogin: number | boolean;
  showAtLogout: number | boolean;
  imageUrlsJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function getExtras(userId: string): Promise<ExtrasRow | null> {
  await ensureReferencesLevelColumn();
  const rows = await prisma.$queryRawUnsafe<ExtrasRow[]>(
    `SELECT * FROM user_profile_extras WHERE userId = ? LIMIT 1`,
    userId,
  );
  return rows[0] ?? null;
}

async function getClubProfile(clubMemberId: string): Promise<ProfileRow | null> {
  const rows = await prisma.$queryRawUnsafe<ProfileRow[]>(
    `SELECT * FROM club_member_profiles WHERE clubMemberId = ? LIMIT 1`,
    clubMemberId,
  );
  return rows[0] ?? null;
}

let teamMemberProfilesTableReady = false;

async function ensureTeamMemberProfilesTable() {
  if (teamMemberProfilesTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS team_member_profiles (
      id VARCHAR(191) NOT NULL,
      teamMemberId VARCHAR(191) NOT NULL,
      profileJson LONGTEXT NOT NULL,
      medicalImageUrl VARCHAR(191) NULL,
      medicalPdfUrl VARCHAR(191) NULL,
      signatureDataUrl LONGTEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY team_member_profiles_teamMemberId_key (teamMemberId)
    )
  `);
  teamMemberProfilesTableReady = true;
}

async function getTeamProfile(teamMemberId: string): Promise<TeamProfileRow | null> {
  await ensureTeamMemberProfilesTable();
  const rows = await prisma.$queryRawUnsafe<TeamProfileRow[]>(
    `SELECT * FROM team_member_profiles WHERE teamMemberId = ? LIMIT 1`,
    teamMemberId,
  );
  return rows[0] ?? null;
}

async function upsertTeamProfile(opts: {
  teamMemberId: string;
  profileJson: string;
  signatureDataUrl?: string | null;
  medicalImageUrl?: string | null;
  medicalPdfUrl?: string | null;
}) {
  await ensureTeamMemberProfilesTable();
  const now = new Date();
  const existing = await getTeamProfile(opts.teamMemberId);
  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE team_member_profiles SET profileJson=?, signatureDataUrl=?, medicalImageUrl=COALESCE(?, medicalImageUrl), medicalPdfUrl=COALESCE(?, medicalPdfUrl), updatedAt=? WHERE teamMemberId=?`,
      opts.profileJson,
      opts.signatureDataUrl ?? existing.signatureDataUrl,
      opts.medicalImageUrl ?? null,
      opts.medicalPdfUrl ?? null,
      now,
      opts.teamMemberId,
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO team_member_profiles (id, teamMemberId, profileJson, medicalImageUrl, medicalPdfUrl, signatureDataUrl, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
    cuid(),
    opts.teamMemberId,
    opts.profileJson,
    opts.medicalImageUrl ?? null,
    opts.medicalPdfUrl ?? null,
    opts.signatureDataUrl ?? null,
    now,
    now,
  );
}

async function getNotes(clubMemberId: string): Promise<NoteRow[]> {
  await ensureNoteImageColumn();
  return prisma.$queryRawUnsafe<NoteRow[]>(
    `SELECT * FROM club_member_notes WHERE clubMemberId = ? ORDER BY createdAt DESC`,
    clubMemberId,
  );
}

let noteImageColumnReady = false;
let referencesLevelColumnReady = false;

async function ensureReferencesLevelColumn() {
  if (referencesLevelColumnReady) return;
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'user_profile_extras'`,
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  if (!columns.has('referencesLevel')) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE user_profile_extras ADD COLUMN referencesLevel VARCHAR(8) NULL DEFAULT '1'`,
    );
  }
  referencesLevelColumnReady = true;
}

async function ensureNoteImageColumn() {
  if (noteImageColumnReady) return;
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'club_member_notes'`,
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  if (!columns.has('imageUrlsJson')) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE club_member_notes ADD COLUMN imageUrlsJson TEXT NULL`,
    );
  }
  noteImageColumnReady = true;
}

/** Team Admin Archive of Users — shared owner tabs + empty team-scoped dossier. */
async function loadTeamMemberProfileBundle(opts: {
  clubId: string;
  memberUserId: string;
  viewerUserId: string;
}): Promise<MemberProfileBundle | { error: string; status: number }> {
  const team = await prisma.team.findUnique({
    where: { id: opts.clubId },
    select: { id: true, name: true, adminId: true, description: true, sport: true },
  });
  if (!team) return { error: 'Club or team not found', status: 404 };

  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_athleteId: { teamId: opts.clubId, athleteId: opts.memberUserId },
    },
    include: {
      athlete: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          firstName: true,
          surname: true,
          gender: true,
          birthdate: true,
          country: true,
          image: true,
        },
      },
    },
  });
  if (!teamMember) return { error: 'Member not found in this team', status: 404 };

  const isClubAdmin = team.adminId === opts.viewerUserId;
  const isSelf = teamMember.athleteId === opts.viewerUserId;
  if (!isClubAdmin && !isSelf) {
    return { error: 'Access denied', status: 403 };
  }

  const extras = await getExtras(opts.memberUserId);
  const teamProfile = await getTeamProfile(teamMember.id);
  const ownerStored = safeJsonParse(extras?.ownerJson, emptyOwnerProfile());
  const contactsRaw = safeJsonParse(extras?.contactsJson, emptyContacts());
  const activitiesRaw = safeJsonParse(extras?.activitiesJson, emptyActivities());
  const contacts: ContactsData = normalizeContacts(contactsRaw);
  const activities: ActivitiesData = normalizeActivities(activitiesRaw);

  const teamMeta = parseClubDescriptionMeta(team.description);
  const entitySportDefault = normalizeEntitySport(
    team.sport || teamMeta.category || '',
  );

  const clubScoped = mergeClubScoped(
    teamProfile?.profileJson
      ? (safeJsonParse(teamProfile.profileJson, {}) as Partial<ClubMemberScopedData>)
      : ({
          settings: {
            memberSettingKind: 'team',
            clubGymEnabled: false,
            teamFootballEnabled: true,
            sportMode: 'TEAM-FOOTBALL',
            teamSport: entitySportDefault || 'Football',
            accessFunctionsEnabled: false,
          },
          visibility: {
            payFor: true,
            otherDetails: true,
            parents: true,
            settings: true,
            messagesStaff: false,
            notesCoach: false,
            presences: true,
          },
        } as Partial<ClubMemberScopedData>),
  );

  if (!clubScoped.settings.teamSport?.trim()) {
    clubScoped.settings.teamSport = entitySportDefault || 'Football';
  } else {
    clubScoped.settings.teamSport = normalizeEntitySport(clubScoped.settings.teamSport);
  }
  // Team archive hides staff/coach notes until a notes store exists.
  clubScoped.visibility = {
    ...clubScoped.visibility,
    messagesStaff: false,
    notesCoach: false,
  };

  const birthIso = teamMember.athlete.birthdate
    ? teamMember.athlete.birthdate.toISOString().slice(0, 10)
    : ownerStored.personal.dateOfBirth || '';
  const age = calcAge(birthIso);
  const underage = age != null && age < 18;

  const owner: OwnerProfileData = emptyOwnerProfile({
    ...ownerStored,
    privateSettings: {
      disallowClubAdmins: Boolean(extras?.disallowClubAdmins),
    },
    photoUrl: teamMember.athlete.image || ownerStored.photoUrl || '',
    qrCodeUrl: normalizeStoredQrCodeUrl(extras?.qrCodeUrl || ownerStored.qrCodeUrl || ''),
    login: {
      ...emptyOwnerProfile().login,
      ...ownerStored.login,
      username: teamMember.athlete.username,
      firstName: teamMember.athlete.firstName || ownerStored.login?.firstName || '',
      lastName: teamMember.athlete.surname || ownerStored.login?.lastName || '',
      email: teamMember.athlete.email,
      newPassword: '',
      repeatPassword: '',
    },
    address: {
      ...emptyOwnerProfile().address,
      ...ownerStored.address,
      country: teamMember.athlete.country || ownerStored.address?.country || '',
    },
    personal: {
      ...emptyOwnerProfile().personal,
      ...ownerStored.personal,
      gender: teamMember.athlete.gender || ownerStored.personal?.gender || '',
      dateOfBirth: birthIso,
      age,
      otherSports: Array.isArray(ownerStored.personal?.otherSports)
        ? ownerStored.personal.otherSports
        : [],
    },
    administrative: {
      ...emptyOwnerProfile().administrative,
      ...ownerStored.administrative,
    },
    documents: {
      ...emptyOwnerProfile().documents,
      ...(ownerStored.documents || {}),
      idCard: {
        ...emptyOwnerProfile().documents.idCard,
        ...(ownerStored.documents?.idCard || {}),
      },
      drivingLicence: {
        ...emptyOwnerProfile().documents.drivingLicence,
        ...(ownerStored.documents?.drivingLicence || {}),
      },
      healthInsuranceCard: {
        ...emptyOwnerProfile().documents.healthInsuranceCard,
        ...(ownerStored.documents?.healthInsuranceCard || {}),
      },
      passport: {
        ...emptyOwnerProfile().documents.passport,
        ...(ownerStored.documents?.passport || {}),
      },
      residencePermit: {
        ...emptyOwnerProfile().documents.residencePermit,
        ...(ownerStored.documents?.residencePermit || {}),
      },
    },
    medical: {
      ...emptyOwnerProfile().medical,
      ...ownerStored.medical,
      imageUrl: ownerStored.medical?.imageUrl || '',
      pdfUrl: ownerStored.medical?.pdfUrl || '',
      ecgUrl: ownerStored.medical?.ecgUrl || '',
    },
    bodyMeasurements: {
      ...emptyOwnerProfile().bodyMeasurements,
      ...(ownerStored.bodyMeasurements || {}),
    },
    otherReferences: {
      ...emptyOwnerProfile().otherReferences,
      ...ownerStored.otherReferences,
    },
  });

  clubScoped.otherDetails.userUnderage = underage;
  syncSignatureFromColumn(clubScoped, teamProfile?.signatureDataUrl, underage);

  const disallow = Boolean(extras?.disallowClubAdmins);
  const canEditOwner = isSelf || (isClubAdmin && !disallow);
  const canEditContactsActivitiesReferences = isSelf;
  const canEditClubScoped = isClubAdmin;
  const canEditMemberSignature = isClubAdmin || isSelf;

  const allMembers = await prisma.teamMember.findMany({
    where: { teamId: opts.clubId },
    include: {
      athlete: {
        select: { id: true, firstName: true, surname: true, name: true, username: true },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const customQuestions = Array.isArray(teamMeta.customQuestions)
    ? teamMeta.customQuestions
        .map((q, i) => ({
          id: String(q?.id || `cq-${i}`),
          question: String(q?.question || '').trim(),
          answerType:
            q?.answerType === 'checkbox' ||
            q?.answerType === 'yes_no' ||
            q?.answerType === 'list' ||
            q?.answerType === 'free'
              ? q.answerType
              : ('free' as const),
          visibleInRegistration: Boolean(q?.visibleInRegistration),
          mandatory: Boolean(q?.mandatory),
          listOptions: String(q?.listOptions || ''),
        }))
        .filter((q) => q.question)
    : [];

  return {
    clubId: team.id,
    workspaceKind: 'team',
    clubName: team.name,
    entitySportDefault,
    clubMemberId: teamMember.id,
    memberId: teamMember.athleteId,
    role: teamMember.role,
    membershipType: teamMember.role,
    viewer: {
      isClubAdmin,
      isSelf,
      canEditOwner,
      canEditContactsActivitiesReferences,
      canEditClubScoped,
      canEditMemberSignature,
    },
    user: {
      id: teamMember.athlete.id,
      username: teamMember.athlete.username,
      email: teamMember.athlete.email,
      name: teamMember.athlete.name,
      firstName: teamMember.athlete.firstName,
      surname: teamMember.athlete.surname,
      gender: teamMember.athlete.gender,
      birthdate: birthIso || null,
      country: teamMember.athlete.country,
      image: teamMember.athlete.image,
    },
    owner,
    contacts,
    activities,
    referencesHtml: extras?.referencesHtml || '',
    referencesLevel: String(extras?.referencesLevel || '1').trim() || '1',
    club: clubScoped,
    clubMembersForPayFor: allMembers
      .filter((m) => m.athleteId !== opts.memberUserId)
      .map((m) => ({
        id: m.athleteId,
        label:
          formatName(m.athlete.firstName, m.athlete.surname, m.athlete.name) ||
          m.athlete.username,
      })),
    vendorCoachOptions: [],
    coachOptions: [],
    clubParentsCatalog: [],
    customQuestions,
    staffNotes: [],
    coachNotes: [],
  };
}

export async function loadMemberProfileBundle(opts: {
  clubId: string;
  memberUserId: string;
  viewerUserId: string;
}): Promise<MemberProfileBundle | { error: string; status: number }> {
  const club = await prisma.club.findUnique({
    where: { id: opts.clubId },
    select: { id: true, name: true, adminId: true, description: true },
  });
  if (!club) {
    return loadTeamMemberProfileBundle(opts);
  }

  const clubMember = await prisma.clubMember.findUnique({
    where: {
      clubId_memberId: { clubId: opts.clubId, memberId: opts.memberUserId },
    },
    include: {
      member: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          firstName: true,
          surname: true,
          gender: true,
          birthdate: true,
          country: true,
          image: true,
        },
      },
    },
  });
  if (!clubMember) return { error: 'Member not found in this club', status: 404 };

  const isClubAdmin = club.adminId === opts.viewerUserId;
  const isSelf = clubMember.memberId === opts.viewerUserId;
  if (!isClubAdmin && !isSelf) {
    return { error: 'Access denied', status: 403 };
  }

  const extras = await getExtras(opts.memberUserId);
  const clubProfile = await getClubProfile(clubMember.id);
  const notes = await getNotes(clubMember.id);

  const ownerStored = safeJsonParse(extras?.ownerJson, emptyOwnerProfile());
  const contactsRaw = safeJsonParse(extras?.contactsJson, emptyContacts());
  const activitiesRaw = safeJsonParse(extras?.activitiesJson, emptyActivities());
  const contacts: ContactsData = normalizeContacts(contactsRaw);
  const activities: ActivitiesData = normalizeActivities(activitiesRaw);
  const clubScoped = mergeClubScoped(
    clubProfile?.profileJson
      ? (safeJsonParse(clubProfile.profileJson, {}) as Partial<ClubMemberScopedData>)
      : null,
  );

  const entitySportDefault = normalizeEntitySport(
    parseClubDescriptionMeta(club.description).category,
  );
  if (!clubScoped.settings.teamSport?.trim()) {
    clubScoped.settings.teamSport = entitySportDefault;
  } else {
    clubScoped.settings.teamSport = normalizeEntitySport(clubScoped.settings.teamSport);
  }

  const birthIso = clubMember.member.birthdate
    ? clubMember.member.birthdate.toISOString().slice(0, 10)
    : ownerStored.personal.dateOfBirth || '';
  const age = calcAge(birthIso);
  const underage = age != null && age < 18;

  const owner: OwnerProfileData = emptyOwnerProfile({
    ...ownerStored,
    privateSettings: {
      disallowClubAdmins: Boolean(extras?.disallowClubAdmins),
    },
    photoUrl: clubMember.member.image || ownerStored.photoUrl || '',
    qrCodeUrl: normalizeStoredQrCodeUrl(extras?.qrCodeUrl || ownerStored.qrCodeUrl || ''),
    login: {
      ...emptyOwnerProfile().login,
      ...ownerStored.login,
      username: clubMember.member.username,
      firstName: clubMember.member.firstName || ownerStored.login?.firstName || '',
      lastName: clubMember.member.surname || ownerStored.login?.lastName || '',
      email: clubMember.member.email,
      newPassword: '',
      repeatPassword: '',
    },
    address: {
      ...emptyOwnerProfile().address,
      ...ownerStored.address,
      country: clubMember.member.country || ownerStored.address?.country || '',
    },
    personal: {
      ...emptyOwnerProfile().personal,
      ...ownerStored.personal,
      gender: clubMember.member.gender || ownerStored.personal?.gender || '',
      dateOfBirth: birthIso,
      age,
      otherSports: Array.isArray(ownerStored.personal?.otherSports)
        ? ownerStored.personal.otherSports
        : [],
    },
    administrative: {
      ...emptyOwnerProfile().administrative,
      ...ownerStored.administrative,
    },
    documents: {
      ...emptyOwnerProfile().documents,
      ...(ownerStored.documents || {}),
      idCard: {
        ...emptyOwnerProfile().documents.idCard,
        ...(ownerStored.documents?.idCard || {}),
      },
      drivingLicence: {
        ...emptyOwnerProfile().documents.drivingLicence,
        ...(ownerStored.documents?.drivingLicence || {}),
      },
      healthInsuranceCard: {
        ...emptyOwnerProfile().documents.healthInsuranceCard,
        ...(ownerStored.documents?.healthInsuranceCard || {}),
      },
      passport: {
        ...emptyOwnerProfile().documents.passport,
        ...(ownerStored.documents?.passport || {}),
      },
      residencePermit: {
        ...emptyOwnerProfile().documents.residencePermit,
        ...(ownerStored.documents?.residencePermit || {}),
      },
    },
    medical: {
      ...emptyOwnerProfile().medical,
      ...ownerStored.medical,
      // Owner (shared) medical files are source of truth; club columns are a mirror.
      imageUrl: ownerStored.medical?.imageUrl || clubProfile?.medicalImageUrl || '',
      pdfUrl: ownerStored.medical?.pdfUrl || clubProfile?.medicalPdfUrl || '',
      ecgUrl: ownerStored.medical?.ecgUrl || '',
    },
    bodyMeasurements: {
      ...emptyOwnerProfile().bodyMeasurements,
      ...(ownerStored.bodyMeasurements || {}),
    },
    otherReferences: {
      ...emptyOwnerProfile().otherReferences,
      ...ownerStored.otherReferences,
    },
  });

  clubScoped.otherDetails.userUnderage = underage;
  syncSignatureFromColumn(clubScoped, clubProfile?.signatureDataUrl, underage);

  const archiveDates = await getLatestMembershipDates(
    opts.clubId,
    opts.memberUserId,
    clubMember.joinedAt,
  );
  if (archiveDates) {
    if (!clubScoped.otherDetails.membershipFrom) {
      clubScoped.otherDetails.membershipFrom = archiveDates.from;
    }
    if (!clubScoped.otherDetails.membershipTo && archiveDates.to) {
      clubScoped.otherDetails.membershipTo = archiveDates.to;
    }
  }

  const disallow = Boolean(extras?.disallowClubAdmins);
  const canEditOwner = isSelf || (isClubAdmin && !disallow);
  const canEditContactsActivitiesReferences = isSelf;
  const canEditClubScoped = isClubAdmin;
  const canEditMemberSignature = isClubAdmin || isSelf;

  const allMembers = await prisma.clubMember.findMany({
    where: { clubId: opts.clubId },
    include: {
      member: { select: { id: true, firstName: true, surname: true, name: true, username: true } },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const authorIds = Array.from(
    new Set(notes.map((n) => n.authorId).filter(Boolean) as string[]),
  );
  const authors =
    authorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, username: true, name: true, image: true },
        })
      : [];
  const authorMap = new Map(authors.map((a) => [a.id, a.username || a.name]));
  const authorImageMap = new Map(authors.map((a) => [a.id, a.image]));

  const staffRoots = notes.filter((n) => n.kind === 'staff' && !n.parentId);
  const coachRoots = notes.filter((n) => n.kind === 'coach' && !n.parentId);
  const repliesOf = (parentId: string) =>
    notes
      .filter((n) => n.parentId === parentId)
      .map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: new Date(n.createdAt).toISOString(),
        authorLabel: (n.authorId && authorMap.get(n.authorId)) || 'User',
      }));

  const visibility = clubScoped.visibility;

  const [operatorOptions, coachStaffOptions] = await Promise.all([
    fetchClubOperatorOptions(opts.clubId),
    fetchClubCoachOptions(opts.clubId),
  ]);
  const vendorCoachOptionsMap = new Map<string, string>();
  for (const op of operatorOptions) {
    vendorCoachOptionsMap.set(op.id, op.name);
  }
  for (const m of allMembers) {
    if (vendorCoachOptionsMap.has(m.memberId)) continue;
    const label =
      formatName(m.member.firstName, m.member.surname, m.member.name) ||
      m.member.username;
    if (label) vendorCoachOptionsMap.set(m.memberId, label);
  }
  // Keep currently saved vendor values visible even if not in club list.
  for (const id of clubScoped.otherDetails.vendors) {
    if (id && !vendorCoachOptionsMap.has(id)) {
      vendorCoachOptionsMap.set(id, id);
    }
  }
  const vendorCoachOptions = Array.from(vendorCoachOptionsMap.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const coachOptionsMap = new Map<string, string>();
  for (const op of coachStaffOptions) {
    coachOptionsMap.set(op.id, op.name);
  }
  // Keep currently saved coach visible even if no longer Instructor/PT.
  if (
    clubScoped.otherDetails.coachName &&
    !coachOptionsMap.has(clubScoped.otherDetails.coachName)
  ) {
    const fromVendors = vendorCoachOptionsMap.get(clubScoped.otherDetails.coachName);
    coachOptionsMap.set(
      clubScoped.otherDetails.coachName,
      fromVendors || clubScoped.otherDetails.coachName,
    );
  }
  const coachOptions = Array.from(coachOptionsMap.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const clubParentsCatalog: import('@/lib/club/memberProfileTypes').ClubParentCatalogEntry[] = [];
  const memberProfiles = await prisma.clubMemberProfile.findMany({
    where: { clubMemberId: { in: allMembers.map((m) => m.id) } },
    select: { clubMemberId: true, profileJson: true },
  });
  const memberByClubMemberId = new Map(allMembers.map((m) => [m.id, m]));
  for (const profile of memberProfiles) {
    const cm = memberByClubMemberId.get(profile.clubMemberId);
    if (!cm) continue;
    const scoped = safeJsonParse(profile.profileJson, {}) as Partial<ClubMemberScopedData>;
    const sourceMemberLabel =
      formatName(cm.member.firstName, cm.member.surname, cm.member.name) ||
      cm.member.username;
    for (const slot of ['parent1', 'parent2'] as const) {
      const raw = scoped.parents?.[slot];
      if (!raw) continue;
      const data = emptyClubScoped().parents[slot];
      const merged = { ...data, ...raw } as typeof data;
      const hasIdentity =
        Boolean(merged.surname?.trim()) ||
        Boolean(merged.name?.trim()) ||
        Boolean(merged.fiscalCode?.trim()) ||
        Boolean(merged.mainEmail?.trim());
      if (!hasIdentity) continue;
      const key = `${cm.memberId}:${slot}`;
      clubParentsCatalog.push({
        key,
        label: `${[merged.surname, merged.name].filter(Boolean).join(' ')} (${sourceMemberLabel} · ${slot})`,
        sourceMemberId: cm.memberId,
        sourceMemberLabel,
        slot,
        data: merged,
      });
    }
  }
  clubParentsCatalog.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );

  const clubMeta = parseClubDescriptionMeta(club.description);
  const customQuestions = Array.isArray(clubMeta.customQuestions)
    ? clubMeta.customQuestions.map((q, i) => ({
        id: String(q?.id || `cq-${i}`),
        question: String(q?.question || '').trim(),
        answerType:
          q?.answerType === 'checkbox' ||
          q?.answerType === 'yes_no' ||
          q?.answerType === 'list' ||
          q?.answerType === 'free'
            ? q.answerType
            : ('free' as const),
        visibleInRegistration: Boolean(q?.visibleInRegistration),
        mandatory: Boolean(q?.mandatory),
        listOptions: String(q?.listOptions || ''),
      })).filter((q) => q.question)
    : [];

  return {
    clubId: club.id,
    workspaceKind: 'club',
    clubName: club.name,
    entitySportDefault,
    clubMemberId: clubMember.id,
    memberId: clubMember.memberId,
    role: clubMember.role,
    membershipType: clubMember.membershipType,
    viewer: {
      isClubAdmin,
      isSelf,
      canEditOwner,
      canEditContactsActivitiesReferences,
      canEditClubScoped,
      canEditMemberSignature,
    },
    user: {
      id: clubMember.member.id,
      username: clubMember.member.username,
      email: clubMember.member.email,
      name: clubMember.member.name,
      firstName: clubMember.member.firstName,
      surname: clubMember.member.surname,
      gender: clubMember.member.gender,
      birthdate: birthIso || null,
      country: clubMember.member.country,
      image: clubMember.member.image,
    },
    owner,
    contacts,
    activities,
    referencesHtml: extras?.referencesHtml || '',
    referencesLevel: String(extras?.referencesLevel || '1').trim() || '1',
    club: clubScoped,
    clubMembersForPayFor: allMembers
      .filter((m) => m.memberId !== opts.memberUserId)
      .map((m) => ({
        id: m.memberId,
        label:
          formatName(m.member.firstName, m.member.surname, m.member.name) ||
          m.member.username,
      })),
    vendorCoachOptions,
    coachOptions,
    clubParentsCatalog,
    customQuestions,
    staffNotes: (isClubAdmin || visibility.messagesStaff ? staffRoots : []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: new Date(n.createdAt).toISOString(),
      authorLabel: (n.authorId && authorMap.get(n.authorId)) || 'Staff',
      showAtLogin: Boolean(n.showAtLogin),
      showAtLogout: Boolean(n.showAtLogout),
      replies: repliesOf(n.id),
    })),
    coachNotes: (isClubAdmin || visibility.notesCoach ? coachRoots : [])
      .filter((n) => isClubAdmin || Boolean(n.visibleToMember))
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: new Date(n.createdAt).toISOString(),
        authorLabel: (n.authorId && authorMap.get(n.authorId)) || 'Coach',
        authorImage: (n.authorId && authorImageMap.get(n.authorId)) || null,
        visibleToMember: Boolean(n.visibleToMember),
        commentsEnabled: Boolean(n.commentsEnabled),
        imageUrls: parseSupportImageUrlsJson(n.imageUrlsJson),
        enableFrom: n.enableFrom ? new Date(n.enableFrom).toISOString().slice(0, 10) : '',
        enableTo: n.enableTo ? new Date(n.enableTo).toISOString().slice(0, 10) : '',
        showAtLogin: Boolean(n.showAtLogin),
        showAtLogout: Boolean(n.showAtLogout),
        replies: repliesOf(n.id),
      })),
  };
}

async function upsertExtras(opts: {
  userId: string;
  disallowClubAdmins: boolean;
  qrCodeUrl: string | null;
  ownerJson: string;
  contactsJson: string;
  activitiesJson: string;
  referencesHtml: string | null;
  referencesLevel?: string | null;
}) {
  await ensureReferencesLevelColumn();
  const existing = await getExtras(opts.userId);
  const now = new Date();
  const level = String(opts.referencesLevel ?? '1').trim() || '1';
  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE user_profile_extras SET disallowClubAdmins=?, qrCodeUrl=?, ownerJson=?, contactsJson=?, activitiesJson=?, referencesHtml=?, referencesLevel=?, updatedAt=? WHERE userId=?`,
      opts.disallowClubAdmins,
      opts.qrCodeUrl,
      opts.ownerJson,
      opts.contactsJson,
      opts.activitiesJson,
      opts.referencesHtml,
      level,
      now,
      opts.userId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO user_profile_extras (id, userId, disallowClubAdmins, qrCodeUrl, ownerJson, contactsJson, activitiesJson, referencesHtml, referencesLevel, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      cuid(),
      opts.userId,
      opts.disallowClubAdmins,
      opts.qrCodeUrl,
      opts.ownerJson,
      opts.contactsJson,
      opts.activitiesJson,
      opts.referencesHtml,
      level,
      now,
      now,
    );
  }
}

/** Persist shared (user) profile fields for a team athlete; team-scoped dossier is not stored yet. */
async function saveTeamMemberSharedProfile(opts: {
  memberUserId: string;
  loaded: MemberProfileBundle;
  payload: {
    owner?: OwnerProfileData;
    contacts?: ContactsData;
    activities?: ActivitiesData;
    referencesHtml?: string;
    referencesLevel?: string;
    club?: ClubMemberScopedData;
  };
}): Promise<{ ok: true } | { error: string; status: number }> {
  const { loaded, payload } = opts;

  if (payload.owner && loaded.viewer.canEditOwner) {
    const owner = payload.owner;
    const userUpdate: Record<string, unknown> = {
      firstName: owner.login.firstName || null,
      surname: owner.login.lastName || null,
      name:
        [owner.login.firstName, owner.login.lastName].filter(Boolean).join(' ') ||
        loaded.user.name,
      gender: owner.personal.gender || null,
      country: owner.address.country || null,
      image: owner.photoUrl || null,
    };
    if (owner.personal.dateOfBirth) {
      const d = new Date(owner.personal.dateOfBirth);
      if (!Number.isNaN(d.getTime())) userUpdate.birthdate = d;
    }
    if (owner.login.email && owner.login.email !== loaded.user.email) {
      userUpdate.email = owner.login.email.trim();
    }
    if (
      owner.login.newPassword &&
      owner.login.newPassword === owner.login.repeatPassword &&
      owner.login.newPassword.length >= 4
    ) {
      userUpdate.password = await hashPassword(owner.login.newPassword);
    }

    await prisma.user.update({
      where: { id: opts.memberUserId },
      data: userUpdate,
    });

    const ownerToStore: OwnerProfileData = {
      ...owner,
      login: { ...owner.login, newPassword: '', repeatPassword: '' },
    };

    await upsertExtras({
      userId: opts.memberUserId,
      disallowClubAdmins: loaded.viewer.isSelf
        ? Boolean(owner.privateSettings.disallowClubAdmins)
        : loaded.owner.privateSettings.disallowClubAdmins,
      qrCodeUrl: normalizeStoredQrCodeUrl(owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify({
        ...ownerToStore,
        privateSettings: {
          disallowClubAdmins: loaded.viewer.isSelf
            ? Boolean(owner.privateSettings.disallowClubAdmins)
            : loaded.owner.privateSettings.disallowClubAdmins,
        },
      }),
      contactsJson: JSON.stringify(loaded.contacts),
      activitiesJson: JSON.stringify(loaded.activities),
      referencesHtml: loaded.referencesHtml || null,
      referencesLevel: loaded.referencesLevel || '1',
    });
  }

  if (
    (payload.contacts ||
      payload.activities ||
      typeof payload.referencesHtml === 'string' ||
      typeof payload.referencesLevel === 'string') &&
    loaded.viewer.canEditContactsActivitiesReferences
  ) {
    const contacts = normalizeContacts(payload.contacts ?? loaded.contacts);
    const activities = payload.activities ?? loaded.activities;
    const referencesHtml =
      typeof payload.referencesHtml === 'string'
        ? payload.referencesHtml
        : loaded.referencesHtml;
    const referencesLevel =
      typeof payload.referencesLevel === 'string'
        ? payload.referencesLevel
        : loaded.referencesLevel;

    await upsertExtras({
      userId: opts.memberUserId,
      disallowClubAdmins: loaded.owner.privateSettings.disallowClubAdmins,
      qrCodeUrl: normalizeStoredQrCodeUrl(loaded.owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify(loaded.owner),
      contactsJson: JSON.stringify(contacts),
      activitiesJson: JSON.stringify(activities),
      referencesHtml: referencesHtml || null,
      referencesLevel,
    });
  }

  if (payload.club) {
    const canSaveClub =
      loaded.viewer.canEditClubScoped || loaded.viewer.canEditMemberSignature;
    if (canSaveClub) {
      let clubData = payload.club;
      if (!loaded.viewer.canEditClubScoped && loaded.viewer.isSelf) {
        clubData = mergeMemberSelfClubSave(loaded.club, clubData);
      }
      const age = calcAge(loaded.owner.personal.dateOfBirth);
      const underage = age != null && age < 18;
      clubData.otherDetails.userUnderage = underage;
      const signatureDataUrl = resolveSignatureDataUrl(clubData, underage);
      await upsertTeamProfile({
        teamMemberId: loaded.clubMemberId,
        profileJson: JSON.stringify(clubScopedForProfileJson(clubData)),
        signatureDataUrl,
        medicalImageUrl: loaded.owner.medical.imageUrl || null,
        medicalPdfUrl: loaded.owner.medical.pdfUrl || null,
      });
    }
  }

  return { ok: true };
}

export async function saveMemberProfileBundle(opts: {
  clubId: string;
  memberUserId: string;
  viewerUserId: string;
  payload: {
    owner?: OwnerProfileData;
    contacts?: ContactsData;
    activities?: ActivitiesData;
    referencesHtml?: string;
    referencesLevel?: string;
    club?: ClubMemberScopedData;
  };
}): Promise<{ ok: true } | { error: string; status: number }> {
  const loaded = await loadMemberProfileBundle({
    clubId: opts.clubId,
    memberUserId: opts.memberUserId,
    viewerUserId: opts.viewerUserId,
  });
  if ('error' in loaded) return loaded;

  if (loaded.workspaceKind === 'team') {
    return saveTeamMemberSharedProfile({
      memberUserId: opts.memberUserId,
      loaded,
      payload: opts.payload,
    });
  }

  const clubMember = await prisma.clubMember.findUnique({
    where: {
      clubId_memberId: { clubId: opts.clubId, memberId: opts.memberUserId },
    },
    select: { id: true },
  });
  if (!clubMember) return { error: 'Member not found', status: 404 };

  if (opts.payload.owner && loaded.viewer.canEditOwner) {
    const owner = opts.payload.owner;
    const userUpdate: Record<string, unknown> = {
      firstName: owner.login.firstName || null,
      surname: owner.login.lastName || null,
      name:
        [owner.login.firstName, owner.login.lastName].filter(Boolean).join(' ') ||
        loaded.user.name,
      gender: owner.personal.gender || null,
      country: owner.address.country || null,
      image: owner.photoUrl || null,
    };
    if (owner.personal.dateOfBirth) {
      const d = new Date(owner.personal.dateOfBirth);
      if (!Number.isNaN(d.getTime())) userUpdate.birthdate = d;
    }
    if (owner.login.email && owner.login.email !== loaded.user.email) {
      userUpdate.email = owner.login.email.trim();
    }
    if (
      owner.login.newPassword &&
      owner.login.newPassword === owner.login.repeatPassword &&
      owner.login.newPassword.length >= 4
    ) {
      userUpdate.password = await hashPassword(owner.login.newPassword);
    }

    await prisma.user.update({
      where: { id: opts.memberUserId },
      data: userUpdate,
    });

    const ownerToStore: OwnerProfileData = {
      ...owner,
      login: { ...owner.login, newPassword: '', repeatPassword: '' },
    };

    await upsertExtras({
      userId: opts.memberUserId,
      disallowClubAdmins: loaded.viewer.isSelf
        ? Boolean(owner.privateSettings.disallowClubAdmins)
        : loaded.owner.privateSettings.disallowClubAdmins,
      qrCodeUrl: normalizeStoredQrCodeUrl(owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify({
        ...ownerToStore,
        privateSettings: {
          disallowClubAdmins: loaded.viewer.isSelf
            ? Boolean(owner.privateSettings.disallowClubAdmins)
            : loaded.owner.privateSettings.disallowClubAdmins,
        },
      }),
      contactsJson: JSON.stringify(loaded.contacts),
      activitiesJson: JSON.stringify(loaded.activities),
      referencesHtml: loaded.referencesHtml || null,
      referencesLevel: loaded.referencesLevel || '1',
    });

    const medicalImage = owner.medical.imageUrl || null;
    const medicalPdf = owner.medical.pdfUrl || null;
    if (medicalImage || medicalPdf) {
      const now = new Date();
      const existingProfile = await getClubProfile(clubMember.id);
      if (existingProfile) {
        await prisma.$executeRawUnsafe(
          `UPDATE club_member_profiles SET medicalImageUrl=?, medicalPdfUrl=?, updatedAt=? WHERE clubMemberId=?`,
          medicalImage,
          medicalPdf,
          now,
          clubMember.id,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO club_member_profiles (id, clubMemberId, profileJson, medicalImageUrl, medicalPdfUrl, signatureDataUrl, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
          cuid(),
          clubMember.id,
          JSON.stringify(loaded.club),
          medicalImage,
          medicalPdf,
          loaded.club.otherDetails.signatureDataUrl || loaded.club.parents.signatureDataUrl || null,
          now,
          now,
        );
      }
    }
  }

  if (
    (opts.payload.contacts ||
      opts.payload.activities ||
      typeof opts.payload.referencesHtml === 'string' ||
      typeof opts.payload.referencesLevel === 'string') &&
    loaded.viewer.canEditContactsActivitiesReferences
  ) {
    const contacts = normalizeContacts(opts.payload.contacts ?? loaded.contacts);
    const activities = opts.payload.activities ?? loaded.activities;
    const referencesHtml =
      typeof opts.payload.referencesHtml === 'string'
        ? opts.payload.referencesHtml
        : loaded.referencesHtml;
    const referencesLevel =
      typeof opts.payload.referencesLevel === 'string'
        ? opts.payload.referencesLevel
        : loaded.referencesLevel;

    await upsertExtras({
      userId: opts.memberUserId,
      disallowClubAdmins: loaded.owner.privateSettings.disallowClubAdmins,
      qrCodeUrl: normalizeStoredQrCodeUrl(loaded.owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify(loaded.owner),
      contactsJson: JSON.stringify(contacts),
      activitiesJson: JSON.stringify(activities),
      referencesHtml: referencesHtml || null,
      referencesLevel,
    });
  }

  if (opts.payload.club) {
    const canSaveClub =
      loaded.viewer.canEditClubScoped || loaded.viewer.canEditMemberSignature;
    if (canSaveClub) {
      let clubData = opts.payload.club;
      if (!loaded.viewer.canEditClubScoped && loaded.viewer.isSelf) {
        clubData = mergeMemberSelfClubSave(loaded.club, clubData);
      }
      const age = calcAge(loaded.owner.personal.dateOfBirth);
      const underage = age != null && age < 18;
      clubData.otherDetails.userUnderage = underage;
      const signatureDataUrl = resolveSignatureDataUrl(clubData, underage);
      const profileJson = JSON.stringify(clubScopedForProfileJson(clubData));
      const now = new Date();
      const existing = await getClubProfile(clubMember.id);
      if (existing) {
        await prisma.$executeRawUnsafe(
          `UPDATE club_member_profiles SET profileJson=?, signatureDataUrl=?, updatedAt=? WHERE clubMemberId=?`,
          profileJson,
          signatureDataUrl,
          now,
          clubMember.id,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO club_member_profiles (id, clubMemberId, profileJson, medicalImageUrl, medicalPdfUrl, signatureDataUrl, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)`,
          cuid(),
          clubMember.id,
          profileJson,
          loaded.owner.medical.imageUrl || null,
          loaded.owner.medical.pdfUrl || null,
          signatureDataUrl,
          now,
          now,
        );
      }

      if (loaded.viewer.canEditClubScoped) {
        await copyParentDataToTaggedMembers({
          clubId: opts.clubId,
          sourceMemberId: opts.memberUserId,
          parentSlot: 'parent1',
          parentData: clubData.parents.parent1,
        });
        await copyParentDataToTaggedMembers({
          clubId: opts.clubId,
          sourceMemberId: opts.memberUserId,
          parentSlot: 'parent2',
          parentData: clubData.parents.parent2,
        });
      }
    }
  }

  return { ok: true };
}

export async function loadSelfMemberProfileBundle(opts: {
  userId: string;
}): Promise<MemberProfileBundle | { error: string; status: number }> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      firstName: true,
      surname: true,
      gender: true,
      birthdate: true,
      country: true,
      image: true,
    },
  });
  if (!user) return { error: 'User not found', status: 404 };

  const extras = await getExtras(opts.userId);
  const ownerStored = safeJsonParse(extras?.ownerJson, emptyOwnerProfile());
  const contacts = normalizeContacts(safeJsonParse(extras?.contactsJson, emptyContacts()));
  const activitiesRaw = safeJsonParse(extras?.activitiesJson, emptyActivities());
  const activities: ActivitiesData = normalizeActivities(activitiesRaw);

  const birthIso = user.birthdate ? user.birthdate.toISOString().slice(0, 10) : ownerStored.personal.dateOfBirth || '';
  const age = calcAge(birthIso);

  const owner: OwnerProfileData = emptyOwnerProfile({
    ...ownerStored,
    privateSettings: {
      disallowClubAdmins: Boolean(extras?.disallowClubAdmins),
    },
    photoUrl: user.image || ownerStored.photoUrl || '',
    qrCodeUrl: normalizeStoredQrCodeUrl(extras?.qrCodeUrl || ownerStored.qrCodeUrl || ''),
    login: {
      ...emptyOwnerProfile().login,
      ...ownerStored.login,
      username: user.username,
      firstName: user.firstName || ownerStored.login?.firstName || '',
      lastName: user.surname || ownerStored.login?.lastName || '',
      email: user.email,
      newPassword: '',
      repeatPassword: '',
    },
    address: {
      ...emptyOwnerProfile().address,
      ...ownerStored.address,
      country: user.country || ownerStored.address?.country || '',
    },
    personal: {
      ...emptyOwnerProfile().personal,
      ...ownerStored.personal,
      gender: user.gender || ownerStored.personal?.gender || '',
      dateOfBirth: birthIso,
      age,
      otherSports: Array.isArray(ownerStored.personal?.otherSports)
        ? ownerStored.personal.otherSports
        : [],
    },
    administrative: {
      ...emptyOwnerProfile().administrative,
      ...ownerStored.administrative,
    },
    documents: {
      ...emptyOwnerProfile().documents,
      ...(ownerStored.documents || {}),
      idCard: {
        ...emptyOwnerProfile().documents.idCard,
        ...(ownerStored.documents?.idCard || {}),
      },
      drivingLicence: {
        ...emptyOwnerProfile().documents.drivingLicence,
        ...(ownerStored.documents?.drivingLicence || {}),
      },
      healthInsuranceCard: {
        ...emptyOwnerProfile().documents.healthInsuranceCard,
        ...(ownerStored.documents?.healthInsuranceCard || {}),
      },
      passport: {
        ...emptyOwnerProfile().documents.passport,
        ...(ownerStored.documents?.passport || {}),
      },
      residencePermit: {
        ...emptyOwnerProfile().documents.residencePermit,
        ...(ownerStored.documents?.residencePermit || {}),
      },
    },
    medical: {
      ...emptyOwnerProfile().medical,
      ...ownerStored.medical,
    },
    bodyMeasurements: {
      ...emptyOwnerProfile().bodyMeasurements,
      ...(ownerStored.bodyMeasurements || {}),
    },
    otherReferences: {
      ...emptyOwnerProfile().otherReferences,
      ...ownerStored.otherReferences,
    },
  });

  return {
    clubId: '',
    clubName: '',
    entitySportDefault: 'Football',
    clubMemberId: '',
    memberId: user.id,
    role: null,
    membershipType: null,
    viewer: {
      isClubAdmin: false,
      isSelf: true,
      canEditOwner: true,
      canEditContactsActivitiesReferences: true,
      canEditClubScoped: false,
      canEditMemberSignature: false,
    },
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      surname: user.surname,
      gender: user.gender,
      birthdate: birthIso || null,
      country: user.country,
      image: user.image,
    },
    owner,
    contacts: normalizeContacts(contacts),
    activities,
    referencesHtml: extras?.referencesHtml || '',
    referencesLevel: String(extras?.referencesLevel || '1').trim() || '1',
    club: emptyClubScoped(),
    clubMembersForPayFor: [],
    vendorCoachOptions: [],
    coachOptions: [],
    clubParentsCatalog: [],
    customQuestions: [],
    staffNotes: [],
    coachNotes: [],
  };
}

export async function saveSelfMemberProfileBundle(opts: {
  userId: string;
  payload: {
    owner?: OwnerProfileData;
    contacts?: ContactsData;
    activities?: ActivitiesData;
    referencesHtml?: string;
    referencesLevel?: string;
  };
}): Promise<{ ok: true } | { error: string; status: number }> {
  const loaded = await loadSelfMemberProfileBundle({ userId: opts.userId });
  if ('error' in loaded) return loaded;

  if (opts.payload.owner) {
    const owner = opts.payload.owner;
    const userUpdate: Record<string, unknown> = {
      firstName: owner.login.firstName || null,
      surname: owner.login.lastName || null,
      name:
        [owner.login.firstName, owner.login.lastName].filter(Boolean).join(' ') ||
        loaded.user.name,
      gender: owner.personal.gender || null,
      country: owner.address.country || null,
      image: owner.photoUrl || null,
    };
    if (owner.personal.dateOfBirth) {
      const d = new Date(owner.personal.dateOfBirth);
      if (!Number.isNaN(d.getTime())) userUpdate.birthdate = d;
    }
    if (owner.login.email && owner.login.email !== loaded.user.email) {
      userUpdate.email = owner.login.email.trim();
    }
    if (
      owner.login.newPassword &&
      owner.login.newPassword === owner.login.repeatPassword &&
      owner.login.newPassword.length >= 4
    ) {
      userUpdate.password = await hashPassword(owner.login.newPassword);
    }

    await prisma.user.update({
      where: { id: opts.userId },
      data: userUpdate,
    });

    const ownerToStore: OwnerProfileData = {
      ...owner,
      login: { ...owner.login, newPassword: '', repeatPassword: '' },
      privateSettings: {
        disallowClubAdmins: Boolean(owner.privateSettings.disallowClubAdmins),
      },
    };

    await upsertExtras({
      userId: opts.userId,
      disallowClubAdmins: Boolean(owner.privateSettings.disallowClubAdmins),
      qrCodeUrl: normalizeStoredQrCodeUrl(owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify(ownerToStore),
      contactsJson: JSON.stringify(loaded.contacts),
      activitiesJson: JSON.stringify(loaded.activities),
      referencesHtml: loaded.referencesHtml || null,
      referencesLevel: loaded.referencesLevel || '1',
    });
  }

  if (
    opts.payload.contacts ||
    opts.payload.activities ||
    typeof opts.payload.referencesHtml === 'string' ||
    typeof opts.payload.referencesLevel === 'string'
  ) {
    const contacts = normalizeContacts(opts.payload.contacts ?? loaded.contacts);
    const activities = opts.payload.activities ?? loaded.activities;
    const referencesHtml =
      typeof opts.payload.referencesHtml === 'string'
        ? opts.payload.referencesHtml
        : loaded.referencesHtml;
    const referencesLevel =
      typeof opts.payload.referencesLevel === 'string'
        ? opts.payload.referencesLevel
        : loaded.referencesLevel;

    await upsertExtras({
      userId: opts.userId,
      disallowClubAdmins: loaded.owner.privateSettings.disallowClubAdmins,
      qrCodeUrl: normalizeStoredQrCodeUrl(loaded.owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify(loaded.owner),
      contactsJson: JSON.stringify(contacts),
      activitiesJson: JSON.stringify(activities),
      referencesHtml: referencesHtml || null,
      referencesLevel,
    });
  }

  return { ok: true };
}

export async function getMemberNoteById(clubMemberId: string, noteId: string) {
  await ensureNoteImageColumn();
  const rows = await prisma.$queryRawUnsafe<NoteRow[]>(
    `SELECT * FROM club_member_notes WHERE clubMemberId = ? AND id = ? LIMIT 1`,
    clubMemberId,
    noteId,
  );
  return rows[0] ?? null;
}

export async function getClubMemberVisibility(clubMemberId: string) {
  const profile = await getClubProfile(clubMemberId);
  const clubScoped = mergeClubScoped(
    profile?.profileJson
      ? (safeJsonParse(profile.profileJson, {}) as Partial<ClubMemberScopedData>)
      : undefined,
  );
  return clubScoped.visibility;
}

export async function createMemberNote(opts: {
  clubMemberId: string;
  kind: string;
  title: string;
  body: string;
  authorId: string;
  parentId?: string | null;
  visibleToMember?: boolean;
  commentsEnabled?: boolean;
  imageUrls?: string[];
  enableFrom?: Date | null;
  enableTo?: Date | null;
  showAtLogin?: boolean;
  showAtLogout?: boolean;
}) {
  await ensureNoteImageColumn();
  const now = new Date();
  const id = cuid();
  const imageUrlsJson = JSON.stringify(normalizeSupportImageUrls(opts.imageUrls ?? []));
  await prisma.$executeRawUnsafe(
    `INSERT INTO club_member_notes (id, clubMemberId, kind, title, body, authorId, parentId, visibleToMember, commentsEnabled, imageUrlsJson, enableFrom, enableTo, showAtLogin, showAtLogout, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    opts.clubMemberId,
    opts.kind,
    opts.title,
    opts.body,
    opts.authorId,
    opts.parentId || null,
    Boolean(opts.visibleToMember),
    Boolean(opts.commentsEnabled),
    imageUrlsJson,
    opts.enableFrom || null,
    opts.enableTo || null,
    Boolean(opts.showAtLogin),
    Boolean(opts.showAtLogout),
    now,
    now,
  );
  return { id };
}

export async function deleteMemberNotes(opts: {
  clubMemberId: string;
  noteId?: string;
  resetKind?: string;
}) {
  if (opts.resetKind) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM club_member_notes WHERE clubMemberId=? AND kind=?`,
      opts.clubMemberId,
      opts.resetKind,
    );
    return;
  }
  if (opts.noteId) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM club_member_notes WHERE clubMemberId=? AND (id=? OR parentId=?)`,
      opts.clubMemberId,
      opts.noteId,
      opts.noteId,
    );
  }
}

/** Copy selected dossier sections from one club/team member onto another (admin only). */
export async function duplicateMemberProfileSections(opts: {
  clubId: string;
  targetMemberUserId: string;
  sourceMemberUserId: string;
  viewerUserId: string;
  sections: DuplicateMemberSection[];
}): Promise<{ ok: true; copied: DuplicateMemberSection[] } | { error: string; status: number }> {
  if (opts.sourceMemberUserId === opts.targetMemberUserId) {
    return { error: 'Choose a different user to duplicate from', status: 400 };
  }
  if (!opts.sections.length) {
    return { error: 'Select at least one section to duplicate', status: 400 };
  }

  const source = await loadMemberProfileBundle({
    clubId: opts.clubId,
    memberUserId: opts.sourceMemberUserId,
    viewerUserId: opts.viewerUserId,
  });
  if ('error' in source) return source;
  if (!source.viewer.isClubAdmin) {
    return { error: 'Only the Club/Team admin can duplicate member data', status: 403 };
  }

  const target = await loadMemberProfileBundle({
    clubId: opts.clubId,
    memberUserId: opts.targetMemberUserId,
    viewerUserId: opts.viewerUserId,
  });
  if ('error' in target) return target;
  if (!target.viewer.isClubAdmin) {
    return { error: 'Only the Club/Team admin can duplicate member data', status: 403 };
  }

  const copied: DuplicateMemberSection[] = [];
  const isTeam = target.workspaceKind === 'team';

  if (opts.sections.includes('member-profile')) {
    const owner = {
      ...source.owner,
      login: {
        ...source.owner.login,
        username: target.owner.login.username,
        email: target.owner.login.email,
        newPassword: '',
        repeatPassword: '',
      },
      privateSettings: target.owner.privateSettings,
    };
    const userUpdate: Record<string, unknown> = {
      firstName: owner.login.firstName || null,
      surname: owner.login.lastName || null,
      name:
        [owner.login.firstName, owner.login.lastName].filter(Boolean).join(' ') ||
        target.user.name,
      gender: owner.personal.gender || null,
      country: owner.address.country || null,
      image: owner.photoUrl || null,
    };
    if (owner.personal.dateOfBirth) {
      const d = new Date(owner.personal.dateOfBirth);
      if (!Number.isNaN(d.getTime())) userUpdate.birthdate = d;
    }
    await prisma.user.update({
      where: { id: opts.targetMemberUserId },
      data: userUpdate,
    });
    await upsertExtras({
      userId: opts.targetMemberUserId,
      disallowClubAdmins: Boolean(target.owner.privateSettings.disallowClubAdmins),
      qrCodeUrl: normalizeStoredQrCodeUrl(owner.qrCodeUrl) || null,
      ownerJson: JSON.stringify({
        ...owner,
        login: { ...owner.login, newPassword: '', repeatPassword: '' },
      }),
      contactsJson: JSON.stringify(target.contacts),
      activitiesJson: JSON.stringify(target.activities),
      referencesHtml: target.referencesHtml || null,
      referencesLevel: target.referencesLevel || '1',
    });
    copied.push('member-profile');
  }

  const needsClubScoped =
    opts.sections.includes('parents') ||
    opts.sections.includes('other-data') ||
    opts.sections.includes('settings');

  if (needsClubScoped) {
    let clubData = { ...target.club };
    if (opts.sections.includes('parents')) {
      clubData = { ...clubData, parents: source.club.parents };
      copied.push('parents');
    }
    if (opts.sections.includes('other-data')) {
      clubData = {
        ...clubData,
        otherDetails: {
          ...source.club.otherDetails,
          duplicateFromUserId: opts.sourceMemberUserId,
        },
        visibility: source.club.visibility,
        payForMemberIds: source.club.payForMemberIds,
      };
      copied.push('other-data');
    }
    if (opts.sections.includes('settings')) {
      clubData = { ...clubData, settings: source.club.settings };
      copied.push('settings');
    }
    const saved = await saveMemberProfileBundle({
      clubId: opts.clubId,
      memberUserId: opts.targetMemberUserId,
      viewerUserId: opts.viewerUserId,
      payload: { club: clubData },
    });
    if ('error' in saved) return saved;
  }

  const copyRootNotes = async (kind: 'staff' | 'coach') => {
    if (isTeam) return;
    const sourceNotes = await getNotes(source.clubMemberId);
    const roots = sourceNotes.filter((n) => n.kind === kind && !n.parentId);
    await deleteMemberNotes({
      clubMemberId: target.clubMemberId,
      resetKind: kind,
    });
    for (const n of roots) {
      await createMemberNote({
        clubMemberId: target.clubMemberId,
        kind,
        title: n.title,
        body: n.body,
        authorId: opts.viewerUserId,
        parentId: null,
        visibleToMember: Boolean(n.visibleToMember),
        commentsEnabled: Boolean(n.commentsEnabled),
        imageUrls: parseSupportImageUrlsJson(n.imageUrlsJson),
        enableFrom: n.enableFrom,
        enableTo: n.enableTo,
        showAtLogin: Boolean(n.showAtLogin),
        showAtLogout: Boolean(n.showAtLogout),
      });
    }
  };

  if (opts.sections.includes('alert-posted') && !isTeam) {
    await copyRootNotes('staff');
    copied.push('alert-posted');
  }
  if (opts.sections.includes('coach-notes') && !isTeam) {
    await copyRootNotes('coach');
    copied.push('coach-notes');
  }

  return { ok: true, copied };
}
