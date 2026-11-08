export type PoImportState = {
  // Quick-order text ("SKU, quantity" per line) for the box.
  text?: string;
  count?: number;
  skipped?: string[];
  // Part numbers this shop doesn't sell (the add step reports them again).
  unknown?: string[];
  error?: string;
  // The pasted text, back after a failed read so the buyer doesn't lose it (the form resets after each action).
  poText?: string;
};
