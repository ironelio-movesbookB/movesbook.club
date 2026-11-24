'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  getAdminPasswordConfirmCopy,
  type ManagedEntityKind,
} from '@/lib/entity/entityProfileLabels';

type AdminPasswordConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  adminUsername?: string;
  entityKind?: ManagedEntityKind;
};

export default function AdminPasswordConfirmModal({
  isOpen,
  onClose,
  onVerified,
  adminUsername = 'username',
  entityKind = 'club',
}: AdminPasswordConfirmModalProps) {
  const copy = getAdminPasswordConfirmCopy(entityKind);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setError(null);
    setVerifying(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Enter your admin password.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/user/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        valid?: boolean;
        error?: string;
      };
      if (!res.ok || !data.valid) {
        setError(data.error || 'Invalid password.');
        return;
      }
      setPassword('');
      onVerified();
    } catch {
      setError('Could not verify password. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-password-confirm-title"
    >
      <div className="relative w-full max-w-md border border-gray-400 bg-[#f3f3f3] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={verifying}
          className="absolute right-3 top-3 z-10 rounded p-1 text-white/90 hover:bg-white/10 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          id="admin-password-confirm-title"
          className="bg-[#6b1020] px-4 py-2.5 pr-10 text-sm font-semibold text-white"
        >
          {copy.title}
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-gray-700">
            {copy.description(adminUsername)}
          </p>
          <div>
            <label htmlFor="club-admin-retype-password" className="mb-1 block text-sm text-gray-800">
              Admin password
            </label>
            <input
              id="club-admin-retype-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !verifying) void handleVerify();
              }}
              autoFocus
              disabled={verifying}
              className="w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-60"
              placeholder="Retype your password"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-center gap-4 pt-1">
            <button
              type="button"
              disabled={verifying}
              onClick={() => void handleVerify()}
              className="flex items-center justify-center gap-2 rounded-lg border border-red-900 bg-gradient-to-b from-red-500 to-red-700 px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Continue'
              )}
            </button>
            <button
              type="button"
              disabled={verifying}
              onClick={onClose}
              className="rounded-lg border border-gray-900 bg-gradient-to-b from-gray-700 to-black px-8 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
