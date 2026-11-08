import { dateLocale } from "@/lib/i18n";
import { Suspense } from "react";
import Link from "next/link";
import type { ProductProjection } from "@commercetools/platform-sdk";
import { currentBuyingContext } from "@/features/business-units/context";
import { ratingSummary } from "@/features/reviews/reviews";
import { getApprovedReviews, reviewEligibility } from "@/features/reviews/service";
import { ReviewForm } from "@/features/reviews/components/ReviewForm";

// Product page: the rating, approved reviews (shared by everyone) and, for a signed-in customer who ordered the
// product, the form (streamed separately: it reads the session).
export async function ProductReviews({ product }: { product: ProductProjection }) {
  const reviews = await getApprovedReviews(product.id);
  const summary = ratingSummary(product.reviewRatingStatistics);
  return (
    <section aria-labelledby="reviews" className="flex flex-col gap-4">
      <h2 id="reviews" className="m-0 text-xl font-semibold">
        Reviews
      </h2>
      {summary ? (
        <p className="m-0 text-sm">
          <span aria-hidden="true" className="text-orange-700">
            {summary.stars}
          </span>{" "}
          <span>
            {summary.average} out of 5, {summary.count} {summary.count === 1 ? "review" : "reviews"}
          </span>
        </p>
      ) : (
        <p className="m-0 text-sm text-gray-600">No reviews yet.</p>
      )}
      {reviews.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-md border border-gray-200 bg-white p-4 text-sm">
              <p className="m-0 font-semibold">
                <span aria-label={`${r.rating} out of 5 stars`} className="text-orange-700">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>{" "}
                {r.title}
              </p>
              <p className="m-0 mt-1 whitespace-pre-line text-gray-800">{r.text}</p>
              <p className="m-0 mt-2 text-xs text-gray-600">
                {r.author}, verified buyer,{" "}
                {new Date(r.createdAt).toLocaleDateString(dateLocale(), { dateStyle: "medium", timeZone: "UTC" })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Suspense fallback={null}>
        <WriteReview productId={product.id} />
      </Suspense>
    </section>
  );
}

async function WriteReview({ productId }: { productId: string }) {
  const current = await currentBuyingContext();
  if (!current?.session) {
    return (
      <p className="m-0 text-sm">
        <Link href="/login">Sign in</Link> to review a product you ordered.
      </p>
    );
  }
  const eligibility = await reviewEligibility(current.session, current.context, productId).catch(() => "not-bought" as const);
  if (eligibility === "reviewed") return <p className="m-0 text-sm text-gray-600">Thank you for your review.</p>;
  if (eligibility === "not-bought") return <p className="m-0 text-sm text-gray-600">Customers who ordered this product can review it.</p>;
  return (
    <details className="rounded-md border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Write a review</summary>
      <div className="mt-3">
        <ReviewForm productId={productId} />
      </div>
    </details>
  );
}
