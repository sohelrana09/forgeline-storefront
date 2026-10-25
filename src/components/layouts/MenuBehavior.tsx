"use client";

import { useEffect } from "react";

const PANEL_WIDTH = 240; // min-w-60

// Progressive enhancement for CategoryMenu (the menu works without it, rendered as plain CSS hover/focus):
// - alignment: when a top-level item opens, check whether its dropdown (plus a level-3 flyout) fits to the right
//   of the viewport; if not, mark it data-align="right" so the CSS opens it leftwards
// - close on click: navigation is client-side, so the header stays mounted with the clicked link still focused
//   and hovered, which would keep the dropdown open. Mark the item data-closed until the pointer leaves it, drop
//   focus, and collapse the mobile <details> tree.
export function MenuBehavior({ navId }: { navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const topItem = (target: EventTarget | null) => (target as Element | null)?.closest<HTMLElement>("[data-menu-top]");

    const align = (event: Event) => {
      const item = topItem(event.target);
      if (!item) return;
      // Coming back by keyboard reopens an item that was closed by a click.
      if (event.type === "focusin") delete item.dataset.closed;
      const levels = item.querySelector("[data-menu-flyout]") ? 2 : 1;
      const fitsRight = item.getBoundingClientRect().left + PANEL_WIDTH * levels <= document.documentElement.clientWidth;
      item.dataset.align = fitsRight ? "left" : "right";
    };

    const closeOnClick = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest("a")) return;
      const item = topItem(event.target);
      if (item) item.dataset.closed = "";
      (document.activeElement as HTMLElement | null)?.blur();
      nav.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
    };

    const reopenOnLeave = (event: MouseEvent) => {
      const item = topItem(event.target);
      if (item && !item.contains(event.relatedTarget as Node | null)) delete item.dataset.closed;
    };

    nav.addEventListener("mouseover", align);
    nav.addEventListener("focusin", align);
    nav.addEventListener("click", closeOnClick);
    nav.addEventListener("mouseout", reopenOnLeave);
    return () => {
      nav.removeEventListener("mouseover", align);
      nav.removeEventListener("focusin", align);
      nav.removeEventListener("click", closeOnClick);
      nav.removeEventListener("mouseout", reopenOnLeave);
    };
  }, [navId]);
  return null;
}
