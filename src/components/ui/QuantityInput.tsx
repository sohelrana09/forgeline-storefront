"use client";

import { useRef } from "react";

// − [ qty ] + selector. The input stays uncontrolled, so a form reset (React resets forms after a Server Action)
// puts it back to defaultValue, and stepUp/stepDown enforce min/max. Without JavaScript the field still works.
export function QuantityInput({
  name,
  label,
  defaultValue = 1,
  min = 1,
  max = 9999,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  const step = (direction: 1 | -1) => {
    const el = input.current;
    if (!el) return;
    if (!el.value) el.value = String(min);
    else if (direction === 1) el.stepUp();
    else el.stepDown();
    // Let listeners (and the form's dirty state) see the change, as if the buyer typed it.
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const buttonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center text-lg font-semibold text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-700";

  return (
    <div className={`flex items-stretch overflow-hidden rounded border border-gray-300 bg-white ${className}`}>
      <button type="button" onClick={() => step(-1)} aria-label={`Decrease ${label}`} className={buttonClass}>
        <span aria-hidden="true">−</span>
      </button>
      <input
        ref={input}
        type="number"
        inputMode="numeric"
        name={name}
        min={min}
        max={max}
        step={1}
        defaultValue={defaultValue}
        aria-label={label}
        className="h-11 w-12 min-w-0 flex-1 border-x border-gray-300 text-center [appearance:textfield] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => step(1)} aria-label={`Increase ${label}`} className={buttonClass}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
