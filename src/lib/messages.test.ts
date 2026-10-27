import { describe, expect, it } from "vitest";
import { parseMessages, serializeMessages } from "@/lib/messages";

describe("parseMessages", () => {
  it("reads messages with an optional link on this site", () => {
    const messages = [
      { type: "success" as const, text: "You added Air Filter to your shopping cart.", link: { href: "/cart", label: "View cart" } },
      { type: "error" as const, text: "Email or password is incorrect." },
    ];
    expect(parseMessages(serializeMessages(messages))).toEqual(messages);
  });

  it("drops messages with an unknown type, an off-site link or a malformed value", () => {
    const json = JSON.stringify([
      { type: "info", text: "x" },
      { type: "success", text: "x", link: { href: "//evil.example", label: "Go" } },
      { type: "success", text: "x", link: { href: "https://evil.example", label: "Go" } },
      { type: "success", text: "x", link: "/cart" },
      { type: "warning", text: "kept" },
    ]);
    expect(parseMessages(json)).toEqual([{ type: "warning", text: "kept" }]);
    expect(parseMessages("not json")).toEqual([]);
  });
});
