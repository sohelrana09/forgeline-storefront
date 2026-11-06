// A company's price ladder for one SKU, as SAP calculates it (the source shop: MS SQL CustomerPrice → KeyDB hash
// `CardCode|ItemCode`, one field per QuantityFrom). Prices stay decimal strings: SAP sends up to 6 decimals.
export type LadderStep = { minQuantity: number; price: string };
export type Ladder = LadderStep[];

// A price store hash as the source shop's importer writes it: field = QuantityFrom ("" for 1), value = {"p": price, "ud": unix}.
// Upstash returns the values parsed, KeyDB/JSON files as strings; both are accepted.
export type LadderFields = Record<string, string | { p?: unknown; ud?: unknown }>;
