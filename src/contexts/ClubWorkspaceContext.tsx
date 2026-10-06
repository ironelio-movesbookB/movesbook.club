'use client';

import { createContext, useContext } from 'react';
import type { ClubWorkspaceTab } from '@/lib/club/clubWorkspaceTab';
import type { SelectedClubMember } from '@/lib/club/selectedClubMember';

/** My Page → My News sub-panels (stay on My Page; do not open My Club). */
export type ClubMyPageNewsPanel = 'movesbook-news' | 'mb-news' | 'ogp-news' | null;

type ClubWorkspaceContextValue = {
  activeTab: ClubWorkspaceTab;
  selectedClubId: string | null;
  myPageNewsPanel: ClubMyPageNewsPanel;
  setMyPageNewsPanel: (panel: ClubMyPageNewsPanel) => void;
  selectedMember: SelectedClubMember | null;
  setSelectedMember: (member: SelectedClubMember | null) => void;
};

export const ClubWorkspaceContext = createContext<ClubWorkspaceContextValue>({
  activeTab: 'my-page',
  selectedClubId: null,
  myPageNewsPanel: null,
  setMyPageNewsPanel: () => {},
  selectedMember: null,
  setSelectedMember: () => {},
});

export function useClubWorkspace() {
  return useContext(ClubWorkspaceContext);
}
