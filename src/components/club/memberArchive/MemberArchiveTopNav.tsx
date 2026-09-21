'use client';

import { useMemo } from 'react';

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
 * One-row header variants:
 * - `archive` — Archive of Users: Members + other tabs, **without** In pending / Not members
 * - `athletes` — Athletes\\Members: Members + In pending + Not members + other tabs
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

function clubOrTeamSections(
  navMode: MemberArchiveNavMode,
  profileSectionLabel: string,
): NavItem[] {
  const members: NavItem = { id: 'athletes', label: 'Members' };
  const pending: NavItem = { id: 'pending', label: 'In pending' };
  const notMembers: NavItem = { id: 'not-members', label: 'Not members' };
  const others: NavItem[] = [
    { id: 'archived', label: 'Members Archived' },
    { id: 'parents', label: 'Parents & Tutors' },
    { id: 'staff', label: 'Staff' },
    { id: 'club-profile', label: profileSectionLabel || 'Team\\Club profile' },
    { id: 'settings', label: 'Settings' },
  ];

  if (navMode === 'athletes') {
    return [members, pending, notMembers, ...others];
  }
  // Archive of Users — no In pending / Not members
  return [members, ...others];
}

function coachSections(profileSectionLabel: string): NavItem[] {
  return [
    { id: 'athletes', label: 'Members' },
    { id: 'pending', label: 'In pending' },
    { id: 'archived', label: 'Members Archived' },
    { id: 'parents', label: 'Parents & Tutors' },
    { id: 'club-profile', label: profileSectionLabel || 'Coach profile' },
    { id: 'settings', label: 'Settings' },
  ];
}

/** Sections visible for a given role + nav mode (used by the page for URL guards). */
export function memberArchiveNavSections(
  navRole: MemberArchiveNavRole,
  navMode: MemberArchiveNavMode,
  profileSectionLabel = 'Club Profile',
): MemberArchiveSection[] {
  const items =
    navRole === 'coach'
      ? coachSections(profileSectionLabel)
      : clubOrTeamSections(navMode, profileSectionLabel);
  return items.map((i) => i.id);
}

/**
 * Top section switcher on Archive of Users (Club / Team / Coach).
 * Single row only. Club/Team use `navMode` to include/exclude pending & not-members.
 */
export default function MemberArchiveTopNav({
  active,
  onChange,
  profileSectionLabel = 'Club Profile',
  navRole = 'club-or-team',
  navMode = 'archive',
}: Props) {
  const sections = useMemo(() => {
    if (navRole === 'coach') return coachSections(profileSectionLabel);
    return clubOrTeamSections(navMode, profileSectionLabel);
  }, [navRole, navMode, profileSectionLabel]);

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
