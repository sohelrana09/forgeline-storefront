// Pure helpers for `npm run setup` (scripts/setup.ts): env files, regions, the storefront client's scopes, the demo
// password. No network, no file access, so they are unit-tested (lib.test.ts).

// commercetools hosts a project in one region; its auth and API hosts follow the same pattern.
export const REGIONS = [
  { id: "us-central1.gcp", label: "North America (Google Cloud, Iowa)" },
  { id: "us-east-2.aws", label: "North America (AWS, Ohio)" },
  { id: "europe-west1.gcp", label: "Europe (Google Cloud, Belgium)" },
  { id: "eu-central-1.aws", label: "Europe (AWS, Frankfurt)" },
  { id: "australia-southeast1.gcp", label: "Australia (Google Cloud, Sydney)" },
] as const;

export const regionUrls = (region: string) => ({
  CTP_AUTH_URL: `https://auth.${region}.commercetools.com`,
  CTP_API_URL: `https://api.${region}.commercetools.com`,
});

// The region of an existing CTP_API_URL, for messages.
export const regionOf = (apiUrl: string | undefined) => apiUrl?.match(/^https:\/\/api\.([a-z0-9.-]+)\.commercetools\.com/)?.[1];

// KEY=value lines; comments, blank lines and commented-out keys are ignored. Values may be quoted.
export function parseEnv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    values.set(m[1], m[2].replace(/^(["'])(.*)\1$/, "$2"));
  }
  return values;
}

// Sets KEY=value: replaces the first uncommented KEY= line (keeping its place in the file), otherwise appends it.
// Values with spaces or # are quoted.
export function setEnvValue(text: string, key: string, value: string): string {
  const line = `${key}=${/[\s#"']/.test(value) ? JSON.stringify(value) : value}`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\n*$/, "")}\n${line}\n`;
}

// What the storefront's API client must hold: exactly what the app asks for (customerScopes and guestScopes in
// src/features/auth/session.ts, sign-up with a client token): profile and quotes project-wide, orders and shopping
// lists per store, and anonymous tokens for guests.
export function storefrontScopes(projectKey: string, storeKeys: string[]): string[] {
  const stores = [...new Set(storeKeys)].sort();
  return [
    `manage_my_profile:${projectKey}`,
    `manage_my_quote_requests:${projectKey}`,
    `manage_my_quotes:${projectKey}`,
    `create_anonymous_token:${projectKey}`,
    ...stores.map((s) => `manage_my_orders:${projectKey}:${s}`),
    ...stores.map((s) => `manage_my_shopping_lists:${projectKey}:${s}`),
  ];
}

// A readable demo password from random bytes: four groups of four characters (no look-alikes such as 0/O, 1/l).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function demoPassword(bytes: Uint8Array): string {
  if (bytes.length < 16) throw new Error("demoPassword needs 16 random bytes");
  const chars = [...bytes.slice(0, 16)].map((b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
