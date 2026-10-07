'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import { ALL_COUNTRIES } from '@/constants/countries.constants';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import AutoTranslate from '@/components/i18n/AutoTranslate';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSportText, translateSportLabel } from '@/lib/sport/sportI18n';
import {
  REMUNERATION_KINDS,
  REMUNERATION_PAYMENT_TYPES,
  STAFF_COMPANY_ROLES,
  formatEuro,
  formatYmd,
  remunerationTotals,
  type RemunerationKind,
  type StaffDetails,
  type StaffGroupLink,
  type StaffGroupOption,
  type StaffRemuneration,
} from '@/lib/club/clubStaffAdmin.constants';

const inputClass =
  'mb-0 mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';
const checkboxClass = 'h-4 w-4 rounded border-gray-400';

/** Enter inside these inputs must not submit the surrounding profile form. */
const stopEnter = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') e.preventDefault();
};

function Field({ label, required, children, className = '' }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className}`}>
      {label}
      {required ? <span> *</span> : null}
      {children}
    </label>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="md:col-span-2">
      <h3 className="mb-2 border border-[#c9bd7a] bg-[#efe7b3] px-4 py-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-4 border border-gray-200 bg-white p-4">{children}</div>
    </section>
  );
}

type DetailsProps = {
  value: StaffDetails;
  onChange: (patch: Partial<StaffDetails>) => void;
  disabled?: boolean;
};

/** Personal data that the staff account did not have yet (tax code, IBAN, residence, place of birth, notes). */
export function StaffPersonalFields({
  value,
  onChange,
  phone,
  onPhoneChange,
  disabled,
}: DetailsProps & { phone: string; onPhoneChange: (phone: string) => void }) {
  const text = (key: keyof StaffDetails, maxLength: number) => (
    <input
      type="text"
      value={String(value[key])}
      maxLength={maxLength}
      disabled={disabled}
      onKeyDown={stopEnter}
      onChange={(e) => onChange({ [key]: e.target.value } as Partial<StaffDetails>)}
      className={inputClass}
    />
  );
  return (
    <>
      <Field label="Tax code" required>
        {text('taxCode', 40)}
      </Field>
      <Field label="Phone">
        <input
          type="tel"
          value={phone}
          maxLength={60}
          disabled={disabled}
          onKeyDown={stopEnter}
          onChange={(e) => onPhoneChange(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="IBAN" className="md:col-span-2">
        {text('iban', 60)}
      </Field>
      <div className="md:col-span-2">
        <h3 className="text-sm font-bold text-gray-900">Residence address</h3>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Address (Street, Avenue, Square)" className="md:col-span-4">
            {text('address', 255)}
          </Field>
          <Field label="City" className="md:col-span-2">
            {text('city', 120)}
          </Field>
          <Field label="Province">{text('province', 60)}</Field>
          <Field label="ZIP code">{text('zip', 20)}</Field>
        </div>
      </div>
      <div className="md:col-span-2">
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
          <Field label="City">{text('birthCity', 120)}</Field>
          <Field label="Province">{text('birthProvince', 60)}</Field>
        </div>
      </div>
      <Field label="Notes" className="md:col-span-2">
        <textarea
          value={value.notes}
          maxLength={5000}
          rows={4}
          disabled={disabled}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={inputClass}
        />
      </Field>
    </>
  );
}

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      disabled={disabled}
      onKeyDown={stopEnter}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

export function StaffCertificationsFields({ value, onChange, disabled }: DetailsProps) {
  return (
    <SectionCard title="Certifications">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="BLSD certificate expiry">
          <DateInput value={value.blsdExpiry} disabled={disabled} onChange={(blsdExpiry) => onChange({ blsdExpiry })} />
        </Field>
        <Field label="Fire safety certificate expiry">
          <DateInput
            value={value.fireSafetyExpiry}
            disabled={disabled}
            onChange={(fireSafetyExpiry) => onChange({ fireSafetyExpiry })}
          />
        </Field>
        <Field label="First aid certificate expiry">
          <DateInput
            value={value.firstAidExpiry}
            disabled={disabled}
            onChange={(firstAidExpiry) => onChange({ firstAidExpiry })}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function Check({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={checkboxClass}
      />
      {children}
    </label>
  );
}

/** Company role, board member, activity dates, volunteer and member number with the progressive counter. */
export function StaffCompanyRoleFields({ value, onChange, disabled }: DetailsProps) {
  const [counterBusy, setCounterBusy] = useState(false);
  const [counterError, setCounterError] = useState('');

  const fillNextNumber = async () => {
    setCounterBusy(true);
    setCounterError('');
    try {
      const { next } = await clubApiFetch<{ next: number }>('/api/club/staff/member-number');
      onChange({ memberNumber: String(next) });
    } catch (e) {
      setCounterError(e instanceof Error ? e.message : 'Failed to load the next member number');
    } finally {
      setCounterBusy(false);
    }
  };

  return (
    <SectionCard title="Company role">
      <Field label="Role">
        <select
          value={value.companyRole}
          disabled={disabled}
          onChange={(e) => onChange({ companyRole: e.target.value })}
          className={inputClass}
        >
          <option value="">No role</option>
          {STAFF_COMPANY_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </Field>
      <Check checked={value.boardMember} disabled={disabled} onChange={(boardMember) => onChange({ boardMember })}>
        Board member
      </Check>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Start of activity">
          <DateInput
            value={value.activityStart}
            disabled={disabled}
            onChange={(activityStart) => onChange({ activityStart })}
          />
        </Field>
        <Field label="End of activity">
          <DateInput value={value.activityEnd} disabled={disabled} onChange={(activityEnd) => onChange({ activityEnd })} />
        </Field>
      </div>
      <Check checked={value.volunteer} disabled={disabled} onChange={(volunteer) => onChange({ volunteer })}>
        Volunteer
      </Check>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Check checked={value.isMember} disabled={disabled} onChange={(isMember) => onChange({ isMember })}>
          <span className="font-semibold uppercase">Set as member</span>
        </Check>
        {value.isMember ? (
          <div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">
                Member no.<span> *</span>
              </span>
              <button
                type="button"
                disabled={disabled || counterBusy}
                onClick={() => void fillNextNumber()}
                className="text-xs font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-50"
              >
                + Add no. automatically
              </button>
            </div>
            <input
              type="text"
              value={value.memberNumber}
              maxLength={40}
              disabled={disabled}
              onKeyDown={stopEnter}
              onChange={(e) => onChange({ memberNumber: e.target.value })}
              className={inputClass}
            />
            <div className="mt-2">
              <Check
                checked={value.storeMemberNumber}
                disabled={disabled}
                onChange={(storeMemberNumber) => onChange({ storeMemberNumber })}
              >
                Store the member no. for the progressive counter
              </Check>
            </div>
            {counterError ? <p className="mt-1 text-xs text-red-600">{counterError}</p> : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/** Groups (Groups of work) linked to the staff member, each with a role. Saved immediately. */
export function StaffGroupRoles({ staffId, disabled }: { staffId?: string; disabled?: boolean }) {
  const [items, setItems] = useState<StaffGroupLink[]>([]);
  const [groups, setGroups] = useState<StaffGroupOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: string; notes: string }>>({});
  const [newGroupId, setNewGroupId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<StaffGroupLink | null>(null);
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!staffId) return;
    try {
      const data = await clubApiFetch<{ items: StaffGroupLink[]; groups: StaffGroupOption[] }>(
        `/api/club/staff/${encodeURIComponent(staffId)}/groups`,
      );
      setItems(data.items);
      setGroups(data.groups);
      setDrafts(Object.fromEntries(data.items.map((i) => [i.id, { role: i.role, notes: i.notes }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const base = staffId ? `/api/club/staff/${encodeURIComponent(staffId)}/groups` : '';
  const available = groups.filter((g) => !items.some((i) => i.groupId === g.id));

  const removeConfirmed = async () => {
    if (!confirmRemove) return;
    const linkId = confirmRemove.id;
    await run(() => clubApiFetch(`${base}/${encodeURIComponent(linkId)}`, { method: 'DELETE' }), 'Group removed.');
    setConfirmRemove(null);
  };

  return (
    <SectionCard title="Groups and associated roles">
      {!staffId ? (
        <p className="text-sm text-gray-500">Save the profile first, then link the staff member to the groups.</p>
      ) : (
        <>
          {items.length > 0 ? (
            <div className="space-y-3">
              <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-3 text-xs font-semibold text-gray-600 md:grid">
                <span>Associated groups</span>
                <span>Roles</span>
                <span>Notes</span>
                <span />
              </div>
              {items.map((item) => {
                const draft = drafts[item.id] ?? { role: item.role, notes: item.notes };
                const setDraft = (patch: Partial<typeof draft>) =>
                  setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, ...patch } }));
                return (
                  <div key={item.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <input type="text" value={item.groupName} readOnly translate="no" className={`${inputClass} bg-gray-50`} />
                    <select
                      value={draft.role}
                      disabled={disabled || busy}
                      onChange={(e) => setDraft({ role: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select role</option>
                      {STAFF_COMPANY_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={draft.notes}
                      maxLength={2000}
                      disabled={disabled || busy}
                      onKeyDown={stopEnter}
                      onChange={(e) => setDraft({ notes: e.target.value })}
                      placeholder="Notes"
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title="Save"
                        aria-label="Save"
                        disabled={disabled || busy}
                        onClick={() =>
                          void run(
                            () =>
                              clubApiFetch(`${base}/${encodeURIComponent(item.id)}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ ...draft, assignedAt: item.assignedAt }),
                              }),
                            'Group saved.',
                          )
                        }
                        className="mt-1 rounded bg-violet-700 px-3 py-2 text-white hover:bg-violet-800 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => setConfirmRemove(item)}
                        className="mt-1 rounded bg-pink-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div>
            <p className="font-semibold text-gray-900">Link the staff member to a group and assign a role.</p>
            {groups.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">There are no groups yet. Create them in Groups of work.</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Field label="Select a group">
                  <select
                    value={newGroupId}
                    disabled={disabled || busy}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {available.map((g) => (
                      <option key={g.id} value={g.id} translate="no">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Select a role">
                  <select
                    value={newRole}
                    disabled={disabled || busy}
                    onChange={(e) => setNewRole(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select role</option>
                    {STAFF_COMPANY_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  disabled={disabled || busy || !newGroupId}
                  onClick={() =>
                    void run(async () => {
                      await clubApiFetch(base, {
                        method: 'POST',
                        body: JSON.stringify({ groupId: newGroupId, role: newRole }),
                      });
                      setNewGroupId('');
                      setNewRole('');
                    }, 'Group added.')
                  }
                  className="rounded-lg border border-transparent bg-violet-700 px-8 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
        </>
      )}
      <PromocodeConfirmModal
        open={confirmRemove !== null}
        title={translateSportLabel(t, 'Remove group')}
        message={
          confirmRemove
            ? formatSportText(t, 'Remove the group {0} from this staff member?', confirmRemove.groupName)
            : ''
        }
        confirmLabel={translateSportLabel(t, 'Remove')}
        cancelLabel={translateSportLabel(t, 'Cancel')}
        destructive
        loading={busy}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => void removeConfirmed()}
      />
    </SectionCard>
  );
}

type RemunerationDraft = {
  id?: string;
  paidOn: string;
  amount: string;
  kind: RemunerationKind;
  paymentType: string;
  notes: string;
};

const emptyDraft = (): RemunerationDraft => ({
  paidOn: new Date().toISOString().slice(0, 10),
  amount: '',
  kind: 'compensation',
  paymentType: 'Cash',
  notes: '',
});

/** Hiring/contract dates (saved with the profile) and the yearly list of remunerations (saved immediately). */
export function StaffContractSection({
  value,
  onChange,
  staffId,
  disabled,
}: DetailsProps & { staffId?: string }) {
  const [items, setItems] = useState<StaffRemuneration[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [draft, setDraft] = useState<RemunerationDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useLanguage();

  const load = useCallback(async () => {
    if (!staffId) return;
    try {
      const data = await clubApiFetch<{ items: StaffRemuneration[] }>(
        `/api/club/staff/${encodeURIComponent(staffId)}/remunerations`,
      );
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load remunerations');
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear(), year]);
    for (const item of items) set.add(Number(item.paidOn.slice(0, 4)));
    return [...set].filter(Boolean).sort((a, b) => b - a);
  }, [items, year]);

  const yearItems = items.filter((item) => item.paidOn.startsWith(String(year)));
  const totals = remunerationTotals(yearItems);
  const base = staffId ? `/api/club/staff/${encodeURIComponent(staffId)}/remunerations` : '';

  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    setModalError('');
    try {
      const body = JSON.stringify({ ...draft, amount: draft.amount });
      if (draft.id) {
        await clubApiFetch(`${base}/${encodeURIComponent(draft.id)}`, { method: 'PATCH', body });
      } else {
        await clubApiFetch(base, { method: 'POST', body });
      }
      setYear(Number(draft.paidOn.slice(0, 4)) || year);
      setDraft(null);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft?.id) return;
    setBusy(true);
    setModalError('');
    try {
      await clubApiFetch(`${base}/${encodeURIComponent(draft.id)}`, { method: 'DELETE' });
      setDraft(null);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  const kindLabel = (kind: RemunerationKind) => REMUNERATION_KINDS.find((k) => k.value === kind)?.label ?? kind;

  return (
    <SectionCard title="Contract and remunerations">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Hiring date">
          <DateInput value={value.hireDate} disabled={disabled} onChange={(hireDate) => onChange({ hireDate })} />
        </Field>
        <Field label="Contract expiry date">
          <DateInput
            value={value.contractExpiry}
            disabled={disabled}
            onChange={(contractExpiry) => onChange({ contractExpiry })}
          />
        </Field>
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-violet-50 p-4 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value.otherSocialSecurity}
          disabled={disabled}
          onChange={(e) => onChange({ otherSocialSecurity: e.target.checked })}
          className={`${checkboxClass} mt-0.5`}
        />
        <span>
          <span className="block font-semibold">Has other social security coverage?</span>
          <span className="block text-gray-600">
            (e.g. employment or pension) - affects the social security percentage of the remuneration
          </span>
        </span>
      </label>

      {!staffId ? (
        <p className="text-sm text-gray-500">Save the profile first, then add the remunerations.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label="Reference year">
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputClass} w-40`}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setModalError('');
                setDraft(emptyDraft());
              }}
              className="rounded bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-200 disabled:opacity-50"
            >
              Add remuneration
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Payment type</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {yearItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">
                      No remunerations in this year.
                    </td>
                  </tr>
                ) : (
                  yearItems.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="py-2 pr-3">{formatYmd(item.paidOn)}</td>
                      <td className="py-2 pr-3">{formatEuro(item.amount)}</td>
                      <td className="py-2 pr-3">{kindLabel(item.kind)}</td>
                      <td className="py-2 pr-3">{item.paymentType}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setModalError('');
                            setDraft({ ...item, amount: String(item.amount) });
                          }}
                          className="rounded bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-200"
                        >
                          Details …
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="mb-3 font-semibold text-gray-900">
              <span>Totals for the year</span> <span translate="no">{year}</span>
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {REMUNERATION_KINDS.map((kind) => (
                <span key={kind.value} className="flex items-center gap-2 rounded bg-gray-50 px-3 py-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      kind.value === 'compensation' ? 'bg-violet-700' : kind.value === 'refund' ? 'bg-sky-500' : 'bg-fuchsia-500'
                    }`}
                  />
                  <span>{kind.label}</span>
                  <strong translate="no">{formatEuro(totals[kind.value])}</strong>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {draft && typeof document !== 'undefined'
        ? createPortal(
            <AutoTranslate>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {draft.id ? 'Remuneration details' : 'Add remuneration'}
                  </h3>
                  <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="text-gray-500 hover:text-gray-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void saveDraft();
                  }}
                  className="space-y-3"
                >
                  <Field label="Date" required>
                    <input
                      type="date"
                      value={draft.paidOn}
                      onChange={(e) => setDraft({ ...draft, paidOn: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Amount (€)" required>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Type" required>
                    <select
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value as RemunerationKind })}
                      className={inputClass}
                    >
                      {REMUNERATION_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payment type" required>
                    <select
                      value={draft.paymentType}
                      onChange={(e) => setDraft({ ...draft, paymentType: e.target.value })}
                      className={inputClass}
                    >
                      {REMUNERATION_PAYMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Notes">
                    <textarea
                      value={draft.notes}
                      rows={3}
                      maxLength={2000}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    {draft.id ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(true)}
                        className="rounded bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded bg-violet-700 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                    >
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            </AutoTranslate>,
            document.body,
          )
        : null}
      {confirmDelete && draft
        ? createPortal(
            <PromocodeConfirmModal
              open
              title={translateSportLabel(t, 'Delete remuneration')}
              message={translateSportLabel(t, 'Delete this remuneration?')}
              confirmLabel={translateSportLabel(t, 'Delete')}
              cancelLabel={translateSportLabel(t, 'Cancel')}
              destructive
              loading={busy}
              zIndexClass="z-[1010]"
              onClose={() => setConfirmDelete(false)}
              onConfirm={() => void deleteDraft()}
            />,
            document.body,
          )
        : null}
    </SectionCard>
  );
}
