// Prints the business unit → store → channel mapping the storefront uses (read-only).
import { getBuyingContexts } from "../src/features/business-units/service";

getBuyingContexts()
  .then((contexts) =>
    console.table(
      contexts.map(({ businessUnitKey, unitType, storeKey, channelKey, currency, country }) => ({
        businessUnitKey,
        unitType,
        storeKey,
        channelKey,
        currency,
        country,
      })),
    ),
  )
  .catch((err) => {
    console.error(err?.body ?? err);
    process.exit(1);
  });
