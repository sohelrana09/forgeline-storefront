// Calls the storefront's POST /api/revalidate by hand, the way the Sanity webhook and the catalog Subscription do
// (docs/cache-refresh.md): the cached reads for the scope expire at once. The secret comes from REVALIDATE_SECRET.
//   npm run ct:revalidate                                    SITE_URL, scope "all"
//   npm run ct:revalidate -- --url http://localhost:3100 --scope catalog
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const site = option("url") ?? process.env.SITE_URL;
  const scope = option("scope") ?? "all";
  const secret = process.env.REVALIDATE_SECRET;
  if (!site) throw new Error("Pass --url or set SITE_URL");
  if (!secret) throw new Error("REVALIDATE_SECRET is not set");
  if (!["all", "catalog", "content"].includes(scope)) throw new Error(`Unknown scope: ${scope}`);

  const response = await fetch(new URL("/api/revalidate", site), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ scope }),
  });
  console.log(response.status, await response.text());
  if (!response.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
