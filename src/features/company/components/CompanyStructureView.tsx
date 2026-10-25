import { getCompanyStructure } from "@/features/company/service";
import { selectBusinessUnit } from "@/features/business-units/actions";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import type { CompanyUnit } from "@/features/company/types";

// Magento's "Company Structure": the company and its divisions. Units the user belongs to can be switched to.
// Shows the units the user belongs to and their parent units (for context), nothing else of the company.
export async function CompanyStructureView({ session, context }: { session: Session; context: BuyerContext }) {
  const units = await getCompanyStructure(context, session.customerId);
  const children = (key?: string) => units.filter((u) => u.parentKey === key);
  const roots = units.filter((u) => !u.parentKey || !units.some((p) => p.key === u.parentKey));

  // A render function, not a nested component, so React doesn't remount the tree on every render.
  const node = (unit: CompanyUnit & { member: boolean }) => (
    <li key={unit.key} className="mt-2">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${
          unit.key === context.businessUnitKey ? "border-orange-700 bg-orange-50" : "border-gray-200 bg-white"
        }`}
      >
        <div>
          <p className="m-0 font-semibold">{unit.name}</p>
          <p className="m-0 text-xs text-gray-600">
            {unit.unitType} · {unit.status}
            {unit.contactEmail && ` · ${unit.contactEmail}`}
          </p>
        </div>
        {unit.key === context.businessUnitKey ? (
          <span className="text-sm font-semibold text-orange-900">Buying for this unit</span>
        ) : unit.member ? (
          <form action={selectBusinessUnit}>
            <input type="hidden" name="businessUnit" value={unit.key} />
            <button className="min-h-11 rounded border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50">Switch to this unit</button>
          </form>
        ) : (
          <span className="text-sm text-gray-500">Parent unit</span>
        )}
      </div>
      {children(unit.key).length > 0 && (
        <ul className="m-0 list-none border-l-2 border-gray-200 pl-6">
          {children(unit.key).map(node)}
        </ul>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Company structure</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">The units you buy for, and the units above them.</p>
      </div>
      <ul className="m-0 list-none p-0">
        {roots.map(node)}
      </ul>
    </div>
  );
}
