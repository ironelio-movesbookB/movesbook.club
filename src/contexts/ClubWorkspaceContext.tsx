'use client';

import { createContext, useContext } from 'react';
import type { ClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';
import type { SelectedClubMember } from '@/lib/club/selectedClubMember';
import type { SharingNotificationsScope } from '@/components/sharing/SharingNotifications';

/** My Page → My News sub-panels (stay on My Page; do not open My Club). */
export type ClubMyPageNewsPanel = 'movesbook-news' | 'mb-news' | 'ogp-news' | null;

type ClubWorkspaceContextValue = {
  activeTab: ClubWorkspaceTab;
  selectedClubId: string | null;
  myPageNewsPanel: ClubMyPageNewsPanel;
  setMyPageNewsPanel: (panel: ClubMyPageNewsPanel) => void;
  selectedMember: SelectedClubMember | null;
  setSelectedMember: (member: SelectedClubMember | null) => void;
  /** Sharing notifications of the open page (My Page or the selected company). */
  sharingScope: SharingNotificationsScope;
};

export const ClubWorkspaceContext = createContext<ClubWorkspaceContextValue>({
  activeTab: 'my-page',
  selectedClubId: null,
  myPageNewsPanel: null,
  setMyPageNewsPanel: () => {},
  selectedMember: null,
  setSelectedMember: () => {},
  sharingScope: { type: 'mypage' },
});

export function useClubWorkspace() {
  return useContext(ClubWorkspaceContext);
}
