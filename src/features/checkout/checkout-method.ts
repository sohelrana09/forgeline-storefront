// One flat list of payment methods: the storefront's radios choose PayPal or card, and commercetools
// Checkout, which always lists every active method of the Application, is made to show only that one. Neither its
// session nor its browser SDK can limit the methods, so this works on Checkout's own markup, read on 7 November 2026:
//   section[data-testid=payment-step] > fieldset > legend
//   section[data-testid=payment-step] > fieldset > div[data-test="<method>-<connector deployment id>"] > label (radio
//     input[name=payment-selector-list][value="<method>-<connector deployment id>"] and the method's name), then the
//     method's body (card fields, PayPal note)
// The pay button is rendered outside that section, for the method selected there. Pure, unit-tested.
//
// Hiding applies only once Checkout's radio for the chosen method has been found and selected (`data-flat`), so when
// Checkout changes its markup the buyer simply sees Checkout's own list again, and payments still work.

export type CheckoutMethod = "card" | "paypal";

export const CHECKOUT_RADIO = 'input[type="radio"][name="payment-selector-list"]';

const UUID = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "paypal-39f766eb-…" → "paypal"; anything else → undefined.
export function methodOfValue(value: string): string | undefined {
  if (!UUID.test(value)) return undefined;
  const method = value.replace(UUID, "");
  return method || undefined;
}

// The style that hides Checkout's list around the chosen method, and drops the indent and margins its body keeps for
// the hidden radio. Selectors only use the fixed method names above.
export function flatMethodCss(scope: string, method: CheckoutMethod): string {
  const list = `${scope}[data-flat="${method}"] [data-ctc] section[data-testid="payment-step"] fieldset`;
  const hidden = [`${list} > legend`, `${list} > div[data-test] > label`, `${list} > div[data-test]:not([data-test^="${method}-"])`]
    .join(",\n")
    .concat(" { display: none; }");
  return [
    hidden,
    `${list} { margin: 0; }`,
    `${list} > div[data-test] { margin: 0; }`,
    `${list} > div[data-test] > div { margin: 0; }`,
  ].join("\n");
}

// Checkout's form in the storefront's look: the page's font, and its pay button like the storefront's own (orange,
// semibold, 48 px). Checkout's class names are generated, so this holds on to its data-testid and plain elements; if
// they change, Checkout keeps its own look. PayPal's button is an iframe and isn't touched.
export function checkoutLookCss(scope: string): string {
  const root = `${scope} [data-ctc] [data-testid="checkout"]`;
  return [
    // Checkout sets Roboto on its container and on elements inside its form, so all of them inherit the page font.
    `${scope} [data-ctc], ${root}, ${root} * { font-family: inherit; }`,
    `${root} button { font-size: 1rem; font-weight: 600; text-transform: none; letter-spacing: normal; min-height: 3rem; border-radius: 0.25rem; background-color: #c2410c; color: #fff; box-shadow: none; }`,
    // The card connector writes its label in capitals ("PAY WITH CREDIT CARD"): shown in sentence case, like ours.
    `${root} button > span { display: inline-block; text-transform: lowercase; }`,
    `${root} button > span::first-letter { text-transform: uppercase; }`,
    `${root} button:hover:not(:disabled) { background-color: #9a3412; }`,
    `${root} button:disabled { opacity: 0.6; }`,
    // The card connector's form keeps a narrow maximum width: its fields span the payment box instead.
    `${root} form { max-width: none; }`,
    `${root} form > div:last-child, ${root} form > div:last-child > div > div { margin-bottom: 0; }`,
    // Expiry and CVV side by side: on phones "Security code (CVV)" wraps, so the fields line up at the bottom.
    `${root} form .grid { align-items: end; }`,
  ].join("\n");
}

// What shows that the chosen method's form is there: the card fields' frames (Braintree's hosted fields) in the card
// method's body, or PayPal's button frame, which Checkout renders where its pay button goes.
export function methodReadySelector(method: CheckoutMethod): string {
  return method === "card"
    ? 'section[data-testid="payment-step"] div[data-test^="card-"] iframe'
    : 'iframe[name^="__zoid__paypal_buttons"]';
}

// Keeps Checkout's form out of sight while it builds up (its list, empty fields, a pay button without fields), until
// the scope gets `data-shown`. It still lays out at full width, so the frames inside load and size normally.
export function buildingCss(scope: string): string {
  return `${scope}:not([data-shown]) [data-ctc] { height: 0; overflow: hidden; visibility: hidden; }`;
}

// Checkout's own pay button (the card method's; PayPal's is a frame, whose clicks the page never sees).
export const CHECKOUT_PAY_BUTTON = '[data-testid="checkout"] button';

// Selects the chosen method among Checkout's radios. Returns whether Checkout offers it (and it is now selected).
export function pickCheckoutMethod(root: ParentNode, method: CheckoutMethod): boolean {
  const radio = [...root.querySelectorAll<HTMLInputElement>(CHECKOUT_RADIO)].find((r) => methodOfValue(r.value) === method);
  if (!radio) return false;
  if (!radio.checked) radio.click();
  return true;
}
