'use client';

import { X } from 'lucide-react';
import ClubProfileEditor, {
  type ClubProfileSavePayload,
} from '@/components/club/ClubProfileEditor';
import TeamProfileEditor, {
  type TeamProfileSavePayload,
} from '@/components/team/TeamProfileEditor';
import type { ManagedEntityKind } from '@/lib/entity/entityProfileLabels';

export type CreateEntityFormPayload = ClubProfileSavePayload | TeamProfileSavePayload;

type CreateEntityModalProps = {
  entityKind: ManagedEntityKind;
  isOpen: boolean;
  onClose: () => void;
  adminUsername?: string;
  onSave: (payload: CreateEntityFormPayload) => Promise<void>;
  saving?: boolean;
};

export default function CreateEntityModal({
  entityKind,
  isOpen,
  onClose,
  adminUsername = 'username',
  onSave,
  saving = false,
}: CreateEntityModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-entity-modal-title"
    >
      <div className="relative my-auto w-full max-w-5xl border border-gray-400 bg-[#f3f3f3] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded p-1 text-white/90 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div id="create-entity-modal-title" className="sr-only">
          Create {entityKind}
        </div>

        {entityKind === 'team' ? (
          <TeamProfileEditor
            mode="create"
            adminUsername={adminUsername}
            onSave={onSave as (payload: TeamProfileSavePayload) => Promise<void>}
            saving={saving}
            onCancel={onClose}
          />
        ) : (
          <ClubProfileEditor
            mode="create"
            entityKind={entityKind}
            adminUsername={adminUsername}
            onSave={onSave as (payload: ClubProfileSavePayload) => Promise<void>}
            saving={saving}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
