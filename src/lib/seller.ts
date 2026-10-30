// The seller on order documents (invoice header, payment details). Demo values: replace them with the real company's
// registered name, address, VAT number and bank account before invoices go to customers.
export const SELLER = {
  name: "Ironline Supply Ltd",
  address: ["Industriestraße 12", "10115 Berlin", "Germany"],
  vatId: "DE000000000",
  email: "accounts@ironline-supply.example",
  bank: { name: "Example Bank", iban: "DE00 0000 0000 0000 0000 00", bic: "EXAMPLEXXX" },
  paymentTermsDays: 30,
} as const;
