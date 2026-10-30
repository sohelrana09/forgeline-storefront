// Sets the value of one standalone price, by key, keeping its currency and tiers. For quick checks such as "does a
// price change reach the storefront" (docs/cache-refresh.md); ERP-style bulk changes belong in an import.
//   npm run ct:price -- <price key>                  shows the price
//   npm run ct:price -- <price key> <cents>          dry run: shows the change
//   npm run ct:price -- <price key> <cents> --yes    changes it (retried once on 409)
// Idempotent: a price that already has the value is left alone.
import { apiRoot } from "../src/lib/commercetools/client";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const [key, cents] = args.filter((a) => !a.startsWith("--"));
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

const money = (centAmount: number, currency: string) => `${(centAmount / 100).toFixed(2)} ${currency}`;

async function main() {
  if (!key) throw new Error("Usage: npm run ct:price -- <price key> [<cents> [--yes]]");
  const wanted = cents === undefined ? undefined : Number(cents);
  if (wanted !== undefined && (!Number.isInteger(wanted) || wanted < 0)) throw new Error(`Not a whole number of cents: ${cents}`);

  for (let attempt = 1; ; attempt++) {
    const { body: price } = await apiRoot.standalonePrices().withKey({ key }).get().execute();
    const { centAmount, currencyCode } = price.value;
    console.log(`${key} (${price.sku}): ${money(centAmount, currencyCode)}, version ${price.version}`);
    if (wanted === undefined) return;
    if (wanted === centAmount) return console.log("unchanged");
    if (!yes) return console.log(`dry run: would set ${money(wanted, currencyCode)} (add --yes)`);
    try {
      const { body } = await apiRoot
        .standalonePrices()
        .withKey({ key })
        .post({
          body: { version: price.version, actions: [{ action: "changeValue", value: { currencyCode, centAmount: wanted } }] },
        })
        .execute();
      return console.log(`set ${money(body.value.centAmount, currencyCode)}, version ${body.version}`);
    } catch (err) {
      if (statusOf(err) !== 409 || attempt > 1) throw err;
    }
  }
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
