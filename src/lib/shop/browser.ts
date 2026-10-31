/** Browser helper for shop manager requests. Sends the Movesbook login token. */

export function shopAuthHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function withOpenClub(url: string) {
  if (typeof window === 'undefined') return url;
  if (!url.startsWith('/api/club/shop')) return url;
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

export function shopFetch(input: string, init: RequestInit = {}) {
  const target = withOpenClub(input);
  const headers = new Headers(init.headers);
  const auth = shopAuthHeaders();
  for (const [key, value] of Object.entries(auth)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return fetch(target, { ...init, headers, cache: 'no-store' });
}
