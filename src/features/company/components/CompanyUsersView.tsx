import { getCompanyMembers, getRoles } from "@/features/company/service";
import { can, roleLabel } from "@/features/company/utils";
import { AddUserForm, UserRolesForm } from "@/features/company/components/CompanyForms";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

// Magento's "Company Users". Everyone in the unit sees who their colleagues are and what they can do; users with
// UpdateAssociates can add, change and remove them (direct members only, never themselves).
export async function CompanyUsersView({ session, context }: { session: Session; context: BuyerContext }) {
  const [members, roles] = await Promise.all([getCompanyMembers(context, session.customerId), getRoles()]);
  const manage = can(context, "UpdateAssociates");
  const roleOptions = roles.map(({ key, name }) => ({ key, name }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Company users</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          {members.length} users of {context.businessUnitName}.{" "}
          {manage ? "You can add users and change their roles." : "Only company administrators can change users."}
        </p>
      </div>

      {manage && (
        <section aria-labelledby="add-user" className="rounded-md border border-gray-200 bg-white p-5">
          <h2 id="add-user" className="mb-3 mt-0 text-lg font-semibold">
            Add a user
          </h2>
          <AddUserForm roles={roleOptions} />
        </section>
      )}

      <section aria-label="Users" className="rounded-md border border-gray-200 bg-white">
        <ul className="m-0 list-none p-0">
          {members.map((m) => {
            const self = m.customerId === session.customerId;
            const name = m.name || m.email || "Unnamed user";
            return (
              <li key={m.customerId} className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 p-5 last:border-b-0">
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="m-0 font-semibold">
                    {name}
                    {self && <span className="ml-2 text-xs font-normal text-gray-600">(you)</span>}
                  </p>
                  {m.email && <p className="m-0 text-sm text-gray-700">{m.email}</p>}
                  <p className="m-0 mt-1 flex flex-wrap gap-1.5">
                    {m.roles.map((r) => (
                      <span key={r} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">
                        {roleLabel(r, roles)}
                      </span>
                    ))}
                    {m.inheritedRoles.map((r) => (
                      <span key={`i-${r}`} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900" title="From the parent unit">
                        {roleLabel(r, roles)} (from parent unit)
                      </span>
                    ))}
                  </p>
                </div>
                {manage && m.explicit && !self && (
                  <div className="flex-[1_1_320px]">
                    <UserRolesForm customerId={m.customerId} name={name} roles={roleOptions} selected={m.roles} />
                  </div>
                )}
                {manage && !m.explicit && <p className="m-0 text-sm text-gray-600">Managed in the parent unit.</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
