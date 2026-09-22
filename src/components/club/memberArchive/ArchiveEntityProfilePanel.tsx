'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ClubProfileEditor, {
  type ClubProfileSavePayload,
} from '@/components/club/ClubProfileEditor';
import TeamProfileEditor, {
  type TeamProfileSavePayload,
} from '@/components/team/TeamProfileEditor';
import { clubProfilePayloadForApi } from '@/lib/club/clubProfilePayload';
import {
  applyEntityImagesOnSave,
  applyEntityLogoOnSave,
} from '@/lib/entity/applyEntityLogoOnSave';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';
import { useAuth } from '@/hooks/useAuth';
import {
  managedEntityKindFromUserType,
  type ManagedEntityKind,
} from '@/lib/entity/entityProfileLabels';

type EntityRecord = {
  id: string;
  name: string;
  description?: string | null;
  sport?: string | null;
  location?: string | null;
};

type Props = {
  /** Selected club id from club workspace (club admins). */
  clubId: string | null;
};

function readSelectedTeamId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selectedTeam');
}

/**
 * Archive → Club Profile / Team Profile section.
 * - Club admins: ClubProfileEditor via clubs API + selectedClub
 * - Team admins: TeamProfileEditor via teams API + selectedTeam
 * - Coach / Group: ClubProfileEditor-shaped entity editors via their workspace id when present
 */
export default function ArchiveEntityProfilePanel({ clubId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [entity, setEntity] = useState<EntityRecord | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const kindFromUser = useMemo(
    () => managedEntityKindFromUserType(user?.userType),
    [user?.userType],
  );

  const useTeamEditor = kindFromUser === 'team';
  const editorKind: ManagedEntityKind = kindFromUser;

  const resolveEntityId = useCallback(async (): Promise<string | null> => {
    if (kindFromUser === 'team') {
      const saved = readSelectedTeamId();
      if (saved) return saved;
      const token = localStorage.getItem('token');
      if (!token) return null;
      const res = await fetch('/api/teams/my-teams', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { teams?: Array<{ id: string }> };
      const first = data.teams?.[0]?.id ?? null;
      if (first) localStorage.setItem('selectedTeam', first);
      return first;
    }

    if (clubId) return clubId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedClub');
    }
    return null;
  }, [clubId, kindFromUser]);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = Boolean(opts?.quiet);
      if (!quiet) {
        setLoading(true);
        setSavedMsg('');
      }
      setError('');
      try {
        const id = await resolveEntityId();
        if (!id) {
          setEntity(null);
          setEntityId(null);
          setError(
            kindFromUser === 'team'
              ? 'Select a team under My Team first.'
              : 'Select a club under My clubs first.',
          );
          return;
        }
        setEntityId(id);

        if (kindFromUser === 'team') {
          const res = await fetch(`/api/teams/${encodeURIComponent(id)}/members`, {
            headers: getAuthHeaders(),
            cache: 'no-store',
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              typeof json.error === 'string' ? json.error : 'Failed to load team profile',
            );
          }
          const loaded = json.team as EntityRecord | undefined;
          if (!loaded) throw new Error('Team not found');
          setEntity(loaded);
          return;
        }

        const res = await fetch(
          withSelectedClubId(`/api/clubs/${encodeURIComponent(id)}/members`),
          { headers: getAuthHeaders(), cache: 'no-store' },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string' ? json.error : 'Failed to load club profile',
          );
        }
        const loaded = json.club as EntityRecord | undefined;
        if (!loaded) throw new Error('Club not found');
        setEntity(loaded);
      } catch (e: unknown) {
        if (!quiet) {
          setEntity(null);
          setEntityId(null);
        }
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [kindFromUser, resolveEntityId],
  );

  useEffect(() => {
    // Wait until auth has resolved so we don't briefly treat TEAM as club and
    // leave a stale "Select a club…" error over the team profile form.
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setEntity(null);
      setError('Not signed in.');
      return;
    }
    void load();
  }, [authLoading, load, user]);

  const handleSaveClub = async (payload: ClubProfileSavePayload) => {
    if (!entityId) return;
    setSaving(true);
    setSavedMsg('');
    setError('');
    try {
      const { logoUrl, bannerUrl } = await applyEntityImagesOnSave(
        editorKind,
        entityId,
        payload,
      );

      const res = await fetch(
        withSelectedClubId(`/api/clubs/${encodeURIComponent(entityId)}`),
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(
            clubProfilePayloadForApi({
              ...payload,
              logoUrl,
              bannerUrl,
              logoFile: undefined,
              removeLogo: false,
              bannerFile: undefined,
              removeBanner: false,
            }),
          ),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to save profile',
        );
      }
      setSavedMsg(
        editorKind === 'coaching-group'
          ? 'Coach profile saved.'
          : editorKind === 'group'
            ? 'Group profile saved.'
            : 'Club profile saved.',
      );
      await load({ quiet: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save profile';
      setError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeam = async (payload: TeamProfileSavePayload) => {
    if (!entityId) return;
    setSaving(true);
    setSavedMsg('');
    setError('');
    try {
      let logoUrl = String(payload.logoUrl ?? '').trim();
      if (payload.logoFile || payload.removeLogo) {
        const uploaded = await applyEntityLogoOnSave('team', entityId, payload);
        logoUrl = payload.removeLogo ? '' : uploaded || logoUrl;
      }

      const { logoFile: _logoFile, removeLogo: _removeLogo, ...body } = payload;
      const res = await fetch(`/api/teams/${encodeURIComponent(entityId)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...body, logoUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to save team profile',
        );
      }
      setSavedMsg('Team profile saved.');
      await load({ quiet: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save team profile';
      setError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if ((error && !entity) || !entity) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {error || 'No profile available.'}
      </div>
    );
  }

  return (
    <div className="space-y-3" key={`${entity.id}-${useTeamEditor ? 'team' : editorKind}`}>
      {savedMsg ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {savedMsg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {useTeamEditor ? (
        <TeamProfileEditor
          mode="edit"
          entityKind="team"
          adminUsername={user?.username || 'admin'}
          initialTeam={{
            name: entity.name,
            description: entity.description,
            sport: entity.sport,
          }}
          saving={saving}
          onSave={handleSaveTeam}
        />
      ) : (
        <ClubProfileEditor
          mode="edit"
          entityKind={editorKind === 'team' ? 'club' : editorKind}
          adminUsername={user?.username || 'admin'}
          initialClub={{
            name: entity.name,
            description: entity.description,
            location: entity.location,
          }}
          saving={saving}
          onSave={handleSaveClub}
        />
      )}
    </div>
  );
}
