'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, UserCircle, Settings, Info, MessageCircle } from 'lucide-react';

type SubmenuItem = {
  key: string;
  label: string;
  disabled?: boolean;
  needsClub?: boolean;
  icon: typeof Info;
  href?: string;
};

/**
 * My Club sidebar — expandable club info / profile / settings links (club accounts).
 */
export default function ClubMyClubInfoSubmenu({ clubId }: { clubId?: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const items: SubmenuItem[] = [
    {
      key: 'info',
      label: 'Info about the club',
      disabled: true,
      icon: Info,
    },
    {
      key: 'admin',
      label: 'Admin profile',
      icon: UserCircle,
      href: '/profile',
    },
    {
      key: 'club',
      label: 'Club profile',
      needsClub: true,
      icon: Building2,
      href: clubId ? `/my-club?clubId=${encodeURIComponent(clubId)}` : undefined,
    },
    {
      key: 'messages',
      label: 'Messages among Staff and members',
      needsClub: false,
      icon: MessageCircle,
      href: clubId ? `/clubs/messages?clubId=${encodeURIComponent(clubId)}` : '/clubs/messages',
    },
    {
      key: 'settings',
      label: 'Club settings',
      needsClub: true,
      icon: Settings,
      href: clubId ? `/club/settings?clubId=${encodeURIComponent(clubId)}` : undefined,
    },
  ];

  const handleItemClick = (item: SubmenuItem) => {
    if (item.disabled) return;
    if (item.needsClub && !clubId) return;
    if (item.href) router.push(item.href);
  };

  return (
    <div className="border-b border-teal-700">
      <div className="flex w-full items-stretch bg-teal-800 text-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-teal-700"
        >
          <Building2 className="h-5 w-5 shrink-0" />
          <span className="truncate font-semibold tracking-wide">Club Info</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="flex shrink-0 items-center px-3 transition-colors hover:bg-teal-700"
        >
          <ChevronDown
            className={`h-4 w-4 opacity-90 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open && (
        <div className="border-t border-teal-900/40 bg-[#2d2d2d] text-sm text-white">
          {items.map((item, idx) => {
            const Icon = item.icon;
            const inactive = item.disabled || (item.needsClub && !clubId);
            return (
              <button
                key={item.key}
                type="button"
                disabled={inactive}
                onClick={() => handleItemClick(item)}
                title={
                  item.disabled
                    ? 'Not available yet'
                    : item.needsClub && !clubId
                      ? 'Select a club first'
                      : undefined
                }
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                  idx > 0 ? 'border-t border-black/25' : ''
                } ${
                  inactive
                    ? 'cursor-not-allowed text-white/40'
                    : 'hover:bg-zinc-700/90 text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
