import { connection, NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { reportEvent } from "@/lib/error-report";
import { stockAlertsEnabled } from "@/features/stock-alerts/alerts";
import { sweepStockAlerts } from "@/features/stock-alerts/service";

export const maxDuration = 120;

// Daily: emails customers whose followed products are back in stock, and expires old alerts. Same CRON_SECRET as the
// order sweep.
export async function GET(request: NextRequest) {
  await connection();
  if (!hasCronSecret(request.headers.get("authorization"))) {
    if (await tooManyAttempts(`stock-alert-sweep:${await clientIp()}`, 20))
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!stockAlertsEnabled()) return NextResponse.json({ skipped: "STOCK_ALERTS is off" });
  try {
    const result = await sweepStockAlerts();
    console.info("stock alert sweep", result);
    return NextResponse.json(result, { status: result.failed ? 500 : 200 });
  } catch (err) {
    reportEvent("sweep_failed", err, { part: "stock-alerts" });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
