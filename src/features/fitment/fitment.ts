// Fitment (docs/features/fitment.md), pure and unit-tested. Which parts fit which machine comes from the machines'
// relatedProducts attribute (curated in Merchant Center): a machine lists its compatible parts, so the index inverts
// that into "this part fits these machines". A company's equipment (the machines it owns) lives in the Custom Object
// company-equipment/<unit key>, and narrows the catalog to parts that fit it.

export const EQUIPMENT_CONTAINER = "company-equipment";
export const EQUIPMENT_MAX = 50;
export const LABEL_MAX = 60;

export type Machine = { id: string; slug: string; name: string; sku?: string; parts: string[] };
// Plain data, so it can be cached: machines by id, and machine ids by part id.
export type FitmentIndex = { machines: Record<string, Machine>; machinesOf: Record<string, string[]> };

export function buildFitmentIndex(products: { id: string; slug: string; name: string; sku?: string; related: string[] }[]): FitmentIndex {
  const machines: Record<string, Machine> = {};
  const machinesOf: Record<string, string[]> = {};
  for (const p of products) {
    const parts = [...new Set(p.related)].filter((id) => id !== p.id);
    if (parts.length === 0) continue;
    machines[p.id] = { id: p.id, slug: p.slug, name: p.name, sku: p.sku, parts };
    for (const part of parts) (machinesOf[part] ??= []).push(p.id);
  }
  for (const ids of Object.values(machinesOf)) ids.sort((a, b) => machines[a].name.localeCompare(machines[b].name));
  return { machines, machinesOf };
}

export const fitsMachines = (index: FitmentIndex, partId: string): Machine[] =>
  (index.machinesOf[partId] ?? []).map((id) => index.machines[id]);

export type EquipmentItem = { machineId: string; label?: string; serial?: string };

const clean = (s: unknown, max: number) =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, max) || undefined
    : undefined;

// The stored list, dropping anything malformed (and machines that no longer exist, when an index is given).
export function parseEquipment(value: unknown, index?: FitmentIndex): EquipmentItem[] {
  const items = (value as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: EquipmentItem[] = [];
  for (const raw of items) {
    const machineId = (raw as EquipmentItem)?.machineId;
    if (typeof machineId !== "string" || !/^[0-9a-f-]{36}$/.test(machineId)) continue;
    if (index && !index.machines[machineId]) continue;
    out.push({ machineId, label: clean((raw as EquipmentItem).label, LABEL_MAX), serial: clean((raw as EquipmentItem).serial, 40) });
    if (out.length >= EQUIPMENT_MAX) break;
  }
  return out;
}

export type EquipmentChange = { op: "add"; item: EquipmentItem } | { op: "remove"; index: number };

export function applyEquipment(items: EquipmentItem[], change: EquipmentChange): { items: EquipmentItem[]; error?: string } {
  if (change.op === "remove") {
    if (change.index < 0 || change.index >= items.length) return { items, error: "That machine is no longer in the list." };
    return { items: items.filter((_, i) => i !== change.index) };
  }
  if (items.length >= EQUIPMENT_MAX) return { items, error: `A company can list up to ${EQUIPMENT_MAX} machines.` };
  const item = { machineId: change.item.machineId, label: clean(change.item.label, LABEL_MAX), serial: clean(change.item.serial, 40) };
  if (items.some((i) => i.machineId === item.machineId && (i.serial ?? "") === (item.serial ?? ""))) {
    return { items, error: "That machine is already in the list." };
  }
  return { items: [...items, item] };
}

// The label a company sees for one of its machines: their own name, else the product name, plus the serial.
export const equipmentLabel = (item: EquipmentItem, machine?: Machine) =>
  [item.label ?? machine?.name ?? "Unknown machine", item.serial && `S/N ${item.serial}`].filter(Boolean).join(", ");
