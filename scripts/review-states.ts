// Review moderation states (docs/features/b2c-engagement.md): review-pending (initial) → review-approved, which carries
// the ReviewIncludedInStatistics role, so only approved reviews count towards a product's rating and show on the
// product page. Merchants move reviews in Merchant Center (Customers → Reviews).
//   npm run ct:review-states            dry run
//   npm run ct:review-states -- --yes   creates the missing states and the transition
// Idempotent. Needs manage_states (Merchant Center or an admin client); the storefront needs view_states and manage_reviews.
import type { StateDraft } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { REVIEW_STATES } from "../src/features/reviews/reviews";

const yes = process.argv.includes("--yes");
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

const DRAFTS: StateDraft[] = [
  {
    key: REVIEW_STATES.approved,
    type: "ReviewState",
    initial: false,
    name: { "en-US": "Approved" },
    roles: ["ReviewIncludedInStatistics"],
  },
  {
    key: REVIEW_STATES.pending,
    type: "ReviewState",
    initial: true,
    name: { "en-US": "Waiting for approval" },
    transitions: [{ typeId: "state", key: REVIEW_STATES.approved }],
  },
];

async function main() {
  for (const draft of DRAFTS) {
    const existing = await apiRoot
      .states()
      .withKey({ key: draft.key })
      .get()
      .execute()
      .then((r) => r.body)
      .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
    if (existing) {
      console.log(`= ${draft.key} exists`);
      continue;
    }
    if (!yes) {
      console.log(`+ would create ${draft.key}`);
      continue;
    }
    await apiRoot.states().post({ body: draft }).execute();
    console.log(`+ created ${draft.key}`);
  }
  if (!yes) console.log("Dry run: add --yes to apply.");
}

main().catch((err) => {
  console.error((err as { body?: { message?: string } })?.body?.message ?? (err as Error).message);
  process.exit(1);
});
