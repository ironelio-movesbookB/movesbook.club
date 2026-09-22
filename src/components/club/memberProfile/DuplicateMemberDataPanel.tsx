'use client';

import { useMemo, useState } from 'react';
import { SectionCard, Field, TextSelect, CheckRow } from '@/components/club/memberProfile/FormBits';
import type { DuplicateMemberSection } from '@/lib/club/memberProfileTypes';
import { getAuthHeaders, withSelectedClubId } from '@/lib/club/servicePurchasesClient';

type MemberOption = { id: string; label: string };

type Props = {
  workspaceId: string;
  isTeamWorkspace: boolean;
  currentMemberId: string;
  members: MemberOption[];
  disabled?: boolean;
  onDuplicated?: () => void;
};

export default function DuplicateMemberDataPanel({
  workspaceId,
  isTeamWorkspace,
  currentMemberId,
  members,
  disabled = false,
  onDuplicated,
}: Props) {
  const otherDataLabel = 'Other data';

  const sectionOptions = useMemo(
    () =>
      (
        [
          { id: 'member-profile' as const, label: 'Member profile' },
          { id: 'parents' as const, label: 'Parents' },
          { id: 'other-data' as const, label: otherDataLabel },
          { id: 'settings' as const, label: 'Settings' },
          {
            id: 'alert-posted' as const,
            label: 'Alert posted',
            clubOnly: true,
          },
          {
            id: 'coach-notes' as const,
            label: 'Coach notes',
            hint: 'not replies and comments',
            clubOnly: true,
          },
        ] as const
      ).filter((s) => !('clubOnly' in s && s.clubOnly) || !isTeamWorkspace),
    [isTeamWorkspace, otherDataLabel],
  );

  const [sourceMemberId, setSourceMemberId] = useState('');
  const [sections, setSections] = useState<Record<DuplicateMemberSection, boolean>>({
    'member-profile': false,
    parents: false,
    'other-data': false,
    settings: false,
    'alert-posted': false,
    'coach-notes': false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const options = useMemo(
    () => members.filter((m) => m.id !== currentMemberId),
    [members, currentMemberId],
  );

  const selectedCount = sectionOptions.filter((s) => sections[s.id]).length;
  const canConfirm = Boolean(sourceMemberId) && selectedCount > 0 && !disabled && !busy;

  const toggleSection = (id: DuplicateMemberSection, checked: boolean) => {
    setSections((prev) => ({ ...prev, [id]: checked }));
    setMessage('');
  };

  const resetForm = () => {
    setSourceMemberId('');
    setSections({
      'member-profile': false,
      parents: false,
      'other-data': false,
      settings: false,
      'alert-posted': false,
      'coach-notes': false,
    });
  };

  const handleNo = () => {
    resetForm();
    setMessage('Duplication cancelled.');
  };

  const handleYes = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setMessage('');
    try {
      const path = `/api/clubs/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(currentMemberId)}/profile/duplicate`;
      const url = isTeamWorkspace
        ? `${path}?teamId=${encodeURIComponent(workspaceId)}`
        : withSelectedClubId(path);
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMemberId,
          sections: sectionOptions.filter((s) => sections[s.id]).map((s) => s.id),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Duplication failed');
      }
      const copied = Array.isArray(json.copied) ? json.copied.length : selectedCount;
      setMessage(`Copied ${copied} section(s) from the selected user.`);
      resetForm();
      onDuplicated?.();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Duplication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Duplicate existing user data">
      <Field label="Do you want to duplicate the data of an existing user?">
        <TextSelect
          disabled={disabled || busy}
          value={sourceMemberId}
          onChange={(e) => {
            setSourceMemberId(e.target.value);
            setMessage('');
          }}
        >
          <option value="">— Select user —</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </TextSelect>
      </Field>

      <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
        <p className="text-sm font-semibold text-gray-800">
          If you chose to duplicate the data of another user you can check among these sections
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sectionOptions.map((s) => (
            <div key={s.id}>
              <CheckRow
                label={s.label}
                disabled={disabled || busy || !sourceMemberId}
                checked={sections[s.id]}
                onChange={(v) => toggleSection(s.id, v)}
              />
              {'hint' in s && s.hint ? (
                <p className="ml-6 text-[11px] text-gray-500">({s.hint})</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm font-semibold text-gray-800">Confirm</span>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void handleYes()}
            className="min-w-[2.5rem] rounded bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? '…' : 'Y'}
          </button>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={handleNo}
            className="min-w-[2.5rem] rounded bg-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
          >
            N
          </button>
        </div>
      </div>

      {message ? <p className="mt-2 text-sm text-gray-700">{message}</p> : null}
    </SectionCard>
  );
}
