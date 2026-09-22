'use client';

import type { ReactNode } from 'react';
import type { TeamContacts } from '@/lib/team/teamProfileTypes';

const INPUT_CLASS =
  'w-full min-w-0 px-3 py-1.5 border border-gray-400 rounded bg-white text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500';

const CLUB_INFO_FIELDS: { key: keyof TeamContacts; label: string; type?: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'pec', label: 'PEC\\Registered mail' },
  { key: 'phone1', label: 'Phone 1' },
  { key: 'phone2', label: 'Phone 2' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'Whatsapp' },
  { key: 'telegram', label: 'Telegram' },
];

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] border-b border-gray-200 last:border-b-0">
      <div className="bg-gray-50/80 px-4 py-3 sm:flex sm:items-start sm:justify-end">
        <span className="text-sm font-bold text-gray-800 sm:text-right">{label}</span>
      </div>
      <div className="px-4 py-3 min-w-0">{children}</div>
    </div>
  );
}

type Props = {
  value: TeamContacts;
  onChange: (next: TeamContacts) => void;
  disabled?: boolean;
  title?: string;
};

export default function ClubInfoContactsFields({
  value,
  onChange,
  disabled,
  title = 'Club Info',
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 shadow-sm">
      <div className="border-b border-gray-300 bg-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className="bg-white">
        {CLUB_INFO_FIELDS.map(({ key, label, type }) => (
          <FormRow key={key} label={label}>
            <input
              type={type || 'text'}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              disabled={disabled}
              className={INPUT_CLASS}
            />
          </FormRow>
        ))}
      </div>
    </div>
  );
}
