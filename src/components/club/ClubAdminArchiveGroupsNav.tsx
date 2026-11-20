'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, Server, Shield, Star, Triangle } from 'lucide-react';
import type { ClubAdminArchiveItem } from '@/lib/club/clubAdminMenus';

/** Submenu panel / nested children background (R≈65 G≈64 B≈64). */
export const CLUB_SUBMENU_BG = '#414040';

function ArchiveLeading({ item }: { item: ClubAdminArchiveItem }): ReactNode {
  if (item.kind === 'affiliate') {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white">
        <Shield className="h-4 w-4 opacity-95" strokeWidth={1.5} />
        <Star className="pointer-events-none absolute h-2 w-2 fill-white text-white" strokeWidth={0} />
      </span>
    );
  }
  if (item.kind === 'overview') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <Server className="h-3.5 w-3.5" strokeWidth={2} />
        <ChevronRight className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  if (item.kind === 'child' || item.kind === 'group') return null;
  const Icon = item.Icon;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />;
}

function GroupToggleIcons({ open }: { open: boolean }) {
  return (
    <span className="ml-auto flex shrink-0 flex-col items-center leading-none" aria-hidden>
      <Triangle
        className={`h-2 w-2 ${open ? 'fill-white text-white' : 'fill-transparent text-white/70'}`}
        strokeWidth={1.5}
      />
      <Triangle
        className={`h-2 w-2 rotate-180 ${open ? 'fill-transparent text-white/70' : 'fill-white text-white'}`}
        strokeWidth={1.5}
      />
    </span>
  );
}

type Props = {
  groups: ClubAdminArchiveItem[][];
  onNavigate: (path: string) => void;
  /** Row text size — club sidebar uses 13px, team/coach use 12px. */
  textClassName?: string;
};

/**
 * Club Admin → Archives groups: group headers toggle children (default hidden).
 * Nested submenu background is #414040.
 */
export default function ClubAdminArchiveGroupsNav({
  groups,
  onNavigate,
  textClassName = 'text-[13px]',
}: Props) {
  const [openByLabel, setOpenByLabel] = useState<Record<string, boolean>>({});

  const toggle = (label: string) => {
    setOpenByLabel((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {groups.map((group, gi) => {
        const header = group.find((item) => item.kind === 'group');
        const children = group.filter((item) => item.kind === 'child');
        const flat = group.filter((item) => item.kind !== 'group' && item.kind !== 'child');
        const collapsible = Boolean(header && children.length > 0);
        const open = collapsible ? Boolean(openByLabel[header!.label]) : true;

        return (
          <div key={gi} className={gi > 0 ? 'border-t border-gray-600/70' : ''}>
            {flat.map((item, ii) => {
              const path = 'path' in item && item.path ? item.path : undefined;
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={!path}
                  onClick={() => {
                    if (path) onNavigate(path);
                  }}
                  className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left font-medium text-white transition-colors hover:bg-[#333] disabled:cursor-default disabled:opacity-90 ${textClassName} ${
                    ii < flat.length - 1 || collapsible ? 'border-b border-gray-600/50' : ''
                  }`}
                >
                  <ArchiveLeading item={item} />
                  <span className="min-w-0 leading-snug">{item.label}</span>
                </button>
              );
            })}

            {collapsible && header ? (
              <>
                <button
                  type="button"
                  onClick={() => toggle(header.label)}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left font-semibold text-white transition-colors hover:bg-[#333] ${textClassName} ${
                    open ? 'border-b border-gray-600/50' : ''
                  }`}
                >
                  <header.Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />
                  <span className="min-w-0 leading-snug">{header.label}</span>
                  <GroupToggleIcons open={open} />
                </button>
                {open ? (
                  <div style={{ background: CLUB_SUBMENU_BG }}>
                    {children.map((item, ii) => {
                      const path = item.path;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => onNavigate(path)}
                          className={`flex w-full items-center gap-2 py-2 pl-12 pr-2 text-left font-medium text-white transition-colors hover:bg-[#333] ${textClassName} ${
                            ii < children.length - 1 ? 'border-b border-gray-600/40' : ''
                          }`}
                        >
                          <span className="min-w-0 leading-snug">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
