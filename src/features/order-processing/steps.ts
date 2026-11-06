// Which after-order steps (G1) still have to run for an order. Pure, unit-tested; service.ts does the reads and writes.
//
// Every order gets one marker, a Custom Object in container `order-processing` keyed by the order id, with one record
// per step: `claimed` while a worker runs it, `done` afterwards. A worker claims a step by writing the marker with the
// version it read, so of two workers (the server action, a Subscription event, the sweep) only one wins (the other
// gets a 409). A claim older than CLAIM_TTL_MS is treated as abandoned (a crashed worker) and may be taken over.

export const MARKER_CONTAINER = "order-processing";
export const CLAIM_TTL_MS = 10 * 60_000;

export type StepRecord = { state: "claimed" | "done"; at: string };
// `failures`: how often each step has failed so far, so a step that keeps failing raises an alert.
export type Marker = { steps: Record<string, StepRecord>; failures?: Record<string, number> };

// After this many failures a step counts as stuck: someone has to look at it.
export const STUCK_AFTER = 3;

// A stored marker value, defensively: unknown or broken records are dropped (and so run again).
export function parseMarker(value: unknown): Marker {
  const steps: Record<string, StepRecord> = {};
  const raw = (value as { steps?: unknown } | undefined)?.steps;
  if (raw && typeof raw === "object") {
    for (const [name, record] of Object.entries(raw as Record<string, unknown>)) {
      const r = record as Partial<StepRecord> | undefined;
      if ((r?.state === "claimed" || r?.state === "done") && typeof r.at === "string" && !Number.isNaN(Date.parse(r.at))) {
        steps[name] = { state: r.state, at: r.at };
      }
    }
  }
  const failures = (value as { failures?: unknown } | undefined)?.failures;
  return failures && typeof failures === "object" ? { steps, failures: failures as Record<string, number> } : { steps };
}

// "run": nobody has done or is doing this step. "skip": done, or claimed by a worker that is still within its time.
export function stepDecision(marker: Marker, step: string, now: number): "run" | "skip" {
  const record = marker.steps[step];
  if (!record) return "run";
  if (record.state === "done") return "skip";
  return now - Date.parse(record.at) > CLAIM_TTL_MS ? "run" : "skip";
}

export const withStep = (marker: Marker, step: string, state: StepRecord["state"], now: number): Marker => ({
  ...marker,
  steps: { ...marker.steps, [step]: { state, at: new Date(now).toISOString() } },
});

export const withoutStep = (marker: Marker, step: string): Marker => ({
  ...marker,
  steps: Object.fromEntries(Object.entries(marker.steps).filter(([name]) => name !== step)),
});

// The steps an order still needs (for the sweep): not done, and not freshly claimed by someone else.
export const pendingSteps = (marker: Marker | undefined, steps: readonly string[], now: number) =>
  steps.filter((step) => !marker || stepDecision(marker, step, now) === "run");

// Gives up a claim after a failed step, so the next event or the sweep retries it. Only this worker's own claim (the
// time it claimed at): undefined when the record changed meanwhile (done, or taken over after expiring).
export function releaseStep(marker: Marker, step: string, claimedAt: string): Marker | undefined {
  const record = marker.steps[step];
  if (record?.state !== "claimed" || record.at !== claimedAt) return undefined;
  const released = withoutStep(marker, step);
  return { ...released, failures: { ...released.failures, [step]: failureCount(marker, step) + 1 } };
}

export const failureCount = (marker: Marker, step: string) => Number(marker.failures?.[step]) || 0;
