'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Mail } from 'lucide-react';
import AdminPasswordConfirmModal from '@/components/club/AdminPasswordConfirmModal';
import CreateEntityModal from '@/components/entity/CreateEntityModal';
import MyPageTopicsEntryRow from '@/components/club/MyPageTopicsEntryRow';
import type { CreateEntityFormPayload } from '@/components/entity/CreateEntityModal';
import type { ClubProfileSavePayload } from '@/components/club/ClubProfileEditor';
import { formatMyClubsSidebarLabel } from '@/lib/club/clubSidebarLabel';
import { clubProfilePayloadForApi } from '@/lib/club/clubProfilePayload';
import {
  applyEntityBannerOnSave,
  applyEntityLogoOnSave,
} from '@/lib/entity/applyEntityLogoOnSave';
import {
  managedEntityKindFromUserType,
  type ManagedEntityKind,
} from '@/lib/entity/entityProfileLabels';
import { getEntityWorkspaceDashboardPath } from '@/lib/entity/entityWorkspaceDashboard';
import { writeClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';

export type MyCompanyRow = {
  id: string;
  name: string;
  description: string | null;
  kind: ManagedEntityKind;
};

const KIND_BADGE: Record<ManagedEntityKind, { label: string; className: string }> = {
  club: { label: 'Club', className: 'text-[#ff4d5a]' },
  team: { label: 'Team', className: 'text-[#3ec6ff]' },
  group: { label: 'Group', className: 'text-[#c4a574]' },
  'coaching-group': { label: 'Group trained', className: 'text-[#8fd18a]' },
};

const CREATE_TARGET: Record<
  ManagedEntityKind,
  { api: string; responseKey: string; storageKey: string }
> = {
  club: { api: '/api/clubs', responseKey: 'club', storageKey: 'selectedClub' },
  team: { api: '/api/teams', responseKey: 'team', storageKey: 'selectedTeam' },
  group: { api: '/api/groups', responseKey: 'group', storageKey: 'selectedGroup' },
  'coaching-group': {
    api: '/api/coaching-groups',
    responseKey: 'coachingGroup',
    storageKey: 'selectedCoachingGroup',
  },
};

type MyCompaniesPanelProps = {
  userType: string;
  adminUsername: string;
  companyLimitReached: boolean;
  selectedEntityId?: string | null;
  onOpenTopics: () => void;
  onBecomeMemberClick?: () => void;
  /** Same dashboard already open — select the company without a full navigation. */
  onOpenOwnedHere?: (row: MyCompanyRow) => void;
};

function memberSectionHref(row: MyCompanyRow): string {
  const name = encodeURIComponent(row.name || '');
  return `/athlete/dashboard?asMember=1&kind=${encodeURIComponent(row.kind)}&id=${encodeURIComponent(row.id)}&name=${name}`;
}

export default function MyCompaniesPanel({
  userType,
  adminUsername,
  companyLimitReached,
  selectedEntityId,
  onOpenTopics,
  onBecomeMemberClick,
  onOpenOwnedHere,
}: MyCompaniesPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isCoach = userType === 'COACH';
  const [memberOpen, setMemberOpen] = useState(true);
  const [owned, setOwned] = useState<MyCompanyRow[]>([]);
  const [memberships, setMemberships] = useState<MyCompanyRow[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showKindPicker, setShowKindPicker] = useState(false);
  const [createKind, setCreateKind] = useState<ManagedEntityKind | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/my-companies', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        owned?: MyCompanyRow[];
        memberships?: MyCompanyRow[];
      };
      setOwned(Array.isArray(data.owned) ? data.owned : []);
      setMemberships(Array.isArray(data.memberships) ? data.memberships : []);
    } catch {
      /* sidebar list is optional until the next open */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOwned = (row: MyCompanyRow) => {
    const target = CREATE_TARGET[row.kind];
    localStorage.setItem(target.storageKey, row.id);
    if (row.kind === 'team') localStorage.setItem('selectedClub', row.id);
    writeClubWorkspaceTab('my-entity');
    const onThisDashboard =
      (row.kind === 'club' && pathname?.startsWith('/club')) ||
      (row.kind === 'team' && pathname?.startsWith('/team')) ||
      (row.kind === 'group' && pathname?.startsWith('/group')) ||
      (row.kind === 'coaching-group' && pathname?.startsWith('/coach'));
    if (onThisDashboard && onOpenOwnedHere) {
      onOpenOwnedHere(row);
      return;
    }
    router.push(getEntityWorkspaceDashboardPath(row.kind, row.id));
  };

  const openMembership = (row: MyCompanyRow) => {
    const target = CREATE_TARGET[row.kind];
    localStorage.setItem(target.storageKey, row.id);
    if (row.kind === 'club') localStorage.setItem('selectedClub', row.id);
    writeClubWorkspaceTab('my-entity');
    router.push(memberSectionHref(row));
  };

  const handleCreateSave = async (payload: CreateEntityFormPayload) => {
    if (!createKind) return;
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not signed in');
    const target = CREATE_TARGET[createKind];
    setSaving(true);
    try {
      const response = await fetch(target.api, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          create: true,
          ...clubProfilePayloadForApi(payload as ClubProfileSavePayload),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create');
      }
      const entity = data[target.responseKey] as { id?: string; name?: string } | undefined;
      if (entity?.id && (payload.logoFile || payload.removeLogo)) {
        await applyEntityLogoOnSave(createKind, entity.id, payload);
      }
      if (entity?.id && (payload.bannerFile || payload.removeBanner)) {
        await applyEntityBannerOnSave(createKind, entity.id, payload);
      }
      setCreateKind(null);
      if (entity?.id) {
        localStorage.setItem(target.storageKey, entity.id);
        if (createKind === 'team') localStorage.setItem('selectedClub', entity.id);
        writeClubWorkspaceTab('my-entity');
        window.location.assign(getEntityWorkspaceDashboardPath(createKind, entity.id));
      }
      void load();
    } finally {
      setSaving(false);
    }
  };

  const kindChoices: { kind: ManagedEntityKind; label: string }[] = [
    { kind: 'club', label: 'A Club' },
    ...(isCoach ? [{ kind: 'coaching-group' as const, label: 'A Group trained' }] : []),
    { kind: 'team', label: 'A Team' },
    { kind: 'group', label: 'A Group' },
  ];

  return (
    <>
      <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
        <p className="mb-3 text-center text-sm font-semibold text-yellow-300">
          Companies in which I am owner
        </p>
        <button
          type="button"
          disabled={companyLimitReached}
          onClick={() => setShowPassword(true)}
          className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm text-white shadow hover:from-red-600 hover:to-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create a <span className="font-bold">new one</span>
        </button>
        {owned.length > 0 && (
          <>
            <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
            <ul className="mt-3 space-y-1">
              {owned.map((row) => (
                <CompanyRowButton
                  key={`${row.kind}-${row.id}`}
                  row={row}
                  selected={selectedEntityId === row.id}
                  onClick={() => openOwned(row)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-b border-teal-700">
        <div className="flex w-full items-stretch bg-teal-800 text-white">
          <button
            type="button"
            onClick={() => setMemberOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left transition-colors hover:bg-teal-700"
          >
            <Mail className="h-5 w-5 shrink-0" />
            <span>Member of…</span>
          </button>
          <button
            type="button"
            onClick={() => setMemberOpen((open) => !open)}
            aria-label={memberOpen ? 'Collapse' : 'Expand'}
            className="flex shrink-0 items-center border-l border-teal-700/40 px-4 transition-colors hover:bg-teal-700"
          >
            <ChevronDown
              className={`h-4 w-4 opacity-80 transition-transform duration-200 ${memberOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {memberOpen && (
          <div className="border-t border-teal-900/40 bg-[#2d2d2d] px-4 py-4">
            <p className="mb-3 text-center text-sm font-semibold text-yellow-300">
              Structures in which I am member
            </p>
            <button
              type="button"
              onClick={() => onBecomeMemberClick?.()}
              className="mx-auto block w-full max-w-[220px] rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
            >
              Become member
            </button>
            {memberships.length > 0 && (
              <>
                <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15" />
                <ul className="mt-3 space-y-1">
                  {memberships.map((row) => (
                    <CompanyRowButton
                      key={`member-${row.kind}-${row.id}`}
                      row={row}
                      selected={false}
                      onClick={() => openMembership(row)}
                    />
                  ))}
                </ul>
              </>
            )}
            <div className="mx-auto mt-4 max-w-[220px] border-t border-white/15 pt-3">
              <MyPageTopicsEntryRow onOpenClubPicker={onOpenTopics} />
            </div>
          </div>
        )}
      </div>

      <AdminPasswordConfirmModal
        isOpen={showPassword}
        onClose={() => setShowPassword(false)}
        onVerified={() => {
          setShowPassword(false);
          setShowKindPicker(true);
        }}
        adminUsername={adminUsername}
        entityKind={managedEntityKindFromUserType(userType)}
      />

      {showKindPicker && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-company-kind-title"
        >
          <div className="w-full max-w-sm border border-gray-400 bg-[#f3f3f3] shadow-2xl">
            <div
              id="create-company-kind-title"
              className="bg-[#6b1020] px-4 py-2.5 text-sm font-semibold text-white"
            >
              What do you want to create?
            </div>
            <div className="space-y-2 p-5">
              {kindChoices.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  onClick={() => {
                    setShowKindPicker(false);
                    setCreateKind(choice.kind);
                    setCreateKey((key) => key + 1);
                  }}
                  className="block w-full rounded-md border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:from-red-600 hover:to-red-800"
                >
                  {choice.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowKindPicker(false)}
                className="mt-2 block w-full rounded-md border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-4 py-2.5 text-sm font-semibold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {createKind && (
        <CreateEntityModal
          key={createKey}
          entityKind={createKind}
          isOpen
          onClose={() => setCreateKind(null)}
          adminUsername={adminUsername}
          saving={saving}
          onSave={handleCreateSave}
        />
      )}
    </>
  );
}

function CompanyRowButton({
  row,
  selected,
  onClick,
}: {
  row: MyCompanyRow;
  selected: boolean;
  onClick: () => void;
}) {
  const badge = KIND_BADGE[row.kind];
  const label = formatMyClubsSidebarLabel(row);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-white transition-colors hover:bg-zinc-700/80 ${
          selected ? 'bg-zinc-700/60' : ''
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
        <span className={`shrink-0 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
      </button>
    </li>
  );
}
