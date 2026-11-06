import "server-only";
import { createHash } from "node:crypto";

// Was this password in a known breach? Have I Been Pwned's range API: only the first 5 characters of the SHA-1 leave
// this server, never the password. Fails open (it must not stop sign-up when the service is down), and
// PASSWORD_BREACH_CHECK=false turns it off.
const TIMEOUT_MS = 1_500;

export async function isBreached(password: string): Promise<boolean> {
  if (process.env.PASSWORD_BREACH_CHECK === "false") return false;
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return false;
    return breachedIn(await res.text(), hash.slice(5));
  } catch {
    return false;
  }
}

export const BREACHED_MESSAGE = "This password appeared in a data breach. Please choose another one.";

// Lines are "SUFFIX:COUNT"; padding lines have a count of 0.
function breachedIn(body: string, suffix: string) {
  return body.split("\n").some((line) => {
    const [candidate, count] = line.trim().split(":");
    return candidate === suffix && Number(count) > 0;
  });
}
