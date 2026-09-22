export type ManagedEntityKind = 'club' | 'coaching-group' | 'team' | 'group';

export type EntityProfileLabels = {
  createTitle: (adminUsername: string) => string;
  logoLabel: string;
  usernameLabel: string;
  categoryLabel: string;
  mailLabel: string;
  passwordSectionTitle: string;
  passwordHintCreate: string;
  passwordRequiredError: string;
  officialNameLabel: string;
  directAccessRequiredError: string;
  nameRequiredError: string;
  saveError: string;
};

const LABELS: Record<ManagedEntityKind, EntityProfileLabels> = {
  club: {
    createTitle: (u) => `Create a new club for the Club Admin <${u}>`,
    logoLabel: 'Club Logo',
    usernameLabel: 'Club username',
    categoryLabel: 'Sport',
    mailLabel: 'Club mail',
    passwordSectionTitle: 'My Club password',
    passwordHintCreate:
      'Used with the club username on the login page to open this club profile directly.',
    passwordRequiredError: 'My Club password is required.',
    officialNameLabel: 'Official Club name',
    directAccessRequiredError: 'Club username and Direct Access are required.',
    nameRequiredError: 'Enter a club username or official club name.',
    saveError: 'Failed to save club profile',
  },
  'coaching-group': {
    createTitle: (u) => `Create a new trained group for the Coach <${u}>`,
    logoLabel: 'Group Logo',
    usernameLabel: 'Group username',
    categoryLabel: 'Sport',
    mailLabel: 'Group mail',
    passwordSectionTitle: 'My Group password',
    passwordHintCreate:
      'Used with the group username on the login page to open this trained group directly.',
    passwordRequiredError: 'My Group password is required.',
    officialNameLabel: 'Official group name',
    directAccessRequiredError: 'Group username and Direct Access are required.',
    nameRequiredError: 'Enter a group username or official group name.',
    saveError: 'Failed to save group profile',
  },
  team: {
    createTitle: (u) => `Create a new team for the Team Admin <${u}>`,
    logoLabel: 'Team Logo',
    usernameLabel: 'Team username',
    categoryLabel: 'Sport',
    mailLabel: 'Team mail',
    passwordSectionTitle: 'My Team password',
    passwordHintCreate:
      'Used with the team username on the login page to open this team profile directly.',
    passwordRequiredError: 'My Team password is required.',
    officialNameLabel: 'Official team name',
    directAccessRequiredError: 'Team username and Direct Access are required.',
    nameRequiredError: 'Enter a team username or official team name.',
    saveError: 'Failed to save team profile',
  },
  group: {
    createTitle: (u) => `Create a new group for the Group Admin <${u}>`,
    logoLabel: 'Group Logo',
    usernameLabel: 'Group username',
    categoryLabel: 'Sport',
    mailLabel: 'Group mail',
    passwordSectionTitle: 'My Group password',
    passwordHintCreate:
      'Used with the group username on the login page to open this group profile directly.',
    passwordRequiredError: 'My Group password is required.',
    officialNameLabel: 'Official group name',
    directAccessRequiredError: 'Group username and Direct Access are required.',
    nameRequiredError: 'Enter a group username or official group name.',
    saveError: 'Failed to save group profile',
  },
};

export function getEntityProfileLabels(kind: ManagedEntityKind): EntityProfileLabels {
  return LABELS[kind];
}

/** Archive of Users top-nav label for the entity profile section. */
export function getArchiveEntityProfileSectionLabel(kind: ManagedEntityKind): string {
  switch (kind) {
    case 'team':
      return 'Team Profile';
    case 'coaching-group':
      return 'Coach Profile';
    case 'group':
      return 'Group Profile';
    case 'club':
    default:
      return 'Club Profile';
  }
}

/** Resolve managed entity kind from the signed-in admin user type. */
export function managedEntityKindFromUserType(
  userType: string | null | undefined,
): ManagedEntityKind {
  const t = (userType || '').toUpperCase();
  if (t === 'TEAM' || t === 'TEAM_MANAGER') return 'team';
  if (t === 'COACH') return 'coaching-group';
  if (t === 'GROUP' || t === 'GROUP_ADMIN') return 'group';
  return 'club';
}

export function getAdminPasswordConfirmCopy(kind: ManagedEntityKind): {
  title: string;
  description: (adminUsername: string) => string;
} {
  switch (kind) {
    case 'coaching-group':
      return {
        title: 'Confirm Coach password',
        description: (u) =>
          `Retype the password for Coach <${u}> to create another trained group.`,
      };
    case 'team':
      return {
        title: 'Confirm Team Admin password',
        description: (u) =>
          `Retype the password for Team Admin <${u}> to create another team.`,
      };
    case 'group':
      return {
        title: 'Confirm Group Admin password',
        description: (u) =>
          `Retype the password for Group Admin <${u}> to create another group.`,
      };
    case 'club':
    default:
      return {
        title: 'Confirm Club Admin password',
        description: (u) =>
          `Retype the password for Club Admin <${u}> to create another club.`,
      };
  }
}
