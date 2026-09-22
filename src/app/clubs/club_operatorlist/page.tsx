'use client';
import Image from 'next/image';

import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import type { Column } from '@/types/clubTable';

const columns: Column[] = [
  {
    key: 'image',
    header: 'Photo',
    render: (value) =>
      value ? (
        <Image
          src={String(value)}
          alt=""
          width={40}
          height={40}
          className="mx-auto h-10 w-10 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <span>-</span>
      ),
  },
  { key: 'name', header: 'Operator name' },
  { key: 'operator', header: 'Nickname\\username' },
  { key: 'typology', header: 'Staff type (Typology)' },
  { key: 'employmentArea', header: 'Employment area' },
  { key: 'operativeLevel', header: 'Operative level' },
];

export default function ClubOperatorListPage() {
  return (
    <div className="p-4">
      <ClubArchivePage
        title="Archive — Operators"
        archiveType="operators"
        columns={columns}
        footerHint="Staff operators from club staff / club_operators (Instructor, Personal Trainer, …)."
      />
    </div>
  );
}
