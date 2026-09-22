'use client';

export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

/** Append sidebar-selected club or team so APIs resolve the same workspace as the UI. */
export function withSelectedClubId(url: string): string {
  if (typeof window === 'undefined') return url;
  if (url.includes('clubId=') || url.includes('teamId=')) return url;

  const clubId = localStorage.getItem('selectedClub');
  if (clubId) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}clubId=${encodeURIComponent(clubId)}`;
  }

  const teamId = localStorage.getItem('selectedTeam');
  if (teamId) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}teamId=${encodeURIComponent(teamId)}`;
  }

  return url;
}

export async function clubApiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withSelectedClubId(url), {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
    const details = data.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
    if (details?.fieldErrors) {
      const fieldMessages = Object.entries(details.fieldErrors)
        .flatMap(([field, errors]) => (errors ?? []).map((err) => `${field}: ${err}`));
      if (fieldMessages.length > 0) {
        message = `${message} — ${fieldMessages.join('; ')}`;
      }
    } else if (details?.formErrors?.length) {
      message = `${message} — ${details.formErrors.join('; ')}`;
    }
    const error = new Error(message) as Error & Record<string, unknown>;
    Object.assign(error, data);
    throw error;
  }
  return data as T;
}

export function formatEuro(value: number | undefined | null): string {
  return `€${Number(value ?? 0).toFixed(2)}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

/** `<input type="date">` only accepts yyyy-MM-dd, while the API returns full ISO timestamps. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value.slice(0, 10) : '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}
