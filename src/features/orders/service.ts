import type { Order } from "@commercetools/platform-sdk";
import { customerApiRoot } from "@/lib/commercetools/client";
import { str } from "@/lib/predicate";
import { signOutOnAuthError, type Session } from "@/features/auth/session";
import type { PricingContext } from "@/features/business-units/types";
import { UUID } from "@/features/orders/utils";

// The buyer's own orders in the selected store, read with their token (someone else's id is simply not found).
const myOrders = (session: Session, ctx: PricingContext) =>
  customerApiRoot(session.accessToken).inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey }).me().orders();

export async function getMyOrder(session: Session, ctx: PricingContext, orderId: string): Promise<Order | undefined> {
  if (!UUID.test(orderId)) return undefined;
  return myOrders(session, ctx)
    .withId({ ID: orderId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => {
      if ((err as { body?: { statusCode?: number } })?.body?.statusCode === 404) return undefined;
      throw err;
    });
}

export async function listMyOrders(session: Session, ctx: PricingContext, limit = 5): Promise<Order[]> {
  return (await pageMyOrders(session, ctx, 1, limit)).orders;
}

// One page of the buyer's orders for the selected unit, newest first (My Orders).
export async function pageMyOrders(session: Session, ctx: PricingContext, page: number, pageSize: number) {
  const { body } = await myOrders(session, ctx)
    .get({
      queryArgs: {
        // Consumers (no unit) see their personal orders: those without a business unit.
        where: ctx.businessUnitKey ? `businessUnit(key=${str(ctx.businessUnitKey)})` : "businessUnit is not defined",
        sort: ["createdAt desc"],
        limit: pageSize,
        offset: (Math.max(1, page) - 1) * pageSize,
        withTotal: true,
      },
    })
    .execute()
    .catch(signOutOnAuthError);
  return { orders: body.results, total: body.total ?? body.count };
}

export const orderReference = (order: Pick<Order, "orderNumber" | "id">) => order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
