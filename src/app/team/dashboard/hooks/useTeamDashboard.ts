import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPathForUserType, isTeamAccountUserType } from '@/utils/dashboardRouting';
import { filterFormCreatedEntities } from '@/hooks/useManagedEntityCreation';
import { isEntityWorkspaceSession } from '@/lib/entity/entityDirectAccessSession';

export function useTeamDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-page' | 'my-entity'>('my-page');

  const loadTeams = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/teams/my-teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedTeam');
      if (saved) setSelectedTeamId(saved);
    }
  }, []);

  useEffect(() => {
    if (user && !isTeamAccountUserType(user.userType)) {
      router.replace(getDashboardPathForUserType(user.userType));
    }
  }, [user, router]);

  useEffect(() => {
    if (user && isTeamAccountUserType(user.userType)) {
      void loadTeams();
    }
  }, [user, loadTeams]);

  const formCreatedTeams = filterFormCreatedEntities(teams);
  const hasFormTeam = formCreatedTeams.length > 0;

  useEffect(() => {
    if (isEntityWorkspaceSession('team')) return;
    if (!hasFormTeam && activeTab === 'my-entity') {
      setActiveTab('my-page');
    }
  }, [hasFormTeam, activeTab]);

  const handleTeamSelect = (teamId: string) => {
    localStorage.setItem('selectedTeam', teamId);
    setSelectedTeamId(teamId);
    setActiveTab('my-entity');
  };

  return {
    user,
    loading,
    teams,
    formCreatedTeams,
    hasFormTeam,
    selectedTeamId,
    setSelectedTeamId,
    activeTab,
    setActiveTab,
    loadTeams,
    handleTeamSelect,
  };
}
