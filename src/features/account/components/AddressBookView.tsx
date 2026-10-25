import type { Address } from "@commercetools/platform-sdk";
import { getMe } from "@/features/account/service";
import { countryName } from "@/features/account/utils";
import { CONSUMER_COUNTRIES } from "@/features/business-units/service";
import { AddressBlock } from "@/features/account/components/AddressBlock";
import { Panel, PanelBox } from "@/features/account/components/Panel";
import { AddressForm, DeleteAddressButton } from "@/features/account/components/AddressForm";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

const countries = CONSUMER_COUNTRIES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
const oneLine = (a: Address) => [a.streetName, a.streetNumber, a.postalCode, a.city].filter(Boolean).join(" ");

// Magento's address book. Consumers ship to and are billed at their own addresses, so they manage them here.
// Business buyers ship to the company's addresses (read-only, managed by the company); their own addresses follow.
export async function AddressBookView({ session, context }: { session: Session; context: BuyerContext }) {
  const me = await getMe(session);
  const byId = (id?: string) => me.addresses.find((a) => a.id === id);
  const company = !context.consumer;
  const defaults = new Set([context.defaultBillingAddress?.id, context.defaultShippingAddress?.id]);
  const otherCompany = context.addresses.filter((a) => !defaults.has(a.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Address book</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          {company
            ? `Orders for ${context.businessUnitName} ship to and are invoiced to the company's addresses. Your company administrator manages them.`
            : "Your delivery and billing addresses. We deliver to Germany, France, Spain and the United Kingdom."}
        </p>
      </div>

      {company ? (
        <>
          <Panel title="Company default addresses">
            <PanelBox title="Default billing address">
              <AddressBlock address={context.defaultBillingAddress} />
            </PanelBox>
            <PanelBox title="Default shipping address">
              <AddressBlock address={context.defaultShippingAddress} />
            </PanelBox>
          </Panel>
          {otherCompany.length > 0 && (
            <Panel title="Other company addresses">
              {otherCompany.map((a, i) => (
                <PanelBox key={a.id ?? i} title={a.company ?? `Address ${i + 1}`}>
                  <AddressBlock address={a} />
                </PanelBox>
              ))}
            </Panel>
          )}
        </>
      ) : (
        <Panel title="Default addresses">
          <PanelBox title="Default billing address">
            <AddressBlock address={byId(me.defaultBillingAddressId)} />
          </PanelBox>
          <PanelBox title="Default shipping address">
            <AddressBlock address={byId(me.defaultShippingAddressId)} />
          </PanelBox>
        </Panel>
      )}

      <section aria-labelledby="my-addresses" className="rounded-md border border-gray-200 bg-white">
        <h2 id="my-addresses" className="m-0 border-b border-gray-200 px-5 py-4 text-lg font-semibold">
          {company ? "My addresses" : "Address book"}
        </h2>
        {me.addresses.length === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">You have no saved addresses yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {me.addresses.map((a, i) => (
              <li key={a.id ?? i} className="flex flex-col gap-3 border-b border-gray-100 p-5 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
                  <AddressBlock address={a} />
                  <div className="flex flex-col items-end gap-1 text-xs font-semibold text-gray-700">
                    {a.id === me.defaultShippingAddressId && <span>Default shipping</span>}
                    {a.id === me.defaultBillingAddressId && <span>Default billing</span>}
                  </div>
                </div>
                {a.id && (
                  <div className="flex flex-wrap items-start gap-4">
                    <details className="flex-1">
                      <summary className="min-h-11 text-sm text-orange-800">Edit</summary>
                      <div className="mt-3">
                        <AddressForm
                          address={a}
                          countries={countries}
                          isDefaultShipping={a.id === me.defaultShippingAddressId}
                          isDefaultBilling={a.id === me.defaultBillingAddressId}
                        />
                      </div>
                    </details>
                    <DeleteAddressButton id={a.id} label={oneLine(a)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-address" className="rounded-md border border-gray-200 bg-white p-5">
        <h2 id="add-address" className="mb-4 mt-0 text-lg font-semibold">
          Add a new address
        </h2>
        <AddressForm countries={countries} isDefaultShipping={me.addresses.length === 0} isDefaultBilling={me.addresses.length === 0} />
      </section>
    </div>
  );
}
