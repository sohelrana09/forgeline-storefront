import { connection, NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { recurringOrdersEnabled } from "@/features/recurring-orders/schedule";
import { sweepRecurringOrders } from "@/features/recurring-orders/service";
import { reportEvent } from "@/lib/error-report";

export const maxDuration = 120;

// Daily: reminders two days before each recurring order runs, and the pre-run check (budget, stock, the buyer's
// right to order) that pauses a run commercetools would otherwise place or fail. Same CRON_SECRET as the order sweep.
export async function GET(request: NextRequest) {
  await connection();
  if (!hasCronSecret(request.headers.get("authorization"))) {
    if (await tooManyAttempts(`recurring-sweep:${await clientIp()}`, 20)) {
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!recurringOrdersEnabled()) return NextResponse.json({ skipped: "RECURRING_ORDERS is off" });
  try {
    const result = await sweepRecurringOrders();
    console.info("recurring order sweep", result);
    return NextResponse.json(result, { status: result.failed ? 500 : 200 });
  } catch (err) {
    reportEvent("sweep_failed", err, { part: "recurring-orders" });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
