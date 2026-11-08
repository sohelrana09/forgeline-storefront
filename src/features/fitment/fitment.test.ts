import { describe, expect, it } from "vitest";
import { applyEquipment, buildFitmentIndex, equipmentLabel, fitsMachines, parseEquipment } from "@/features/fitment/fitment";

const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const index = buildFitmentIndex([
  { id: M2, slug: "zx-200", name: "Zeta excavator", related: [P1] },
  { id: M1, slug: "ab-100", name: "Alpha loader", sku: "ab-100-1", related: [P1, P2, P2, M1] },
  { id: P1, slug: "air-filter", name: "Air filter", related: [] },
]);

describe("buildFitmentIndex", () => {
  it("inverts relatedProducts into parts → machines, sorted by name, without self or duplicate links", () => {
    expect(Object.keys(index.machines).sort()).toEqual([M1, M2]);
    expect(index.machines[M1].parts).toEqual([P1, P2]);
    expect(fitsMachines(index, P1).map((m) => m.slug)).toEqual(["ab-100", "zx-200"]);
    expect(fitsMachines(index, P2).map((m) => m.slug)).toEqual(["ab-100"]);
    expect(fitsMachines(index, "nope")).toEqual([]);
  });
});

describe("equipment", () => {
  it("keeps only valid, existing machines and cleans labels", () => {
    const items = parseEquipment(
      { items: [{ machineId: M1, label: "  Yard 3\u0007 ", serial: "SN-1" }, { machineId: "x" }, { machineId: P2 }, "junk"] },
      index,
    );
    expect(items).toEqual([{ machineId: M1, label: "Yard 3", serial: "SN-1" }]);
    expect(parseEquipment(undefined)).toEqual([]);
  });
  it("adds, refuses duplicates and removes", () => {
    const added = applyEquipment([], { op: "add", item: { machineId: M1, serial: "A" } });
    expect(added.items).toHaveLength(1);
    expect(applyEquipment(added.items, { op: "add", item: { machineId: M1, serial: "A" } }).error).toMatch(/already/);
    expect(applyEquipment(added.items, { op: "add", item: { machineId: M1, serial: "B" } }).items).toHaveLength(2);
    expect(applyEquipment(added.items, { op: "remove", index: 0 }).items).toEqual([]);
    expect(applyEquipment(added.items, { op: "remove", index: 3 }).error).toBeDefined();
  });
  it("labels a machine by the company's name, else the product, with the serial", () => {
    expect(equipmentLabel({ machineId: M1, serial: "9" }, index.machines[M1])).toBe("Alpha loader, S/N 9");
    expect(equipmentLabel({ machineId: M1, label: "Yard 3" }, index.machines[M1])).toBe("Yard 3");
  });
});
