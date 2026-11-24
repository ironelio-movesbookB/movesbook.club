'use client';

import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import { formatArchiveDate, statusBadgeColumn } from '@/components/club/archives/archiveColumns';
import type { Column } from '@/types/clubTable';

const columns: Column[] = [
  { key: 'name', header: 'Event' },
  { key: 'typology', header: 'Type' },
  { key: 'insertDate', header: 'Date', render: (v) => formatArchiveDate(v) },
  { key: 'casual', header: 'Description' },
  statusBadgeColumn(),
];

export default function EventsArchivePage() {
  return (
    <div className="p-4">
      <ClubArchivePage
        title="Archive — Events"
        archiveType="events"
        columns={columns}
        footerHint="Club events from legacy events table."
      />
    </div>
  );
}
