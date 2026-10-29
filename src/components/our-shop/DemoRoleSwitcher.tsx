
'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ShieldCheck,
  Users,
  User,
} from 'lucide-react';

type DemoRole = 'club-manager' | 'club-member' | 'customer';

const STORAGE_KEY = 'shop-mvp-demo-role';
const ROLE_CHANGE_EVENT = 'demo-role-change';

const ROLES: {
  value: DemoRole;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    value: 'club-manager',
    label: 'Manager',
    description: 'Manage the shop and orders',
    icon: ShieldCheck,
  },
  {
    value: 'club-member',
    label: 'Team Member',
    description: 'Shop and product access',
    icon: Users,
  },
  {
    value: 'customer',
    label: 'Normal User',
    description: 'Browse and order products',
    icon: User,
  },
];

function isDemoRole(value: string | null): value is DemoRole {
  return (
    value === 'club-manager' ||
    value === 'club-member' ||
    value === 'customer'
  );
}

function readRole(): DemoRole {
  if (typeof window === 'undefined') return 'club-manager';

  const saved = window.localStorage.getItem(STORAGE_KEY);

  // Convert the previous demo role values to the new three-role setup.
  if (saved === 'visitor') return 'customer';
  if (saved === 'normal-user') return 'customer';
  if (saved === 'manager') return 'club-manager';
  if (saved === 'team-member') return 'club-member';

  return isDemoRole(saved) ? saved : 'club-manager';
}

export default function DemoRoleSwitcher() {
  const [role, setRole] = useState<DemoRole>('club-manager');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const syncRole = () => setRole(readRole());

    syncRole();
    window.addEventListener(ROLE_CHANGE_EVENT, syncRole);
    window.addEventListener('storage', syncRole);

    return () => {
      window.removeEventListener(ROLE_CHANGE_EVENT, syncRole);
      window.removeEventListener('storage', syncRole);
    };
  }, []);

  const selectedRole =
    ROLES.find((item) => item.value === role) ?? ROLES[0];

  const SelectedIcon = selectedRole.icon;

  function handleRoleChange(nextRole: DemoRole) {
    window.localStorage.setItem(STORAGE_KEY, nextRole);
    window.dispatchEvent(
      new CustomEvent(ROLE_CHANGE_EVENT, { detail: nextRole }),
    );

    setRole(nextRole);
    setOpen(false);

    // Open the most useful screen for the selected demo role.
    if (nextRole === 'customer') {
      window.location.href = '/shop/manchester-juniors';
    } else if (nextRole === 'club-member') {
      window.location.href = '/products';
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className="relative border-t border-slate-200 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Demo user
      </p>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <SelectedIcon size={18} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">
            {selectedRole.label}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {selectedRole.description}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close role selector"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div
            role="listbox"
            aria-label="Select demo role"
            className="absolute bottom-[calc(100%-0.5rem)] left-4 right-4 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          >
            {ROLES.map((item) => {
              const Icon = item.icon;
              const selected = item.value === role;

              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleRoleChange(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                    selected ? 'bg-violet-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      selected
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon size={17} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.description}
                    </span>
                  </span>

                  {selected && (
                    <Check size={16} className="text-violet-700" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-2 text-[11px] leading-4 text-slate-400">
        Presentation demo — switch between the available views.
      </p>
    </div>
  );
}
