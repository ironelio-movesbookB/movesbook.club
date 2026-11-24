export const MEMBER_OVERVIEW_TOGGLE = 'movesbook:member-overview-toggle';
const STORAGE_KEY = 'movesbook.memberOverviewOpen';

export function readMemberOverviewOpen(): boolean {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(STORAGE_KEY) !== '0';
}

export function writeMemberOverviewOpen(open: boolean) {
  sessionStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  window.dispatchEvent(new Event(MEMBER_OVERVIEW_TOGGLE));
}
