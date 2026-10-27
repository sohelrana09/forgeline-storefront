// Page messages ("You added Air Filter to your shopping cart."), passed in a cookie: a Server Action records them in
// a short-lived cookie (src/lib/flash.ts), and PageMessages (src/components/ui) shows them at the top of the page and
// clears the cookie. That also works on the cached guest pages, whose HTML never reads cookies: the browser does.
export type MessageType = "success" | "error" | "warning";
export type PageMessage = { type: MessageType; text: string };

export const MESSAGES_COOKIE = "ct_messages";
// Fired in the browser after a Server Action returns, so the bar reads the cookie its response just set.
export const MESSAGES_CHECK = "messages:check";
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
          !!m && typeof m.text === "string" && m.text.length <= 300 && ["success", "error", "warning"].includes(m.type),
      )
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export const serializeMessages = (messages: PageMessage[]) => JSON.stringify(messages.slice(-MAX_MESSAGES));
