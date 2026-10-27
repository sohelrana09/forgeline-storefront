"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type Suggestion = { label: string; detail?: string; href: string; image?: string; price?: string };
export type Suggestions = { products: Suggestion[]; categories: Suggestion[]; total: number; corrected?: string };
type Loaded = Suggestions & { q: string };

// Magento-style search autocomplete (ARIA combobox): suggestions appear from the second letter, arrow keys move
// through them, Enter opens the highlighted one or, with none highlighted, the full results page. Without
// JavaScript it is a plain search form.
export function SearchBox({ suggestUrl = "/api/search/suggest" }: { suggestUrl?: string }) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Loaded>();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  // Too short to search: drop what an earlier query loaded, so typing on doesn't flash its rows.
  if (query.trim().length < 2 && data !== undefined) {
    setData(undefined);
    setActive(-1);
  }

  // Fetch after a short pause in typing; a newer query cancels the older request.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${suggestUrl}?${new URLSearchParams({ q })}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Suggestions>) : undefined))
        .then((s) => {
          // A refused or failed request clears the list rather than leaving the previous query's rows up.
          setData(s && { ...s, q });
          setActive(-1);
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, suggestUrl]);

  // Close when focus or a click goes elsewhere.
  useEffect(() => {
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("focusin", away);
    };
  }, []);

  const q = query.trim();
  const resultsHref = `/search?${new URLSearchParams({ q })}`;
  // "View all results" is the last option, so the keyboard reaches it too.
  const viewAll: Suggestion | undefined = data?.total ? { label: `View all ${data.total} results`, href: resultsHref } : undefined;
  const options = [...(data?.categories ?? []), ...(data?.products ?? []), ...(viewAll ? [viewAll] : [])];
  const showPanel = open && q.length >= 2 && data !== undefined;
  const showList = showPanel && options.length > 0;
  // Enter opens a highlighted row only if the rows belong to what is typed now (not the previous query).
  const current = data?.q === q;
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showList) e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 is the input itself: moving past either end returns there.
      setActive((i) => {
        const next = i + step;
        return next >= options.length ? -1 : next < -1 ? options.length - 1 : next;
      });
    } else if (e.key === "Enter" && showList && current && active >= 0 && options[active]) {
      e.preventDefault();
      go(options[active].href);
    }
  };
  const optionId = (i: number) => `${id}-opt-${i}`;
  const announcement = !showPanel
    ? ""
    : data.total === 0
      ? "No matching products"
      : `${data.total} matching ${data.total === 1 ? "product" : "products"}${data.corrected ? `, showing results for ${data.corrected}` : ""}. Use the arrow keys to choose.`;

  return (
    <form
      ref={box}
      action="/search"
      role="search"
      className="relative order-last flex w-full sm:order-none sm:w-auto sm:flex-1 lg:ml-auto lg:max-w-xl"
      onSubmit={() => setOpen(false)}
    >
      <label htmlFor="site-search" className="sr-only">
        Search the catalog
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        required
        maxLength={100}
        autoComplete="off"
        placeholder="Search by product name, model or SKU"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className="min-h-11 w-full min-w-0 rounded-l border border-gray-600 bg-white px-3 text-base text-gray-900"
      />
      <button className="min-h-11 rounded-r bg-orange-700 px-4 text-sm font-semibold text-white hover:bg-orange-800">Search</button>

      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div
        hidden={!showPanel}
        className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg"
      >
        {data?.corrected && (
          <p className="m-0 border-b border-gray-100 px-3 py-2 text-xs text-gray-600">Showing results for &ldquo;{data.corrected}&rdquo;</p>
        )}
        <ul id={listId} role="listbox" aria-label="Search suggestions" className="m-0 max-h-[70vh] list-none overflow-y-auto p-0">
          {options.map((o, i) => {
            const isCategory = i < (data?.categories.length ?? 0);
            if (o === viewAll) {
              return (
                <li
                  key="view-all"
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(o.href)}
                  onPointerEnter={() => setActive(i)}
                  className={`cursor-pointer border-t border-gray-200 px-3 py-2 text-sm font-semibold text-orange-800 ${i === active ? "bg-orange-50" : "bg-gray-50"}`}
                >
                  {o.label}
                </li>
              );
            }
            return (
              <li
                key={o.href}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => go(o.href)}
                onPointerEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-orange-50" : ""} ${isCategory ? "" : "border-t border-gray-100"}`}
              >
                {isCategory ? (
                  <span aria-hidden="true" className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    Category
                  </span>
                ) : o.image ? (
                  <Image src={o.image} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 object-contain" />
                ) : (
                  <span className="size-12 shrink-0 rounded bg-gray-100" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-medium">
                    {o.label}
                    {isCategory && <span className="sr-only"> (category)</span>}
                  </span>
                  {o.detail && <span className="font-mono text-xs text-gray-500">{o.detail}</span>}
                </span>
                {o.price && <span className="shrink-0 font-semibold">{o.price}</span>}
              </li>
            );
          })}
        </ul>
        {data && data.total === 0 && (
          <p className="m-0 px-3 py-3 text-sm text-gray-600">
            No products match &ldquo;{q}&rdquo;. Try a product name, a model code or a SKU.
          </p>
        )}
      </div>
    </form>
  );
}
