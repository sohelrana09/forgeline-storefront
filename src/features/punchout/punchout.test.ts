import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CxmlError,
  MAX_BYTES,
  errorResponse,
  esc,
  orderMessage,
  parseSetupRequest,
  parseXml,
  setupResponse,
} from "@/features/punchout/cxml";
import { hashSecret, parseConfig, punchoutEnabled, returnUrlAllowed, verifySecret } from "@/features/punchout/config";
import { ociFields, parseOciSetup } from "@/features/punchout/oci";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseSetupRequest", () => {
  it("reads a PunchOutSetupRequest", () => {
    const r = parseSetupRequest(fixture("setup-request.xml"));
    expect(r).toMatchObject({
      payloadId: "1699999999.123@buyer.example",
      from: { domain: "NetworkID", identity: "LIFTTECH-ES" },
      to: { domain: "DUNS", identity: "FORGELINE" },
      sender: { domain: "NetworkID", identity: "LIFTTECH-ES", sharedSecret: "correct horse battery staple" },
      operation: "create",
      buyerCookie: "34234234ADFSDF234234",
      browserFormPost: "https://procurement.example.com/punchout/return?session=abc",
      email: "sofia-lopez@ltsl.com",
      name: "Sofía López",
    });
  });

  it("refuses external entities (XXE)", () => expect(() => parseSetupRequest(fixture("xxe.xml"))).toThrow(CxmlError));
  it("refuses entity expansion (billion laughs)", () =>
    expect(() => parseSetupRequest(fixture("billion-laughs.xml"))).toThrow(/internal subset/));
  it("refuses undeclared entities", () => expect(() => parseXml(fixture("undeclared-entity.xml"))).toThrow(CxmlError));
  it("refuses oversized, deep, malformed and foreign documents", () => {
    expect(() => parseXml(`<a>${"x".repeat(MAX_BYTES)}</a>`)).toThrow(/too large/);
    expect(() => parseXml("<a>".repeat(40) + "</a>".repeat(40))).toThrow(/too deep/);
    expect(() => parseXml("<a><b></a>")).toThrow(/Malformed/);
    expect(() => parseSetupRequest("<html/>")).toThrow(/Not a cXML/);
    expect(() => parseSetupRequest("<cXML><Header/></cXML>")).toThrow(/Not a PunchOutSetupRequest/);
  });
  it("needs a return URL and a buyer cookie", () => {
    const noUrl = fixture("setup-request.xml").replace(/<BrowserFormPost>[\s\S]*?<\/BrowserFormPost>/, "");
    expect(() => parseSetupRequest(noUrl)).toThrow(/BrowserFormPost/);
  });
});

describe("building cXML", () => {
  it("escapes text and drops characters XML can't carry", () =>
    expect(esc(`<a href="x">&'\u0001`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;"));
  it("answers the setup with the start page", () => {
    const xml = setupResponse("p1", "2026-11-08T10:00:00Z", "https://shop.example.com/api/punchout/start?t=a&b=c");
    expect(xml).toContain('<Status code="200" text="OK"/>');
    expect(xml).toContain("<URL>https://shop.example.com/api/punchout/start?t=a&amp;b=c</URL>");
    expect(parseXml(xml).name).toBe("cXML");
  });
  it("answers errors as cXML", () => expect(errorResponse("p", "t", 401, "Unauthorized <x>")).toContain('text="Unauthorized &lt;x&gt;"'));
  it("returns the cart as a PunchOutOrderMessage the parser reads back", () => {
    const xml = orderMessage({
      payloadId: "p2",
      timestamp: "2026-11-08T11:00:00Z",
      buyerCookie: "34234234ADFSDF234234",
      from: { domain: "DUNS", identity: "FORGELINE" },
      to: { domain: "NetworkID", identity: "LIFTTECH-ES" },
      currency: "EUR",
      total: "140.00",
      lines: [{ sku: "air-filter", name: "Air Filter & <seal>", quantity: 2, unitPrice: "70.00", lineId: "l1" }],
    });
    const root = parseXml(xml);
    const msg = root.children.find((c) => c.name === "Message")!.children[0];
    expect(msg.name).toBe("PunchOutOrderMessage");
    const item = msg.children.find((c) => c.name === "ItemIn")!;
    expect(item.attrs.quantity).toBe("2");
    expect(xml).toContain("Air Filter &amp; &lt;seal&gt;");
    expect(xml).toContain('<Money currency="EUR">140.00</Money>');
  });
});

describe("config", () => {
  const salt = "00112233445566778899aabbccddeeff";
  const config = { salt, secretHash: hashSecret("s3cret-value", salt) };
  it("verifies the shared secret in constant time and refuses the rest", () => {
    expect(verifySecret("s3cret-value", config)).toBe(true);
    expect(verifySecret("s3cret-valuE", config)).toBe(false);
    expect(verifySecret(undefined, config)).toBe(false);
    expect(verifySecret("s3cret-value", { salt, secretHash: "nope" })).toBe(false);
  });
  it("allows returns only to configured https hosts", () => {
    expect(returnUrlAllowed("https://procurement.example.com/x?y=1", ["procurement.example.com"])).toBe(true);
    expect(returnUrlAllowed("http://procurement.example.com/x", ["procurement.example.com"])).toBe(false);
    expect(returnUrlAllowed("https://evil.example.net/x", ["procurement.example.com"])).toBe(false);
    expect(returnUrlAllowed("https://u:p@procurement.example.com/x", ["procurement.example.com"])).toBe(false);
    expect(returnUrlAllowed("javascript:alert(1)", ["procurement.example.com"])).toBe(false);
  });
  it("validates stored configs", () => {
    const good = {
      unitKey: "u",
      domain: "NetworkID",
      identity: "X",
      customerId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      salt,
      secretHash: config.secretHash,
      returnHosts: ["procurement.example.com"],
      formats: ["cxml"],
      supplier: { domain: "DUNS", identity: "FORGELINE" },
    };
    expect(parseConfig(good)).toEqual(good);
    expect(parseConfig({ ...good, returnHosts: ["https://x"] })).toBeUndefined();
    expect(parseConfig({ ...good, formats: ["edi"] })).toBeUndefined();
    expect(punchoutEnabled({})).toBe(false);
  });
});

describe("OCI", () => {
  it("builds 1-based NEW_ITEM fields with OCI lengths", () => {
    const fields = Object.fromEntries(
      ociFields([{ sku: "air-filter", name: "A".repeat(50), quantity: 3, unitPrice: "70.00", currency: "EUR", lineId: "l1" }], {
        target: "_top",
      }),
    );
    expect(fields["NEW_ITEM-DESCRIPTION[1]"]).toHaveLength(40);
    expect(fields["NEW_ITEM-QUANTITY[1]"]).toBe("3");
    expect(fields["NEW_ITEM-VENDORMAT[1]"]).toBe("air-filter");
    expect(fields["~TARGET"]).toBe("_top");
    expect(fields["~OKCODE"]).toBe("ADDI");
  });
  it("reads the setup call", () => {
    expect(parseOciSetup(new URLSearchParams("HOOK_URL=https%3A%2F%2Fsrm.example.com%2Fhook&USERNAME=X&PASSWORD=p&~TARGET=_top"))).toEqual({
      hookUrl: "https://srm.example.com/hook",
      username: "X",
      password: "p",
      target: "_top",
      caller: undefined,
    });
  });
});
