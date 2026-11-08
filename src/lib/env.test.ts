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

  it("refuses a session key the cookies can't use", () => {
    expect(checkEnv({ ...base, SESSION_SECRET: "short" }).missing).toEqual(["SESSION_SECRET (at least 32 characters)"]);
    expect(checkEnv({ ...base, SESSION_SECRET_PREVIOUS: "short" }).missing).toEqual(["SESSION_SECRET_PREVIOUS (at least 32 characters)"]);
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
    expect(degraded.some((d) => d.endsWith("can't pay"))).toBe(true);
  });

  it("wants a bank-transfer expiry whenever bank transfer is offered", () => {
    const expiry = (env: Record<string, string>) =>
      checkEnv({ ...base, ...env }).degraded.some((d) => d.startsWith("BANK_TRANSFER_EXPIRY_DAYS"));
    expect(expiry({})).toBe(false);
    expect(expiry({ B2C_CARD_PAYMENTS: "true" })).toBe(false);
    expect(expiry({ B2C_BANK_TRANSFER: "true" })).toBe(true);
    expect(expiry({ B2C_CARD_PAYMENTS: "true", B2C_BANK_TRANSFER: "true" })).toBe(true);
  });

  it("says when consumers and guests have no way to pay", () => {
    const none = (env: Record<string, string>) => checkEnv({ ...base, ...env }).degraded.some((d) => d.endsWith("can't pay"));
    expect(none({})).toBe(true);
    expect(none({ B2C_CARD_PAYMENTS: "false", CHECKOUT_PAYPAL: "false", B2C_BANK_TRANSFER: "false" })).toBe(true);
    expect(none({ CHECKOUT_PAYPAL: "true" })).toBe(false);
    expect(none({ B2C_BANK_TRANSFER: "true" })).toBe(false);
  });
});
