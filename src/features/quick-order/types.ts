export type QuickOrderLine = { sku: string; quantity: number };
export type QuickOrderError = { line: number; text: string; reason: string };

export type QuickOrderState = {
  // `price`: the unit price the line was added at (for the analytics data layer).
  added: {
    sku: string;
    name: string;
    quantity: number;
    quoteOnly?: boolean;
    price?: { centAmount: number; fractionDigits: number; currencyCode: string };
  }[];
  errors: QuickOrderError[];
  submitted?: string;
};
