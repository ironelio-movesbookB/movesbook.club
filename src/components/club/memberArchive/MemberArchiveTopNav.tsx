'use client';

import { useMemo } from 'react';
import { Settings } from 'lucide-react';

export type MemberArchiveSection =
  | 'athletes'
  | 'pending'
  | 'archived'
  | 'not-members'
  | 'parents'
  | 'staff'
  | 'club-profile'
  | 'settings';

/** Archive top-nav audience: Club Admin (ID8) / Team Admin (ID7) vs Coach (ID6). */
export type MemberArchiveNavRole = 'club-or-team' | 'coach';

/**
 * Which list the Members tab shows (the tab row itself is the same):
 * - `archive` — All the users profiles (members, pending and not members)
 * - `athletes` — Athletes\\Members only
 */
export type MemberArchiveNavMode = 'archive' | 'athletes';

type Props = {
  active: MemberArchiveSection;
  onChange: (section: MemberArchiveSection) => void;
  /** Club Profile / Team Profile / Coach Profile / Group Profile */
  profileSectionLabel?: string;
  /** Controls which black-menu voices are shown. */
  navRole?: MemberArchiveNavRole;
  /** Which one-row header set to show (club/team only). */
  navMode?: MemberArchiveNavMode;
};

type NavItem = { id: MemberArchiveSection; label: string };

function clubOrTeamSections(profileSectionLabel: string): NavItem[] {
  return [
    { id: 'athletes', label: 'Members' },
    { id: 'archived', label: 'Members Archived' },
    { id: 'pending', label: 'Members in pending' },
    { id: 'not-members', label: 'Not members' },
    { id: 'parents', label: 'Parents & Tutors' },
    { id: 'staff', label: 'Staff' },
    { id: 'club-profile', label: profileSectionLabel || 'Team\\Club profile' },
  ];
}

function coachSections(profileSectionLabel: string): NavItem[] {
  return [
    { id: 'athletes', label: 'Members' },
    { id: 'archived', label: 'Members Archived' },
    { id: 'pending', label: 'Members in pending' },
    { id: 'parents', label: 'Parents & Tutors' },
    { id: 'club-profile', label: profileSectionLabel || 'Coach profile' },
  ];
}

/**
 * Sections reachable for a role (used by the page for URL guards). Settings is opened from the
 * "Settings" link beside the Archive of Users title, not from the tab row.
 */
export function memberArchiveNavSections(
  navRole: MemberArchiveNavRole,
  _navMode: MemberArchiveNavMode,
  profileSectionLabel = 'Club Profile',
): MemberArchiveSection[] {
  const items =
    navRole === 'coach'
      ? coachSections(profileSectionLabel)
      : clubOrTeamSections(profileSectionLabel);
  return [...items.map((i) => i.id), 'settings'];
}

/** Top section switcher on Archive of Users (Club / Team / Coach). Single row only. */
export default function MemberArchiveTopNav({
  active,
  onChange,
  profileSectionLabel = 'Club Profile',
  navRole = 'club-or-team',
}: Props) {
  const sections = useMemo(() => {
    if (navRole === 'coach') return coachSections(profileSectionLabel);
    return clubOrTeamSections(profileSectionLabel);
  }, [navRole, profileSectionLabel]);

  const count = sections.length;
  const colClass =
    count <= 5
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      : count === 6
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        : count === 7
          ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'
          : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8';

  return (
    <nav
      className={`mb-3 grid w-full gap-px overflow-hidden rounded-md bg-[#1e293b] ${colClass}`}
      aria-label="Archive of Users sections"
    >
      {sections.map((section) => {
        const isActive = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(section.id)}
            className={`min-h-[3rem] px-3 py-3 text-center text-sm font-bold tracking-wide sm:text-base ${
              isActive
                ? 'bg-[#0f172a] text-white'
                : 'bg-[#334155] text-slate-100 hover:bg-[#1e293b] hover:text-white'
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

/** "Archive of Users ⚙ Settings" title row under the tabs. */
export function MemberArchiveTitle({
  settingsActive,
  onSettingsClick,
}: {
  settingsActive: boolean;
  onSettingsClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold text-gray-900">Archive of Users</h1>
      <button
        type="button"
        onClick={onSettingsClick}
        aria-current={settingsActive ? 'page' : undefined}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold hover:underline ${
          settingsActive ? 'text-red-900 underline' : 'text-red-700'
        }`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600">
          <Settings className="h-4 w-4" />
        </span>
        Settings
      </button>
    </div>
  );
}
