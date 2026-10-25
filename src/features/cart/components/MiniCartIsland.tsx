"use client";

import { useEffect, useState } from "react";
import { MiniCartLink } from "@/components/layouts/MiniCartLink";

// Event fired after anything changes the cart from a cached page (see AddToCartForm).
export const CART_CHANGED = "cart:changed";

// Mini-cart for cached guest pages: the page is shared, so the visitor's own cart is loaded in the browser.
export function MiniCartIsland() {
  const [summary, setSummary] = useState<{ items: number; total?: string }>({ items: 0 });
  useEffect(() => {
    const load = () =>
      fetch("/api/cart-summary", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : undefined))
        .then((s) => s && setSummary(s))
        .catch(() => {});
    // Coming back to the tab picks up changes from other tabs, at most every 30 s (each load reads the cart).
    let lastLoad = 0;
    const loadOnFocus = () => {
      if (Date.now() - lastLoad > 30_000) loadNow();
    };
    const loadNow = () => {
      lastLoad = Date.now();
      load();
    };
    loadNow();
    window.addEventListener(CART_CHANGED, loadNow);
    window.addEventListener("focus", loadOnFocus);
    return () => {
      window.removeEventListener(CART_CHANGED, loadNow);
      window.removeEventListener("focus", loadOnFocus);
    };
  }, []);
  return <MiniCartLink items={summary.items} total={summary.total} />;
}
