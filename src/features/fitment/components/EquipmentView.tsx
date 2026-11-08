import Link from "next/link";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { productHref } from "@/features/catalog/utils";
import { equipmentLabel } from "@/features/fitment/fitment";
import { canManageEquipment, companyEquipment, getFitmentIndex } from "@/features/fitment/service";
import { AddEquipmentForm, RemoveEquipmentButton } from "@/features/fitment/components/EquipmentForms";

// /account/company/equipment: the machines the company owns. Category pages then offer "Fits my equipment", and
// product pages say which of them a part fits. Everyone in the unit sees the list; company admins change it.
export async function EquipmentView({ session, context }: { session: Session; context: BuyerContext }) {
  const [index, items, admin] = await Promise.all([
    getFitmentIndex(),
    companyEquipment(context),
    canManageEquipment(context, session.customerId),
  ]);
  const machines = Object.values(index.machines).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">My equipment</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          The machines {context.businessUnitName} runs. Category pages can then show only the parts that fit them.
        </p>
      </div>
      <section aria-labelledby="equipment-list" className="rounded-md border border-gray-200 bg-white p-5 text-sm">
        <h2 id="equipment-list" className="m-0 mb-3 text-lg font-semibold">
          Machines ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="m-0">No machines yet.{admin ? " Add the first one below." : " A company admin can add them."}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-gray-200 p-0">
            {items.map((item, i) => {
              const machine = index.machines[item.machineId];
              const label = equipmentLabel(item, machine);
              return (
                <li key={`${item.machineId}-${item.serial ?? i}`} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <strong>{label}</strong>
                    {machine && (
                      <>
                        {" "}
                        <Link href={productHref(machine.slug, machine.sku)} className="text-gray-600">
                          {item.label ? machine.name : "View machine"}
                        </Link>
                        <span className="block text-xs text-gray-600">{machine.parts.length} compatible parts</span>
                      </>
                    )}
                  </span>
                  {admin && <RemoveEquipmentButton index={i} label={label} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {admin && (
        <section aria-labelledby="equipment-add" className="rounded-md border border-gray-200 bg-white p-5">
          <h2 id="equipment-add" className="m-0 mb-3 text-lg font-semibold">
            Add a machine
          </h2>
          <AddEquipmentForm machines={machines.map((m) => ({ id: m.id, name: m.name, sku: m.sku }))} />
        </section>
      )}
    </div>
  );
}
