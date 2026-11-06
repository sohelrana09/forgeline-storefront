import { connection, NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { expireUnpaidOrders, sweepCancelledOrders, sweepOrphanPayments, sweepRecentOrders } from "@/features/order-processing/service";
import { reportEvent } from "@/lib/error-report";

export const maxDuration = 120;

// The safety net for after-order processing: numbers and finishes orders from the last 72 hours that neither the
// server action nor the Subscription event completed. Called by a scheduler (Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>`); see docs/checkout-setup.md for the schedule.
export async function GET(request: NextRequest) {
  await connection();
  if (!hasCronSecret(request.headers.get("authorization"))) {
    if (await tooManyAttempts(`order-sweep:${await clientIp()}`, 20)) {
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const part = <T>(name: string, run: () => Promise<T>, fallback: T) =>
    run().catch((err) => {
      reportEvent("sweep_failed", err, { part: name });
      return fallback;
    });
  const result = await sweepRecentOrders();
  const expired = await part("expiry", expireUnpaidOrders, 0);
  const restockFailed = await part("restock", sweepCancelledOrders, 1);
  const orphans = await part("orphans", sweepOrphanPayments, 0);
  const summary = { ...result, expired, restockFailed, orphans };
  console.info("order sweep", summary);
  return NextResponse.json(summary, { status: result.failed || restockFailed ? 500 : 200 });
}
