// Demo personas (docs/features/demo-personas.md): puts the demo personas' data back, as the nightly cron does.
// Deletes their carts (shared carts too), quote requests with their staged quotes and quotes, purchase lists,
// recurring orders and the demo company's budgets, and rejects their pending approvals (which cancels those orders the
// storefront's way). Orders stay.
//   npm run ct:demo-reset                                   dry run: the personas' company and what would go
//   npm run ct:demo-reset -- --yes [--url http://localhost:3000]   asks the storefront to reset (its /api/cron/demo-reset,
//                                                           with CRON_SECRET; the site must run with DEMO_MODE=true)
// The reset itself runs in the storefront because cancelling an order goes through its order processing.
// Personas: DEMO_BUYER_EMAIL, DEMO_APPROVER_EMAIL, DEMO_ADMIN_EMAIL (default: the sample data's LiftTech accounts).
// Only for a company that exists for the demo: everything those three accounts made there goes.
import { demoEmails, planReset, summarizePlan } from "@/features/demo/demo";
import { readReset } from "@/features/demo/reset-data";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const { personas, input } = await readReset();
console.log(
  "personas:",
  Object.entries(demoEmails())
    .map(([role, email]) => `${role} ${email}`)
    .join(", "),
);
console.log("demo company units:", personas.units.join(", ") || "(none shared by all three)");
console.log(yes ? "resetting:" : "would reset:", JSON.stringify(summarizePlan(planReset(input))));

if (!yes) {
  console.log("Dry run. Add --yes to reset.");
} else {
  const site = option("url") ?? process.env.SITE_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set");
  const response = await fetch(new URL("/api/cron/demo-reset", site), { headers: { authorization: `Bearer ${secret}` } });
  console.log(response.status, await response.text());
  if (!response.ok) process.exitCode = 1;
}
