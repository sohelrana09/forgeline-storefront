// Creates (or updates) the commercetools Subscription that runs the storefront's after-order steps (order number, and
// later the Payment and the confirmation email) for every new order, however it was created, even when the buyer's
// browser never came back after paying. Subscriptions deliver to a queue, which then POSTs to /api/order-events with
// `Authorization: Bearer <ORDER_EVENTS_SECRET>`. Setup of the queue side: docs/checkout-setup.md.
//   npm run ct:order-subscription                                   show the current subscription (dry run)
//   npm run ct:order-subscription -- --eventbridge <aws-account-id> [--yes]
//   npm run ct:order-subscription -- --pubsub <gcp-project>/<topic> [--yes]
// Idempotent: looked up by key; re-running with the same destination changes nothing.
import { isDeepStrictEqual } from "node:util";
import type { Destination, MessageSubscription, SubscriptionUpdateAction } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { destinationFromArgs } from "./subscription-destination";

const KEY = "storefront-order-events";
// Messages (not changes): they say what happened. They need Messages switched on in the project settings.
const MESSAGES: MessageSubscription[] = [
  { resourceTypeId: "order", types: ["OrderCreated", "OrderPaymentStateChanged"] },
  { resourceTypeId: "payment", types: ["PaymentTransactionAdded", "PaymentTransactionStateChanged"] },
];

const normalized = (messages: MessageSubscription[]) =>
  messages
    .map((m) => ({ resourceTypeId: m.resourceTypeId, types: [...(m.types ?? [])].sort() }))
    .sort((a, b) => a.resourceTypeId.localeCompare(b.resourceTypeId));

async function main() {
  const args = process.argv.slice(2);
  const destination = destinationFromArgs(args);
  const [{ body: project }, current] = await Promise.all([
    apiRoot.get().execute(),
    apiRoot
      .subscriptions()
      .withKey({ key: KEY })
      .get()
      .execute()
      .then((r) => r.body)
      .catch((err) => {
        if (err?.body?.statusCode === 404) return undefined;
        throw err;
      }),
  ]);

  if (!project.messages.enabled) {
    console.log("! Messages are switched off in this project (Merchant Center → Settings → Project settings → Miscellaneous).");
    console.log("  Without them the Subscription delivers nothing; orders are still processed by the server actions and the sweep.");
  }
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
  if (current && !isDeepStrictEqual(normalized(current.messages), normalized(MESSAGES)))
    actions.push({ action: "setMessages", messages: MESSAGES });
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
      .post({ body: { key: KEY, destination, messages: MESSAGES } })
      .execute();
    console.log(`+ ${KEY} → ${JSON.stringify(destination)}`);
  }
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
