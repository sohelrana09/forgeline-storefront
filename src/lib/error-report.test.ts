import { describe, expect, it } from "vitest";
import { errorReport } from "@/lib/error-report";

const context = { routerKind: "App Router", routePath: "/reset-password", routeType: "action" };

describe("errorReport", () => {
  it("never logs the query string (reset and invitation codes)", () => {
    const report = errorReport(new Error("boom"), { path: "/reset-password?token=secret123", method: "POST" }, context);
    expect(report.path).toBe("/reset-password");
    expect(JSON.stringify(report)).not.toContain("secret123");
  });

  it("keeps the useful part of a commercetools error", () => {
    const err = Object.assign(new Error("Conflict"), { body: { statusCode: 409, errors: [{ code: "ConcurrentModification" }] } });
    expect(errorReport(err, { path: "/cart", method: "POST" }, context)).toMatchObject({
      ctStatus: 409,
      ctCodes: ["ConcurrentModification"],
    });
  });

  it("copes with things thrown that aren't errors, and caps long messages", () => {
    expect(errorReport("plain", { path: "/", method: "GET" }, context)).toMatchObject({ error: "string", message: "plain" });
    expect(errorReport(new Error("x".repeat(2000)), { path: "/", method: "GET" }, context).message).toHaveLength(500);
  });
});
