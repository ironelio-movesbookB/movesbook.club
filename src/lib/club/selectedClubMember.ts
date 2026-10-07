export type SelectedClubMember = {
  memberId: string;
  name: string;
  surname: string;
  username?: string;
  image?: string | null;
  dateOfBirth?: string | null;
};

const storageKey = (clubId: string) => `clubSelectedMember:${clubId}`;

export function readSelectedClubMember(clubId: string | null | undefined): SelectedClubMember | null {
  if (typeof window === 'undefined' || !clubId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(clubId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedClubMember;
    if (!parsed?.memberId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSelectedClubMember(
  clubId: string | null | undefined,
  member: SelectedClubMember | null
): void {
  if (typeof window === 'undefined' || !clubId) return;
  if (!member) {
    sessionStorage.removeItem(storageKey(clubId));
    return;
  }
  sessionStorage.setItem(storageKey(clubId), JSON.stringify(member));
}
