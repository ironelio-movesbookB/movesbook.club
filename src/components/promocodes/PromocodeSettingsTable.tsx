'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PromocodeInviteEntry, PromocodeSettingRow } from '@/lib/promocodes/types';
import PromocodeInviteEmailsModal from './PromocodeInviteEmailsModal';
import PromocodeAssetImage from './PromocodeAssetImage';
import {
  PROMOCODE_NO_FLAG_IMAGE,
  PROMOCODE_NO_PROFILE_IMAGE,
  promocodeFlagImageUrl,
  promocodeProfileImageUrl,
} from './promocodeImageUrls';

export default function PromocodeSettingsTable({
  rows,
  selectedIds,
  highlightedId,
  onToggle,
  onToggleAll,
  onHighlight,
  onRowDoubleClick,
  showSelectAll = true,
}: {
  rows: PromocodeSettingRow[];
  selectedIds: number[];
  highlightedId?: number | null;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  onHighlight?: (id: number) => void;
  onRowDoubleClick?: (id: number) => void;
  showSelectAll?: boolean;
}) {
  const [inviteEmailsOpen, setInviteEmailsOpen] = useState(false);
  const [inviteEmailEntries, setInviteEmailEntries] = useState<PromocodeInviteEntry[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  return (
    <div className="overflow-x-auto border border-gray-300 bg-white gub_row mt-10">
      {showSelectAll && (
        <div className="all_select p-2 border-b bg-gray-50">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
            Select all
          </label>
        </div>
      )}
      <table className="w-full text-sm border-collapse promo-table">
        <thead>
          <tr className="bg-[#3d3d3d] text-white text-left">
            <th className="p-2 w-8" />
            <th className="p-2">Promocode</th>
            <th className="p-2">Flag</th>
            <th className="p-2">Photo</th>
            <th className="p-2">Creator</th>
            <th className="p-2">Version</th>
            <th className="p-2">Usage</th>
            <th className="p-2">Invites sent</th>
            <th className="p-2">Last invite</th>
            <th className="p-2">Last registration</th>
            <th className="p-2">Exp name</th>
            <th className="p-2">Created</th>
            <th className="p-2">Status</th>
            <th className="p-2">Enable</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={15} className="p-6 text-center text-gray-500">
                No promocodes found.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const flagCountryCode = row.inviteCountryCode ?? row.creatorCountryCode;
            const flagSrc = promocodeFlagImageUrl(row.inviteFlagImage ?? row.creatorFlagImage, {
              countryCode: flagCountryCode,
            });
            const photoSrc = promocodeProfileImageUrl(row.creator?.image);
            const created = row.created ? row.created.slice(0, 10) : '';
            const status = row.validTo && row.validTo < today ? 'Expire' : 'Current';

            return (
              <tr
                key={row.id}
                data-promo={row.id}
                className={`border-t border-gray-200 hover:bg-gray-50 ${
                  highlightedId === row.id ? 'highlighted' : ''
                }`}
                onClick={() => onHighlight?.(row.id)}
                onDoubleClick={() => onRowDoubleClick?.(row.id)}
              >
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => onToggle(row.id)}
                  />
                </td>
                <td className="p-2 font-medium">
                  <Link href={`/promocodes/promoDetail/${row.id}`} className="text-[#7b0a26] hover:underline">
                    {row.code}
                  </Link>
                </td>
                <td className="p-2">
                  <PromocodeAssetImage
                    src={flagSrc}
                    fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                    countryCode={flagCountryCode}
                    className="h-6"
                  />
                </td>
                <td className="p-2">
                  <PromocodeAssetImage
                    src={photoSrc}
                    fallbackSrc={PROMOCODE_NO_PROFILE_IMAGE}
                    className="w-10 h-10 object-cover rounded"
                  />
                </td>
                <td className="p-2">
                  {row.creator?.username}
                  <br />
                  <span className="text-xs text-gray-500">{row.creatorCountryCode}</span>
                </td>
                <td className="p-2 text-center">{row.versionCount}</td>
                <td className="p-2">{row.usableBy}</td>
                <td className="p-2">
                  <button
                    type="button"
                    className="text-blue-700 underline"
                    title={(row.inviteEntries ?? []).map((entry) => entry.email).join(', ')}
                    onClick={(e) => {
                      e.stopPropagation();
                      const entries =
                        row.inviteEntries ??
                        (row.inviteEmails ?? []).map((email) => ({
                          email,
                          username: null,
                          registered: false,
                          inviteDate: null,
                          registrationDate: null,
                          subscriptionName: null,
                        }));
                      setInviteEmailEntries(entries);
                      setInviteEmailsOpen(true);
                    }}
                  >
                    {row.inviteCount}
                  </button>
                </td>
                <td className="p-2">{row.lastInviteDate?.slice(0, 10) ?? ''}</td>
                <td className="p-2">{row.lastRegistrationDate?.slice(0, 10) ?? ''}</td>
                <td className="p-2">{row.recipient}</td>
                <td className="p-2">{created}</td>
                <td className="p-2">{status}</td>
                <td className="p-2">{row.enable}</td>
                <td className="p-2">
                  <Link
                    href={`/promocodes/edit/${row.id}`}
                    target="_blank"
                    className="text-[#7b0a26] hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PromocodeInviteEmailsModal
        open={inviteEmailsOpen}
        entries={inviteEmailEntries}
        onClose={() => setInviteEmailsOpen(false)}
      />
    </div>
  );
}
