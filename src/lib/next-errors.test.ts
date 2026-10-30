import { describe, expect, it } from "vitest";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { isRedirect } from "./next-errors";

const thrown = (fn: () => void) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
};

describe("isRedirect", () => {
  it("recognises redirect() the way Next itself does", () => {
    const err = thrown(() => redirect("/logout"));
    expect(isRedirectError(err)).toBe(true);
    expect(isRedirect(err)).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isRedirect(new Error("boom"))).toBe(false);
    expect(isRedirect({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(false);
    expect(isRedirect(null)).toBe(false);
    expect(isRedirect("NEXT_REDIRECT;")).toBe(false);
  });
});
