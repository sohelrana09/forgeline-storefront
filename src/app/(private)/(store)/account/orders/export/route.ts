import type { Order } from "@commercetools/platform-sdk";
import { requireShopContext } from "@/features/business-units/context";
import { pageMyOrders } from "@/features/orders/service";
import { getCompanyMembers, pageCompanyOrders } from "@/features/company/service";
import { can } from "@/features/company/utils";
import { ordersCsv } from "@/features/orders/csv";
import { tooManyAttempts } from "@/lib/rate-limit";

const PAGE = 500;
const MAX = 2000;

// My orders as CSV, or (?scope=company, ViewOthersOrders re-checked live by the service) all of the unit's orders.
// Newest first, at most 2,000.
export async function GET(request: Request) {
  const { session, context } = await requireShopContext();
  if (await tooManyAttempts(`order-export:${session.customerId}`, 10)) {
    return new Response("Too many exports. Please wait a few minutes.", { status: 429 });
  }
  const company = new URL(request.url).searchParams.get("scope") === "company" && can(context, "ViewOthersOrders");
  const orders: Order[] = [];
  try {
    for (let page = 1; orders.length < MAX; page++) {
      const { orders: batch, total } = company
        ? await pageCompanyOrders(context, session.customerId, page, PAGE)
        : await pageMyOrders(session, context, page, PAGE);
      orders.push(...batch);
      if (batch.length < PAGE || orders.length >= total) break;
    }
  } catch (err) {
    console.error("order export failed", (err as { body?: unknown })?.body ?? err);
    return new Response("The orders could not be exported. Please try again.", { status: 503 });
  }
  const names = company
    ? Object.fromEntries(
        (await getCompanyMembers(context, session.customerId).catch(() => [])).map((m) => [m.customerId, m.name || m.email]),
      )
    : undefined;
  const day = new Date().toISOString().slice(0, 10);
  return new Response(ordersCsv(orders.slice(0, MAX), names), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${company ? "company-orders" : "my-orders"}-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
