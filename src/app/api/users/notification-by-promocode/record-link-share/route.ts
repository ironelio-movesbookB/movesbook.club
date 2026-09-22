import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppliesColumns, getPromocodeAppliesTable } from '@/lib/promocodes/legacyDb';
import { userOwnsOrReceivedPromocode, resolveInviteExpiryDate } from '@/lib/promocodes/childPromocode';
import { resolvePromocodeSessionUser } from '@/lib/promocodes/promocodeSessionAuth';
import { ensurePromocodeMetaTables } from '@/lib/promocodes/ensureMetaTables';

export const dynamic = 'force-dynamic';

const LINK_SHARE_EMAIL = '(link shared)';
const LINK_SENT_MODE = 'Link sent';

export async function POST(request: NextRequest) {
  const session = await resolvePromocodeSessionUser(request);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  let body: { promocodeId?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const promocodeId = Number(body.promocodeId);
  if (!Number.isFinite(promocodeId) || promocodeId <= 0) {
    return NextResponse.json({ error: 'Please select a promocode.' }, { status: 400 });
  }

  try {
    await ensurePromocodeMetaTables();
    const appliesTable = await getPromocodeAppliesTable();
    if (!appliesTable) {
      return NextResponse.json({ error: 'Promocode tables not found.' }, { status: 500 });
    }

    const allowed = await userOwnsOrReceivedPromocode(session.user.legacyUserId, promocodeId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You can only use a promocode you received or created.' },
        { status: 403 }
      );
    }

    const applyColumns = await getAppliesColumns();
    const existing = await prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM \`${appliesTable}\`
       WHERE sender_id = ? AND promocode_id = ?
         AND delete_status = 2
         AND LOWER(TRIM(COALESCE(receiver_email, ''))) = ?
         AND LOWER(TRIM(COALESCE(invite_mode, ''))) = ?
       ORDER BY id DESC LIMIT 1`,
      session.user.legacyUserId,
      promocodeId,
      LINK_SHARE_EMAIL.toLowerCase(),
      LINK_SENT_MODE.toLowerCase()
    );

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (existing.length > 0) {
      if (applyColumns.has('modified')) {
        await prisma.$executeRawUnsafe(
          `UPDATE \`${appliesTable}\` SET modified = ? WHERE id = ?`,
          now,
          Number(existing[0].id)
        );
      }
      return NextResponse.json({ status: 'success', message: 'Link share recorded.' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, val: unknown) => {
      if (applyColumns.has(col)) {
        fields.push(`\`${col}\``);
        values.push(val);
      }
    };

    add('sender_id', session.user.legacyUserId);
    add('sender_email', session.user.email);
    add('receiver_email', LINK_SHARE_EMAIL);
    add('promocode_id', promocodeId);
    add('created', now);
    add('modified', now);
    add('delete_status', 2);
    add('level', '2');
    add('invite_mode', LINK_SENT_MODE);
    add('invite_expires_at', await resolveInviteExpiryDate(promocodeId));

    if (fields.length === 0) {
      return NextResponse.json({ status: 'success', message: 'Nothing to record.' });
    }

    const placeholders = fields.map(() => '?').join(', ');
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${appliesTable}\` (${fields.join(', ')}) VALUES (${placeholders})`,
      ...values
    );

    return NextResponse.json({ status: 'success', message: 'Link share recorded.' });
  } catch (err) {
    console.error('record-link-share POST:', err);
    return NextResponse.json({ error: 'Failed to record link share.' }, { status: 500 });
  }
}
