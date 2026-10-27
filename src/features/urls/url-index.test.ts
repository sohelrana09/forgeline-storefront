import { describe, expect, it } from "vitest";
import { buildUrlIndex, resolvePath, type UrlSources } from "@/features/urls/url-index";
import { categoryPath, normalizePath, productPath, urlKey } from "@/lib/urls";

const sources: UrlSources = {
  categories: [
    { id: "c1", trail: ["excavators"] },
    { id: "c2", trail: ["excavators", "wheeled_excavators"] },
    { id: "c3", trail: ["spare_parts"] },
  ],
  products: [{ slug: "jj234-wx" }, { slug: "air_filter" }],
  pages: [{ slug: "delivery-information" }],
  rewrites: [{ from: "/old-hose", to: "/hydraulic-hose", permanent: true }],
};
const index = buildUrlIndex(sources);

describe("URL helpers", () => {
  it("turns slugs into lowercase, hyphenated URL keys and paths", () => {
    expect(urlKey("High_Capacity_Loaders")).toBe("high-capacity-loaders");
    expect(categoryPath(["excavators", "wheeled_excavators"])).toBe("/excavators/wheeled-excavators");
    expect(productPath("jj234-wx", "jj234-wx-2019")).toBe("/jj234-wx?sku=jj234-wx-2019");
    expect(normalizePath("//Excavators//Wheeled-Excavators/")).toBe("/excavators/wheeled-excavators");
  });
});

describe("resolvePath", () => {
  it("finds categories by their full path, products and pages at the root", () => {
    expect(resolvePath(index, "/excavators/wheeled-excavators")).toEqual({ kind: "category", id: "c2", slug: "wheeled_excavators" });
    expect(resolvePath(index, "/air-filter")).toEqual({ kind: "product", slug: "air_filter" });
    expect(resolvePath(index, "/delivery-information")).toEqual({ kind: "page", slug: "delivery-information" });
    expect(resolvePath(index, "/no-such-thing")).toEqual({ kind: "missing" });
  });

  it("redirects every old address permanently, keeping the query string", () => {
    expect(resolvePath(index, "/c/wheeled_excavators", "mobility=tracked")).toEqual({
      kind: "redirect",
      to: "/excavators/wheeled-excavators?mobility=tracked",
      permanent: true,
    });
    expect(resolvePath(index, "/p/jj234-wx", "sku=jj234-wx-2019")).toEqual({
      kind: "redirect",
      to: "/jj234-wx?sku=jj234-wx-2019",
      permanent: true,
    });
    expect(resolvePath(index, "/pages/delivery-information")).toMatchObject({ to: "/delivery-information" });
    expect(resolvePath(index, "/spare_parts")).toMatchObject({ to: "/spare-parts" });
    expect(resolvePath(index, "/air_filter")).toMatchObject({ to: "/air-filter" });
  });

  it("redirects other spellings of a URL to the canonical one", () => {
    expect(resolvePath(index, "/Excavators/Wheeled-Excavators/")).toEqual({
      kind: "redirect",
      to: "/excavators/wheeled-excavators",
      permanent: true,
    });
  });

  it("applies merchants' redirects first", () => {
    expect(resolvePath(index, "/old-hose")).toEqual({ kind: "redirect", to: "/hydraulic-hose", permanent: true });
  });
});

describe("buildUrlIndex", () => {
  it("reports clashes and app paths instead of shadowing them", () => {
    const { conflicts } = buildUrlIndex({
      categories: [
        { id: "c1", trail: ["cart"] },
        { id: "c2", trail: ["filters"] },
      ],
      products: [{ slug: "filters" }],
      pages: [],
      rewrites: [],
    });
    expect(conflicts).toEqual([
      { path: "/cart", wanted: "category cart", reason: "reserved for the app" },
      { path: "/filters", wanted: "product filters", reason: "already used by category filters" },
    ]);
  });
});
