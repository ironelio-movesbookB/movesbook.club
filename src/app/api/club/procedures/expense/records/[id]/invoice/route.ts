import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getClubAuthContext } from '@/lib/procedures';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function recordMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeInvoicePath(storageKey: unknown, clubId: string, recordId: string): string | null {
  if (typeof storageKey !== 'string') return null;
  const fileName = storageKey;
  if (!/^[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(fileName)) return null;
  return join(process.cwd(), 'private_uploads', 'expense-invoices', clubId, recordId, fileName);
}

function expenseInvoice(
  metadata: Record<string, unknown>,
  clubId: string,
  recordId: string
) {
  const invoice = metadata.expenseInvoice;
  if (!invoice || typeof invoice !== 'object') return null;
  const value = invoice as Record<string, unknown>;
  if (typeof value.name !== 'string' || typeof value.storageKey !== 'string') return null;
  if (!safeInvoicePath(value.storageKey, clubId, recordId)) return null;
  return {
    name: value.name,
    url: `/api/club/procedures/expense/records/${encodeURIComponent(recordId)}/invoice`,
    storageKey: value.storageKey,
  };
}

async function findExpenseRecord(id: string, clubId: string) {
  return prisma.procedureRecord.findFirst({
    where: {
      id,
      clubId,
      procedureType: { code: 'expense' },
      status: 'ACTIVE',
    },
    select: { id: true, clubId: true, metadata: true },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    const invoice = expenseInvoice(recordMetadata(record.metadata), record.clubId, record.id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const filePath = safeInvoicePath(invoice.storageKey, record.clubId, record.id);
    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json({ error: 'Invoice image is missing.' }, { status: 404 });
    }
    const extension = invoice.storageKey.split('.').pop()?.toLowerCase();
    const contentType =
      extension === 'jpg' ? 'image/jpeg' :
      extension === 'png' ? 'image/png' :
      extension === 'gif' ? 'image/gif' : 'image/webp';
    return new NextResponse(await readFile(filePath), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('GET expense invoice:', error);
    return NextResponse.json({ error: 'Failed to load invoice image.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Select an invoice picture.' }, { status: 400 });
    }
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: 'Invoice must be a JPG, PNG, GIF, or WebP image.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Invoice image must be 10 MB or smaller.' }, { status: 400 });
    }

    const fileName = `${randomUUID()}.${extension}`;
    const uploadDirectory = join(
      process.cwd(),
      'private_uploads',
      'expense-invoices',
      record.clubId,
      record.id
    );
    await mkdir(uploadDirectory, { recursive: true });
    const filePath = join(uploadDirectory, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const metadata = recordMetadata(record.metadata);
    const previousInvoice = metadata.expenseInvoice;
    const displayName =
      file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim() ||
      `invoice.${extension}`;
    const invoice = {
      name: displayName.slice(0, 160),
      url: `/api/club/procedures/expense/records/${encodeURIComponent(record.id)}/invoice`,
      storageKey: fileName,
    };

    try {
      await prisma.procedureRecord.update({
        where: { id: record.id },
        data: {
          metadata: { ...metadata, expenseInvoice: invoice } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await unlink(filePath);
      throw error;
    }

    const oldFilePath = safeInvoicePath(
      previousInvoice && typeof previousInvoice === 'object'
        ? (previousInvoice as Record<string, unknown>).storageKey
        : null,
      record.clubId,
      record.id
    );
    if (oldFilePath && oldFilePath !== filePath && existsSync(oldFilePath)) {
      await unlink(oldFilePath);
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('POST expense invoice:', error);
    return NextResponse.json({ error: 'Failed to save invoice image.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ('error' in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const metadata = recordMetadata(record.metadata);
    const invoice = metadata.expenseInvoice;
    if (!invoice) return NextResponse.json({ invoice: null });

    const updatedMetadata = { ...metadata };
    delete updatedMetadata.expenseInvoice;
    await prisma.procedureRecord.update({
      where: { id: record.id },
      data: { metadata: updatedMetadata as Prisma.InputJsonValue },
    });

    const filePath = safeInvoicePath(
      typeof invoice === 'object' ? (invoice as Record<string, unknown>).storageKey : null,
      record.clubId,
      record.id
    );
    if (filePath && existsSync(filePath)) {
      await unlink(filePath);
    }

    return NextResponse.json({ invoice: null });
  } catch (error) {
    console.error('DELETE expense invoice:', error);
    return NextResponse.json({ error: 'Failed to remove invoice image.' }, { status: 500 });
  }
}
