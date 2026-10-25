import "server-only";
import type { BaseAddress, Customer, MyCustomerUpdateAction } from "@commercetools/platform-sdk";
import type { BuyerContext } from "@/features/business-units/types";
import { customerApiRoot } from "@/lib/commercetools/client";
import { signOutOnAuthError, type Session } from "@/features/auth/session";

// The signed-in customer's own profile (/me, scope manage_my_profile).
const me = (session: Session) => customerApiRoot(session.accessToken).me();

export async function getMe(session: Session): Promise<Customer> {
  const { body } = await me(session).get().execute().catch(signOutOnAuthError);
  return body;
}

// Applies the change to the current version; on a 409 re-reads the profile and retries once.
export async function updateMe(session: Session, actions: MyCustomerUpdateAction[]): Promise<Customer> {
  const update = (version: number) =>
    me(session)
      .post({ body: { version, actions } })
      .execute()
      .then((r) => r.body);
  const current = await getMe(session);
  try {
    return await update(current.version);
  } catch (err) {
    if ((err as { body?: { statusCode?: number } })?.body?.statusCode !== 409) return signOutOnAuthError(err);
    return update((await getMe(session)).version).catch(signOutOnAuthError);
  }
}

// A consumer's checkout and cart use their own address book (business buyers use the unit's addresses, which
// the buying context already holds). One /me read, only where addresses are needed.
export async function withMyAddresses(session: Session, context: BuyerContext): Promise<BuyerContext> {
  if (!context.consumer) return context;
  const me = await getMe(session);
  const byId = (id?: string) => me.addresses.find((a) => a.id === id);
  return {
    ...context,
    addresses: me.addresses,
    defaultShippingAddress: byId(me.defaultShippingAddressId) ?? me.addresses[0],
    defaultBillingAddress: byId(me.defaultBillingAddressId) ?? byId(me.defaultShippingAddressId) ?? me.addresses[0],
  };
}

// Address book changes. The id comes from the form but only ever addresses the customer's own profile (/me).
export async function saveMyAddress(
  session: Session,
  address: BaseAddress,
  { id, defaultShipping, defaultBilling }: { id?: string; defaultShipping: boolean; defaultBilling: boolean },
) {
  const me = await getMe(session);
  if (id && !me.addresses.some((a) => a.id === id)) throw new Error("unknown address");
  // A new address gets a key so it can be made the default in the same update.
  const key = id ? undefined : `a-${crypto.randomUUID().slice(0, 8)}`;
  const ref = id ? { addressId: id } : { addressKey: key };
  return updateMe(session, [
    id ? { action: "changeAddress", addressId: id, address } : { action: "addAddress", address: { ...address, key } },
    ...(defaultShipping ? [{ action: "setDefaultShippingAddress" as const, ...ref }] : []),
    ...(defaultBilling ? [{ action: "setDefaultBillingAddress" as const, ...ref }] : []),
  ]);
}

export async function removeMyAddress(session: Session, id: string) {
  const me = await getMe(session);
  if (!me.addresses.some((a) => a.id === id)) return me;
  return updateMe(session, [{ action: "removeAddress", addressId: id }]);
}
