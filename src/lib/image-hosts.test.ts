import { describe, expect, it } from "vitest";
import { imagePattern, productImagesBase, SAMPLE_IMAGES_BASE } from "@/lib/image-hosts";

describe("productImagesBase", () => {
  it("falls back to the demo project's folder", () => {
    expect(productImagesBase(undefined)).toBe("https://images.us-east-2.aws.commercetools.com/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/");
    expect(productImagesBase("  ")).toBe(productImagesBase(undefined));
  });

  it("takes another project's folder, with or without the trailing slash", () => {
    expect(productImagesBase("https://images.europe-west1.gcp.commercetools.com/abc")).toBe(
      "https://images.europe-west1.gcp.commercetools.com/abc/",
    );
    expect(productImagesBase("https://images.europe-west1.gcp.commercetools.com/abc//")).toBe(
      "https://images.europe-west1.gcp.commercetools.com/abc/",
    );
  });

  it("refuses values that would open the optimizer to a whole host or to http", () => {
    expect(() => productImagesBase("https://images.us-east-2.aws.commercetools.com/")).toThrow();
    expect(() => productImagesBase("http://images.example.com/abc")).toThrow();
    expect(() => productImagesBase("not a url")).toThrow();
    expect(() => productImagesBase("https://images.example.com/abc?x=1")).toThrow();
  });
});

describe("imagePattern", () => {
  it("allows only the folder", () => {
    expect(imagePattern("https://images.example.com/abc/")).toEqual({
      protocol: "https",
      hostname: "images.example.com",
      pathname: "/abc/**",
    });
    expect(imagePattern(SAMPLE_IMAGES_BASE)).toEqual({
      protocol: "https",
      hostname: "storage.googleapis.com",
      pathname: "/merchant-center-europe/**",
    });
  });
});
