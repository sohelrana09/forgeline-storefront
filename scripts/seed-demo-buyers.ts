// T2.1 / T13.7: give every business-unit associate (buyers, and with --all-roles also admins and approvers) the demo
// password (from .env.demo) so each role can sign in. Idempotent: an account whose demo password works is skipped.
import { apiRoot } from "../src/lib/commercetools/client";

async function main() {
  // This resets real customers' passwords: only ever on the sandbox project unless explicitly forced.
  if (process.env.CTP_PROJECT_KEY !== "ctwara" && !process.argv.includes("--force")) {
    throw new Error(`Refusing to reset buyer passwords in project "${process.env.CTP_PROJECT_KEY}" (use --force)`);
  }
  const password = process.env.DEMO_BUYER_PASSWORD;
  if (!password) throw new Error("DEMO_BUYER_PASSWORD missing (create .env.demo)");

  const { body: units } = await apiRoot.businessUnits().get({ queryArgs: { limit: 100 } }).execute();
  const allRoles = process.argv.includes("--all-roles");
  const buyerIds = new Set(
    units.results.flatMap((bu) =>
      bu.associates
        .filter((a) => allRoles || a.associateRoleAssignments.some((r) => r.associateRole.key === "buyer"))
        .map((a) => a.customer.id),
    ),
  );

  for (const id of buyerIds) {
    const customer = (await apiRoot.customers().withId({ ID: id }).get().execute()).body;
    const works = await apiRoot
      .login()
      .post({ body: { email: customer.email, password } })
      .execute()
      .then(() => true)
      .catch(() => false);
    if (works) {
      console.log(`= ${customer.email} (already set)`);
      continue;
    }
    const { body: token } = await apiRoot.customers().passwordToken().post({ body: { email: customer.email } }).execute();
    await apiRoot.customers().passwordReset().post({ body: { tokenValue: token.value, newPassword: password } }).execute();
    console.log(`+ ${customer.email} (password set)`);
  }
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
