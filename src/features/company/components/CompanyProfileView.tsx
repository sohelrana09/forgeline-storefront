import { getCompanyMembers, getCompanyUnit, getRoles } from "@/features/company/service";
import { can, roleLabel } from "@/features/company/utils";
import { AddressBlock } from "@/features/account/components/AddressBlock";
import { Panel, PanelBox } from "@/features/account/components/Panel";
import { CompanyProfileForm } from "@/features/company/components/CompanyForms";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

export async function CompanyProfileView({ session, context }: { session: Session; context: BuyerContext }) {
  const [company, members, roles] = await Promise.all([getCompanyUnit(context), getCompanyMembers(context, session.customerId), getRoles()]);
  const self = members.find((m) => m.customerId === session.customerId);
  const myRoles = [...new Set([...(self?.roles ?? []), ...(self?.inheritedRoles ?? [])])].map((k) => roleLabel(k, roles));
  const editable = can(context, "UpdateBusinessUnitDetails");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Company profile</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Your roles in {company.name}: {myRoles.join(", ") || "none"}.
        </p>
      </div>

      <Panel title="Company information">
        <PanelBox title="Company">
          <p className="m-0 font-semibold">{company.name}</p>
          <p className="m-0 text-gray-700">
            {company.unitType === "Division" ? "Division" : "Company"} · {company.status}
          </p>
          <p className="m-0 text-gray-700">{company.contactEmail ?? "No contact email"}</p>
        </PanelBox>
        <PanelBox title="Buying">
          <p className="m-0">{context.storeName}</p>
          <p className="m-0 text-gray-700">Prices in {context.currency}</p>
          <p className="m-0 text-gray-700">{members.length} company users</p>
        </PanelBox>
      </Panel>

      <Panel title="Legal and shipping address">
        <PanelBox title="Default billing address">
          <AddressBlock address={context.defaultBillingAddress} />
        </PanelBox>
        <PanelBox title="Default shipping address">
          <AddressBlock address={context.defaultShippingAddress} />
        </PanelBox>
      </Panel>

      {editable ? (
        <section aria-labelledby="edit-company" className="rounded-md border border-gray-200 bg-white p-5">
          <h2 id="edit-company" className="mb-4 mt-0 text-lg font-semibold">
            Edit company profile
          </h2>
          <CompanyProfileForm name={company.name} contactEmail={company.contactEmail} />
        </section>
      ) : (
        <p className="m-0 text-sm text-gray-600">Only company administrators can edit the company profile.</p>
      )}
    </div>
  );
}
