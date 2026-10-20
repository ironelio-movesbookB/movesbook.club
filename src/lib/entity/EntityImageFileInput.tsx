'use client';

import type { RefObject } from 'react';
import {
  uploadAndPublishEntityImage,
  type EntityVisualEdit,
} from '@/lib/entity/useEntityVisual';

export default function EntityImageFileInput({
  edit,
  asset,
  inputRef,
}: {
  edit: EntityVisualEdit | null;
  asset: 'logo' | 'banner';
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  if (!edit) return null;
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        void uploadAndPublishEntityImage(edit.kind, edit.entityId, file, asset).catch((error) => {
          window.alert(error instanceof Error ? error.message : 'Upload failed');
        });
      }}
    />
  );
}
