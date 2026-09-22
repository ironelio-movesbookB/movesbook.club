'use client';

import Image from 'next/image';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Pencil, Trash2, User } from 'lucide-react';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column, Member } from '@/types/clubTable';

type Props = {
  clubId?: string | null;
  teamId?: string | null;
};

function formatDisplayDate(value: unknown) {
  if (!value) return '-';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    }
  }
  return raw;
}

/**
 * Archive browse of all parents/tutors linked on athlete member profiles.
 * Same archive shell as athletes/members (filter + teal table).
 */
export default function AthletesParentsArchive({ clubId, teamId }: Props) {
  const router = useRouter();
  const isTeam = Boolean(teamId);

  const openLinkedMember = useCallback(
    (row: Member, mode: 'view' | 'edit') => {
      const id = row.memberId || '';
      if (!id) return;
      const q = new URLSearchParams();
      if (teamId) q.set('teamId', teamId);
      else if (clubId) q.set('clubId', clubId);
      q.set('mode', mode);
      router.push(`/clubMembers/memberProfile/${encodeURIComponent(id)}?${q.toString()}`);
    },
    [clubId, router, teamId],
  );

  const columns: Column[] = useMemo(
    () => [
      {
        key: 'image',
        header: 'Image',
        render: (value) =>
          value ? (
            <Image
              src={String(value)}
              alt=""
              className="mx-auto h-10 w-10 rounded-full object-cover"
              width={40}
              height={40}
              unoptimized
            />
          ) : (
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
              —
            </span>
          ),
      },
      { key: 'surname', header: 'Surname' },
      { key: 'name', header: 'Name' },
      { key: 'gender', header: 'Gender' },
      { key: 'kinship', header: 'Degree of kinship' },
      {
        key: 'member',
        header: 'Member',
        render: (value, row) => String(value || row.memberLabel || '-'),
      },
      {
        key: 'localCity',
        header: 'Local City',
        render: (value, row) => String(value || row.Localcity || '-'),
      },
      { key: 'phone', header: 'Phone' },
      {
        key: 'insertDate',
        header: 'Insert Date',
        render: (_value, row) =>
          String(row.insertDateDisplay || formatDisplayDate(row.insertDate) || '-'),
      },
      {
        key: 'options',
        header: 'Options',
        render: (_value, row) => (
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <button
              type="button"
              title="Open linked member profile"
              onClick={() => openLinkedMember(row, 'view')}
              className="rounded p-1 hover:bg-blue-50 hover:text-blue-600"
            >
              <User className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Edit linked member profile"
              onClick={() => openLinkedMember(row, 'edit')}
              className="rounded p-1 hover:bg-teal-50 hover:text-teal-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Schedule (coming soon)"
              disabled
              className="rounded p-1 opacity-40"
            >
              <CalendarClock className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Delete parent link (edit member profile)"
              disabled
              className="rounded p-1 opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [openLinkedMember],
  );

  return (
    <ClubArchivePage
      title="Archive — Parents & Tutors"
      archiveType="parents"
      columns={columns}
      selectable
      clubId={isTeam ? null : clubId}
      teamId={teamId}
      emptyMessage={
        isTeam
          ? 'No parents/tutors found for this team yet. Parent slots will appear here once team member dossiers store them.'
          : 'No parents/tutors found. Add them on underage member profiles (Parents tab).'
      }
      footerHint={
        isTeam
          ? 'Parents/tutors linked on athlete profiles for this team.'
          : 'All parents/tutors linked on athlete member profiles for this club.'
      }
    />
  );
}
