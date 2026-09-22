'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ModernNavbar from '@/components/ModernNavbar';
import TeamProfileEditor, {
  type TeamProfileSavePayload,
} from '@/components/team/TeamProfileEditor';
import { applyEntityLogoOnSave } from '@/lib/entity/applyEntityLogoOnSave';
import { useAuth } from '@/hooks/useAuth';
import { isClubCreatedFromForm } from '@/lib/club/clubSidebarLabel';
import { isTeamAccountUserType } from '@/utils/dashboardRouting';

type TeamRecord = {
  id: string;
  name: string;
  description?: string | null;
  sport?: string | null;
};

function EditTeamProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const teamId = searchParams?.get('teamId');

  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to load team');
      }
      const data = await res.json();
      const loaded = data.team as TeamRecord | undefined;
      if (!loaded || !isClubCreatedFromForm(loaded)) {
        throw new Error('This team profile cannot be edited here');
      }
      setTeam(loaded);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load team');
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!isTeamAccountUserType(user.userType)) return;
    if (teamId) {
      void loadTeam();
      return;
    }

    let cancelled = false;
    const resolveTeam = async () => {
      const saved =
        typeof window !== 'undefined' ? localStorage.getItem('selectedTeam') : null;
      if (saved) {
        if (!cancelled) {
          router.replace(`/my-team/edit?teamId=${encodeURIComponent(saved)}`);
        }
        return;
      }
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          if (!cancelled) {
            setLoading(false);
            setLoadError('Select a team first.');
          }
          return;
        }
        const res = await fetch('/api/teams/my-teams', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) {
            setLoading(false);
            setLoadError('Could not load your teams.');
          }
          return;
        }
        const data = (await res.json()) as { teams?: Array<{ id: string }> };
        const first = data.teams?.[0]?.id ?? null;
        if (first) {
          localStorage.setItem('selectedTeam', first);
          if (!cancelled) {
            router.replace(`/my-team/edit?teamId=${encodeURIComponent(first)}`);
          }
          return;
        }
        if (!cancelled) {
          setLoading(false);
          setLoadError('Create a team first from the Team dashboard.');
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setLoadError('Could not load your teams.');
        }
      }
    };
    void resolveTeam();
    return () => {
      cancelled = true;
    };
  }, [teamId, loadTeam, authLoading, user, router]);

  const handleSave = async (payload: TeamProfileSavePayload) => {
    if (!teamId) return;
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not signed in');

    setSaving(true);
    try {
      let logoUrl = String(payload.logoUrl ?? '').trim();
      if (payload.logoFile || payload.removeLogo) {
        const uploaded = await applyEntityLogoOnSave('team', teamId, payload);
        logoUrl = payload.removeLogo ? '' : uploaded || logoUrl;
      }
      const { logoFile: _logoFile, removeLogo: _removeLogo, ...body } = payload;
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, logoUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save team profile');
      }
      router.push(`/my-team?teamId=${encodeURIComponent(teamId)}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  if (!isTeamAccountUserType(user.userType)) {
    router.replace('/my-page');
    return null;
  }

  const backHref = teamId
    ? `/my-team?teamId=${encodeURIComponent(teamId)}`
    : '/team/dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <ModernNavbar />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back to team profile
        </Link>

        {!teamId ? (
          <p className="text-sm text-red-600">
            Missing team. Open a team from the dashboard first.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        ) : team ? (
          <div className="rounded-lg border border-gray-300 bg-white shadow-xl overflow-hidden">
            <TeamProfileEditor
              mode="edit"
              adminUsername={user.username}
              initialTeam={team}
              onSave={handleSave}
              saving={saving}
              onCancel={() => router.push(backHref)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EditTeamProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <EditTeamProfileContent />
    </Suspense>
  );
}
