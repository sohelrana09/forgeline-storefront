import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env";

const base = {
  CTP_PROJECT_KEY: "p",
  CTP_CLIENT_ID: "a",
  CTP_CLIENT_SECRET: "b",
  CTP_AUTH_URL: "https://auth",
  CTP_API_URL: "https://api",
  CTP_STOREFRONT_CLIENT_ID: "c",
  CTP_STOREFRONT_CLIENT_SECRET: "d",
  SITE_URL: "https://shop",
  SESSION_SECRET: "x".repeat(32),
};
const seller = {
  SELLER_NAME: "n",
  SELLER_VAT_ID: "v",
  SELLER_EMAIL: "e",
  SELLER_BANK_NAME: "b",
  SELLER_IBAN: "i",
  SELLER_BIC: "c",
  SELLER_ADDRESS: "a",
};

describe("checkEnv", () => {
  it("names what a production server can't start without", () => {
    expect(checkEnv({ ...base, SESSION_SECRET: undefined }).missing).toEqual(["SESSION_SECRET"]);
  });

  it("refuses demo seller details on a public site only", () => {
    expect(checkEnv(base).missing).toEqual([]);
    expect(checkEnv({ ...base, SITE_INDEXABLE: "true" }).missing).toContain("SELLER_IBAN");
    expect(checkEnv({ ...base, ...seller, SITE_INDEXABLE: "true" }).missing).toEqual([]);
  });

  it("reports what runs but is weaker than it looks", () => {
    const { degraded } = checkEnv(base);
    expect(degraded.some((d) => d.startsWith("no Redis"))).toBe(true);
    expect(degraded.some((d) => d.startsWith("CRON_SECRET"))).toBe(true);
    expect(degraded.some((d) => d.startsWith("BANK_TRANSFER_EXPIRY_DAYS"))).toBe(true);
  });
});
