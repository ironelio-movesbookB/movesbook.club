'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getBannerUrlFromEntityDescription,
  getLogoUrlFromEntityDescription,
  type ManagedEntityLogoKind,
} from '@/lib/entity/entityLogo';
import { uploadEntityLogo } from '@/lib/entity/uploadEntityLogoClient';

export const ENTITY_VISUAL_UPDATED_EVENT = 'movesbook:entity-visual-updated';

export type EntityVisualEdit = {
  kind: ManagedEntityLogoKind;
  entityId: string;
};

type EntityVisualDetail = {
  id: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

export function publishEntityVisual(detail: EntityVisualDetail) {
  window.dispatchEvent(new CustomEvent(ENTITY_VISUAL_UPDATED_EVENT, { detail }));
}

/** Club/team/group logo and banner from the entity record, plus uploads made in this session. */
export function useEntityVisual(entityId?: string | null, description?: string | null) {
  const [logoOverride, setLogoOverride] = useState<string | null | undefined>(undefined);
  const [bannerOverride, setBannerOverride] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setLogoOverride(undefined);
    setBannerOverride(undefined);
  }, [entityId, description]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<EntityVisualDetail>).detail;
      if (!detail || detail.id !== entityId) return;
      if (detail.logoUrl !== undefined) setLogoOverride(detail.logoUrl);
      if (detail.bannerUrl !== undefined) setBannerOverride(detail.bannerUrl);
    };
    window.addEventListener(ENTITY_VISUAL_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(ENTITY_VISUAL_UPDATED_EVENT, onUpdate);
  }, [entityId]);

  return {
    logoUrl:
      logoOverride !== undefined ? logoOverride : getLogoUrlFromEntityDescription(description),
    bannerUrl:
      bannerOverride !== undefined
        ? bannerOverride
        : getBannerUrlFromEntityDescription(description),
  };
}

export async function uploadAndPublishEntityImage(
  kind: ManagedEntityLogoKind,
  entityId: string,
  file: File,
  asset: 'logo' | 'banner',
) {
  const url = await uploadEntityLogo(kind, entityId, file, asset);
  publishEntityVisual({
    id: entityId,
    ...(asset === 'banner' ? { bannerUrl: url } : { logoUrl: url }),
  });
  return url;
}

export function useEntityImageInput() {
  return useRef<HTMLInputElement>(null);
}
