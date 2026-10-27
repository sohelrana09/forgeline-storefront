import type { BaseAddress } from "@commercetools/platform-sdk";

// Address as display lines: name/company, street, postcode + city, region, country, phone.
export function addressLines(a: BaseAddress): string[] {
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ");
  const street = [a.streetName, a.streetNumber].filter(Boolean).join(" ");
  return [
    name,
    a.company,
    street,
    a.additionalStreetInfo,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    a.state ?? a.region,
    a.country && countryName(a.country),
    a.phone && `T: ${a.phone}`,
  ].filter((l): l is string => Boolean(l));
}

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });
export const countryName = (code: string) => regionNames.of(code) ?? code;

export const NAME_MAX = 60;
// Letters (any script), spaces, apostrophes, dots and hyphens: no markup or control characters in a profile name.
export const NAME_PATTERN = /^[\p{L}\p{M}' .-]{1,60}$/u;

// Consumer address form: each field's limits. Country is checked against CONSUMER_COUNTRIES on the server.
export const ADDRESS_FIELDS = {
  streetName: /^[\p{L}\p{M}\p{N}' .,/-]{2,100}$/u,
  streetNumber: /^[\p{L}\p{N} ./-]{0,20}$/u,
  additionalStreetInfo: /^[\p{L}\p{M}\p{N}' .,/#-]{0,100}$/u,
  postalCode: /^[A-Za-z0-9 -]{2,12}$/,
  city: /^[\p{L}\p{M}' .-]{2,60}$/u,
  phone: /^[+0-9 ()/-]{0,30}$/,
  company: /^[\p{L}\p{M}\p{N}' .,&()/-]{0,100}$/u,
};

const ADDRESS_KEYS = [
  "firstName",
  "lastName",
  "company",
  "streetName",
  "streetNumber",
  "additionalStreetInfo",
  "postalCode",
  "city",
  "country",
  "phone",
];

// Reads and validates an address form (address book, guest checkout). `countries`: where we deliver.
export function parseAddress(formData: FormData, countries: string[]): { address: BaseAddress } | { error: string } {
  const v = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, String(formData.get(k) ?? "").trim()]));
  if (![v.firstName, v.lastName].every((n) => NAME_PATTERN.test(n) && /\p{L}/u.test(n))) return { error: "Enter the first and last name." };
  for (const [key, pattern] of Object.entries(ADDRESS_FIELDS)) {
    if (!pattern.test(v[key])) return { error: `Check the ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.` };
  }
  if (!countries.includes(v.country)) return { error: "We deliver to Germany, France, Spain and the United Kingdom." };
  const filled = Object.fromEntries(Object.entries(v).filter(([, value]) => value !== ""));
  return { address: { ...filled, country: v.country } };
}
