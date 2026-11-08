"use server";

// Public endpoint for writing a review: the switch, a signed-in customer, a rate limit, input checks, then the service
// (which checks the customer ordered the product, with their own token).

import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireShopContext } from "@/features/business-units/context";
import { getProductsByIds } from "@/features/catalog/service";
import { parseReview, reviewsEnabled } from "@/features/reviews/reviews";
import { ReviewError, submitReview } from "@/features/reviews/service";

export type ReviewFormState = { error?: string; saved?: string };

export async function submitReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  if (!reviewsEnabled()) return { error: "Reviews are not available." };
  const { session, context } = await requireShopContext();
  if (await tooManyAttempts(`review:${session.customerId}`, 10)) return { error: "Too many reviews. Please wait a few minutes." };
  const productId = String(formData.get("productId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(productId)) return { error: "The form is out of date. Please reload." };
  const parsed = parseReview({ rating: formData.get("rating"), title: formData.get("title"), text: formData.get("text") });
  if (!parsed.ok) return { error: parsed.error };
  try {
    // Only products this customer's store sells.
    if ((await getProductsByIds(context, [productId])).length === 0) return { error: "This product isn't sold to you." };
    await submitReview(session, context, productId, parsed.review);
    return { saved: "Thank you. Your review shows here once we have checked it." };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ReviewError) return { error: err.message };
    console.error("review failed", (err as { body?: unknown })?.body ?? err);
    return { error: "That didn't work. Please try again." };
  }
}
