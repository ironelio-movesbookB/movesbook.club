import type { ManagedEntityLogoKind } from '@/lib/entity/entityLogo';

function logoApiPath(kind: ManagedEntityLogoKind, entityId: string): string {
  switch (kind) {
    case 'club':
      return `/api/clubs/${encodeURIComponent(entityId)}/logo`;
    case 'team':
      return `/api/teams/${encodeURIComponent(entityId)}/logo`;
    case 'group':
      return `/api/groups/${encodeURIComponent(entityId)}/logo`;
    case 'coach':
      return `/api/coaching-groups/${encodeURIComponent(entityId)}/logo`;
  }
}

export async function uploadEntityLogo(
  kind: ManagedEntityLogoKind,
  entityId: string,
  file: File,
  asset: 'logo' | 'banner' = 'logo',
): Promise<string> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not signed in');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('asset', asset);

  const res = await fetch(logoApiPath(kind, entityId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : asset === 'banner'
          ? 'Failed to upload banner'
          : 'Failed to upload logo',
    );
  }
  if (asset === 'banner') {
    const bannerUrl =
      typeof data.bannerUrl === 'string'
        ? data.bannerUrl
        : typeof data.logoUrl === 'string'
          ? data.logoUrl
          : '';
    if (!bannerUrl) throw new Error('Banner upload did not return a path');
    return bannerUrl;
  }
  const logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl : '';
  if (!logoUrl) throw new Error('Logo upload did not return a path');
  return logoUrl;
}

export async function removeEntityLogo(
  kind: ManagedEntityLogoKind,
  entityId: string,
  asset: 'logo' | 'banner' = 'logo',
): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not signed in');

  const qs = asset === 'banner' ? '?asset=banner' : '';
  const res = await fetch(`${logoApiPath(kind, entityId)}${qs}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : asset === 'banner'
          ? 'Failed to remove banner'
          : 'Failed to remove logo',
    );
  }
}
