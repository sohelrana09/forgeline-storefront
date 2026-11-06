import { describe, expect, it } from "vitest";
import { signSanityBody, validSanitySignature } from "@/lib/sanity/webhook-signature";

const NOW = 1_800_000_000_000;
const header = (t: number, body = "{}", secret = "s3cret") => `t=${t},v1=${signSanityBody(secret, t, body)}`;

describe("validSanitySignature", () => {
  it("accepts a fresh, correctly signed body", () => expect(validSanitySignature(header(NOW), "{}", "s3cret", NOW)).toBe(true));
  it("refuses another body", () => expect(validSanitySignature(header(NOW), '{"scope":"all"}', "s3cret", NOW)).toBe(false));
  it("refuses another secret", () => expect(validSanitySignature(header(NOW, "{}", "other"), "{}", "s3cret", NOW)).toBe(false));
  it("refuses a replay after five minutes", () => expect(validSanitySignature(header(NOW - 301_000), "{}", "s3cret", NOW)).toBe(false));
  it("refuses a malformed header", () => {
    expect(validSanitySignature("", "{}", "s3cret", NOW)).toBe(false);
    expect(validSanitySignature("t=abc,v1=x", "{}", "s3cret", NOW)).toBe(false);
  });
});
