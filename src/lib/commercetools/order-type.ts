import type { CartUpdateAction, FieldDefinition } from "@commercetools/platform-sdk";

// The one Type carts and orders carry (commercetools allows one per resource). Every feature that stores a field on a
// cart or an order adds it here, never in a Type of its own; `npm run ct:order-approval-type` creates the Type or adds
// the fields it lacks. The resource type "order" covers carts and orders, and a cart's fields move to its order.
// Pure (no imports at run time), so the script and the tests read the same list.
export const ORDER_TYPE_KEY = "order-approval";

const text = (name: string, label: string, multiLine = false): FieldDefinition => ({
  name,
  label: { en: label },
  type: { name: "String" },
  required: false,
  inputHint: multiLine ? "MultiLine" : "SingleLine",
});

export const ORDER_FIELDS: { feature: string; definition: FieldDefinition }[] = [
  { feature: "approvals", definition: text("approvalStatus", "Approval status") },
  { feature: "procurement-checkout", definition: text("costCentre", "Cost centre") },
  { feature: "procurement-checkout", definition: text("projectCode", "Project code") },
  {
    feature: "procurement-checkout",
    definition: { name: "requestedDeliveryDate", label: { en: "Requested delivery date" }, type: { name: "Date" }, required: false },
  },
  { feature: "procurement-checkout", definition: text("orderNote", "Order note", true) },
  { feature: "shared-carts", definition: text("sharedWith", "Shared with (customer id)") },
  { feature: "shared-carts", definition: text("sharedBy", "Shared by (customer id)") },
  { feature: "shared-carts", definition: text("sharedAt", "Shared at") },
  { feature: "shared-carts", definition: text("shareNote", "Note to the reviewer", true) },
];

// The field definitions a Type with these field names still needs.
export function missingOrderFields(existing: string[]): FieldDefinition[] {
  const has = new Set(existing);
  return ORDER_FIELDS.map((f) => f.definition).filter((d) => !has.has(d.name));
}

// Cart updates that set `next` (string fields of the one Type; undefined removes a field): setCustomType on a cart
// without a Type, else one setCustomField per changed field. A cart's Type is always ORDER_TYPE_KEY: the storefront
// sets no other, and the runtime client can't read Types to check.
export function customFieldActions(
  custom: { fields: Record<string, unknown> } | undefined,
  next: Record<string, string | undefined>,
): CartUpdateAction[] {
  if (!custom) {
    const fields = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== ""));
    return Object.keys(fields).length === 0 ? [] : [{ action: "setCustomType", type: { typeId: "type", key: ORDER_TYPE_KEY }, fields }];
  }
  return Object.entries(next)
    .map(([name, v]) => [name, v === "" ? undefined : v] as const)
    .filter(([name, v]) => (custom.fields[name] ?? undefined) !== v)
    .map(([name, value]) => ({ action: "setCustomField" as const, name, value }));
}
