import type { CartUpdateAction, CustomFields } from "@commercetools/platform-sdk";
import { customFieldActions } from "@/lib/commercetools/order-type";

// Procurement fields at business checkout (cost centre, project code, requested delivery date, order note), stored as
// cart custom fields of the one cart/order Type (src/lib/commercetools/order-type.ts) and carried to the order.
// Pure, unit-tested. Switched on with PROCUREMENT_FIELDS=true once `npm run ct:order-approval-type -- --yes` has
// added the fields (without them commercetools refuses the update).

export type Procurement = {
  costCentre?: string;
  projectCode?: string;
  // YYYY-MM-DD, a calendar day (no time zone).
  requestedDeliveryDate?: string;
  orderNote?: string;
};

export const PROCUREMENT_KEYS = ["costCentre", "projectCode", "requestedDeliveryDate", "orderNote"] as const;
export const CODE_PATTERN = /^[A-Za-z0-9 ._/#-]{1,40}$/;
export const NOTE_MAX = 500;

export const procurementEnabled = (env: Record<string, string | undefined> = process.env) => env.PROCUREMENT_FIELDS === "true";

// Calendar days as YYYY-MM-DD in UTC: tomorrow is the earliest delivery, one year from today the latest.
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function deliveryWindow(now: Date): { min: string; max: string } {
  const min = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const max = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  return { min: isoDay(min), max: isoDay(max) };
}

const validDay = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && isoDay(d) === s;
};

// Control characters (except line breaks) and invisible direction marks go: they can hide text in emails, PDFs and
// spreadsheets. Line breaks become \n, at most two in a row.
export function cleanNote(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The buyer's form input → fields, or the first problem in words.
export function parseProcurement(
  input: Record<string, string | undefined>,
  now: Date,
): { ok: true; value: Procurement } | { ok: false; error: string } {
  const value: Procurement = {};
  const costCentre = input.costCentre?.trim();
  if (costCentre) {
    if (!CODE_PATTERN.test(costCentre)) return { ok: false, error: "Cost centre: up to 40 letters, digits, spaces or . _ / # -" };
    value.costCentre = costCentre;
  }
  const projectCode = input.projectCode?.trim();
  if (projectCode) {
    if (!CODE_PATTERN.test(projectCode)) return { ok: false, error: "Project code: up to 40 letters, digits, spaces or . _ / # -" };
    value.projectCode = projectCode;
  }
  const date = input.requestedDeliveryDate?.trim();
  if (date) {
    const { min, max } = deliveryWindow(now);
    if (!validDay(date) || date < min || date > max) {
      return { ok: false, error: "Requested delivery date: choose a day from tomorrow up to one year ahead." };
    }
    value.requestedDeliveryDate = date;
  }
  const note = cleanNote(input.orderNote ?? "");
  if (note) {
    if (note.length > NOTE_MAX) return { ok: false, error: `Order note: up to ${NOTE_MAX} characters.` };
    value.orderNote = note;
  }
  return { ok: true, value };
}

// What a cart or order carries (fields of other features are ignored).
export function readProcurement(custom?: Pick<CustomFields, "fields">): Procurement {
  const fields = custom?.fields ?? {};
  const out: Procurement = {};
  for (const key of PROCUREMENT_KEYS) {
    const v = fields[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

export const hasProcurement = (p: Procurement) => PROCUREMENT_KEYS.some((k) => p[k]);

// Cart updates that bring the cart to `next`: setCustomType on a cart without a Type, else one setCustomField per
// changed field (an absent value removes the field). A cart's Type is always ORDER_TYPE_KEY (the one Type the
// storefront sets on carts and orders; the runtime client can't read Types to check, see docs/api-clients.md).
export function procurementActions(custom: Pick<CustomFields, "fields"> | undefined, next: Procurement): CartUpdateAction[] {
  return customFieldActions(custom, Object.fromEntries(PROCUREMENT_KEYS.map((k) => [k, next[k]])));
}

// Label/value rows for the order page and documents, in form order.
export function procurementRows(p: Procurement, formatDay: (iso: string) => string): [string, string][] {
  const rows: [string, string][] = [];
  if (p.costCentre) rows.push(["Cost centre", p.costCentre]);
  if (p.projectCode) rows.push(["Project code", p.projectCode]);
  if (p.requestedDeliveryDate) rows.push(["Requested delivery", formatDay(p.requestedDeliveryDate)]);
  return rows;
}
