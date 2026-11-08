import { describe, expect, it } from "vitest";
import {
  cleanNote,
  deliveryWindow,
  parseProcurement,
  procurementActions,
  procurementEnabled,
  procurementRows,
  readProcurement,
} from "@/features/checkout/procurement";

const now = new Date("2026-11-08T22:30:00Z");

describe("deliveryWindow", () => {
  it("runs from tomorrow to one year from today (UTC days)", () => {
    expect(deliveryWindow(now)).toEqual({ min: "2026-11-09", max: "2027-11-08" });
  });
  it("crosses month and leap-year ends", () => {
    expect(deliveryWindow(new Date("2027-12-31T05:00:00Z")).min).toBe("2028-01-01");
    expect(deliveryWindow(new Date("2028-02-29T05:00:00Z")).max).toBe("2029-03-01");
  });
});

describe("parseProcurement", () => {
  it("accepts an empty form", () => expect(parseProcurement({}, now)).toEqual({ ok: true, value: {} }));

  it("trims and keeps valid values", () => {
    expect(
      parseProcurement({ costCentre: " CC-100 ", projectCode: "PRJ/7", requestedDeliveryDate: "2026-11-09", orderNote: " Gate 4 " }, now),
    ).toEqual({
      ok: true,
      value: { costCentre: "CC-100", projectCode: "PRJ/7", requestedDeliveryDate: "2026-11-09", orderNote: "Gate 4" },
    });
  });

  it("refuses codes with other characters or over 40 long", () => {
    expect(parseProcurement({ costCentre: "=cmd|' /C calc'!A0" }, now).ok).toBe(false);
    expect(parseProcurement({ projectCode: "x".repeat(41) }, now).ok).toBe(false);
  });

  it("refuses today, past, far-future and impossible dates", () => {
    for (const d of ["2026-11-08", "2025-01-01", "2027-11-09", "2026-02-30", "2026-13-01", "09/11/2026"]) {
      expect(parseProcurement({ requestedDeliveryDate: d }, now).ok, d).toBe(false);
    }
    expect(parseProcurement({ requestedDeliveryDate: "2027-11-08" }, now).ok).toBe(true);
  });

  it("limits the note after cleaning", () => {
    expect(parseProcurement({ orderNote: "a".repeat(501) }, now).ok).toBe(false);
    expect(parseProcurement({ orderNote: "a".repeat(500) }, now).ok).toBe(true);
  });
});

describe("cleanNote", () => {
  it("drops control and direction characters and keeps line breaks", () => {
    expect(cleanNote("a\u0000b‮c\r\nd\n\n\n\ne\t")).toBe("abc\nd\n\ne");
  });
});

describe("readProcurement", () => {
  it("reads only procurement strings", () => {
    expect(readProcurement({ fields: { approvalStatus: "Pending", costCentre: "CC", orderNote: "", projectCode: 5 } })).toEqual({
      costCentre: "CC",
    });
    expect(readProcurement(undefined)).toEqual({});
  });
});

describe("procurementActions", () => {
  it("sets the Type on a cart without one, only with values", () => {
    expect(procurementActions(undefined, {})).toEqual([]);
    expect(procurementActions(undefined, { costCentre: "CC" })).toEqual([
      { action: "setCustomType", type: { typeId: "type", key: "order-approval" }, fields: { costCentre: "CC" } },
    ]);
  });

  it("changes only what differs on a cart with the Type, removing cleared fields", () => {
    expect(
      procurementActions({ fields: { costCentre: "CC", projectCode: "P1", approvalStatus: "x" } }, { costCentre: "CC", orderNote: "n" }),
    ).toEqual([
      { action: "setCustomField", name: "projectCode", value: undefined },
      { action: "setCustomField", name: "orderNote", value: "n" },
    ]);
  });
});

describe("procurementRows / procurementEnabled", () => {
  it("lists filled fields in form order", () => {
    expect(procurementRows({ requestedDeliveryDate: "2026-12-01", costCentre: "CC" }, (d) => `day ${d}`)).toEqual([
      ["Cost centre", "CC"],
      ["Requested delivery", "day 2026-12-01"],
    ]);
  });
  it("is off unless PROCUREMENT_FIELDS=true", () => {
    expect(procurementEnabled({})).toBe(false);
    expect(procurementEnabled({ PROCUREMENT_FIELDS: "true" })).toBe(true);
  });
});
