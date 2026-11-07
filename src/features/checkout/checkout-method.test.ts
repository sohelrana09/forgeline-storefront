import { describe, expect, it } from "vitest";
import { checkoutLookCss, flatMethodCss, methodOfValue } from "@/features/checkout/checkout-method";

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
    expect(css).toContain("{ display: none; }");
    // The method's body loses the indent kept for the hidden radio.
    expect(css).toContain('#pay[data-flat="card"] [data-ctc] section[data-testid="payment-step"] fieldset > div[data-test] { margin: 0; }');
  });
});

describe("checkoutLookCss", () => {
  it("gives Checkout's form the page font and the storefront's pay button, inside the scope only", () => {
    const css = checkoutLookCss("#pay");
    expect(css).toContain(
      '#pay [data-ctc], #pay [data-ctc] [data-testid="checkout"], #pay [data-ctc] [data-testid="checkout"] * { font-family: inherit; }',
    );
    expect(css).toContain('#pay [data-ctc] [data-testid="checkout"] button {');
    expect(css).toContain("text-transform: none");
    expect(css.split("\n").every((rule) => rule.startsWith("#pay "))).toBe(true);
  });
});
