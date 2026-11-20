'use client';

import { useEffect, useRef, useState } from 'react';
import ClubArchivePage from '@/components/club/archives/ClubArchivePage';
import MemberProfileSettingsTab from '@/components/club/memberProfile/MemberProfileSettingsTab';
import {
  MEMBER_OVERVIEW_ADMIN_DEFAULT_LABEL,
  MEMBER_OVERVIEW_MNGMNT_LINKS,
} from '@/lib/club/clubAdminMenus';
import type { ArchiveType } from '@/lib/club/archives/clubArchiveClient';
import type { MemberProfileBundle } from '@/lib/club/memberProfileTypes';
import { fetchPurchases } from '@/lib/club/serviceSaleClient';
import {
  formatDate,
  formatEuro,
  getAuthHeaders,
  withSelectedClubId,
} from '@/lib/club/servicePurchasesClient';
import type { Column } from '@/types/clubTable';

type MgmtSelection =
  | { kind: 'archive'; label: string; archiveType: ArchiveType }
  | { kind: 'services'; label: string };

const ADMIN_ARCHIVE_COLUMNS: Column[] = [
  { key: 'name', header: 'Full Name' },
  { key: 'typology', header: 'Typology' },
  { key: 'service', header: 'Detail' },
  { key: 'insertDate', header: 'Date', render: (value) => formatDate(value) },
  { key: 'expirationDate', header: 'Expiration Date', render: (value) => formatDate(value) },
  { key: 'value', header: 'Cost', render: (value) => formatEuro(value) },
  { key: 'paid', header: 'Paid', render: (value) => formatEuro(value) },
  { key: 'rest', header: 'Rest', render: (value) => formatEuro(value) },
  { key: 'dateEnd', header: 'Last payment', render: (value) => formatDate(value) },
  { key: 'casual', header: 'Notes' },
  { key: 'edit', header: 'Edit', sortable: false },
  { key: 'delete', header: 'Delete', sortable: false },
];

function defaultSelection(): MgmtSelection {
  const link =
    MEMBER_OVERVIEW_MNGMNT_LINKS.find((item) => item.label === MEMBER_OVERVIEW_ADMIN_DEFAULT_LABEL) ||
    MEMBER_OVERVIEW_MNGMNT_LINKS[0];
  if (!link) return { kind: 'archive', label: 'Subscriptions', archiveType: 'subscriptions' };
  if (link.services) return { kind: 'services', label: link.label };
  return {
    kind: 'archive',
    label: link.label,
    archiveType: link.archiveType || 'subscriptions',
  };
}

type Props = {
  data: MemberProfileBundle;
  onChange: (next: MemberProfileBundle) => void;
  onReload: () => void;
  readOnly?: boolean;
};

/**
 * Club Admin → Administration: archive buttons (Subscriptions default),
 * compact filters + 5-row scroll grid, then Current subscription form.
 */
export default function MemberAdministrationPanel({
  data,
  onChange,
  onReload,
  readOnly = false,
}: Props) {
  const [mgmt, setMgmt] = useState<MgmtSelection>(() => defaultSelection());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const club = data.club;
  const setClub = (next: typeof club | ((prev: typeof club) => typeof club)) => {
    onChange({
      ...data,
      club: typeof next === 'function' ? next(club) : next,
    });
  };

  const clubRef = useRef(club);
  clubRef.current = club;

  const saveClubSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const path = withSelectedClubId(
        `/api/clubs/${encodeURIComponent(data.clubId)}/members/${encodeURIComponent(data.memberId)}/profile`,
      );
      const res = await fetch(path, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ club: clubRef.current }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Save failed');
      }
      setMessage('Saved.');
      onReload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap gap-1 bg-gray-100 px-1 py-2">
        {MEMBER_OVERVIEW_MNGMNT_LINKS.map((link) => {
          const active =
            mgmt.label === link.label &&
            (link.services ? mgmt.kind === 'services' : mgmt.kind === 'archive');
          return (
            <button
              key={link.label}
              type="button"
              onClick={() => {
                if (link.services) {
                  setMgmt({ kind: 'services', label: link.label });
                  return;
                }
                if (link.archiveType) {
                  setMgmt({
                    kind: 'archive',
                    label: link.label,
                    archiveType: link.archiveType,
                  });
                }
              }}
              className={`min-w-[88px] px-3 py-2 text-sm font-medium text-white ${
                active ? 'bg-gray-700' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {mgmt.kind === 'archive' ? (
        <div className="border-t border-gray-200 bg-white p-3">
          <ClubArchivePage
            key={mgmt.archiveType}
            title={mgmt.label}
            archiveType={mgmt.archiveType}
            clubId={data.clubId}
            memberId={data.memberId}
            columns={ADMIN_ARCHIVE_COLUMNS}
            pageSize={5}
            maxVisibleRows={5}
            showFilters
            compactFilters
            footerHint={`${mgmt.label} of this member.`}
          />
        </div>
      ) : null}

      {mgmt.kind === 'services' ? <MemberServicesGrid memberId={data.memberId} /> : null}

      <div className="border-t border-gray-200 bg-white p-4">
        <MemberProfileSettingsTab
          clubId={data.clubId}
          memberUserId={data.memberId}
          entitySportDefault={data.entitySportDefault || 'Football'}
          workspaceKind={data.workspaceKind === 'team' ? 'team' : 'club'}
          ownerAdministrative={data.owner?.administrative}
          club={club}
          setClub={setClub}
          readOnlyClub={readOnly || !data.viewer.canEditClubScoped}
          showVisibility={data.viewer.isClubAdmin}
          canEditPaymentDefaults={data.viewer.isClubAdmin}
          saving={saving}
          message={message}
          onSave={() => void saveClubSettings()}
          variant="subscription"
          memberLanguage={data.owner?.otherReferences?.language}
        />
      </div>
    </div>
  );
}

function MemberServicesGrid({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; detail: string; date: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchPurchases({ memberId, page: 1, pageSize: 20 })
      .then((result) => {
        if (cancelled) return;
        setRows(
          result.items.map((item) => ({
            id: item.id,
            name: item.memberName || '—',
            detail: item.serviceName || item.notes || '—',
            date: item.recordDate || '—',
          })),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load services');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">Services</h3>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No records.</p>
      ) : null}
      {rows.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-teal-800 text-white">
            <tr className="text-left">
              <th className="px-3 py-2">Full name</th>
              <th className="px-3 py-2">Detail</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.detail}</td>
                <td className="px-3 py-2">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
