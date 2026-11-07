import { describe, expect, it } from "vitest";
import { flatMethodCss, methodOfValue } from "@/features/checkout/checkout-method";

describe("methodOfValue", () => {
  it("reads the method from Checkout's radio value", () => {
    expect(methodOfValue("paypal-39f766eb-15c2-4427-8bff-b845de07250a")).toBe("paypal");
    expect(methodOfValue("card-dd7ad399-2654-4912-97da-38921f6bf3cb")).toBe("card");
    expect(methodOfValue("klarna_paynow-dd7ad399-2654-4912-97da-38921f6bf3cb")).toBe("klarna_paynow");
  });

  it("ignores values without a connector id", () => {
    expect(methodOfValue("paypal")).toBeUndefined();
    expect(methodOfValue("-dd7ad399-2654-4912-97da-38921f6bf3cb")).toBeUndefined();
    expect(methodOfValue("")).toBeUndefined();
  });
});

describe("flatMethodCss", () => {
  it("hides Checkout's legend, method headers and the other methods, only when picked", () => {
    const css = flatMethodCss("#pay", "card");
    expect(css).toContain('#pay[data-flat="card"] [data-ctc] section[data-testid="payment-step"] fieldset > legend');
    expect(css).toContain("> div[data-test] > label");
    expect(css).toContain(':not([data-test^="card-"])');
    expect(css.endsWith("{ display: none; }")).toBe(true);
  });
});
