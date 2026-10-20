'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import PromocodesPagination from '@/components/promocodes/PromocodeAppliesTable';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import { PromocodePersonMark } from '@/components/promocodes/PromocodePersonMark';
import PromocodeAssetImage from '@/components/promocodes/PromocodeAssetImage';
import {
  PROMOCODE_NO_FLAG_IMAGE,
  promocodeFlagImageUrl,
} from '@/components/promocodes/promocodeImageUrls';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import type { PaginatedResult, PromocodeUserRow } from '@/lib/promocodes/types';
import '@/components/promocodes/promocodes.css';

type DetailTab = 'users' | 'invites' | 'credits' | 'connections';

export default function PromocodeUsersPage() {
  const ready = usePromocodesAdminAuth();
  const [data, setData] = useState<PaginatedResult<PromocodeUserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('users');
  const [detail, setDetail] = useState<{
    invites: Record<string, unknown>[];
    registrations: Record<string, unknown>[];
    friendInvites: Record<string, unknown>[];
    friendRegistrations: Record<string, unknown>[];
    totals: {
      pendingInvites: number;
      pendingFriendInvites: number;
      connectedInvites: number;
      friendRegistrations: number;
      friendOfFriendRegistrations: number;
      connectedRegistrations: number;
      creditsEarned: number;
    };
    credits: {
      asSender: Record<string, unknown>[];
      asSecondary: Record<string, unknown>[];
      asReceiver: Record<string, unknown>[];
    };
    connections: {
      currentUserUsername: string;
      thanksTo: { username: string } | null;
      personalRegistrationCredits: number;
      direct: { username: string; credits: number; image?: string | null; logoUrl?: string | null; roleId?: number | null }[];
      indirect: { username: string; credits: number; senderUsername: string; image?: string | null; logoUrl?: string | null; roleId?: number | null }[];
    } | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      const res = await promocodesFetch(`/api/admin/promocodes/users?${params}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !selectedUserId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    promocodesFetch(`/api/admin/promocodes/users/${selectedUserId}`)
      .then(async (res) => {
        const json = await res.json();
        setDetail({
          invites: Array.isArray(json.invites) ? json.invites : [],
          registrations: Array.isArray(json.registrations) ? json.registrations : [],
          friendInvites: Array.isArray(json.friendInvites) ? json.friendInvites : [],
          friendRegistrations: Array.isArray(json.friendRegistrations)
            ? json.friendRegistrations
            : [],
          totals: json.totals ?? {
            pendingInvites: 0,
            pendingFriendInvites: 0,
            connectedInvites: 0,
            friendRegistrations: 0,
            friendOfFriendRegistrations: 0,
            connectedRegistrations: 0,
            creditsEarned: 0,
          },
          credits: json.credits ?? { asSender: [], asSecondary: [], asReceiver: [] },
          connections: json.connections ?? null,
        });
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [ready, selectedUserId]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search);
  };

  if (!ready) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const selectedUser = data?.items.find((u) => u.legacyUserId === selectedUserId) ?? null;

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Users of Promocodes</div>
      <PromocodesTabs active="users" />

      <form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={onSearch}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username or name"
          className="px-3 py-2 border text-sm min-w-[240px]"
        />
        <button type="submit" className="px-4 py-2 bg-[#7b0a26] text-white text-sm rounded">
          Search
        </button>
      </form>

      <div className="re-tab-bar mt-6">
        <ul>
          {(
            [
              ['users', 'Users'],
              ['invites', 'Invites and Registrations'],
              ['credits', 'Credits earned'],
              ['connections', 'Connections chart'],
            ] as const
          ).map(([key, label]) => (
            <li key={key}>
              <a
                href="#"
                className={detailTab === key ? 'active' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setDetailTab(key);
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {detailTab === 'users' && (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <PromocodePageSizeSelect
              value={pageSize}
              onChange={(size) => {
                setPageSize(size);
                setPage(1);
                setDetailPage(1);
              }}
            />
            <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto border border-gray-300 bg-white mt-2">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#3d3d3d] text-white text-left">
                    <th className="p-2">Username</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Country</th>
                    <th className="p-2">Flag</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Version</th>
                    <th className="p-2">Expiration</th>
                    <th className="p-2">1th promocode</th>
                    <th className="p-2">PG count</th>
                    <th className="p-2">Credits earned</th>
                    <th className="p-2">Used</th>
                    <th className="p-2">Remain</th>
                    <th className="p-2">Last invite</th>
                    <th className="p-2">Days</th>
                    <th className="p-2">Last registration</th>
                  </tr>
                </thead>
                <tbody>
                    {(data?.items ?? []).slice(0, pageSize).length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-6 text-center text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    (data?.items ?? []).slice(0, pageSize).map((row) => (
                      <tr
                        key={row.legacyUserId}
                        className={`border-t hover:bg-[#f9f4db] cursor-pointer ${
                          selectedUserId === row.legacyUserId ? 'bg-[#ffe566]' : ''
                        }`}
                        onClick={() => setSelectedUserId(row.legacyUserId)}
                      >
                        <td className="p-2 font-medium">
                          <PromocodePersonMark
                            label={row.username}
                            email={row.email}
                            image={row.image}
                            logoUrl={row.logoUrl}
                            roleId={row.roleId}
                            countryCode={row.countryCode}
                            countryName={row.country}
                            flagImage={row.flagImage}
                            registered
                          />
                        </td>
                        <td className="p-2">{row.wholeName}</td>
                        <td className="p-2">{row.country ?? ''}</td>
                        <td className="p-2">
                          <span title={row.country ?? row.countryCode ?? ''}>
                            <PromocodeAssetImage
                              src={promocodeFlagImageUrl(row.flagImage, {
                                countryCode: row.countryCode,
                              })}
                              fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                              countryCode={row.countryCode}
                              alt={row.country ?? ''}
                              className="h-6"
                            />
                          </span>
                        </td>
                        <td className="p-2">{row.userType}</td>
                        <td className="p-2">{row.version ?? ''}</td>
                        <td className="p-2">{row.expiration ?? ''}</td>
                        <td className="p-2" style={{ color: '#7b0a26' }}>{row.firstPromocode ?? ''}</td>
                        <td className="p-2 text-center">{row.promocodesGenerated}</td>
                        <td className="p-2 text-center">{row.creditsEarned.toFixed(2)}</td>
                        <td className="p-2 text-center">{row.creditsUsed.toFixed(2)}</td>
                        <td className="p-2 text-center">{Math.min(row.creditsEarned, row.creditsRemain).toFixed(2)}</td>
                        <td className="p-2">
                          {row.lastInviteDate?.slice(0, 10) ?? ''}
                          {row.daysSinceLastInvite != null ? (
                            <div style={{ color: '#cc0000' }}>({row.daysSinceLastInvite})</div>
                          ) : null}
                        </td>
                        <td className="p-2 text-center" style={{ color: '#cc0000' }}>
                          {row.daysSinceLastInvite ?? ''}
                        </td>
                        <td className="p-2">
                          {row.lastRegistrationDate?.slice(0, 10) ?? ''}
                          {row.daysSinceLastRegistration != null ? (
                            <div style={{ color: '#cc0000' }}>({row.daysSinceLastRegistration})</div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <PromocodesPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {detailTab !== 'users' && (
        <div className="mt-4 border border-gray-300 bg-white p-4">
          {!selectedUserId ? (
            <p className="text-gray-600">Select a user from the Users tab first.</p>
          ) : detailLoading ? (
            <p>Loading detail…</p>
          ) : (
            <>
              <div className="mb-4 font-semibold">
                {selectedUser?.username ?? `User #${selectedUserId}`}
              </div>
              {detailTab === 'invites' && (
                <div className="overflow-x-auto">
                  <div className="mb-4 grid gap-1 text-sm">
                    <p>
                      Invites sent, not yet registered:{' '}
                      <strong>{detail?.totals.pendingInvites ?? 0}</strong>
                    </p>
                    <p>
                      Invites sent by friends, not yet registered:{' '}
                      <strong>{detail?.totals.pendingFriendInvites ?? 0}</strong>
                    </p>
                    <p>
                      Total invites of connected users:{' '}
                      <strong>{detail?.totals.connectedInvites ?? 0}</strong>
                    </p>
                    <p>
                      Registrations by friends:{' '}
                      <strong>{detail?.totals.friendRegistrations ?? 0}</strong>
                    </p>
                    <p>
                      Registrations by friends of friends:{' '}
                      <strong>{detail?.totals.friendOfFriendRegistrations ?? 0}</strong>
                    </p>
                    <p>
                      Total connected registrations:{' '}
                      <strong>{detail?.totals.connectedRegistrations ?? 0}</strong>
                      {' — '}credits earned{' '}
                      <strong>{(selectedUser?.creditsEarned ?? detail?.totals.creditsEarned ?? 0).toFixed(2)}</strong>
                      {' — '}used <strong>{(selectedUser?.creditsUsed ?? 0).toFixed(2)}</strong>
                      {' — '}available{' '}
                      <strong>
                        {Math.min(
                          selectedUser?.creditsEarned ?? detail?.totals.creditsEarned ?? 0,
                          selectedUser?.creditsRemain ?? detail?.totals.creditsEarned ?? 0
                        ).toFixed(2)}
                      </strong>
                    </p>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#3d3d3d] text-white text-left">
                        <th className="p-2">Sender</th>
                        <th className="p-2">Relation</th>
                        <th className="p-2">Mail / Username</th>
                        <th className="p-2">Promocode</th>
                        <th className="p-2">Date mail</th>
                        <th className="p-2">Registered</th>
                        <th className="p-2">Registration date</th>
                        <th className="p-2">Expiring date</th>
                        <th className="p-2">Cost paid</th>
                        <th className="p-2">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.invites ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-4 text-gray-500">
                            No invites.
                          </td>
                        </tr>
                      ) : (
                        (detail?.invites ?? [])
                          .slice((detailPage - 1) * pageSize, detailPage * pageSize)
                          .map((row, idx) => {
                          const registered = Number(row.receiver_id ?? 0) > 0;
                          const senderName = String(row.sender_username || row.sender_email || '');
                          const receiverName = registered
                            ? String(row.receiver_username || row.receiver_email || '')
                            : String(row.receiver_email || '');
                          const direct = Number(row.sender_id ?? 0) === selectedUserId;
                          return (
                          <tr key={idx} className="border-t">
                            <td className="p-2">
                              <PromocodePersonMark
                                label={senderName}
                                email={String(row.sender_email ?? '')}
                                image={row.sender_image != null ? String(row.sender_image) : null}
                                logoUrl={row.sender_logo != null ? String(row.sender_logo) : null}
                                roleId={row.sender_role_id != null ? Number(row.sender_role_id) : null}
                                registered={Boolean(row.sender_username)}
                              />
                            </td>
                            <td className="p-2">{direct ? 'Direct' : 'Indirect'}</td>
                            <td className="p-2">
                              <PromocodePersonMark
                                label={receiverName}
                                email={String(row.receiver_email ?? '')}
                                image={row.receiver_image != null ? String(row.receiver_image) : null}
                                logoUrl={row.receiver_logo != null ? String(row.receiver_logo) : null}
                                roleId={row.receiver_role_id != null ? Number(row.receiver_role_id) : null}
                                registered={registered}
                              />
                            </td>
                            <td className="p-2">{String(row.promocode_code ?? row.promocode_id ?? '')}</td>
                            <td className="p-2">{String(row.created ?? '').slice(0, 10)}</td>
                            <td className="p-2">{Number(row.receiver_id ?? 0) > 0 ? 'Yes' : 'No'}</td>
                            <td className="p-2">
                              {String(row.registration_date ?? row.subscription_start_date ?? '').slice(0, 10) || '--'}
                            </td>
                            <td className="p-2">
                              {String(row.subscription_end_date ?? '').slice(0, 10) || '--'}
                            </td>
                            <td className="p-2">{String(row.cost_paid ?? row.total_payment ?? '--')}</td>
                            <td className="p-2">{String(row.sender_credit ?? '')}</td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {detailTab === 'credits' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#3d3d3d] text-white text-left">
                        <th className="p-2">Sender</th>
                        <th className="p-2">Credits thanks to</th>
                        <th className="p-2">Registered user</th>
                        <th className="p-2">Version</th>
                        <th className="p-2">Registration date</th>
                        <th className="p-2">Expiring date</th>
                        <th className="p-2">Cost paid</th>
                        <th className="p-2">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...(detail?.credits.asReceiver ?? []),
                        ...(detail?.credits.asSender ?? []),
                        ...(detail?.credits.asSecondary ?? []),
                      ].length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-gray-500">
                            No credits earned.
                          </td>
                        </tr>
                      ) : (
                        [
                          ...(detail?.credits.asReceiver ?? []).map((row) => ({
                            ...row,
                            _role: 'receiver' as const,
                          })),
                          ...(detail?.credits.asSender ?? []).map((row) => ({
                            ...row,
                            _role: 'sender' as const,
                          })),
                          ...(detail?.credits.asSecondary ?? []).map((row) => ({
                            ...row,
                            _role: 'secondary' as const,
                          })),
                        ].map((raw, idx) => {
                          const row = raw as Record<string, unknown> & { _role: 'receiver' | 'sender' | 'secondary' };
                          return (
                          <tr key={idx} className="border-t">
                            <td className="p-2">
                              <PromocodePersonMark
                                label={String(row.sender_username || row.sender_email || '')}
                                email={String(row.sender_email ?? '')}
                                image={row.sender_image != null ? String(row.sender_image) : null}
                                logoUrl={row.sender_logo != null ? String(row.sender_logo) : null}
                                roleId={row.sender_role_id != null ? Number(row.sender_role_id) : null}
                                registered={Boolean(row.sender_username)}
                              />
                            </td>
                            <td className="p-2">
                              {row._role === 'receiver'
                                ? '-'
                                : String(row.secondary_sender_username ?? '')}
                            </td>
                            <td className="p-2">
                              <PromocodePersonMark
                                label={
                                  row._role === 'receiver'
                                    ? selectedUser?.username ?? String(row.receiver_username || row.receiver_email || '')
                                    : String(row.receiver_username || row.receiver_email || '')
                                }
                                email={String(row.receiver_email ?? '')}
                                image={row.receiver_image != null ? String(row.receiver_image) : null}
                                logoUrl={row.receiver_logo != null ? String(row.receiver_logo) : null}
                                roleId={row.receiver_role_id != null ? Number(row.receiver_role_id) : null}
                                registered={Number(row.receiver_id ?? 0) > 0 || row._role === 'receiver'}
                              />
                            </td>
                            <td className="p-2">{String(row.receiver_version ?? '')}</td>
                            <td className="p-2">
                              {String(row.registration_date ?? row.subscription_start_date ?? '').slice(0, 10) ||
                                '--'}
                            </td>
                            <td className="p-2">
                              {String(row.subscription_end_date ?? '').slice(0, 10) || '--'}
                            </td>
                            <td className="p-2">{String(row.cost_paid ?? row.total_payment ?? '--')}</td>
                            <td className="p-2">
                              {String(
                                row._role === 'receiver'
                                  ? row.receiver_credit
                                  : row._role === 'secondary'
                                    ? row.secondary_sender_credit
                                    : row.sender_credit ?? ''
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {detailTab === 'connections' && selectedUser && (
                <div className="text-sm space-y-3 max-h-[420px] overflow-y-auto pr-2">
                  <p>
                    Credits earned: <strong>{selectedUser.creditsEarned.toFixed(2)}</strong>
                    {' · '}used <strong>0.00</strong>
                    {' · '}available <strong>{selectedUser.creditsEarned.toFixed(2)}</strong>
                  </p>
                  {detail?.connections?.thanksTo ? (
                    <p>
                      {selectedUser.username} allows to user{' '}
                      <strong style={{ color: '#7b0a26' }}>
                        {detail.connections.thanksTo.username}
                      </strong>{' '}
                      to earn credits
                    </p>
                  ) : (
                    <p>No upstream promocode sender recorded.</p>
                  )}
                  <div>
                    <div className="font-bold mb-1">Personal registration</div>
                    <p>
                      {selectedUser.username} —{' '}
                      {(detail?.connections?.personalRegistrationCredits ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <div className="font-bold mb-1">Direct recipients who registered</div>
                    {(detail?.connections?.direct ?? []).length === 0 ? (
                      <p>No direct recipients registered yet.</p>
                    ) : (
                      (detail?.connections?.direct ?? []).map((d, i) => (
                        <p key={i} className="flex items-center gap-2">
                          <PromocodePersonMark
                            label={d.username}
                            image={d.image}
                            logoUrl={d.logoUrl}
                            roleId={d.roleId}
                            registered
                          />
                          <span>— {d.credits.toFixed(2)}</span>
                        </p>
                      ))
                    )}
                  </div>
                  <div>
                    <div className="font-bold mb-1">Indirect secondary recipients who registered</div>
                    {(detail?.connections?.indirect ?? []).length === 0 ? (
                      <p>No indirect secondary recipients registered yet.</p>
                    ) : (
                      (detail?.connections?.indirect ?? []).map((d, i) => (
                        <p key={i} className="flex items-center gap-2">
                          <PromocodePersonMark
                            label={d.username}
                            image={d.image}
                            logoUrl={d.logoUrl}
                            roleId={d.roleId}
                            registered
                          />
                          <span>— {d.credits.toFixed(2)} (by {d.senderUsername})</span>
                        </p>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
