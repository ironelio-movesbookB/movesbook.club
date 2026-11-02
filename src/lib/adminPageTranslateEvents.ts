export const ADMIN_PAGE_TRANSLATE_OPEN_EVENT = 'movesbook:admin-page-translate-open';
export const ADMIN_PAGE_TRANSLATE_STATUS_EVENT = 'movesbook:admin-page-translate-status';

export type AdminPageTranslateStatusDetail = {
  busy: boolean;
  activeCode: string | null;
  activeName: string | null;
};

export function openAdminPageTranslatePanel(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ADMIN_PAGE_TRANSLATE_OPEN_EVENT));
}

export function emitAdminPageTranslateStatus(detail: AdminPageTranslateStatusDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_PAGE_TRANSLATE_STATUS_EVENT, { detail }));
}
