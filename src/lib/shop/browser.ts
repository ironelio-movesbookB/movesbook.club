/** Browser helper for shop manager requests. Sends the Movesbook login token. */

export function shopAuthHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function shopFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const auth = shopAuthHeaders();
  for (const [key, value] of Object.entries(auth)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
