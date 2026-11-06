import { connection, NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { sweepRecentOrders } from "@/features/order-processing/service";

// The safety net for after-order processing: numbers and finishes orders from the last 24 hours that neither the
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
  const result = await sweepRecentOrders();
  console.info("order sweep", result);
  return NextResponse.json(result, { status: result.failed ? 500 : 200 });
}
