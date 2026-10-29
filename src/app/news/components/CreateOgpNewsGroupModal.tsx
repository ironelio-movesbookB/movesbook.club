'use client';

import { useState, useEffect, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import NewTopicModal from './NewTopicModal';

interface CreateOgpNewsGroupModalProps {
  /** Defaults to news wording; music uses OGP Music labels. */
  variant?: 'news' | 'music';
  topics: string[];
  defaultTopic?: string | null;
  selectedCount: number;
  saving?: boolean;
  error?: string | null;
  /** When set, name already exists — user can change name or confirm merge. */
  existingNameConflict?: boolean;
  onCancel: () => void;
  onSave: (payload: {
    name: string;
    topic: string;
    confirmExisting: boolean;
    coverImage?: string | null;
  }) => void | Promise<void>;
  /** Persist a newly created topic (e.g. via API); new topic is selected after success. */
  onCreateTopic?: (name: string) => void | Promise<void>;
}

async function uploadCoverImage(file: File): Promise<string> {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'picture');

  const res = await fetch('/api/news/upload-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.path) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Failed to upload group picture'
    );
  }
  return data.path as string;
}

export default function CreateOgpNewsGroupModal({
  variant = 'news',
  topics,
  defaultTopic,
  selectedCount,
  saving = false,
  error = null,
  existingNameConflict = false,
  onCancel,
  onSave,
  onCreateTopic,
}: CreateOgpNewsGroupModalProps) {
  const ogpLabel = variant === 'music' ? 'OGP Music' : 'OGP News';
  const [name, setName] = useState('');
  const [topic, setTopic] = useState(
    () => (defaultTopic && topics.includes(defaultTopic) ? defaultTopic : topics[0] ?? '')
  );
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep selection valid if the topics list changes; do not overwrite the user's pick.
  useEffect(() => {
    setTopic((prev) => {
      if (prev && topics.includes(prev)) return prev;
      if (defaultTopic && topics.includes(defaultTopic)) return defaultTopic;
      return topics[0] ?? '';
    });
  }, [defaultTopic, topics]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const busy = saving || uploadingCover;
  /** Music groups need 2+ items; news/other keep 1+. */
  const minSelected = variant === 'music' ? 2 : 1;
  const canSubmit =
    name.trim().length > 0 && !!topic && selectedCount >= minSelected && !busy;
  const displayError = localError || error;

  const handleCreateTopic = async (newTopicName: string) => {
    if (!onCreateTopic) return;
    setCreatingTopic(true);
    try {
      await onCreateTopic(newTopicName);
      setTopic(newTopicName);
      setShowAddTopicModal(false);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    setLocalError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Please select an image file (JPEG, PNG, GIF, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('Image size must be 5MB or less.');
      return;
    }
    setCoverFile(file);
  };

  const clearCover = () => {
    setCoverFile(null);
    setLocalError(null);
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setLocalError(null);
    try {
      let coverImage: string | null = null;
      if (coverFile) {
        setUploadingCover(true);
        coverImage = await uploadCoverImage(coverFile);
      }
      await onSave({
        name: name.trim(),
        topic,
        confirmExisting: existingNameConflict,
        coverImage,
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to save group');
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
        onClick={onCancel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ogp-group-title"
      >
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800 text-white text-center py-3 px-4">
            <h2 id="create-ogp-group-title" className="text-base font-semibold">
              Create a new group of {variant === 'music' ? 'OG Music' : 'OG News'}
            </h2>
          </div>

          <div className="p-4 flex flex-col gap-4 min-h-0 overflow-y-auto">
            <div>
              <label htmlFor="ogp-group-name" className="block text-sm text-gray-800 mb-1.5">
                Give a name to the group
              </label>
              <input
                id="ogp-group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-800 rounded px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-slate-400"
                autoFocus
                disabled={busy}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="block text-sm text-gray-800">Select a topic for this group</p>
                {onCreateTopic && (
                  <button
                    type="button"
                    onClick={() => setShowAddTopicModal(true)}
                    disabled={busy || creatingTopic}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-cyan-500 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add new topic"
                    aria-label="Add new topic"
                  >
                    Add new topic
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {topics.map((t) => {
                  const selected = t === topic;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      disabled={busy}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        selected
                          ? 'bg-orange-200 border-orange-300 text-gray-900'
                          : 'bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200'
                      }`}
                      aria-pressed={selected}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="block text-sm text-gray-800 mb-1">Group picture</p>
              <p className="text-xs text-gray-500 mb-2">
                Optional. If not selected, the first {ogpLabel} picture/video of this group will be
                displayed.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleCoverChange}
                disabled={busy}
              />
              {coverPreview ? (
                <div className="relative w-full h-36 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="Group cover preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearCover}
                    disabled={busy}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
                    aria-label="Remove group picture"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="w-full h-28 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <ImagePlus className="w-6 h-6 text-gray-500" />
                  Choose picture
                </button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              {selectedCount} {ogpLabel} selected
              {topic ? ` · will be saved under “${topic}”` : ''}
              {variant === 'music' && selectedCount < minSelected
                ? ` · select at least ${minSelected} to create a group`
                : ''}
            </p>

            {existingNameConflict && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                A group with this name already exists. Change the name, or press Save again to add the
                selected {ogpLabel} to the existing group (duplicates will be updated).
              </p>
            )}

            {displayError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {displayError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSave}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingCover ? 'Uploading…' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {onCreateTopic && (
        <NewTopicModal
          isOpen={showAddTopicModal}
          onClose={() => setShowAddTopicModal(false)}
          onSave={handleCreateTopic}
          editingTopic={null}
          existingTopics={topics}
          overlayClassName="z-[90]"
        />
      )}
    </>
  );
}
