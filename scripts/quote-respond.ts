// TEST HELPER, plays the seller: turns a buyer's quote request into a published quote (what a sales rep does in
// Merchant Center › Quotes). Sandbox only.
//   npm run ct:quote-respond -- <quoteRequestId> [--discount 10] [--valid-days 30] [--comment "text"]
// Idempotent: a request that already has a quote is reported, not quoted again; a half-done run resumes.
import { apiRoot, projectKey } from "../src/lib/commercetools/client";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  if (projectKey !== "ctwara" && !process.argv.includes("--force")) {
    throw new Error(`Refusing to create quotes in project "${projectKey}" (use --force)`);
  }
  const requestId = process.argv[2];
  if (!requestId || requestId.startsWith("--")) throw new Error("Usage: npm run ct:quote-respond -- <quoteRequestId> [--discount N] [--valid-days N] [--comment text]");
  const discount = Number(arg("discount") ?? 0);
  const validDays = Number(arg("valid-days") ?? 30);
  const comment = arg("comment") ?? (discount ? `Project discount of ${discount}% applied.` : "Thank you for your request.");
  if (!(discount >= 0 && discount < 100) || !(validDays > 0)) throw new Error("--discount must be 0–99, --valid-days > 0");

  const { body: request } = await apiRoot.quoteRequests().withId({ ID: requestId }).get().execute();
  const existing = (await apiRoot.quotes().get({ queryArgs: { where: `quoteRequest(id="${request.id}")`, limit: 1 } }).execute()).body.results[0];
  if (existing) {
    console.log(`= request ${request.id} already has quote ${existing.id} (${existing.quoteState}); nothing to do`);
    return;
  }
  // 1. Staged quote (the seller's draft; accepts the request). A rerun after a failed later step resumes with the
  // staged quote it already created instead of failing on the now-Accepted request.
  let staged = (await apiRoot.stagedQuotes().get({ queryArgs: { where: `quoteRequest(id="${request.id}")`, limit: 1 } }).execute()).body.results[0];
  if (staged) {
    console.log(`= resuming staged quote ${staged.id} (${staged.stagedQuoteState})`);
  } else {
    if (request.quoteRequestState !== "Submitted") throw new Error(`Request is ${request.quoteRequestState}, not Submitted`);
    ({ body: staged } = await apiRoot
      .stagedQuotes()
      .post({ body: { quoteRequest: { typeId: "quote-request", id: request.id }, quoteRequestVersion: request.version, quoteRequestStateToAccepted: true } })
      .execute());
    console.log(`+ staged quote ${staged.id}`);
  }

  // 2. Optional discount: fixed (external) line prices on the seller's quotation cart.
  if (discount > 0) {
    const { body: cart } = await apiRoot.carts().withId({ ID: staged.quotationCart.id }).get().execute();
    await apiRoot
      .carts()
      .withId({ ID: cart.id })
      .post({
        body: {
          version: cart.version,
          actions: cart.lineItems.map((l) => ({
            action: "setLineItemPrice" as const,
            lineItemId: l.id,
            externalPrice: {
              currencyCode: l.price.value.currencyCode,
              centAmount: Math.round((l.price.discounted?.value ?? l.price.value).centAmount * (1 - discount / 100)),
            },
          })),
        },
      })
      .execute();
    console.log(`~ quotation cart ${cart.id}: ${discount}% off ${cart.lineItems.length} line(s)`);
  }

  // 3. Validity and seller comment, then 4. publish as a Quote the buyer can act on.
  const validTo = new Date(Date.now() + validDays * 86_400_000).toISOString();
  ({ body: staged } = await apiRoot
    .stagedQuotes()
    .withId({ ID: staged.id })
    .post({ body: { version: staged.version, actions: [{ action: "setValidTo", validTo }, { action: "setSellerComment", sellerComment: comment }] } })
    .execute());
  const { body: quote } = await apiRoot
    .quotes()
    .post({ body: { stagedQuote: { typeId: "staged-quote", id: staged.id }, stagedQuoteVersion: staged.version, stagedQuoteStateToSent: true } })
    .execute();
  console.log(`+ quote ${quote.id}: ${quote.quoteState}, total ${quote.totalPrice.centAmount / 10 ** quote.totalPrice.fractionDigits} ${quote.totalPrice.currencyCode}, valid to ${validTo.slice(0, 10)}`);
}

main().catch((err) => {
  console.error(JSON.stringify(err?.body ?? err.message ?? err, null, 2));
  process.exit(1);
});
