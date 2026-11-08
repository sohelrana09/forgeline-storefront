"use client";

import { t } from "@/lib/i18n";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { COMPARE_MAX, compareHref, toggleCompare } from "@/features/compare/compare";

// The visitor's own compare list, kept in this browser only (a convenience; the /compare URL carries the list).
const KEY = "compare-skus";
const EVENT = "compare-changed";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
const list = (raw: string) => raw.split(",").filter(Boolean);

export function CompareButton({ sku }: { sku: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const skus = list(raw);
  const on = skus.includes(sku);
  const toggle = () => {
    try {
      localStorage.setItem(KEY, toggleCompare(skus, sku).join(","));
    } catch {
      // storage blocked: the button simply does nothing
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex min-h-9 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={on} onChange={toggle} className="size-4" />
        {t("pdp.compare")}
      </label>
      {skus.length > 0 && (
        <Link href={compareHref(skus)} className="text-orange-800">
          Compare {skus.length} of {COMPARE_MAX}
        </Link>
      )}
    </div>
  );
}
