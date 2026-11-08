"use client";

import { useEffect } from "react";
import { parseSent, rememberSent, shouldTrackPurchase, type DataLayerEvent } from "@/features/analytics/events";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// GA4 asks to clear the previous ecommerce object first, or tag managers merge the item lists of two events.
export function pushEvent(event: DataLayerEvent) {
  window.dataLayer = window.dataLayer ?? [];
  if ("ecommerce" in event) window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push(event);
}

// Sends an event once when the part that shows it mounts (server components render this with plain data). The key
// is the event's JSON, so a client-side move to another list or product sends again, a re-render doesn't.
// The same event again within a second is the same view mounted twice (React's Strict Mode in development, a Suspense
// boundary re-showing its content), not a second view.
const recent = new Map<string, number>();
export function TrackEvent({ event }: { event: DataLayerEvent }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    const now = Date.now();
    for (const [k, at] of recent) if (now - at >= 1000) recent.delete(k);
    if (recent.has(key)) return;
    recent.set(key, now);
    pushEvent(JSON.parse(key) as DataLayerEvent);
  }, [key]);
  return null;
}

const SENT_KEY = "analytics-orders";

// purchase: only for a new order and once per browser (reloads and the back button land here again).
export function TrackPurchase({ id, createdAt, event }: { id: string; createdAt: string; event: DataLayerEvent }) {
  useEffect(() => {
    let sent: string[] = [];
    try {
      sent = parseSent(localStorage.getItem(SENT_KEY));
    } catch {}
    if (!shouldTrackPurchase(id, createdAt, Date.now(), sent)) return;
    pushEvent(event);
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(rememberSent(sent, id)));
    } catch {}
  }, [id, createdAt, event]);
  return null;
}
