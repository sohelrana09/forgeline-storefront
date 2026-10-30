// Ends a customer's sessions after a password reset: commercetools keeps their access tokens (up to 48 h) valid, so a
// Custom Object (container "session-revocation", key = customer id) marks the time before which getSession() refuses
// them. Memoized 60 s per process; a failed read lets the session through (an outage must not sign everyone out).
import "server-only";
import { apiRoot } from "@/lib/commercetools/client";
import { staleWhileRevalidate } from "@/lib/memo";

const CONTAINER = "session-revocation";
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const memo = staleWhileRevalidate<number>(60 * 1000);

// Epoch ms; sessions issued before it are no longer accepted (0 = no mark).
export async function sessionsValidAfter(customerId: string): Promise<number> {
  return memo(customerId, () =>
    apiRoot
      .customObjects()
      .withContainerAndKey({ container: CONTAINER, key: customerId })
      .get()
      .execute()
      .then((r) => Number((r.body.value as { after?: number })?.after) || 0)
      .catch((err) => (statusOf(err) === 404 ? 0 : Promise.reject(err))),
  ).catch((err) => {
    console.error("session revocation check failed", (err as { body?: unknown })?.body ?? err);
    return 0;
  });
}

// No version: the last write wins, which is the latest time either way.
export async function endSessions(customerId: string) {
  await apiRoot
    .customObjects()
    .post({ body: { container: CONTAINER, key: customerId, value: { after: Date.now() } } })
    .execute();
  memo.forget(customerId);
}
