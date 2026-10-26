import "server-only";
import { checkBotId } from "botid/server";

// Spam protection for public forms (sign-in, sign-up, password reset, guest checkout), on top of the rate limits:
// - FormGuardFields (src/components/ui) adds a honeypot field people never see and the time the form was open,
//   measured in the browser (so a wrong clock can't block anyone);
// - Vercel BotID classifies the request (its paths are listed in src/instrumentation-client.ts). Locally it always
//   answers "human". If the check itself fails, the request goes through: the rate limits still apply.
export const HONEYPOT_FIELD = "website";
export const ELAPSED_FIELD = "form_elapsed";
const MIN_FILL_MS = 1500;

export const AUTOMATED_MESSAGE = "We couldn't verify this request. Please reload the page and try again.";

export async function isAutomated(formData?: FormData): Promise<boolean> {
  if (formData) {
    if (String(formData.get(HONEYPOT_FIELD) ?? "") !== "") return true;
    const elapsed = Number(formData.get(ELAPSED_FIELD));
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return true;
  }
  try {
    return (await checkBotId()).isBot;
  } catch (err) {
    console.error("BotID check failed", err);
    return false;
  }
}
