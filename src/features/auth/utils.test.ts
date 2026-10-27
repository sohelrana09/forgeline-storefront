import { describe, expect, it } from "vitest";
import { KNOWN_DEVICES_MAX, loginLimits, rememberAccount } from "@/features/auth/utils";

describe("loginLimits", () => {
  it("limits address + email, email and address on an unknown device", () => {
    expect(loginLimits("1.2.3.4", "a@b.co", false).map((l) => l.key)).toEqual([
      "login:1.2.3.4:a@b.co",
      "login-email:a@b.co",
      "login-ip:1.2.3.4",
    ]);
  });

  it("skips the per-email limit on a device that signed in to the account before", () => {
    expect(loginLimits("1.2.3.4", "a@b.co", true).map((l) => l.key)).toEqual(["login:1.2.3.4:a@b.co", "login-ip:1.2.3.4"]);
  });

  it("has no per-address limit without a proxy", () => {
    expect(loginLimits("no-proxy", "a@b.co", false).map((l) => l.key)).toEqual(["login:no-proxy:a@b.co", "login-email:a@b.co"]);
  });
});

describe("rememberAccount", () => {
  it("puts the account first without duplicates", () => {
    expect(rememberAccount(["x@b.co", "a@b.co"], "a@b.co")).toEqual(["a@b.co", "x@b.co"]);
  });

  it(`keeps at most ${KNOWN_DEVICES_MAX} accounts`, () => {
    const many = Array.from({ length: 9 }, (_, i) => `u${i}@b.co`);
    expect(rememberAccount(many, "new@b.co")).toHaveLength(KNOWN_DEVICES_MAX);
  });
});
