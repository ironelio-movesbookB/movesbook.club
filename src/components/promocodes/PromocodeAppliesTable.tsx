'use client';

import {
  promocodeRecipientLabel,
  promocodeSecondarySenderLabel,
  promocodeSenderEmail,
  promocodeSenderLabel,
} from '@/lib/promocodes/promocodeApplyDisplay';
import { formatPromocodeDisplayDate } from '@/lib/promocodes/formatPromocodeDate';
import PromocodeAssetImage from './PromocodeAssetImage';
import { PromocodePersonMark } from './PromocodePersonMark';
import { PROMOCODE_NO_FLAG_IMAGE, promocodeFlagImageUrl } from './promocodeImageUrls';

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function PromocodesPagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1, 2, 3, 4, 5, 'ellipsis', totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
      >
        Prev
      </button>
      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`e-${idx}`} className="px-2 text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 text-sm border rounded ${
              p === page ? 'bg-[#7b0a26] text-white border-[#7b0a26]' : 'hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
      >
        Next
      </button>
    </div>
  );
}

function recipientLabel(row: import('@/lib/promocodes/types').PromocodeApplyRow): {
  text: string;
  className: string;
} {
  return promocodeRecipientLabel(row);
}

function senderMark(
  row: import('@/lib/promocodes/types').PromocodeApplyRow,
  onClick?: (name: string) => void
) {
  return (
    <PromocodePersonMark
      label={promocodeSenderLabel(row)}
      email={promocodeSenderEmail(row)}
      image={row.sender?.image}
      logoUrl={row.sender?.logoUrl}
      roleId={row.sender?.roleId}
      countryCode={row.senderCountryCode}
      countryName={row.senderCountryName}
      flagImage={row.senderFlagImage}
      registered={Boolean(row.sender)}
      onClick={onClick}
    />
  );
}

function recipientMark(
  row: import('@/lib/promocodes/types').PromocodeApplyRow,
  onClick?: (name: string) => void
) {
  const recipient = promocodeRecipientLabel(row);
  return (
    <PromocodePersonMark
      label={recipient.text}
      email={row.receiver?.email || row.receiverEmail}
      image={row.receiver?.image}
      logoUrl={row.receiver?.logoUrl}
      roleId={row.receiver?.roleId}
      countryCode={row.receiverCountryCode}
      countryName={row.receiverCountryName}
      flagImage={row.flagImage}
      registered={Boolean(row.receiverId && row.receiverId > 0)}
      showFlag={false}
      onClick={onClick}
    />
  );
}

function secondaryMark(
  row: import('@/lib/promocodes/types').PromocodeApplyRow,
  onClick?: (name: string) => void
) {
  return (
    <PromocodePersonMark
      label={promocodeSecondarySenderLabel(row)}
      email={row.secondarySender?.email}
      image={row.secondarySender?.image}
      logoUrl={row.secondarySender?.logoUrl}
      roleId={row.secondarySender?.roleId}
      countryCode={row.secondaryCountryCode}
      countryName={row.secondaryCountryName}
      flagImage={row.secondaryFlagImage}
      registered={Boolean(row.secondarySender)}
      onClick={onClick}
    />
  );
}

/** Vertical column separators for apply tables. */
const thClass = 'p-2 border-r border-gray-500 last:border-r-0';
const tdClass = 'p-2 border-r border-gray-200 last:border-r-0';
const tdCenter = `${tdClass} text-center`;

function clickableName(
  label: string,
  onClick?: (name: string) => void
) {
  if (!label || !onClick) return label;
  return (
    <button
      type="button"
      className="text-blue-800 underline"
      onClick={(e) => {
        e.stopPropagation();
        onClick(label);
      }}
    >
      {label}
    </button>
  );
}

