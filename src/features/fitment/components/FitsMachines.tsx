import { t } from "@/lib/i18n";
import Link from "next/link";
import type { BuyerContext } from "@/features/business-units/types";
import { getProductsByIds } from "@/features/catalog/service";
import { productHref } from "@/features/catalog/utils";
import { equipmentLabel, fitsMachines, type Machine } from "@/features/fitment/fitment";
import { companyEquipment, getFitmentIndex } from "@/features/fitment/service";

const SHOWN = 12;

function MachineList({ machines }: { machines: Machine[] }) {
  return (
    <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
      {machines.map((m) => (
        <li key={m.id}>
          <Link href={productHref(m.slug, m.sku)}>{m.name}</Link>
        </li>
      ))}
    </ul>
  );
}

// Product page, for a part: the machines it fits, and which of the company's own machines (streamed, per visitor).
export async function FitsMachines({ context, productId }: { context: BuyerContext; productId: string }) {
  const [index, equipment] = await Promise.all([getFitmentIndex(), companyEquipment(context)]);
  const fitting = fitsMachines(index, productId);
  if (fitting.length === 0) return null;
  // Only machines in the visitor's assortment (the store's product selections), so no link answers 404.
  const sold = new Set(
    (
      await getProductsByIds(
        context,
        fitting.map((m) => m.id),
      )
    ).map((p) => p.id),
  );
  const machines = fitting.filter((m) => sold.has(m.id));
  if (machines.length === 0) return null;
  const mine = equipment.filter((e) => machines.some((m) => m.id === e.machineId));
  return (
    <section aria-labelledby="fits" className="rounded-md border border-gray-200 bg-white p-4 text-sm">
      <h2 id="fits" className="m-0 mb-2 text-base font-semibold">
        {t("pdp.fits")}
      </h2>
      {mine.length > 0 && (
        <p className="m-0 mb-2 rounded bg-green-50 px-3 py-2 text-green-900">
          Fits your {mine.map((e) => equipmentLabel(e, index.machines[e.machineId])).join("; ")}.
        </p>
      )}
      <MachineList machines={machines.slice(0, SHOWN)} />
      {machines.length > SHOWN && (
        <details className="mt-2">
          <summary className="cursor-pointer text-gray-700">Show all {machines.length} machines</summary>
          <MachineList machines={machines.slice(SHOWN)} />
        </details>
      )}
    </section>
  );
}
