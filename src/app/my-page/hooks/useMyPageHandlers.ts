import { useState } from 'react';
import { storeSelectedEntity } from '../utils/myPageUtils';

export function useMyPageHandlers() {
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

  const handleClubSelect = (clubId: string) => {
    setSelectedClub(clubId);
    storeSelectedEntity('Club', clubId);
    window.location.href = `/my-club?clubId=${clubId}`;
  };

  const handleGroupSelect = (groupId: string) => {
    storeSelectedEntity('Group', groupId);
    window.location.href = `/my-group?groupId=${groupId}`;
  };

  const handleTeamSelect = (teamId: string) => {
    storeSelectedEntity('Team', teamId);
    window.location.href = `/my-team?teamId=${teamId}`;
  };

  const handleCoachingGroupSelect = (groupId: string) => {
    storeSelectedEntity('CoachingGroup', groupId);
    window.location.href = `/my-coaching-group?groupId=${groupId}`;
  };

  // Handlers for athletes to view their entities (same pages, different context)
  const handleMyCoachingGroupSelect = (groupId: string) => {
    storeSelectedEntity('CoachingGroup', groupId);
    window.location.href = `/my-coaching-group?groupId=${groupId}`;
  };

  // Athlete membership select — store only (admin /my-team is for team accounts).
  const handleMyTeamSelect = (teamId: string) => {
    storeSelectedEntity('Team', teamId);
  };

  const handleMyClubSelect = (clubId: string) => {
    storeSelectedEntity('Club', clubId);
    window.location.href = `/my-club?clubId=${clubId}`;
  };

  const handleMyGroupSelect = (groupId: string) => {
    storeSelectedEntity('Group', groupId);
    window.location.href = `/my-group?groupId=${groupId}`;
  };

  return {
    selectedClub,
    setSelectedClub,
    handleClubSelect,
    handleGroupSelect,
    handleTeamSelect,
    handleCoachingGroupSelect,
    handleMyCoachingGroupSelect,
    handleMyTeamSelect,
    handleMyClubSelect,
    handleMyGroupSelect
  };
}

