import { describe, expect, it } from "vitest";
import { blogCategoryPath, formatPostDate, isUrlKey, listPath, pageNumber, postPath, tagCounts } from "@/features/blog/utils";

describe("blog URLs", () => {
  it("builds post, category, tag and paged list paths", () => {
    expect(postPath("filter-service-checklist")).toBe("/blog/filter-service-checklist");
    expect(blogCategoryPath("maintenance")).toBe("/blog/category/maintenance");
    expect(listPath({})).toBe("/blog");
    expect(listPath({}, 2)).toBe("/blog?page=2");
    expect(listPath({ category: "maintenance" }, 3)).toBe("/blog/category/maintenance?page=3");
    expect(listPath({ tag: "filters" })).toBe("/blog/tag/filters");
  });

  it("accepts only lowercase, hyphenated URL keys", () => {
    expect(isUrlKey("buying-guides")).toBe(true);
    expect(isUrlKey("Buying-Guides")).toBe(false);
    expect(isUrlKey("a--b")).toBe(false);
    expect(isUrlKey("../etc")).toBe(false);
    expect(isUrlKey("")).toBe(false);
  });

  it("reads page numbers defensively", () => {
    expect(pageNumber(undefined)).toBe(1);
    expect(pageNumber("2")).toBe(2);
    expect(pageNumber("0")).toBe(1);
    expect(pageNumber("-3")).toBe(1);
    expect(pageNumber("abc")).toBe(1);
    expect(pageNumber("99999")).toBe(1000);
  });
});

describe("tagCounts", () => {
  it("counts tags across posts, most used first, and drops malformed tags", () => {
    expect(
      tagCounts([
        ["filters", "service"],
        ["filters", "Bad Tag"],
        ["engines", "filters"],
      ]),
    ).toEqual([
      { tag: "filters", count: 3 },
      { tag: "engines", count: 1 },
      { tag: "service", count: 1 },
    ]);
  });
});

describe("formatPostDate", () => {
  it("formats in UTC so the date doesn't shift with the server's time zone", () => {
    expect(formatPostDate("2026-10-27T23:30:00Z")).toBe("27 October 2026");
  });
});
