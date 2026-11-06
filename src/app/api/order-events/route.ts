import { connection, NextResponse, type NextRequest } from "next/server";
import { hasOrderEventsSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { orderEventTarget } from "@/features/order-processing/events";
import { orderIdForPayment, processOrder } from "@/features/order-processing/service";

// Order and payment messages from the commercetools Subscription `storefront-order-events` (npm run
// ct:order-subscription), delivered through a queue: an EventBridge API destination or a Pub/Sub push. Runs the
// after-order steps (number, and later the Payment and the confirmation email) even when the buyer's browser never
// came back after paying. Authorized by `Authorization: Bearer <ORDER_EVENTS_SECRET>`; answers nothing about the order.
//
// 200 for anything handled or not ours (so the queue drops it), 500 when a step failed (so the queue retries; the
// sweep, /api/cron/order-sweep, catches what retries miss).
export async function POST(request: NextRequest) {
  await connection();
  if (!hasOrderEventsSecret(request.headers.get("authorization"))) {
    if (await tooManyAttempts(`order-events:${await clientIp()}`, 20)) {
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = orderEventTarget(await request.json().catch(() => undefined));
  if (!target) return NextResponse.json({ ignored: true });
  const orderId = target.typeId === "order" ? target.id : await orderIdForPayment(target.id).catch(() => undefined);
  if (!orderId) return NextResponse.json({ ignored: true });
  const ok = await processOrder(orderId);
  return NextResponse.json({ processed: ok }, { status: ok ? 200 : 500 });
}
