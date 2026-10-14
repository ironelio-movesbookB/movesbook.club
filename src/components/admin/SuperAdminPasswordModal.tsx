'use client';

import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react';

interface PasswordRequest {
  title: string;
  message: string;
}

/** Asks for the super admin password before a destructive action; resolves null when cancelled. */
export function useSuperAdminPassword(): {
  requestPassword: (request: PasswordRequest) => Promise<string | null>;
  passwordModal: ReactNode;
} {
  const [request, setRequest] = useState<PasswordRequest | null>(null);
  const [password, setPassword] = useState('');
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const close = useCallback((value: string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
    setPassword('');
  }, []);

  const requestPassword = useCallback(
    (next: PasswordRequest) =>
      new Promise<string | null>((resolve) => {
        resolverRef.current?.(null);
        resolverRef.current = resolve;
        setPassword('');
        setRequest(next);
      }),
    [],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    close(password.trim());
  };

  const passwordModal = request ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-black bg-[#fff8dc] shadow-xl"
      >
        <div className="bg-red-700 px-4 py-2 text-sm font-bold text-white">{request.title}</div>
        <div className="space-y-3 p-4 text-sm">
          <p className="whitespace-pre-line text-gray-900">{request.message}</p>
          <label className="block font-semibold text-gray-900">
            SuperAdmin password
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-gray-500 bg-white px-2 py-1.5 font-normal"
            />
          </label>
        </div>
        <div className="flex justify-center gap-4 border-t border-gray-400 bg-[#f5ebc8] py-3">
          <button
            type="submit"
            disabled={!password.trim()}
            className="px-8 py-1.5 bg-red-600 border border-red-800 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => close(null)}
            className="px-8 py-1.5 bg-[#c4c4c4] border border-gray-600 text-sm font-semibold text-gray-900 hover:bg-[#b8b8b8]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { requestPassword, passwordModal };
}
