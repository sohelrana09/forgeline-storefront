import type { BaseAddress } from "@commercetools/platform-sdk";

// Express payments (docs/features/express-payments.md), pure and unit-tested: Apple Pay, Google Pay or PayPal buttons
// on the cart through commercetools Checkout's express payment flow. The wallet sheet sends addresses and the
// buyer's choices back through callbacks; these helpers turn what the wallet sends into cart data, and never trust it
// further than an address a guest would type.

export const expressEnabled = (env: Record<string, string | undefined> = process.env) => env.CHECKOUT_EXPRESS === "true";

type WalletAddress = {
  country?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  streetName?: unknown;
  streetNumber?: unknown;
  additionalStreetInfo?: unknown;
  state?: unknown;
  postalCode?: unknown;
  city?: unknown;
  phone?: unknown;
  email?: unknown;
};

const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .trim()
        .slice(0, max) || undefined
    : undefined;

export const EXPRESS_COUNTRIES = ["DE", "ES", "FR", "GB"];

// The partial address a wallet shares before the buyer confirms (for shipping rates): country, postcode, city.
export function partialAddress(a: WalletAddress): BaseAddress | undefined {
  const country = text(a.country, 2)?.toUpperCase();
  if (!country || !EXPRESS_COUNTRIES.includes(country)) return undefined;
  return { country, postalCode: text(a.postalCode, 20), city: text(a.city, 80), state: text(a.state, 80) };
}

// The full address once the buyer confirms: name, street and city are required, as in the guest checkout form.
export function fullAddress(a: WalletAddress): BaseAddress | undefined {
  const base = partialAddress(a);
  const address: BaseAddress | undefined = base && {
    ...base,
    firstName: text(a.firstName, 60),
    lastName: text(a.lastName, 60),
    streetName: text(a.streetName, 120),
    streetNumber: text(a.streetNumber, 20),
    additionalStreetInfo: text(a.additionalStreetInfo, 120),
    phone: text(a.phone, 30),
  };
  return address?.lastName && address.streetName && address.city && address.postalCode ? address : undefined;
}

const EMAIL = /^[^\s@"\\]{1,64}@[^\s@"\\]{1,190}\.[A-Za-z]{2,}$/;
export const walletEmail = (v: unknown) => (typeof v === "string" && EMAIL.test(v.trim()) ? v.trim() : undefined);

type Money = { centAmount: number; currencyCode: string; fractionDigits: number };

// Shipping options as the wallet sheet lists them: free once the lines reach the rate's freeAbove, as commercetools
// will charge.
export function walletShippingMethods(
  options: { key: string; name: string; price?: Money; freeAbove?: Money }[],
  linesTotal: number,
  selectedKey?: string,
) {
  return options
    .filter((o) => o.price)
    .map((o) => ({
      id: o.key,
      name: o.name,
      isSelected: o.key === selectedKey,
      amount: {
        type: "centPrecision" as const,
        ...o.price!,
        centAmount: o.freeAbove && linesTotal >= o.freeAbove.centAmount ? 0 : o.price!.centAmount,
      },
    }));
}
