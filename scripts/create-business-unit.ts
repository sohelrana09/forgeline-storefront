// B2B step 1: a Company business unit with a customer linked as an associate.
// Usage: npm run ct:create-bu -- <company-key> <buyer-email>
import { apiRoot } from "../src/lib/commercetools/client";

async function main() {
  const [companyKey = "acme-corp", email = "buyer@acme.example"] = process.argv.slice(2);

  // Associate roles are project-wide; create a basic buyer role if it doesn't exist yet.
  const roleKey = "buyer";
  const existingRole = await apiRoot.associateRoles().withKey({ key: roleKey }).get().execute().catch(() => null);
  if (!existingRole) {
    await apiRoot
      .associateRoles()
      .post({
        body: {
          key: roleKey,
          name: "Buyer",
          buyerAssignable: true,
          permissions: [
            "CreateMyCarts",
            "UpdateMyCarts",
            "ViewMyCarts",
            "CreateMyOrdersFromMyCarts",
            "ViewMyOrders",
            "CreateMyQuoteRequestsFromMyCarts",
            "ViewMyQuoteRequests",
            "ViewMyQuotes",
            "AcceptMyQuotes",
            "DeclineMyQuotes",
          ],
        },
      })
      .execute();
    console.log(`Created associate role "${roleKey}"`);
  }

  const existingCustomer = (
    await apiRoot.customers().get({ queryArgs: { where: `email="${email}"` } }).execute()
  ).body.results[0];
  const customer =
    existingCustomer ??
    (
      await apiRoot
        .customers()
        .post({ body: { email, password: "ChangeMe123!", firstName: "Demo", lastName: "Buyer" } })
        .execute()
    ).body.customer;
  console.log(`Customer: ${customer.email} (${customer.id})`);

  const unit = (
    await apiRoot
      .businessUnits()
      .post({
        body: {
          key: companyKey,
          name: companyKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          unitType: "Company",
          associates: [
            {
              customer: { typeId: "customer", id: customer.id },
              associateRoleAssignments: [{ associateRole: { typeId: "associate-role", key: roleKey } }],
            },
          ],
        },
      })
      .execute()
  ).body;
  console.log(`Business unit: ${unit.name} [${unit.key}] with ${unit.associates.length} associate(s)`);
}

main().catch((err) => {
  console.error(JSON.stringify(err?.body ?? err, null, 2));
  process.exit(1);
});
