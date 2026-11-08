import type { Permission } from "@commercetools/platform-sdk";
import { customFieldActions } from "@/lib/commercetools/order-type";
import { cleanNote } from "@/features/checkout/procurement";

// Requisition hand-off (docs/features/shared-carts.md): a buyer sends their cart to a colleague who may order and
// handle others' carts; the colleague reviews it and takes it over to edit and check out. Pure, unit-tested. The
// share is four string fields on the cart (the one cart/order Type).

export const sharedCartsEnabled = (env: Record<string, string | undefined> = process.env) => env.SHARED_CARTS === "true";

// What a reviewer needs: order, and view and edit others' carts (commercetools checks the last two again on the
// as-associate endpoints).
export const REVIEWER_PERMISSIONS: Permission[] = ["CreateMyOrdersFromMyCarts", "ViewOthersCarts", "UpdateOthersCarts"];
export const canReview = (permissions: Set<Permission> | undefined) =>
  !!permissions && REVIEWER_PERMISSIONS.every((p) => permissions.has(p));

export const SHARE_NOTE_MAX = 300;

export type Share = { sharedWith?: string; sharedBy?: string; sharedAt?: string; shareNote?: string };

export function readShare(custom?: { fields: Record<string, unknown> }): Share {
  const f = custom?.fields ?? {};
  const s = (k: string) => (typeof f[k] === "string" && f[k] ? (f[k] as string) : undefined);
  return { sharedWith: s("sharedWith"), sharedBy: s("sharedBy"), sharedAt: s("sharedAt"), shareNote: s("shareNote") };
}

export function parseShareNote(input: string | undefined): { ok: true; note?: string } | { ok: false; error: string } {
  const note = cleanNote(input ?? "");
  if (note.length > SHARE_NOTE_MAX) return { ok: false, error: `Note: up to ${SHARE_NOTE_MAX} characters.` };
  return { ok: true, note: note || undefined };
}

// Sending: who, by whom, when, with the note.
export const shareActions = (
  custom: { fields: Record<string, unknown> } | undefined,
  share: Required<Pick<Share, "sharedWith" | "sharedBy" | "sharedAt">> & Pick<Share, "shareNote">,
) => customFieldActions(custom, { ...share, shareNote: share.shareNote });

// Withdrawing, declining or taking over: the share ends (sharedBy stays on a taken-over cart, so the order shows
// whose requisition it was).
export const endShareActions = (custom: { fields: Record<string, unknown> } | undefined, keepSender: boolean) =>
  customFieldActions(custom, {
    sharedWith: undefined,
    sharedAt: undefined,
    shareNote: undefined,
    ...(keepSender ? {} : { sharedBy: undefined }),
  });

// How the signed-in buyer relates to a cart's share.
export function shareRole(share: Share, customerId: string): "sender" | "reviewer" | undefined {
  if (!share.sharedWith) return undefined;
  if (share.sharedWith === customerId) return "reviewer";
  if (share.sharedBy === customerId) return "sender";
  return undefined;
}
