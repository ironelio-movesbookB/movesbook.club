'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, Radio, Shield, Star, User } from 'lucide-react';
import {
  CLUB_ADMIN_ARCHIVE_GROUPS,
  CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS,
  type ClubAdminArchiveItem,
  type ClubAdminInsertItem,
} from '@/lib/club/clubAdminMenus';
import { writeClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';

function InsertLeading({ item }: { item: ClubAdminInsertItem }) {
  if (item.kind === 'affiliate') {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white">
        <Shield className="h-4 w-4 opacity-95" strokeWidth={1.5} />
        <Star className="pointer-events-none absolute h-2 w-2 fill-white text-white" strokeWidth={0} />
      </span>
    );
  }
  if (item.kind === 'assignAlert') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <User className="h-3 w-3" strokeWidth={2} />
        <Radio className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  if (item.kind === 'recordAlert') {
    return (
      <span className="flex shrink-0 items-center gap-0.5 text-white opacity-95">
        <User className="h-3 w-3" strokeWidth={2} />
        <Bell className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  const Icon = item.Icon;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />;
}

function ArchiveLeading({ item }: { item: ClubAdminArchiveItem }) {
  if (item.kind === 'affiliate') {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white">
        <Shield className="h-4 w-4 opacity-95" strokeWidth={1.5} />
        <Star className="pointer-events-none absolute h-2 w-2 fill-white text-white" strokeWidth={0} />
      </span>
    );
  }
  if (item.kind === 'child' || item.kind === 'group' || item.kind === 'overview') return null;
  const Icon = item.Icon;
  return <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />;
}

type Variant = 'insert' | 'archive';

type Props = {
  variant: Variant;
  /** Dark filled button (Insert) vs outlined (Archive). */
  tone?: 'dark' | 'light';
};

export default function ClubAdminMenuDropdown({ variant, tone = 'dark' }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = variant === 'insert' ? 'Insert data' : 'Archive data';
  const groups = variant === 'insert' ? CLUB_ADMIN_INSERT_NEW_ITEM_GROUPS : CLUB_ADMIN_ARCHIVE_GROUPS;

  const go = (path: string) => {
    writeClubWorkspaceTab('my-entity');
    setOpen(false);
    router.push(path);
  };

  const btnClass =
    tone === 'dark'
      ? 'h-[28px] px-3 bg-[#333333] text-white rounded-sm text-[13px] flex items-center gap-1 hover:bg-[#444]'
      : 'h-[28px] px-3 bg-white border border-gray-300 rounded-sm text-[13px] flex items-center gap-1 hover:bg-gray-50';

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className={btnClass} onClick={() => setOpen((v) => !v)}>
        {label}
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-[70vh] w-[320px] overflow-y-auto rounded-sm border border-gray-600 bg-[#2a2a2a] shadow-xl">
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'border-t border-gray-600/70' : ''}>
              {group.map((item, ii) => {
                const rowBorder = ii < group.length - 1 ? 'border-b border-gray-600/50' : '';

                if (variant === 'archive' && item.kind === 'group') {
                  const GroupIcon = item.Icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex w-full items-center gap-2 py-2 pl-3 pr-2 text-[13px] font-semibold text-white ${rowBorder}`}
                    >
                      <GroupIcon className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2} />
                      <span className="min-w-0 leading-snug">{item.label}</span>
                    </div>
                  );
                }

                const path = 'path' in item && item.path ? item.path : undefined;
                const isChild = variant === 'archive' && item.kind === 'child';
                const leading: ReactNode =
                  variant === 'insert' ? (
                    <InsertLeading item={item as ClubAdminInsertItem} />
                  ) : isChild ? null : (
                    <ArchiveLeading item={item as ClubAdminArchiveItem} />
                  );

                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={!path}
                    onClick={() => {
                      if (path) go(path);
                    }}
                    className={`flex w-full items-center gap-2 py-2 pr-2 text-left text-[13px] font-medium text-white transition-colors hover:bg-[#333] disabled:cursor-default disabled:opacity-80 ${
                      isChild ? 'pl-12' : 'pl-3'
                    } ${rowBorder}`}
                  >
                    {leading}
                    <span className="min-w-0 leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
