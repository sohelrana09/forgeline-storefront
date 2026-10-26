// Creates (or updates) the commercetools Subscription that tells the storefront to refresh its cached guest pages
// when prices, products, discounts, categories or content change in Merchant Center or through imports.
// Subscriptions can't call an HTTP URL: they deliver to a queue, which then POSTs to /api/revalidate.
// Setup of the queue side: docs/cache-refresh.md.
//   npm run ct:catalog-subscription                                   show the current subscription (dry run)
//   npm run ct:catalog-subscription -- --eventbridge <aws-account-id> [--yes]
//   npm run ct:catalog-subscription -- --pubsub <gcp-project>/<topic> [--yes]
// Idempotent: looked up by key; re-running with the same destination changes nothing.
import { isDeepStrictEqual } from "node:util";
import type { ChangeSubscription, Destination, SubscriptionUpdateAction } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";

const KEY = "storefront-cache-refresh";
const REGION = "us-east-2";
// Every create, update and delete of these resources. "changes" (not messages) need no Messages setting, and cover
// staged product edits too: those refresh the cache needlessly, which is harmless.
const CHANGES: ChangeSubscription[] = [
  { resourceTypeId: "standalone-price" },
  { resourceTypeId: "product" },
  { resourceTypeId: "product-discount" },
  { resourceTypeId: "category" },
  { resourceTypeId: "key-value-document" },
];

function destinationFromArgs(args: string[]): Destination | undefined {
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const account = value("--eventbridge");
  if (account) {
    if (!/^\d{12}$/.test(account)) throw new Error("--eventbridge needs the 12-digit AWS account id");
    // `source` is set by commercetools (the SDK type wrongly requires it on create).
    return { type: "EventBridge", region: REGION, accountId: account } as Destination;
  }
  const pubsub = value("--pubsub");
  if (pubsub) {
    const [projectId, topic] = pubsub.split("/");
    if (!projectId || !topic) throw new Error("--pubsub needs <gcp-project>/<topic>");
    return { type: "GoogleCloudPubSub", projectId, topic };
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const destination = destinationFromArgs(args);
  const current = await apiRoot
    .subscriptions()
    .withKey({ key: KEY })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => {
      if (err?.body?.statusCode === 404) return undefined;
      throw err;
    });

  console.log(current ? `Current: ${KEY} → ${JSON.stringify(current.destination)} (${current.status})` : `No subscription "${KEY}" yet.`);
  if (!destination) {
    console.log("Pass --eventbridge <aws-account-id> or --pubsub <gcp-project>/<topic> to create or change it.");
    return;
  }

  const actions: SubscriptionUpdateAction[] = [];
  // Compare only the fields we set: commercetools adds some (EventBridge `source`).
  const sameDestination = (d: Destination) =>
    Object.entries(destination).every(([k, v]) => isDeepStrictEqual((d as unknown as Record<string, unknown>)[k], v));
  if (current && !sameDestination(current.destination)) actions.push({ action: "changeDestination", destination });
  const typeIds = (changes: ChangeSubscription[]) => changes.map((c) => c.resourceTypeId).sort();
  if (current && !isDeepStrictEqual(typeIds(current.changes), typeIds(CHANGES))) actions.push({ action: "setChanges", changes: CHANGES });
  if (current && actions.length === 0) {
    console.log("= already up to date");
    return;
  }
  if (!args.includes("--yes")) {
    console.log(
      `Would ${current ? `update (${actions.map((a) => a.action).join(", ")})` : "create"} ${KEY} → ${JSON.stringify(destination)}. Re-run with --yes.`,
    );
    return;
  }
  if (current) {
    await apiRoot
      .subscriptions()
      .withKey({ key: KEY })
      .post({ body: { version: current.version, actions } })
      .execute();
    console.log(`~ ${KEY}: ${actions.map((a) => a.action).join(", ")}`);
  } else {
    // commercetools sends a test message on create, so the destination must already accept messages.
    await apiRoot
      .subscriptions()
      .post({ body: { key: KEY, destination, changes: CHANGES } })
      .execute();
    console.log(`+ ${KEY} → ${JSON.stringify(destination)}`);
  }
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
