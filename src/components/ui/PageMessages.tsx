"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Message } from "@/components/ui/Message";
import {
  MAX_MESSAGES,
  MESSAGES_CHECK,
  MESSAGES_COOKIE,
  MESSAGES_SHOW,
  parseMessages,
  type MessageLink,
  type PageMessage,
} from "@/lib/messages";

// Page messages at the top of the content, shown until dismissed or the next page. They arrive in the ct_messages
// cookie (src/lib/flash.ts), read on every page, when `hint` changes and on MESSAGES_CHECK. A form's result arrives
// through MESSAGES_SHOW (FormMessage) and replaces what is shown.
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
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMessages([]);
  }
  // The cookie is outside React, so reading it is an effect's job.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => take(), [pathname, hint, take]);
  useEffect(() => {
    const show = (event: Event) => {
      const incoming = (event as CustomEvent<PageMessage[]>).detail;
      setMessages(incoming.slice(-MAX_MESSAGES).map((m, i) => ({ ...m, id: Date.now() + i })));
    };
    window.addEventListener(MESSAGES_CHECK, take);
    window.addEventListener(MESSAGES_SHOW, show);
    return () => {
      window.removeEventListener(MESSAGES_CHECK, take);
      window.removeEventListener(MESSAGES_SHOW, show);
    };
  }, [take]);

  if (messages.length === 0) return null;
  return (
    <div className="sticky top-0 z-30 -mt-2 mb-4 flex flex-col gap-2 pt-2">
      {messages.map((m) => (
        <Message key={m.id} type={m.type} link={m.link} onDismiss={() => setMessages((current) => current.filter((x) => x.id !== m.id))}>
          {m.text}
        </Message>
      ))}
    </div>
  );
}

// After calling a Server Action from the browser: show what it recorded.
export const checkMessages = () => window.dispatchEvent(new Event(MESSAGES_CHECK));

// Shows a form's result (useActionState) in the page messages, once per new state.
export function FormMessage({ state, error, success, link }: { state: unknown; error?: string; success?: string; link?: MessageLink }) {
  const shown = useRef(state);
  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    const messages: PageMessage[] = [];
    if (error) messages.push({ type: "error", text: error });
    if (success) messages.push({ type: "success", text: success, ...(link && { link }) });
    if (messages.length > 0) window.dispatchEvent(new CustomEvent(MESSAGES_SHOW, { detail: messages }));
  });
  return null;
}
