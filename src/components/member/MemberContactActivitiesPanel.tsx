'use client';

import MemberSelfProfilePanel from '@/components/profile/MemberSelfProfilePanel';

type ClubOption = { id: string; name: string };

type Props = {
  userId: string;
  clubs: ClubOption[];
  onClose?: () => void;
};

/**
 * My Page → Member info → Contact info & activities.
 * Same Contacts + My Activities UI as under Member info / User Profile.
 */
export default function MemberContactActivitiesPanel({ userId, clubs, onClose }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
      <MemberSelfProfilePanel
        userId={userId}
        clubs={clubs}
        initialTab="contacts"
        onlyTabs={['contacts', 'activities']}
        title="Contact info & activities"
        description="Edit your Contacts and My Activities here — the same shared sections as under Member info and User Profile."
        onClose={onClose}
      />
    </div>
  );
}
