// Ends sessions commercetools can't end for us. After a password reset it keeps a customer's access tokens (up to 48 h)
// valid, and a copied cookie outlives sign-out if the token revocation failed. So a Custom Object (container
// "session-revocation", key = customer id) holds the time before which sessions are refused, and the ids of sessions
// that signed out. Read at most every 60 s per process, and never served stale after that; a failed read lets the
// session through (an outage must not sign everyone out).
import "server-only";
import { statusOf } from "@/lib/commercetools/errors";
import { apiRoot } from "@/lib/commercetools/client";
import { reportEvent } from "@/lib/error-report";
import { staleWhileRevalidate } from "@/lib/memo";
import { parseRevocation, withEndedSession, type Revocation } from "@/features/auth/utils";

const CONTAINER = "session-revocation";
const memo = staleWhileRevalidate<Revocation>(60 * 1000, { maxStaleMs: 0 });

const stored = (customerId: string) => apiRoot.customObjects().withContainerAndKey({ container: CONTAINER, key: customerId });

const read = (customerId: string) =>
  stored(customerId)
    .get()
    .execute()
    .then((r) => ({ value: parseRevocation(r.body.value), version: r.body.version as number | undefined }))
    .catch((err) => {
      if (statusOf(err) === 404) return { value: parseRevocation(undefined), version: undefined };
      throw err;
    });

export async function sessionRevocation(customerId: string): Promise<Revocation> {
  return memo(customerId, () => read(customerId).then((r) => r.value)).catch((err) => {
    console.error("session revocation check failed", (err as { body?: unknown })?.body ?? err);
    return parseRevocation(undefined);
  });
}

// Every session of the customer. No version: the last write wins, which is the latest time either way, and the time
// also covers the sessions listed as ended.
export async function endSessions(customerId: string) {
  await apiRoot
    .customObjects()
    .post({ body: { container: CONTAINER, key: customerId, value: { after: Date.now() } } })
    .execute();
  memo.forget(customerId);
}

// One session, at sign-out. Never fails the sign-out: the cookie is deleted either way.
export async function endSession(customerId: string, sid: string, until: number) {
  try {
    for (let attempt = 1; ; attempt++) {
      const { value, version } = await read(customerId);
      try {
        await apiRoot
          .customObjects()
          .post({ body: { container: CONTAINER, key: customerId, version, value: withEndedSession(value, sid, until, Date.now()) } })
          .execute();
        break;
      } catch (err) {
        if (statusOf(err) !== 409 || attempt === 2) throw err;
      }
    }
    memo.forget(customerId);
  } catch (err) {
    reportEvent("session_end_failed", err, { customerId });
  }
}
