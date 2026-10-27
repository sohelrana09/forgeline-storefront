export type QuickOrderLine = { sku: string; quantity: number };
export type QuickOrderError = { line: number; text: string; reason: string };

export type QuickOrderState = {
  added: { sku: string; name: string; quantity: number; quoteOnly?: boolean }[];
  errors: QuickOrderError[];
  submitted?: string;
};
