"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireShopContext } from "@/features/business-units/context";
import { saveSession } from "@/features/auth/session";
import { removeMyAddress, saveMyAddress, updateMe } from "@/features/account/service";
import { CONSUMER_COUNTRIES } from "@/features/business-units/service";
import { NAME_PATTERN, parseAddress } from "@/features/account/utils";
import type { AccountInfoState, AddressFormState } from "@/features/account/types";

// Public endpoint: the signed-in customer edits their own first and last name (nothing else on the profile).
export async function updateAccountInformation(_prev: AccountInfoState, formData: FormData): Promise<AccountInfoState> {
  const { session } = await requireShopContext();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (await tooManyAttempts(`profile:${session.customerId}`, 20))
    return { error: "Too many changes. Please wait a few minutes and try again." };
  if (![firstName, lastName].every((n) => NAME_PATTERN.test(n) && /\p{L}/u.test(n))) {
    return {
      error: "Enter a first and last name (letters, spaces, apostrophes, dots and hyphens; up to 60 characters).",
    };
  }
  try {
    await updateMe(session, [
      { action: "setFirstName", firstName },
      { action: "setLastName", lastName },
    ]);
  } catch (err) {
    unstable_rethrow(err); // signed out (revoked token)
    console.error("account update failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your details could not be saved. Please try again." };
  }
  // The header greeting uses the name in the session; the profile is saved either way.
  await saveSession({ ...session, name: firstName }).catch((err) => console.error("session name update failed", err));
  refresh();
  return { saved: true };
}

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const ADDRESS_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Public endpoint: add or edit one of the signed-in customer's own addresses (the address book used at checkout).
export async function saveAddress(_prev: AddressFormState, formData: FormData): Promise<AddressFormState> {
  const { session } = await requireShopContext();
  if (await tooManyAttempts(`address:${session.customerId}`, 30))
    return { error: "Too many changes. Please wait a few minutes and try again." };
  const id = field(formData, "id");
  if (id && !ADDRESS_ID.test(id)) return { error: "Unknown address." };
  const parsed = parseAddress(formData, CONSUMER_COUNTRIES);
  if ("error" in parsed) return parsed;
  try {
    await saveMyAddress(session, parsed.address, {
      id: id || undefined,
      defaultShipping: formData.get("defaultShipping") === "on",
      defaultBilling: formData.get("defaultBilling") === "on",
    });
  } catch (err) {
    unstable_rethrow(err);
    console.error("address save failed", (err as { body?: unknown })?.body ?? err);
    return { error: "The address could not be saved. Please try again." };
  }
  refresh();
  return { saved: true };
}

// Public endpoint: remove one of the customer's own addresses.
export async function deleteAddress(formData: FormData) {
  const { session } = await requireShopContext();
  const id = field(formData, "id");
  if (!ADDRESS_ID.test(id) || (await tooManyAttempts(`address:${session.customerId}`, 30))) return;
  try {
    await removeMyAddress(session, id);
  } catch (err) {
    unstable_rethrow(err);
    console.error("address remove failed", (err as { body?: unknown })?.body ?? err);
  }
  refresh();
}
