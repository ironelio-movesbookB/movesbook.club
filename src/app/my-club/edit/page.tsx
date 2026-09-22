'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ModernNavbar from '@/components/ModernNavbar';
import ClubProfileEditor, {
  type ClubProfileSavePayload,
} from '@/components/club/ClubProfileEditor';
import { clubProfilePayloadForApi } from '@/lib/club/clubProfilePayload';
import {
  applyEntityImagesOnSave,
} from '@/lib/entity/applyEntityLogoOnSave';
import { useAuth } from '@/hooks/useAuth';
import { isClubCreatedFromForm } from '@/lib/club/clubSidebarLabel';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

type ClubRecord = {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
};

function EditClubProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const clubId = searchParams?.get('clubId');

  const [club, setClub] = useState<ClubRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadClub = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clubs/${clubId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to load club');
      }
      const data = await res.json();
      const loaded = data.club as ClubRecord | undefined;
      if (!loaded || !isClubCreatedFromForm(loaded)) {
        throw new Error('This club profile cannot be edited here');
      }
      setClub(loaded);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load club');
      setClub(null);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      return;
    }
    void loadClub();
  }, [clubId, loadClub]);

  const handleSave = async (payload: ClubProfileSavePayload) => {
    if (!clubId) return;
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not signed in');

    setSaving(true);
    try {
      const { logoUrl, bannerUrl } = await applyEntityImagesOnSave('club', clubId, payload);
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save club profile');
      }
      router.push(`/my-club?clubId=${encodeURIComponent(clubId)}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  if (!isClubAccountUserType(user.userType)) {
    router.replace('/my-page');
    return null;
  }

  const backHref = clubId
    ? `/my-club?clubId=${encodeURIComponent(clubId)}`
    : '/club/dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <ModernNavbar />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back to club profile
        </Link>

        {!clubId ? (
          <p className="text-sm text-red-600">Missing club. Open a club from the dashboard first.</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        ) : club ? (
          <div className="rounded-lg border border-gray-300 bg-white shadow-xl overflow-hidden">
            <ClubProfileEditor
              mode="edit"
              adminUsername={user.username}
              initialClub={club}
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

export default function EditClubProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <EditClubProfileContent />
    </Suspense>
  );
}
