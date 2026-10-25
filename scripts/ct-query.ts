// Read-only explorer: GET any project endpoint and print JSON.
// Usage: npm run ct:query -- <path> [where] [limit]
//   npm run ct:query -- stores
//   npm run ct:query -- standalone-prices 'sku="air-filter"' 50
//   npm run ct:query -- product-projections/key=air-filter
import { projectKey } from "../src/lib/commercetools/client";

async function main() {
  const [path, where, limit = "20"] = process.argv.slice(2);
  if (!path) throw new Error("Usage: npm run ct:query -- <path> [where] [limit]");

  const auth = await fetch(`${process.env.CTP_AUTH_URL}/oauth/token?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.CTP_CLIENT_ID}:${process.env.CTP_CLIENT_SECRET}`).toString("base64")}`,
    },
  });
  const { access_token } = await auth.json();

  const url = new URL(`${process.env.CTP_API_URL}/${projectKey}/${path.replace(/^\//, "")}`);
  if (where) url.searchParams.set("where", where);
  if (!path.includes("/")) url.searchParams.set("limit", limit);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  console.log(JSON.stringify(await res.json(), null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
