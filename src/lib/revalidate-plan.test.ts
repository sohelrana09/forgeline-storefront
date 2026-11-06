import { describe, expect, it } from "vitest";
import { planFor } from "@/lib/revalidate-plan";

const message = (typeId: string, extra = {}) => ({ resource: { typeId }, ...extra });

describe("planFor", () => {
  it("refreshes everything, at once, for an empty or unreadable body", () => {
    expect(planFor(undefined).tags).toContain("content");
    expect(planFor(undefined).debounced).toBe(false);
    expect(planFor({ message: { data: "%%%" } }).tags).toContain("content");
  });

  it("applies an explicit scope at once", () => {
    expect(planFor({ scope: "content" })).toEqual({ tags: ["content", "urls"], debounced: false, catalog: false });
  });

  it("expires only prices for a price message, debounced", () => {
    expect(planFor(message("standalone-price"))).toEqual({ tags: ["catalog"], debounced: true, catalog: true });
  });

  it("includes the URL index for products and categories", () => {
    expect(planFor(message("product")).tags).toEqual(["catalog", "urls"]);
    expect(planFor(message("category")).tags).toEqual(["categories", "urls", "catalog"]);
  });

  it("ignores Custom Objects other than redirects", () => {
    const of = (container: string) =>
      message("key-value-document", { resourceUserProvidedIdentifiers: { containerAndKey: { container } } });
    expect(planFor(of("url-rewrite")).tags).toEqual(["urls"]);
    expect(planFor(of("order-processing")).tags).toEqual([]);
    expect(planFor(message("key-value-document")).tags).toEqual(["urls"]);
  });

  it("reads the EventBridge and Pub/Sub wrappers", () => {
    expect(planFor({ detail: message("product") }).tags).toEqual(["catalog", "urls"]);
    const data = Buffer.from(JSON.stringify(message("category"))).toString("base64");
    expect(planFor({ message: { data } }).tags).toEqual(["categories", "urls", "catalog"]);
  });
});
