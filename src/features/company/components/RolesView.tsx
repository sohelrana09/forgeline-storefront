import { getRoles } from "@/features/company/service";
import { PERMISSION_GROUPS } from "@/features/company/utils";
import type { BuyerContext } from "@/features/business-units/types";

// Roles and permissions, read-only: commercetools associate roles are shared by every company.
export async function RolesView({ context }: { context: BuyerContext }) {
  const roles = await getRoles();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Roles and permissions</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          What each role allows. Roles are the same for every company; ask our sales team if you need a different one.
        </p>
      </div>
      <section aria-label="Permissions by role" className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              <th className="px-5 py-3 font-semibold">Permission</th>
              {roles.map((r) => (
                <th key={r.key} className="px-3 py-3 text-center font-semibold">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((group) => (
            <tbody key={group.title}>
              <tr className="border-t border-gray-200 bg-gray-50">
                <th colSpan={roles.length + 1} scope="colgroup" className="px-5 py-2 text-left font-semibold">
                  {group.title}
                </th>
              </tr>
              {group.permissions.map(([permission, label]) => (
                <tr key={permission} className="border-t border-gray-100">
                  <th scope="row" className="px-5 py-2 text-left font-normal">
                    {label}
                    {context.permissions.includes(permission) && <span className="ml-2 text-xs text-green-800">(you)</span>}
                  </th>
                  {roles.map((r) => (
                    <td key={r.key} className="px-3 py-2 text-center">
                      {r.permissions.includes(permission) ? (
                        <span aria-label="Allowed" className="font-bold text-green-700">
                          ✓
                        </span>
                      ) : (
                        <span aria-label="Not allowed" className="text-gray-300">
                          ·
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>
    </div>
  );
}
