import { describe, expect, it } from "vitest";
import { routeOf, spanAttributes, spanName } from "./trace-attributes";

const api = (path: string) => new URL(`https://api.us-east-2.aws.commercetools.com${path}`);

describe("routeOf", () => {
  it("replaces ids, keys and the project key", () => {
    expect(routeOf("/ctwara/carts/0b4c5f3e-1d2a-4c3b-9e8f-112233445566", "ctwara")).toBe("/{project}/carts/{id}");
    expect(routeOf("/ctwara/in-store/key=us-big-customers/me/carts", "ctwara")).toBe("/{project}/in-store/key={key}/me/carts");
    expect(routeOf("/ctwara/as-associate/0b4c5f3e-1d2a-4c3b-9e8f-112233445566/in-business-unit/key=acme/orders", "ctwara")).toBe(
      "/{project}/as-associate/{id}/in-business-unit/key={key}/orders",
    );
  });

  it("hides long or numeric segments", () => {
    expect(routeOf(`/ctwara/customers/password-token=${"x".repeat(60)}`, "ctwara")).toBe("/{project}/customers/{value}");
    expect(routeOf("/ctwara/orders/order-number=12345", "ctwara")).toBe("/{project}/orders/order-number=12345");
  });
});

describe("spanName", () => {
  it("groups custom objects by kind, not by container or key", () => {
    expect(spanName("get", api("/ctwara/custom-objects/punchout-session/abc"), "ctwara")).toBe(
      "commercetools GET /{project}/custom-objects/{container}/{key}",
    );
  });
});

describe("spanAttributes", () => {
  it("records parameter names only, never their values", () => {
    const attrs = spanAttributes("GET", api('/ctwara/customers?where=email%3D"jane@example.com"&limit=1'), "ctwara");
    expect(attrs["commercetools.query_params"]).toBe("limit,where");
    expect(JSON.stringify(attrs)).not.toContain("jane");
    expect(attrs["url.template"]).toBe("/{project}/customers");
  });
});
