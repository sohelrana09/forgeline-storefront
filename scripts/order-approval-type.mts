// The Type behind an order's `approvalStatus` field, so an ERP or a warehouse can see that an order waits for approval
// without reading approval flows. Dry run without --yes.
//   npm run ct:order-approval-type [-- --yes]
import { apiRoot } from "../src/lib/commercetools/client";

const KEY = "order-approval";
const write = process.argv.includes("--yes");

const existing = await apiRoot
  .types()
  .withKey({ key: KEY })
  .get()
  .execute()
  .then((r) => r.body)
  .catch(() => undefined);

if (existing) console.log(`Type ${KEY} exists already (version ${existing.version}). Nothing to do.`);
else if (!write) console.log(`Would create Type ${KEY} for orders, with the field approvalStatus. Run again with --yes.`);
else {
  await apiRoot
    .types()
    .post({
      body: {
        key: KEY,
        name: { en: "Order approval" },
        resourceTypeIds: ["order"],
        fieldDefinitions: [
          { name: "approvalStatus", label: { en: "Approval status" }, type: { name: "String" }, required: false, inputHint: "SingleLine" },
        ],
      },
    })
    .execute();
  console.log(`Created Type ${KEY}.`);
}
