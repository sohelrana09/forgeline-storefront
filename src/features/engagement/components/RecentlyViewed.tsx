"use client";

import { t } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { productPath } from "@/lib/urls";
import { parseViewed, rememberViewed, type Viewed } from "@/features/engagement/engagement";

// Recently viewed products, in this browser only (no prices, nothing sent anywhere).
const KEY = "recently-viewed";
const EVENT = "recently-viewed-changed";

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

// On the product page: remembers this product.
export function TrackViewed({ item }: { item: Viewed }) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(rememberViewed(parseViewed(read()), item)));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // storage blocked: nothing is remembered
    }
  }, [item]);
  return null;
}

export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items = parseViewed(raw).filter((v) => v.slug !== exclude);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recently-viewed">
      <h2 id="recently-viewed" className="mb-4 mt-0 text-xl font-semibold">
        {t("pdp.recentlyViewed")}
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((v) => (
          <li key={v.slug}>
            <Link
              href={productPath(v.slug, v.sku)}
              prefetch={false}
              className="flex flex-col gap-2 text-sm text-gray-900 no-underline hover:text-orange-800"
            >
              {v.image ? (
                <Image
                  src={v.image}
                  alt=""
                  width={160}
                  height={160}
                  sizes="160px"
                  className="aspect-square w-full rounded bg-gray-50 object-contain"
                />
              ) : (
                <div aria-hidden="true" className="aspect-square w-full rounded bg-gray-100" />
              )}
              {v.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
