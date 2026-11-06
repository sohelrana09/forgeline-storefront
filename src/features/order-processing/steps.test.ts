import { describe, expect, it } from "vitest";
import {
  CLAIM_TTL_MS,
  parseMarker,
  pendingSteps,
  stepDecision,
  withoutStep,
  withStep,
  failureCount,
  releaseStep,
} from "@/features/order-processing/steps";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("parseMarker", () => {
  it("keeps valid step records", () => {
    const marker = parseMarker({ steps: { number: { state: "done", at: ago(0) }, confirmation: { state: "claimed", at: ago(5) } } });
    expect(Object.keys(marker.steps)).toEqual(["number", "confirmation"]);
  });

  it("drops broken records and survives junk", () => {
    expect(parseMarker({ steps: { a: { state: "weird", at: ago(0) }, b: { state: "done", at: "not a date" }, c: null } })).toEqual({
      steps: {},
    });
    for (const value of [undefined, null, "x", { steps: "x" }]) expect(parseMarker(value)).toEqual({ steps: {} });
  });
});

describe("stepDecision", () => {
  it("runs a step nobody has started", () => {
    expect(stepDecision({ steps: {} }, "confirmation", NOW)).toBe("run");
  });

  it("skips a done step, however old", () => {
    expect(stepDecision({ steps: { confirmation: { state: "done", at: ago(CLAIM_TTL_MS * 10) } } }, "confirmation", NOW)).toBe("skip");
  });

  it("skips a fresh claim and takes over an abandoned one", () => {
    expect(stepDecision({ steps: { c: { state: "claimed", at: ago(CLAIM_TTL_MS - 1) } } }, "c", NOW)).toBe("skip");
    expect(stepDecision({ steps: { c: { state: "claimed", at: ago(CLAIM_TTL_MS + 1) } } }, "c", NOW)).toBe("run");
  });
});

describe("withStep / withoutStep", () => {
  it("records and releases a step without touching the others", () => {
    const claimed = withStep({ steps: { number: { state: "done", at: ago(0) } } }, "confirmation", "claimed", NOW);
    expect(claimed.steps.confirmation).toEqual({ state: "claimed", at: new Date(NOW).toISOString() });
    expect(withoutStep(claimed, "confirmation")).toEqual({ steps: { number: { state: "done", at: ago(0) } } });
  });
});

describe("pendingSteps", () => {
  it("lists every step for an order without a marker", () => {
    expect(pendingSteps(undefined, ["a", "b"], NOW)).toEqual(["a", "b"]);
  });

  it("lists only steps that may run", () => {
    const marker = { steps: { a: { state: "done" as const, at: ago(0) }, b: { state: "claimed" as const, at: ago(1) } } };
    expect(pendingSteps(marker, ["a", "b", "c"], NOW)).toEqual(["c"]);
  });
});

describe("releaseStep", () => {
  const at = "2026-11-06T10:00:00.000Z";
  const claimed = { steps: { payment: { state: "claimed" as const, at }, number: { state: "done" as const, at } } };

  it("removes this worker's own claim and keeps the other steps", () => {
    expect(releaseStep(claimed, "payment", at)).toEqual({ steps: { number: { state: "done", at } }, failures: { payment: 1 } });
  });

  it("counts every failure of a step", () => {
    const again = { ...claimed, failures: { payment: 2 } };
    expect(failureCount(releaseStep(again, "payment", at)!, "payment")).toBe(3);
    expect(parseMarker(releaseStep(again, "payment", at)).failures).toEqual({ payment: 3 });
  });

  it("leaves a step that was finished or taken over meanwhile", () => {
    expect(releaseStep({ steps: { payment: { state: "done", at } } }, "payment", at)).toBeUndefined();
    expect(releaseStep(claimed, "payment", "2026-11-06T10:11:00.000Z")).toBeUndefined();
    expect(releaseStep({ steps: {} }, "payment", at)).toBeUndefined();
  });
});
