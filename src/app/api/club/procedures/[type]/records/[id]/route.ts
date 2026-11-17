import { NextRequest, NextResponse } from "next/server";
import { getClubAuthContext, procedureService } from "@/lib/procedures";
import { parseAddPayment } from "@/lib/procedures/validators";
import { verifyOperatorPassword } from '@/lib/procedures/operatorAuth';

export const dynamic = "force-dynamic";

type RouteContext = { params: { type: string; id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const result = await procedureService.listRecords(auth.ctx, params.type, {
      recordId: params.id,
      page: 1,
      pageSize: 1,
    });

    if (!result.items[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ record: result.items[0] });
  } catch (error) {
    console.error("GET procedure record:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      recordDate?: string;
      dueDate?: string | null;
      expenseExpirationDate?: string | null;
      adminPassword?: string;
      notes?: string;
      operatorId?: string;
      totalAmount?: number;
    };

    const changesProtectedExpenseFields =
      params.type === 'expense' &&
      (body.totalAmount !== undefined ||
        body.dueDate !== undefined ||
        body.expenseExpirationDate !== undefined);
    if (changesProtectedExpenseFields) {
      if (!body.adminPassword?.trim()) {
        return NextResponse.json(
          { error: 'Club/team administrator code is required' },
          { status: 400 },
        );
      }
      if (!(await verifyOperatorPassword(auth.ctx.userId, body.adminPassword))) {
        return NextResponse.json(
          { error: 'Club/team administrator code is incorrect' },
          { status: 401 },
        );
      }
    }

    await procedureService.updateRecord(auth.ctx, params.type, params.id, {
      recordDate: body.recordDate,
      dueDate: body.dueDate,
      expenseExpirationDate: body.expenseExpirationDate,
      notes: body.notes,
      operatorId: body.operatorId,
      totalAmount: body.totalAmount,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Record not found"
        ? 404
        : message.includes("amount already paid") ||
            message.includes("fully paid expense")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = parseAddPayment(params.type, body);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: parsed.error,
          ...(parsed.details ? { details: parsed.details } : {}),
        },
        { status: parsed.status },
      );
    }

    const result = await procedureService.addPayment(
      auth.ctx,
      params.type,
      params.id,
      parsed.data,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Record not found"
        ? 404
        : message.includes("Payment") ||
            message.includes("exceeds") ||
            message.includes("password")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
