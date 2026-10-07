'use client';

import type { ReactNode } from 'react';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import type { ClubCoachInput } from '@/lib/club/clubCoach.constants';

type Props = {
  value: ClubCoachInput;
  onChange: (patch: Partial<ClubCoachInput>) => void;
  disabled?: boolean;
};

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-gray-100';

function Field({ label, required, children, className = '' }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-gray-600 ${className}`}>
      {label}
      {required ? ' *' : ''}
      {children}
    </label>
  );
}

export default function CoachFields({ value, onChange, disabled }: Props) {
  const text = (key: keyof ClubCoachInput, opts: { type?: string; placeholder?: string; maxLength?: number } = {}) => (
    <input
      type={opts.type ?? 'text'}
      value={value[key]}
      placeholder={opts.placeholder}
      maxLength={opts.maxLength}
      disabled={disabled}
      onChange={(e) => onChange({ [key]: e.target.value })}
      className={inputClass}
    />
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Surname" required>{text('surname', { maxLength: 120 })}</Field>
        <Field label="Name" required>{text('firstName', { maxLength: 120 })}</Field>
        <Field label="Tax code" required>{text('taxCode', { maxLength: 40 })}</Field>
        <Field label="Email">{text('email', { type: 'email', maxLength: 191 })}</Field>
        <Field label="Phone">{text('phone', { type: 'tel', maxLength: 60 })}</Field>
        <Field label="Date of birth" required>{text('birthDate', { type: 'date' })}</Field>
        <Field label="Membership number" className="md:col-span-2">{text('membershipNumber', { maxLength: 80 })}</Field>
        <Field label="IBAN" className="md:col-span-2">{text('iban', { maxLength: 60 })}</Field>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900">Residence address</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Address (Street, Avenue, Square)" className="md:col-span-4">{text('address', { maxLength: 255 })}</Field>
          <Field label="City" className="md:col-span-2">{text('city', { maxLength: 120 })}</Field>
          <Field label="Province">{text('province', { maxLength: 60 })}</Field>
          <Field label="ZIP code">{text('zip', { maxLength: 20 })}</Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900">Place of birth</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Country">
            <select
              value={value.birthCountry}
              disabled={disabled}
              onChange={(e) => onChange({ birthCountry: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {ALL_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">{text('birthCity', { maxLength: 120 })}</Field>
          <Field label="Province">{text('birthProvince', { maxLength: 60 })}</Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900">Notes</h3>
        <textarea
          value={value.notes}
          disabled={disabled}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          maxLength={5000}
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function validateCoachInput(value: ClubCoachInput): string | null {
  if (!value.surname.trim()) return 'Surname is required';
  if (!value.firstName.trim()) return 'Name is required';
  if (!value.taxCode.trim()) return 'Tax code is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.birthDate)) return 'Date of birth is required';
  if (value.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) return 'Email is not valid';
  return null;
}
