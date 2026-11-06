// The seller on order documents (invoice header, payment details), from SELLER_* in the environment. The defaults are
// demo values for development: src/lib/env.ts refuses them on a site that is open to the public (SITE_INDEXABLE=true).
const DEMO = {
  name: "Ironline Supply Ltd",
  address: "Industriestraße 12|10115 Berlin|Germany",
  vatId: "DE000000000",
  email: "accounts@ironline-supply.example",
  bankName: "Example Bank",
  iban: "DE00 0000 0000 0000 0000 00",
  bic: "EXAMPLEXXX",
};

const env = process.env;

export const SELLER = {
  name: env.SELLER_NAME || DEMO.name,
  // Address lines, separated by "|".
  address: (env.SELLER_ADDRESS || DEMO.address).split("|").map((l) => l.trim()),
  vatId: env.SELLER_VAT_ID || DEMO.vatId,
  email: env.SELLER_EMAIL || DEMO.email,
  bank: { name: env.SELLER_BANK_NAME || DEMO.bankName, iban: env.SELLER_IBAN || DEMO.iban, bic: env.SELLER_BIC || DEMO.bic },
  paymentTermsDays: Number(env.SELLER_PAYMENT_TERMS_DAYS) || 30,
};

// The variables still on a demo value. A wrong IBAN or VAT number on a real invoice is a legal and a money problem.
export const demoSellerFields = (e: Record<string, string | undefined>) =>
  ["SELLER_NAME", "SELLER_VAT_ID", "SELLER_EMAIL", "SELLER_BANK_NAME", "SELLER_IBAN", "SELLER_BIC", "SELLER_ADDRESS"].filter((k) => !e[k]);
