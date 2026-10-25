"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Horizontal slider built on native scrolling with snap points: swipe, trackpad and keyboard work without
// JavaScript; the prev/next buttons are an enhancement. Children can be Server Components (e.g. product cards).
// No autoplay: content only moves when the buyer asks it to.
export function Carousel({
  label,
  children,
  itemClassName = "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]",
}: {
  label: string;
  children: ReactNode;
  itemClassName?: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const [state, setState] = useState({ page: 0, pages: 1, perView: 1, step: 0 });

  // Pages are counted in whole cards: perView = cards that fit, step = their width including gaps.
  const update = useCallback(() => {
    const el = track.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const slot = first.getBoundingClientRect().width + gap;
    if (slot <= 0) return;
    const perView = Math.max(1, Math.round((el.clientWidth + gap) / slot));
    const pages = Math.max(1, Math.ceil(el.children.length / perView));
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    const page = atEnd ? pages - 1 : Math.min(pages - 1, Math.round(el.scrollLeft / (perView * slot)));
    setState({ page, pages, perView, step: perView * slot });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [update]);

  const goTo = (page: number) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(page, state.pages - 1));
    el.scrollTo({ left: Math.min(target * state.step, el.scrollWidth - el.clientWidth), behavior: "smooth" });
  };

  const paged = state.pages > 1;

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative">
      <ul
        ref={track}
        tabIndex={0}
        aria-label={`${label}: ${items.length} items`}
        className="m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-700 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, i) => (
          <li key={i} className={`flex shrink-0 snap-start ${itemClassName}`} aria-label={`${i + 1} of ${items.length}`}>
            <div className="flex w-full [&>*]:w-full">{child}</div>
          </li>
        ))}
      </ul>
      {paged && (
        <>
          <SlideButton direction="previous" disabled={state.page === 0} onClick={() => goTo(state.page - 1)} />
          <SlideButton direction="next" disabled={state.page === state.pages - 1} onClick={() => goTo(state.page + 1)} />
          <div className="mt-3 flex justify-center" role="group" aria-label={`${label} pages`}>
            {Array.from({ length: state.pages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Page ${i + 1} of ${state.pages}`}
                aria-current={i === state.page ? "true" : undefined}
                // 44px hit area, small visible dot.
                className="group/dot flex h-11 w-8 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-2.5 rounded-full transition-all ${
                    i === state.page ? "w-6 bg-orange-700" : "w-2.5 bg-gray-300 group-hover/dot:bg-gray-500"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SlideButton({ direction, disabled, onClick }: { direction: "previous" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "previous" ? "Previous items" : "Next items"}
      // Phones swipe and use the dots; the arrows would cover the cards there.
      className={`absolute top-1/3 z-10 hidden h-11 w-11 sm:flex -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-900 shadow-md hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-0 ${
        direction === "previous" ? "-left-3" : "-right-3"
      }`}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === "previous" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
