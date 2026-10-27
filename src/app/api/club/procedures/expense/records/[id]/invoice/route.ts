import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getClubAuthContext } from "@/lib/procedures";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;
const INVOICE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.apple.pages": "pages",
  "text/plain": "txt",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "text/html": "html",
  "application/xhtml+xml": "xhtml",
};
const ALLOWED_INVOICE_EXTENSIONS = new Set(Object.values(INVOICE_EXTENSIONS));

function invoiceExtensionFromName(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName ?? "");
  return match ? match[1].toLowerCase() : null;
}

function invoiceContentTypeFromExtension(fileNameOrExtension: string): string {
  const extension = (
    fileNameOrExtension.split(".").pop() ?? fileNameOrExtension
  ).toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    odt: "application/vnd.oasis.opendocument.text",
    pages: "application/vnd.apple.pages",
    txt: "text/plain",
    rtf: "application/rtf",
    md: "text/markdown",
    html: "text/html",
    xhtml: "application/xhtml+xml",
  };
  return map[extension] ?? "application/octet-stream";
}

function recordMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeInvoicePath(
  storageKey: unknown,
  clubId: string,
  recordId: string,
): string | null {
  if (typeof storageKey !== "string") return null;
  const fileName = storageKey;
  const extension = invoiceExtensionFromName(fileName);
  if (!extension || !ALLOWED_INVOICE_EXTENSIONS.has(extension)) return null;
  if (!/^[0-9a-f-]+\.[a-z0-9]+$/i.test(fileName)) return null;
  return join(
    process.cwd(),
    "private_uploads",
    "expense-invoices",
    clubId,
    recordId,
    fileName,
  );
}

function expenseInvoice(
  metadata: Record<string, unknown>,
  clubId: string,
  recordId: string,
) {
  const invoice = metadata.expenseInvoice;
  if (!invoice || typeof invoice !== "object") return null;
  const value = invoice as Record<string, unknown>;
  if (typeof value.name !== "string" || typeof value.storageKey !== "string")
    return null;
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
      procedureType: { code: "expense" },
      status: "ACTIVE",
    },
    select: { id: true, clubId: true, metadata: true },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record)
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    const invoice = expenseInvoice(
      recordMetadata(record.metadata),
      record.clubId,
      record.id,
    );
    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const filePath = safeInvoicePath(
      invoice.storageKey,
      record.clubId,
      record.id,
    );
    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json(
        { error: "Invoice image is missing." },
        { status: 404 },
      );
    }
    const extension = invoice.storageKey.split(".").pop()?.toLowerCase();
    const contentType = invoiceContentTypeFromExtension(extension ?? "");
    return new NextResponse(await readFile(filePath), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET expense invoice:", error);
    return NextResponse.json(
      { error: "Failed to load invoice image." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record)
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Select an invoice file." },
        { status: 400 },
      );
    }

    const extension =
      invoiceExtensionFromName(file.name) ??
      (file.type && INVOICE_EXTENSIONS[file.type.toLowerCase()]) ??
      null;
    if (!extension || !ALLOWED_INVOICE_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error:
            "Invoice must be one of: JPG, JPEG, PNG, GIF, BMP, WEBP, PDF, DOC, DOCX, ODT, PAGES, TXT, RTF, MD, HTML, XHTML.",
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_INVOICE_BYTES) {
      return NextResponse.json(
        { error: "Invoice file must be 10 MB or smaller." },
        { status: 400 },
      );
    }

    const fileName = `${randomUUID()}.${extension}`;
    const uploadDirectory = join(
      process.cwd(),
      "private_uploads",
      "expense-invoices",
      record.clubId,
      record.id,
    );
    await mkdir(uploadDirectory, { recursive: true });
    const filePath = join(uploadDirectory, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const metadata = recordMetadata(record.metadata);
    const previousInvoice = metadata.expenseInvoice;
    const displayName =
      file.name
        .split(/[\\/]/)
        .pop()
        ?.replace(/[\u0000-\u001f\u007f]/g, "")
        .trim() || `invoice.${extension}`;
    const invoice = {
      name: displayName.slice(0, 160),
      url: `/api/club/procedures/expense/records/${encodeURIComponent(record.id)}/invoice`,
      storageKey: fileName,
    };

    try {
      await prisma.procedureRecord.update({
        where: { id: record.id },
        data: {
          metadata: {
            ...metadata,
            expenseInvoice: invoice,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await unlink(filePath);
      throw error;
    }

    const oldFilePath = safeInvoicePath(
      previousInvoice && typeof previousInvoice === "object"
        ? (previousInvoice as Record<string, unknown>).storageKey
        : null,
      record.clubId,
      record.id,
    );
    if (oldFilePath && oldFilePath !== filePath && existsSync(oldFilePath)) {
      await unlink(oldFilePath);
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("POST expense invoice:", error);
    return NextResponse.json(
      { error: "Failed to save invoice image." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const record = await findExpenseRecord(params.id, auth.ctx.club.id);
    if (!record)
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });

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
      typeof invoice === "object"
        ? (invoice as Record<string, unknown>).storageKey
        : null,
      record.clubId,
      record.id,
    );
    if (filePath && existsSync(filePath)) {
      await unlink(filePath);
    }

    return NextResponse.json({ invoice: null });
  } catch (error) {
    console.error("DELETE expense invoice:", error);
    return NextResponse.json(
      { error: "Failed to remove invoice image." },
      { status: 500 },
    );
  }
}