export function PromocodeAppliesTable({
  rows,
  variant = 'index',
  selectedId,
  onSelect,
  onSenderClick,
  onSecondaryClick,
  onRecipientClick,
}: {
  rows: import('@/lib/promocodes/types').PromocodeApplyRow[];
  variant?: 'index' | 'promoAll' | 'detail';
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onSenderClick?: (username: string) => void;
  onSecondaryClick?: (username: string) => void;
  onRecipientClick?: (username: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto border border-gray-300 bg-white">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#3d3d3d] text-white text-left">
            {variant === 'promoAll' && (
              <>
                <th className={thClass}>Date</th>
                <th className={thClass}>Promocode</th>
                <th className={thClass}>Mode invite</th>
                <th className={thClass}>Sender</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Also Credits to</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Flag</th>
                <th className={thClass}>Recipient</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Version</th>
                <th className={thClass}>Data Start</th>
                <th className={thClass}>Data end</th>
              </>
            )}
            {variant === 'detail' && (
              <>
                <th className={thClass}>Date</th>
                <th className={thClass}>Sender</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Secondary Sender</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Flag</th>
                <th className={thClass}>Recipient</th>
                <th className={thClass}>%</th>
                <th className={thClass}>Version</th>
                <th className={thClass}>Data Start</th>
                <th className={thClass}>Data end</th>
              </>
            )}
            {variant === 'index' && (
              <>
                <th className={thClass}>Flag</th>
                <th className={thClass}>New user</th>
                <th className={thClass}>Version</th>
                <th className={thClass}>Data Start</th>
                <th className={thClass}>Data End</th>
                <th className={thClass}>Promocode</th>
                <th className={thClass}>Primary</th>
                <th className={thClass}>Secondary</th>
                <th className={thClass}>Date of Mail</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Credit</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={14} className="p-6 text-center text-gray-500">
                No records found.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const recipient = recipientLabel(row);
            const date = row.created ? new Date(row.created).toLocaleDateString('en-GB') : '';
            const dataStart = formatPromocodeDisplayDate(row.receiver?.subscriptionStartDate);
            const dataEnd = formatPromocodeDisplayDate(row.receiver?.subscriptionEndDate);
            const status =
              row.promocodeValidTo && row.promocodeValidTo > today ? 'Current' : 'Expired';
            const secondary = promocodeSecondarySenderLabel(row);
            const sender = promocodeSenderLabel(row);
            const flagSrc = promocodeFlagImageUrl(row.flagImage, {
              countryCode: row.receiverCountryCode,
            });

            return (
              <tr
                key={row.id}
                onClick={() => onSelect?.(row.id)}
                className={`border-t border-gray-200 hover:bg-[#f9f4db] cursor-pointer ${
                  selectedId === row.id ? 'bg-[#ffe566]' : ''
                }`}
              >
                {variant === 'promoAll' && (
                  <>
                    <td className={tdClass}>{date}</td>
                    <td className={`${tdClass} text-[#7b0a26]`}>{row.promocodeCode}</td>
                    <td className={tdCenter}>{row.inviteMode || 'Mail'}</td>
                    <td className={tdCenter}>{senderMark(row, onSenderClick)}</td>
                    <td className={tdCenter}>{row.senderCredit ?? '00'}</td>
                    <td className={tdCenter}>{secondaryMark(row, onSecondaryClick)}</td>
                    <td className={tdCenter}>{row.secondarySenderCredit ?? '00'}</td>
                    <td className={tdCenter}>
                      <PromocodeAssetImage
                        src={flagSrc}
                        fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                        countryCode={row.receiverCountryCode}
                        className="w-12 h-7 object-cover mx-auto"
                      />
                    </td>
                    <td className={`${tdClass} ${recipient.className}`}>
                      {recipientMark(row, onRecipientClick)}
                    </td>
                    <td className={tdCenter}>{row.receiverCredit ?? '00'}</td>
                    <td className={tdCenter}>{row.receiverVersion}</td>
                    <td className={tdCenter}>{dataStart}</td>
                    <td className={tdCenter}>{dataEnd}</td>
                  </>
                )}
                {variant === 'detail' && (
                  <>
                    <td className={tdClass}>{date}</td>
                    <td className={tdCenter}>{senderMark(row, onSenderClick)}</td>
                    <td className={tdCenter}>{row.senderCredit}</td>
                    <td className={tdCenter}>{secondaryMark(row, onSecondaryClick)}</td>
                    <td className={tdCenter}>{row.secondarySenderCredit}</td>
                    <td className={tdCenter}>
                      <PromocodeAssetImage
                        src={flagSrc}
                        fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                        countryCode={row.receiverCountryCode}
                        className="w-12 h-7 object-cover mx-auto"
                      />
                    </td>
                    <td className={`${tdClass} ${recipient.className}`}>
                      {recipientMark(row, onRecipientClick)}
                    </td>
                    <td className={tdCenter}>{row.receiverCredit}</td>
                    <td className={tdCenter}>{row.receiverVersion}</td>
                    <td className={tdCenter}>{dataStart}</td>
                    <td className={tdCenter}>{dataEnd}</td>
                  </>
                )}
                {variant === 'index' && (
                  <>
                    <td className={tdCenter}>
                      <PromocodeAssetImage
                        src={flagSrc}
                        fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                        countryCode={row.receiverCountryCode}
                        className="w-12 h-7 object-cover mx-auto"
                      />
                    </td>
                    <td className={`${tdClass} ${recipient.className}`}>
                      {recipientMark(row, onRecipientClick)}
                    </td>
                    <td className={tdCenter}>{row.receiverVersion}</td>
                    <td className={tdCenter}>{dataStart}</td>
                    <td className={tdCenter}>{dataEnd}</td>
                    <td className={`${tdClass} text-[#7b0a26]`}>{row.promocodeCode}</td>
                    <td className={tdCenter}>{senderMark(row, onSenderClick)}</td>
                    <td className={tdCenter}>{secondaryMark(row, onSecondaryClick)}</td>
                    <td className={tdCenter}>{date}</td>
                    <td className={tdCenter}>{status}</td>
                    <td className={tdCenter}>{row.receiverCredit ?? '00'}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
