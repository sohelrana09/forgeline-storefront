// Shared data for the pricing POC scripts (ct:tier-prices, ct:customer-group-prices): every spare part with
// quantity breaks. Base prices are the sample data's (same amount in USD and EUR); each price list takes its own
// percentage off the base at the SKU's two break quantities.
export const SPARE_PARTS: { sku: string; base: number; breaks: [number, number] }[] = [
  { sku: "air-filter", base: 4000, breaks: [10, 50] },
  { sku: "oil-filter", base: 2750, breaks: [12, 48] },
  { sku: "fuel-filter", base: 3250, breaks: [10, 50] },
  { sku: "hydraulic-hose", base: 7500, breaks: [5, 20] },
  { sku: "brake-pad-set", base: 10000, breaks: [4, 12] },
  { sku: "led-work-light", base: 10000, breaks: [4, 12] },
  { sku: "piston-ring-set", base: 17500, breaks: [4, 10] },
  { sku: "tapered-roller-bearing", base: 20000, breaks: [4, 10] },
  { sku: "starter-motor", base: 20000, breaks: [2, 5] },
  { sku: "alternator", base: 27500, breaks: [2, 5] },
  { sku: "pin-and-bushing-kit", base: 32500, breaks: [3, 8] },
];

// `percent` off the base in cents, rounded to 5 cents.
export const off = (base: number, percent: number) => Math.round((base * (100 - percent)) / 100 / 5) * 5;

// The two quantity breaks at the given percentages off the base: [[minimumQuantity, cents], ...].
export const breaksAt = (part: (typeof SPARE_PARTS)[number], percents: [number, number]): [number, number][] =>
  part.breaks.map((q, i) => [q, off(part.base, percents[i])]);
