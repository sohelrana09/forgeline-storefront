"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/PageMessages";
import { changeEquipmentAction, type EquipmentFormState } from "@/features/fitment/actions";

const field = "min-h-11 rounded border border-gray-300 px-3";

export function AddEquipmentForm({ machines }: { machines: { id: string; name: string; sku?: string }[] }) {
  const [state, action, pending] = useActionState(changeEquipmentAction, {} as EquipmentFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} error={state.error} success={state.saved} />
      <input type="hidden" name="op" value="add" />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Machine
          <select name="machineId" required defaultValue="" className={`${field} font-normal`}>
            <option value="" disabled>
              Choose a machine
            </option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.sku ? ` (${m.sku})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Your name for it (optional)
          <input name="label" maxLength={60} placeholder="Yard 3 loader" className={`${field} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Serial number (optional)
          <input name="serial" maxLength={40} className={`${field} font-normal`} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded bg-orange-700 px-5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add machine"}
      </button>
    </form>
  );
}

export function RemoveEquipmentButton({ index, label }: { index: number; label: string }) {
  const [state, action, pending] = useActionState(changeEquipmentAction, {} as EquipmentFormState);
  return (
    <form action={action}>
      <FormMessage state={state} error={state.error} success={state.saved} />
      <input type="hidden" name="op" value="remove" />
      <input type="hidden" name="index" value={index} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Remove ${label}`}
        className="text-sm text-red-700 underline disabled:opacity-60"
      >
        Remove
      </button>
    </form>
  );
}
