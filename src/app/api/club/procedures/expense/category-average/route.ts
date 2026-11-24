import { NextRequest, NextResponse } from "next/server";
import { getClubAuthContext, procedureService } from "@/lib/procedures";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getClubAuthContext(request);
    if ("error" in auth) return auth.error;

    const expenseId = request.nextUrl.searchParams.get("expenseId")?.trim();
    const beforeDate = request.nextUrl.searchParams.get("beforeDate");
    if (!expenseId || !beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
      return NextResponse.json(
        { error: "expenseId and a valid beforeDate are required" },
        { status: 400 },
      );
    }

    const date = new Date(`${beforeDate}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== beforeDate
    ) {
      return NextResponse.json(
        { error: "beforeDate must be a valid calendar date" },
        { status: 400 },
      );
    }

    const result = await procedureService.getExpenseCategoryAverage(
      auth.ctx,
      expenseId,
      beforeDate,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET expense category average:", error);
    return NextResponse.json(
      { error: "Unable to calculate expense category average" },
      { status: 500 },
    );
  }
}
