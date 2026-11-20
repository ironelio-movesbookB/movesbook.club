import { NextRequest, NextResponse } from "next/server";
import { procedureService } from "@/lib/procedures";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await procedureService.processDueExpenseRecurrences();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/club/expenses/recurrent:", error);
    return NextResponse.json(
      { error: "Unable to process recurrent expenses" },
      { status: 500 },
    );
  }
}
