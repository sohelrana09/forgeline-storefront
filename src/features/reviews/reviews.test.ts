import { describe, expect, it } from "vitest";
import { authorName, parseReview, ratingSummary, reviewKey, reviewsEnabled } from "@/features/reviews/reviews";

describe("parseReview", () => {
  it("accepts a whole 1-5 rating with a short text, cleaned", () => {
    expect(parseReview({ rating: "4", title: " Solid\u0007 ", text: "Fitted in ten minutes." })).toEqual({
      ok: true,
      review: { rating: 4, title: "Solid", text: "Fitted in ten minutes." },
    });
  });
  it("refuses bad ratings and too short or long texts", () => {
    expect(parseReview({ rating: "6", text: "long enough text" }).ok).toBe(false);
    expect(parseReview({ rating: "2.5", text: "long enough text" }).ok).toBe(false);
    expect(parseReview({ rating: "3", text: "short" }).ok).toBe(false);
    expect(parseReview({ rating: "3", text: "x".repeat(2001) }).ok).toBe(false);
    expect(parseReview({ rating: "3", title: "t".repeat(101), text: "long enough text" }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("shows a first name and initial only", () => {
    expect(authorName("Sofía María", "lópez")).toBe("Sofía L.");
    expect(authorName(undefined, "X")).toBe("Verified buyer");
  });
  it("keys one review per customer and product", () => expect(reviewKey("c", "p")).toBe("review-c-p"));
  it("summarizes the rating", () => {
    expect(ratingSummary({ averageRating: 4.26, count: 3 })).toEqual({ average: 4.3, count: 3, stars: "★★★★☆" });
    expect(ratingSummary({ averageRating: 0, count: 0 })).toBeUndefined();
  });
  it("is off by default", () => expect(reviewsEnabled({})).toBe(false));
});
