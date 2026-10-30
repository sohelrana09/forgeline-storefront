// Page messages ("You added Air Filter to your shopping cart."), passed in a cookie: a Server Action records them in
// a short-lived cookie (src/lib/flash.ts), and PageMessages (src/components/ui) shows them at the top of the page and
// clears the cookie (it streams in after the prerendered shell; the browser reads the cookie itself).
import { isLocalPath } from "@/lib/urls";

export type MessageType = "success" | "error" | "warning";
export type MessageLink = { href: string; label: string };
export type PageMessage = { type: MessageType; text: string; link?: MessageLink };

export const MESSAGES_COOKIE = "ct_messages";
// Fired in the browser after a Server Action returns, so the bar reads the cookie its response just set.
export const MESSAGES_CHECK = "messages:check";
// Fired in the browser with a form's result (FormMessage).
export const MESSAGES_SHOW = "messages:show";
export const MAX_MESSAGES = 5;

// `json` is the cookie's value as JSON: Next's cookies() API hands it over decoded (and encodes it when setting), the
// browser reads it encoded (decode it once first, see PageMessages).
export function parseMessages(json: string | undefined): PageMessage[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (m): m is PageMessage =>
          !!m &&
          typeof m.text === "string" &&
          m.text.length <= 300 &&
          ["success", "error", "warning"].includes(m.type) &&
          (m.link === undefined || isMessageLink(m.link)),
      )
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export const serializeMessages = (messages: PageMessage[]) => JSON.stringify(messages.slice(-MAX_MESSAGES));

const isMessageLink = (link: unknown): link is MessageLink =>
  !!link &&
  typeof (link as MessageLink).href === "string" &&
  isLocalPath((link as MessageLink).href) &&
  typeof (link as MessageLink).label === "string" &&
  (link as MessageLink).label.length <= 60;
