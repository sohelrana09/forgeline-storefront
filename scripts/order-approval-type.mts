// The one Type behind carts' and orders' custom fields (approval status, procurement fields and whatever later
// features add in src/lib/commercetools/order-type.ts), so an ERP or a warehouse can read them without the storefront.
// Creates the Type, or adds the fields it lacks; never removes or changes a field. Dry run without --yes.
//   npm run ct:order-approval-type [-- --yes]
import { apiRoot } from "../src/lib/commercetools/client";
import { missingOrderFields, ORDER_FIELDS, ORDER_TYPE_KEY as KEY } from "../src/lib/commercetools/order-type";

const write = process.argv.includes("--yes");

const existing = await apiRoot
  .types()
  .withKey({ key: KEY })
  .get()
  .execute()
  .then((r) => r.body)
  // Only "not found" means missing: a 403 (the client lacks view_types) must not look like a project without the Type.
  .catch((err) => {
    if (err?.statusCode === 404 || err?.body?.statusCode === 404) return undefined;
    console.error(err?.body ?? err);
    process.exit(1);
  });

if (!existing) {
  const names = ORDER_FIELDS.map((f) => f.definition.name).join(", ");
  if (!write) console.log(`Would create Type ${KEY} for carts and orders, with the fields ${names}. Run again with --yes.`);
  else {
    await apiRoot
      .types()
      .post({
        body: {
          key: KEY,
          name: { en: "Order approval and procurement" },
          resourceTypeIds: ["order"],
          fieldDefinitions: ORDER_FIELDS.map((f) => f.definition),
        },
      })
      .execute();
    console.log(`Created Type ${KEY} with ${names}.`);
  }
} else {
  if (!existing.resourceTypeIds.includes("order")) {
    console.error(`Type ${KEY} exists but isn't for orders (${existing.resourceTypeIds.join(", ")}). Fix it in Merchant Center.`);
    process.exit(1);
  }
  const missing = missingOrderFields(existing.fieldDefinitions.map((d) => d.name));
  if (missing.length === 0) console.log(`Type ${KEY} has every field already (version ${existing.version}). Nothing to do.`);
  else if (!write) console.log(`Would add to Type ${KEY}: ${missing.map((d) => d.name).join(", ")}. Run again with --yes.`);
  else {
    await apiRoot
      .types()
      .withKey({ key: KEY })
      .post({
        body: {
          version: existing.version,
          actions: missing.map((fieldDefinition) => ({ action: "addFieldDefinition" as const, fieldDefinition })),
        },
      })
      .execute();
    console.log(`Added to Type ${KEY}: ${missing.map((d) => d.name).join(", ")}.`);
  }
}
