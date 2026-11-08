// Product reviews (docs/features/b2c-engagement.md), pure and unit-tested. Signed-in customers who bought the product
// write one review per product; it starts in the state review-pending and shows once a merchant moves it to
// review-approved in Merchant Center (that state carries the ReviewIncludedInStatistics role, so only approved reviews
// count towards the product's rating).

export const reviewsEnabled = (env: Record<string, string | undefined> = process.env) => env.REVIEWS === "true";

export const REVIEW_STATES = { pending: "review-pending", approved: "review-approved" } as const;
export const TITLE_MAX = 100;
export const TEXT_MIN = 10;
export const TEXT_MAX = 2000;

export type ReviewInput = { rating: number; title: string; text: string };

const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

export function parseReview(input: {
  rating?: unknown;
  title?: unknown;
  text?: unknown;
}): { ok: true; review: ReviewInput } | { ok: false; error: string } {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  const title = clean(input.title);
  const text = clean(input.text);
  if (title.length > TITLE_MAX) return { ok: false, error: `Keep the title under ${TITLE_MAX} characters.` };
  if (text.length < TEXT_MIN) return { ok: false, error: `Tell other buyers a little more (at least ${TEXT_MIN} characters).` };
  if (text.length > TEXT_MAX) return { ok: false, error: `Keep the review under ${TEXT_MAX} characters.` };
  return { ok: true, review: { rating, title, text } };
}

// One review per customer and product: the key makes a second one fail with a duplicate.
export const reviewKey = (customerId: string, productId: string) => `review-${customerId}-${productId}`;

// "Sofía L." from the profile: never the full surname or the email.
export function authorName(first?: string, last?: string): string {
  const f = clean(first).split(/\s+/)[0];
  const l = clean(last).charAt(0);
  return f ? `${f}${l ? ` ${l.toUpperCase()}.` : ""}` : "Verified buyer";
}

export type RatingSummary = { average: number; count: number; stars: string };

export function ratingSummary(stats: { averageRating: number; count: number } | undefined): RatingSummary | undefined {
  if (!stats || stats.count === 0) return undefined;
  const average = Math.round(stats.averageRating * 10) / 10;
  const full = Math.round(average);
  return { average, count: stats.count, stars: "★".repeat(full) + "☆".repeat(5 - full) };
}
