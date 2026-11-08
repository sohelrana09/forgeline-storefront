import "server-only";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { TAGS, cacheFor } from "@/lib/cache";
import { str } from "@/lib/predicate";
import type { Session } from "@/features/auth/session";
import type { PricingContext } from "@/features/business-units/types";
import { REVIEW_STATES, authorName, reviewKey, type ReviewInput } from "@/features/reviews/reviews";

// Reviews (docs/features/b2c-engagement.md). The admin client writes them (commercetools has no /me/reviews), only
// for the signed-in customer, after their own token showed an order with this product in the selected store.

export class ReviewError extends Error {}

export type PublicReview = { id: string; rating: number; title?: string; text: string; author: string; createdAt: string };

async function approvedStateId(): Promise<string | undefined> {
  "use cache: remote";
  cacheFor("structure", TAGS.catalog);
  return apiRoot
    .states()
    .withKey({ key: REVIEW_STATES.approved })
    .get()
    .execute()
    .then((r) => r.body.id)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
}

// Approved reviews of a product, newest first. Shared by every visitor (names are first name + initial).
export async function getApprovedReviews(productId: string): Promise<PublicReview[]> {
  "use cache: remote";
  cacheFor("prices", TAGS.catalog);
  const stateId = await approvedStateId();
  if (!stateId) return [];
  const { body } = await apiRoot
    .reviews()
    .get({
      queryArgs: { where: `target(id = ${str(productId)}) and state(id = ${str(stateId)})`, sort: ["createdAt desc"], limit: 20 },
    })
    .execute();
  return body.results.map((r) => ({
    id: r.id,
    rating: r.rating ?? 0,
    title: r.title,
    text: r.text ?? "",
    author: r.authorName ?? "Verified buyer",
    createdAt: r.createdAt,
  }));
}

export type Eligibility = "can" | "not-bought" | "reviewed";

export async function reviewEligibility(session: Session, ctx: PricingContext, productId: string): Promise<Eligibility> {
  const [reviewed, bought] = await Promise.all([
    apiRoot
      .reviews()
      .withKey({ key: reviewKey(session.customerId, productId) })
      .get()
      .execute()
      .then(() => true)
      .catch((err) => (statusOf(err) === 404 ? false : Promise.reject(err))),
    customerApiRoot(session.accessToken)
      .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
      .me()
      .orders()
      .get({ queryArgs: { where: `lineItems(productId = ${str(productId)})`, limit: 1, withTotal: false } })
      .execute()
      .then((r) => r.body.results.length > 0),
  ]);
  return reviewed ? "reviewed" : bought ? "can" : "not-bought";
}

export async function submitReview(session: Session, ctx: PricingContext, productId: string, input: ReviewInput) {
  const eligibility = await reviewEligibility(session, ctx, productId);
  if (eligibility === "reviewed") throw new ReviewError("You already reviewed this product.");
  if (eligibility === "not-bought") throw new ReviewError("Only customers who ordered this product can review it.");
  const customer = (await apiRoot.customers().withId({ ID: session.customerId }).get().execute()).body;
  try {
    await apiRoot
      .reviews()
      .post({
        body: {
          key: reviewKey(session.customerId, productId),
          target: { typeId: "product", id: productId },
          customer: { typeId: "customer", id: session.customerId },
          authorName: authorName(customer.firstName, customer.lastName),
          rating: input.rating,
          ...(input.title && { title: input.title }),
          text: input.text,
          locale: "en-US",
          state: { typeId: "state", key: REVIEW_STATES.pending },
        },
      })
      .execute();
  } catch (err) {
    if (statusOf(err) === 400 && JSON.stringify((err as { body?: unknown }).body).includes("DuplicateField")) {
      throw new ReviewError("You already reviewed this product.");
    }
    throw err;
  }
}
