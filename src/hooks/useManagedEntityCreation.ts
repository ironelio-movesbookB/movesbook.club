'use client';

import { useCallback, useState } from 'react';
import type { CreateEntityFormPayload } from '@/components/entity/CreateEntityModal';
import type { ManagedEntityKind } from '@/lib/entity/entityProfileLabels';
import { getFormCreatedEntitiesSortedByCreatedAt } from '@/lib/entity/entityForm';
import { clubProfilePayloadForApi } from '@/lib/club/clubProfilePayload';
import {
  applyEntityBannerOnSave,
  applyEntityLogoOnSave,
} from '@/lib/entity/applyEntityLogoOnSave';

type EntityRow = { id: string; description?: string | null };

export function useManagedEntityCreation(options: {
  createApiPath: string;
  responseEntityKey: string;
  entityKind: ManagedEntityKind;
  onReload: () => Promise<void>;
  onEntityCreated?: (id: string) => void;
  storageKey?: string;
}) {
  const { createApiPath, responseEntityKey, entityKind, onReload, onEntityCreated, storageKey } =
    options;

  const [showAdminPasswordConfirm, setShowAdminPasswordConfirm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);
  const [createSaving, setCreateSaving] = useState(false);

  const openCreateFlow = useCallback(() => setShowAdminPasswordConfirm(true), []);

  const handleAdminPasswordVerified = useCallback(() => {
    setShowAdminPasswordConfirm(false);
    setCreateModalKey((k) => k + 1);
    setShowCreateModal(true);
  }, []);

  const handleCreateSave = useCallback(
    async (payload: CreateEntityFormPayload) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not signed in');

      setCreateSaving(true);
      try {
        const response = await fetch(createApiPath, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ create: true, ...clubProfilePayloadForApi(payload) }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create');
        }
        const entity = data[responseEntityKey] as { id?: string } | undefined;
        if (entity?.id && (payload.logoFile || payload.removeLogo)) {
          await applyEntityLogoOnSave(entityKind, entity.id, payload);
        }
        if (entity?.id && (payload.bannerFile || payload.removeBanner)) {
          await applyEntityBannerOnSave(entityKind, entity.id, payload);
        }
        await onReload();
        if (entity?.id) {
          if (storageKey) localStorage.setItem(storageKey, entity.id);
          onEntityCreated?.(entity.id);
        }
        setShowCreateModal(false);
      } finally {
        setCreateSaving(false);
      }
    },
    [createApiPath, responseEntityKey, entityKind, onReload, onEntityCreated, storageKey],
  );

  return {
    showAdminPasswordConfirm,
    setShowAdminPasswordConfirm,
    showCreateModal,
    setShowCreateModal,
    createModalKey,
    createSaving,
    openCreateFlow,
    handleAdminPasswordVerified,
    handleCreateSave,
  };
}

export function filterFormCreatedEntities<
  T extends { id: string; description?: string | null; createdAt?: string | Date | null },
>(entities: T[]): T[] {
  return getFormCreatedEntitiesSortedByCreatedAt(entities);
}

export type { ManagedEntityKind };
