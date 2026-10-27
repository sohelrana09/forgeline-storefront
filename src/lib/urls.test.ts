import { describe, expect, it } from "vitest";
import { isLocalPath } from "@/lib/urls";

describe("isLocalPath", () => {
  it("accepts paths on this site", () => {
    expect(isLocalPath("/")).toBe(true);
    expect(isLocalPath("/excavators/wheeled-excavators?sort=price#top")).toBe(true);
  });

  it("refuses paths a browser reads as another site", () => {
    expect(isLocalPath("//evil.example")).toBe(false);
    expect(isLocalPath("/\\evil.example")).toBe(false);
    expect(isLocalPath("/\t/evil.example")).toBe(false);
    expect(isLocalPath("/\n/evil.example")).toBe(false);
    expect(isLocalPath("https://evil.example")).toBe(false);
    expect(isLocalPath("evil.example")).toBe(false);
  });
});
