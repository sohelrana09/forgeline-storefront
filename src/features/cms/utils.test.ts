import { afterEach, describe, expect, it, vi } from "vitest";
import { isBannerImage, isLive, safeHref, validBanners } from "@/features/cms/utils";
import type { CmsBlock } from "@/features/cms/types";

describe("safeHref", () => {
  it("allows site paths, https and mailto links", () => {
    expect(safeHref("/excavators")).toBe("/excavators");
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:sales@example.com")).toBe("mailto:sales@example.com");
  });

  it("refuses links that leave the site in disguise or run script", () => {
    expect(safeHref("//evil.example")).toBeUndefined();
    expect(safeHref("/\\evil.example")).toBeUndefined();
    expect(safeHref("/\t/evil.example")).toBeUndefined();
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("http://example.com")).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});

describe("banner pictures", () => {
  afterEach(() => vi.unstubAllEnvs());
  const sanity = "https://cdn.sanity.io/images/abc123/production/pic-1600x900.jpg";

  it("accepts this project's Sanity folder only", () => {
    vi.stubEnv("NEXT_SANITY_PROJECT_ID", "abc123");
    expect(isBannerImage(sanity)).toBe(true);
    expect(isBannerImage("https://images.us-east-2.aws.commercetools.com/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/a.jpg")).toBe(false);
  });

  it("refuses other Sanity projects and other hosts", () => {
    vi.stubEnv("NEXT_SANITY_PROJECT_ID", "abc123");
    expect(isBannerImage("https://cdn.sanity.io/images/other/production/pic.jpg")).toBe(false);
    expect(isBannerImage("https://evil.example/images/abc123/pic.jpg")).toBe(false);
    expect(isBannerImage("http://cdn.sanity.io/images/abc123/production/pic.jpg")).toBe(false);
  });

  it("accepts no Sanity picture without a project", () => {
    vi.stubEnv("NEXT_SANITY_PROJECT_ID", "");
    expect(isBannerImage(sanity)).toBe(false);
  });

  it("shows only banners with a headline and an allowed picture", () => {
    vi.stubEnv("NEXT_SANITY_PROJECT_ID", "abc123");
    const banner = (b: Partial<CmsBlock>) => ({ identifier: "x", active: true, placement: "home.hero", type: "banner", ...b }) as CmsBlock;
    expect(validBanners([banner({ headline: "Hi", image: sanity }), banner({ image: sanity }), banner({ headline: "Hi" })])).toHaveLength(
      1,
    );
  });
});

describe("isLive", () => {
  it("treats an empty date (null from Sanity) as no limit", () => expect(isLive({ startsAt: null, endsAt: null })).toBe(true));
  it("hides a block outside its dates", () => {
    expect(isLive({ startsAt: "2999-01-01T00:00:00Z" })).toBe(false);
    expect(isLive({ endsAt: "2000-01-01T00:00:00Z" })).toBe(false);
  });
});
