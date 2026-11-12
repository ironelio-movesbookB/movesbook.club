'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

export type Toast = { type: 'success' | 'error' | 'info'; message: string };

const STYLES: Record<Toast['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-sky-600'
};

/** Small auto-hiding status message (replaces the legacy showTemporaryMessage). */
export default function StatusToast({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => onCloseRef.current(), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : Info;
  return (
    <div
      role="status"
      className={`fixed right-5 top-5 z-[10010] flex max-w-sm items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white shadow-lg ${STYLES[toast.type]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {toast.message}
    </div>
  );
}
