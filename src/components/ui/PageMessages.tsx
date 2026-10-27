"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MESSAGES_CHECK, MESSAGES_COOKIE, parseMessages, type PageMessage } from "@/lib/messages";

// Magento page messages at the top of the content: green success, red error, yellow warning, each with its icon and a
// close button. They stay (and stick to the top while scrolling) until dismissed or the next page.
// Messages arrive in the ct_messages cookie (src/lib/flash.ts); it's read on every page, when `hint` changes (the
// server saw a new cookie after a form action) and on MESSAGES_CHECK (after an action called from the browser).
export function PageMessages({ hint }: { hint?: string }) {
  const [messages, setMessages] = useState<(PageMessage & { id: number })[]>([]);
  const pathname = usePathname();

  const take = useCallback(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${MESSAGES_COOKIE}=`))
      ?.slice(MESSAGES_COOKIE.length + 1);
    let incoming: PageMessage[] = [];
    try {
      incoming = parseMessages(raw && decodeURIComponent(raw));
    } catch {
      // A malformed cookie is dropped below.
    }
    if (raw === undefined) return;
    document.cookie = `${MESSAGES_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    if (incoming.length === 0) return;
    setMessages((current) => [...current, ...incoming.map((m, i) => ({ ...m, id: Date.now() + i }))].slice(-5));
  }, []);

  // A new page starts with only its own messages.
  useEffect(() => {
    setMessages([]);
    take();
  }, [pathname, take]);
  useEffect(() => take(), [hint, take]);
  useEffect(() => {
    window.addEventListener(MESSAGES_CHECK, take);
    return () => window.removeEventListener(MESSAGES_CHECK, take);
  }, [take]);

  if (messages.length === 0) return null;
  return (
    <div className="sticky top-0 z-30 -mt-2 mb-4 flex flex-col gap-2 pt-2">
      {messages.map((m) => (
        <div
          key={m.id}
          role={m.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm ${STYLE[m.type].box}`}
        >
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${STYLE[m.type].icon}`}
          >
            {STYLE[m.type].symbol}
          </span>
          <p className="m-0 flex-1">{m.text}</p>
          <button
            type="button"
            onClick={() => setMessages((current) => current.filter((x) => x.id !== m.id))}
            aria-label="Dismiss message"
            className="-my-1 flex h-7 w-7 flex-none items-center justify-center rounded text-base opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const STYLE = {
  success: { box: "border-green-200 bg-green-50 text-green-900", icon: "bg-green-700", symbol: "✓" },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: "bg-red-700", symbol: "✕" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", icon: "bg-amber-600", symbol: "!" },
};

// After calling a Server Action from the browser: show what it recorded.
export const checkMessages = () => window.dispatchEvent(new Event(MESSAGES_CHECK));
