"use client";

import { selectBusinessUnit } from "@/features/business-units/actions";

type Option = { key: string; label: string };

// Submits on change; the button keeps it working without JavaScript.
export function BuSwitcher({ options, selected }: { options: Option[]; selected: string }) {
  return (
    <form action={selectBusinessUnit} className="flex items-end gap-2">
      <label className="flex flex-col gap-0.5 text-[11px] text-gray-300">
        Buying for
        <select
          // React resets forms after an action; re-mount so the new selection sticks.
          key={selected}
          name="businessUnit"
          defaultValue={selected}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="min-h-9 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm font-semibold text-gray-50"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button className="min-h-9 rounded bg-gray-700 px-3 text-sm text-white">Switch</button>
      </noscript>
    </form>
  );
}
