import { sportFieldKey } from '@/lib/sport/sportProfileTypes';

/** Category of the sport labels in the Section languages (translations table). */
export const SPORT_I18N_CATEGORY = 'sports';

/** Translation key of an English sport label: `sport_weight_class`. */
export function sportLabelKey(text: string): string {
  return `sport_${sportFieldKey(text)}`.slice(0, 120);
}

/** Translated label, or the English text when the key has no translation yet. */
export function translateSportLabel(t: (key: string) => string, text: string): string {
  if (!text) return text;
  const key = sportLabelKey(text);
  const value = t(key);
  return value && value !== key ? value : text;
}

/** Translates a `{0}` template (registered as a label) and fills in the values: `Delete {0}?`. */
export function formatSportText(t: (key: string) => string, template: string, ...values: string[]): string {
  return translateSportLabel(t, template).replace(/\{(\d)\}/g, (_, i: string) => values[Number(i)] ?? '');
}

/** "Position roles (Goalie, Defenseman…)" → label "Position roles", examples as placeholder. */
export function splitFieldLabel(full: string): { label: string; examples?: string } {
  const m = /^([^()]+?)\s*\(([^()]+)\)$/.exec(full);
  if (!m || m[2].length < 25) return { label: full };
  return { label: m[1], examples: m[2] };
}

/** Fixed texts of the sport profile / statistics screens. */
export const SPORT_UI_LABELS = [
  'Club\\Team profile',
  'Profile',
  'Passwords',
  'Statistics',
  'Stats',
  'Statistical options',
  'Season',
  'Add season',
  'No statistics for this sport.',
  'Click a statistic to see its value.',
  'Click a statistic to record its value for the season.',
  'Season statistics',
  'Statistics — general',
  'Sport profile',
  'fields',
  'Main sport',
  'Other sports',
  'Member visibility',
  'Allow member to read the Stats',
  'Jersey number',
  'Vertical jump',
  'Team names',
  'Club names',
  'Foot/Hand',
  'Dominant hand',
  'Positions',
  'Ambidextrous',
  'Member profile',
  'Contacts',
  'My Activities',
  'References',
  'Parents',
  'Pay for…',
  'Other Club data',
  'Settings',
  'Alert posted',
  'Coach notes',
  'Presences',
  'Team Profile',
  'Team contacts',
  'Federal membership',
  'Subteams and Categories',
  'Administrative & Sport data',
  'Sport of the team',
  'Edit team profile',
  'Edit club / team profile',
] as const;

/** Member profile page chrome (admin dossier and the member's own panel). */
export const MEMBER_PROFILE_UI_LABELS = [
  'Other Team data',
  'Other data',
  'Managed by the member (*Member profile can be shared)',
  'Managed by the Team Admin',
  'Managed by the Club Admin',
  'Managed by the Club/Team Admin',
  'Back to Archive of Members',
  'Switch to view',
  'Switch to edit',
  'View mode',
  'Edit mode',
  'Loading member profile…',
  'Return to archive',
  'Athlete trained profile',
  'Team member profile',
  'Club member profile',
  'Read-only: the athlete manages these shared labels. Club and team data stay with their admins.',
  'Grey tabs are shared across teams (user DB). Blue tabs load from this team’s data:',
  'Grey tabs are shared across clubs (user DB). Blue tabs load from this club’s data:',
  'shared profile',
  'select a club',
  'Duplicate existing user data',
  'Do you want to duplicate the data of an existing user?',
  '— Select user —',
  'If you chose to duplicate the data of another user you can check among these sections',
  'not replies and comments',
  'Confirm',
  'Duplication cancelled.',
  'Duplication failed',
  'Sections copied from the selected user:',
  'Member info',
  'Grey labels are shared across all your clubs and teams (you edit them). Blue labels load data from the club or team you select and are managed by its admin — they may enable or hide each label for you.',
  'You are not a member of any club or team yet. Shared profile labels still work; blue labels need a club or team membership.',
  'You are not a member of any club or team yet. Join one to open this section.',
  'Change club',
  'What you can do here:',
  'What this section is for:',
  'Why it is not available:',
  'Loading profile…',
  'Join a club (Become member) to load Owner profile and club sections.',
  'Select a tab to load your profile.',
  'Select which club or team',
  'This section is stored in the club database. Choose which club you want to open (same clubs as under My clubs).',
  'This club section stores data linked to your membership.',
  'The club admin has not enabled reading of this label for you. Use Change club to try another club, or ask the admin to enable it.',
  'Parents is available only for underage members (under 18). Update the date of birth on Owner profile if needed, or ask the club admin.',
  'Your personal identity data (login, address, personal and medical info). Shared across every club. Managed by you (*Member profile can be shared).',
  'Your public contact details and social links. Managed by you; shared across every club.',
  'Preferred days and free-time activities (Music, Sport, Travels, …). Managed by you; shared across every club.',
  'Your references text and level. Managed by you; shared across every club.',
  'Lists other club members whose fees or purchases you pay for (family members, children, etc.). Managed by the club admin for this club.',
  'Other Club/Team data for this membership (status, membership dates, tutors, insurance, news permissions). Most fields are managed by the club/team admin; signatures and rule/privacy acceptance are managed by the member.',
  'Parent / tutor contacts for underage members in this club. Managed by the club admin; visible only when the member is under 18.',
  'How this club shows your profile (theme, sharing, follow-up). Managed by the club admin.',
  'Alerts posted by club staff about your membership. Visible when the admin enables this label for you.',
  'Notes written by coaches for you (login/logout notices, training comments). Visible when enabled by the club admin.',
  'Graphs and history of your attendances / accesses at this club. Visible when enabled by the club admin.',
  'Your sport statistics per season, recorded by the club/team admin. Visible when enabled by the club admin.',
] as const;
