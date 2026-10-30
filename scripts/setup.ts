// One-command setup for a commercetools project with the B2B sample data:
//   npm run setup                  asks for what's missing, then sets everything up (safe to run again)
//   npm run setup -- --check       read-only: reports what's ready and what's missing, changes nothing
//   npm run setup -- --yes         no questions (CI): fails if .env lacks the admin client; with --demo-passwords it
//                                  also sets the demo password on the sample users
//   npm run setup -- --with-pricing-demo   also loads the pricing demos (tier prices, trade-member prices)
// Steps: .env (admin client, region, generated REVALIDATE_SECRET and SESSION_SECRET) → admin client works → B2B sample data loaded →
// storefront API client (created with exactly the shop's scopes when the admin client may create API clients, else
// you paste its id and secret) → demo password in .env.demo, set on the sample users → purchase-list permissions and
// the demo approval rule → demo blog in Sanity when configured. Values already in .env are never replaced, and no
// secret is ever printed. The seed scripts it runs are the ct:* ones (each idempotent, see package.json).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { demoPassword, parseEnv, REGIONS, regionOf, regionUrls, setEnvValue, storefrontScopes } from "./setup/lib";
import { RUNTIME_SCOPES, runtimeScopes } from "../src/lib/commercetools/scopes";

const args = process.argv.slice(2);
const check = args.includes("--check");
const noQuestions = args.includes("--yes") || !process.stdin.isTTY;
const ENV_FILE = process.env.SETUP_ENV_FILE ?? ".env";
const DEMO_FILE = process.env.SETUP_DEMO_FILE ?? ".env.demo";
// The B2B sample data's stores; the storefront's prices are mapped to them (STORE_PRICING, GUEST_STORE_KEY).
const SAMPLE_STORES = ["de-fr-uk", "default-store", "spain", "us-large-customers", "us-medium-customers"];
const DEMO_ACCOUNTS = [
  ["sofia-lopez@ltsl.com", "buyer, LiftTech Soluciones (Spain)"],
  ["carlos-garcia@ltsl.com", "approver"],
  ["oliver-smith@ltsl.com", "company admin"],
];

const todo: string[] = [];
const say = (status: "ok" | "todo" | "fail" | "info", text: string) => {
  console.log(`${{ ok: "  ok  ", todo: " todo ", fail: " FAIL ", info: "      " }[status]} ${text}`);
  if (status === "todo") todo.push(text);
};
const heading = (text: string) => console.log(`\n${text}`);
class SetupError extends Error {}

// ---------- questions (hidden input for secrets) ----------

let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});
const rl = noQuestions ? undefined : createInterface({ input: process.stdin, output, terminal: true });

async function ask(question: string, { secret = false } = {}): Promise<string> {
  if (!rl) throw new SetupError(`Missing: ${question.replace(/[:\s(]*(hidden\))?[:\s]*$/, "").trim()} (run without --yes to be asked)`);
  process.stdout.write(question);
  muted = secret;
  const answer = (await rl.question("")).trim();
  muted = false;
  if (secret) process.stdout.write("\n");
  return answer;
}

async function confirm(question: string): Promise<boolean> {
  if (!rl) return false;
  return /^y(es)?$/i.test(await ask(`${question} [y/N] `));
}

// ---------- env files ----------

const readFile = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);
let envText = readFile(ENV_FILE);
let demoText = readFile(DEMO_FILE) ?? "";
const env = () => parseEnv(envText ?? "");
const filled = (key: string) => {
  const value = env().get(key);
  return value && !value.includes("your-project-key") ? value : undefined;
};
function setEnv(key: string, value: string) {
  envText = setEnvValue(envText ?? "", key, value);
  writeFileSync(ENV_FILE, envText);
}

// ---------- commercetools over plain fetch (the app's client needs a complete .env at import time) ----------

type Token = { ok: true; accessToken: string; scope: string } | { ok: false; error: string };

async function token(clientId: string, clientSecret: string, scope: string): Promise<Token> {
  const response = await fetch(`${filled("CTP_AUTH_URL")}/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope }),
  }).catch((err: Error) => ({ ok: false, status: 0, json: async () => ({ error: err.message }) }) as const);
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string; message?: string };
  if (!response.ok || !body.access_token) return { ok: false, error: body.error ?? body.message ?? `status ${response.status}` };
  return { ok: true, accessToken: body.access_token, scope: body.scope ?? "" };
}

async function api<T>(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${filled("CTP_API_URL")}/${filled("CTP_PROJECT_KEY")}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SetupError(`${init.method ?? "GET"} ${path}: ${(body as { message?: string }).message ?? response.status}`);
  return body as T;
}

// Runs one of the ct:* seed scripts with this setup's env files.
function seed(script: string, scriptArgs: string[], { demo = false } = {}) {
  rl?.pause();
  const result = spawnSync(
    "npx",
    [
      "tsx",
      "--conditions=react-server",
      `--env-file=${ENV_FILE}`,
      ...(demo ? [`--env-file=${DEMO_FILE}`] : []),
      `scripts/${script}`,
      ...scriptArgs,
    ],
    { stdio: "inherit" },
  );
  rl?.resume();
  if (result.status !== 0) throw new SetupError(`scripts/${script} failed`);
}

// ---------- steps ----------

async function envFile() {
  heading("1. Settings (.env)");
  if (!envText) {
    if (check) throw new SetupError(`${ENV_FILE} is missing: run npm run setup`);
    envText = readFileSync(".env.example", "utf8");
    writeFileSync(ENV_FILE, envText);
    say("ok", `created ${ENV_FILE} from .env.example`);
  }
  const missing = ["CTP_PROJECT_KEY", "CTP_CLIENT_ID", "CTP_CLIENT_SECRET"].filter((k) => !filled(k));
  if (missing.length && check) throw new SetupError(`${ENV_FILE} lacks ${missing.join(", ")}: run npm run setup`);
  if (missing.length) {
    console.log(
      "\n   Your admin API client: Merchant Center → Settings → Developer settings → Create new API client,\n" +
        '   template "Admin client". Copy the values from the page shown after creating it (the secret is shown once).\n',
    );
    if (!filled("CTP_PROJECT_KEY")) setEnv("CTP_PROJECT_KEY", await ask("   Project key: "));
    if (!filled("CTP_CLIENT_ID")) setEnv("CTP_CLIENT_ID", await ask("   Client ID: "));
    if (!filled("CTP_CLIENT_SECRET")) setEnv("CTP_CLIENT_SECRET", await ask("   Secret (hidden): ", { secret: true }));
    if (missing.includes("CTP_PROJECT_KEY") || !regionOf(filled("CTP_API_URL"))) {
      console.log("\n   Region (the host in the API URL on that page):");
      REGIONS.forEach((r, i) => console.log(`     ${i + 1}. ${r.id}  ${r.label}`));
      const pick = REGIONS[Number(await ask(`   Number [1-${REGIONS.length}]: `)) - 1];
      if (!pick) throw new SetupError("No region picked");
      for (const [key, value] of Object.entries(regionUrls(pick.id))) setEnv(key, value);
    }
  }
  // With a separate admin client, CTP_SCOPES stays empty: the shop's narrowed client gets all of its own scopes.
  if (!filled("CTP_SCOPES") && !filled("CTP_ADMIN_CLIENT_ID")) {
    if (check) say("todo", "CTP_SCOPES is empty (setup sets it to manage_project:<project key>)");
    else setEnv("CTP_SCOPES", `manage_project:${filled("CTP_PROJECT_KEY")}`);
  }
  if (!filled("REVALIDATE_SECRET")) {
    if (check) say("todo", "REVALIDATE_SECRET is empty (setup generates one)");
    else {
      setEnv("REVALIDATE_SECRET", randomBytes(32).toString("hex"));
      say("ok", "generated REVALIDATE_SECRET (add the same value to your hosting, e.g. Vercel)");
    }
  }
  if (!filled("SESSION_SECRET")) {
    if (check) say("todo", "SESSION_SECRET is empty (setup generates one; until then the key comes from CTP_CLIENT_SECRET)");
    else {
      setEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
      say("ok", "generated SESSION_SECRET (add the same value to your hosting, e.g. Vercel)");
    }
  }
  say("ok", `project ${filled("CTP_PROJECT_KEY")} in ${regionOf(filled("CTP_API_URL")) ?? filled("CTP_API_URL")}`);
}

// The client for setup and the seed scripts: CTP_ADMIN_CLIENT_* once the shop runs on its own narrowed client
// (CTP_CLIENT_*, see runtimeClient below), else CTP_CLIENT_* as before.
function adminCredentials() {
  if (filled("CTP_ADMIN_CLIENT_ID"))
    return {
      id: filled("CTP_ADMIN_CLIENT_ID")!,
      secret: filled("CTP_ADMIN_CLIENT_SECRET") ?? "",
      scope: filled("CTP_ADMIN_SCOPES") ?? `manage_project:${filled("CTP_PROJECT_KEY")}`,
    };
  return { id: filled("CTP_CLIENT_ID")!, secret: filled("CTP_CLIENT_SECRET")!, scope: filled("CTP_SCOPES")! };
}

async function adminClient() {
  heading("2. Admin API client");
  const { id, secret, scope } = adminCredentials();
  const admin = await token(id, secret, scope);
  if (!admin.ok)
    throw new SetupError(
      `the admin client was refused (${admin.error}): fix ${filled("CTP_ADMIN_CLIENT_ID") ? "CTP_ADMIN_CLIENT_ID, CTP_ADMIN_CLIENT_SECRET" : "CTP_CLIENT_ID, CTP_CLIENT_SECRET"}, the region URLs or the scopes in ${ENV_FILE} (setup never replaces a value that is set) and run it again`,
    );
  const project = await api<{ name: string; currencies: string[] }>(admin.accessToken, "");
  say("ok", `signed in to "${project.name}" (${project.currencies.join(", ")})`);
  return admin.accessToken;
}

type BusinessUnit = { key: string; stores?: { key: string }[] };

async function sampleData(accessToken: string) {
  heading("3. B2B sample data");
  const [stores, units] = await Promise.all([
    api<{ results: { key: string }[] }>(accessToken, "/stores?limit=100"),
    api<{ results: BusinessUnit[]; total?: number }>(accessToken, "/business-units?limit=100"),
  ]);
  const storeKeys = stores.results.map((s) => s.key);
  const absent = SAMPLE_STORES.filter((k) => !storeKeys.includes(k));
  const sample = absent.length === 0 && units.results.length > 0;
  if (sample) say("ok", `${storeKeys.length} stores, ${units.results.length} business units`);
  else
    say(
      "todo",
      `the B2B sample data isn't loaded (missing stores: ${absent.join(", ") || "none"}; business units: ${units.results.length}). ` +
        "Create a project with it in Merchant Center; the demo seeds below are skipped",
    );
  // The stores the shop sells from: the units' own stores (divisions inherit theirs) and the B2C store.
  const sellingStores = [...new Set([...units.results.flatMap((u) => (u.stores ?? []).map((s) => s.key)), "default-store"])].filter((k) =>
    storeKeys.includes(k),
  );
  return { sample, sellingStores };
}

async function storefrontClient(stores: string[]) {
  heading("4. Storefront API client (customer sign-in)");
  const projectKey = filled("CTP_PROJECT_KEY")!;
  const scopes = storefrontScopes(projectKey, stores);
  if (!filled("CTP_STOREFRONT_CLIENT_ID") || !filled("CTP_STOREFRONT_CLIENT_SECRET")) {
    if (check) return say("todo", "no storefront API client in .env (setup creates one or asks for it)");
    const admin = adminCredentials();
    const manager = await token(admin.id, admin.secret, `manage_api_clients:${projectKey}`);
    if (manager.ok) {
      const created = await api<{ id: string; secret: string }>(manager.accessToken, "/api-clients", {
        method: "POST",
        body: { name: "Forgeline storefront", scope: scopes.join(" ") },
      });
      setEnv("CTP_STOREFRONT_CLIENT_ID", created.id);
      setEnv("CTP_STOREFRONT_CLIENT_SECRET", created.secret);
      say("ok", `created "Forgeline storefront" with ${scopes.length} scopes`);
    } else {
      console.log(
        "\n   Your admin client may not create API clients, so create this one by hand: Merchant Center → Settings →\n" +
          "   Developer settings → Create new API client, no template, with exactly these scopes:\n" +
          scopes.map((s) => `     ${s}`).join("\n") +
          "\n   (In the form: the project-wide ones under the project, the :<store> ones under each store.)\n",
      );
      setEnv("CTP_STOREFRONT_CLIENT_ID", await ask("   Storefront client ID: "));
      setEnv("CTP_STOREFRONT_CLIENT_SECRET", await ask("   Storefront secret (hidden): ", { secret: true }));
    }
  }
  const id = filled("CTP_STOREFRONT_CLIENT_ID")!;
  const secret = filled("CTP_STOREFRONT_CLIENT_SECRET")!;
  if ((await token(id, secret, scopes.join(" "))).ok) return say("ok", `holds all ${scopes.length} scopes the shop asks for`);
  // Find the missing ones, one request each.
  const missing: string[] = [];
  for (const scope of scopes) if (!(await token(id, secret, scope)).ok) missing.push(scope);
  if (missing.length === scopes.length)
    throw new SetupError("the storefront client was refused: check CTP_STOREFRONT_CLIENT_ID and its secret");
  say("todo", `the storefront client lacks: ${missing.join(" ")} (edit it in Merchant Center)`);
}

// The client the running shop uses (CTP_CLIENT_*). Fine to start with the admin client; for production it should
// hold only RUNTIME_SCOPES, so a leak can't change products, prices or project settings (docs/api-clients.md).
async function runtimeClient() {
  heading("5. Runtime API client (the running shop)");
  const projectKey = filled("CTP_PROJECT_KEY")!;
  const id = filled("CTP_CLIENT_ID")!;
  const secret = filled("CTP_CLIENT_SECRET")!;
  if ((await token(id, secret, `manage_project:${projectKey}`)).ok)
    return say(
      "info",
      "the shop uses an admin client (manage_project): fine locally; for production give it its own client, see docs/api-clients.md",
    );
  if ((await token(id, secret, runtimeScopes(projectKey))).ok)
    return say("ok", `narrowed client: exactly the ${RUNTIME_SCOPES.length} scopes the shop needs, no manage_project`);
  const missing: string[] = [];
  for (const scope of RUNTIME_SCOPES) if (!(await token(id, secret, `${scope}:${projectKey}`)).ok) missing.push(scope);
  say("todo", `the runtime client (CTP_CLIENT_*) lacks: ${missing.join(" ")} (edit it in Merchant Center)`);
}

async function demoUsers() {
  heading("6. Demo sign-ins");
  let password = parseEnv(demoText).get("DEMO_BUYER_PASSWORD");
  if (!password) {
    if (check) return say("todo", `no demo password yet (setup writes one to ${DEMO_FILE})`);
    password = demoPassword(randomBytes(16));
    demoText = setEnvValue(demoText, "DEMO_BUYER_PASSWORD", password);
    writeFileSync(DEMO_FILE, demoText);
    say("ok", `generated a demo password in ${DEMO_FILE} (git-ignored)`);
  }
  if (check) return say("info", `demo password in ${DEMO_FILE}; npm run setup sets it on the sample users`);
  const agreed =
    args.includes("--demo-passwords") ||
    (await confirm(
      "   Set this password on every user of the sample business units (buyers, approvers, admins)?\n" +
        "   Only on a demo project: it replaces those customers' passwords.",
    ));
  if (!agreed) return say("todo", "demo password not set on the sample users (run npm run ct:seed-associates -- --force)");
  seed("seed-demo-buyers.ts", ["--all-roles", "--force"], { demo: true });
  say("ok", "sample users can sign in with the demo password");
}

function featureSeeds() {
  heading("7. Demo data for the B2B features");
  seed("seed-shopping-list-permissions.ts", check ? [] : ["--yes"]);
  if (check) say("info", "the demo approval rule (orders over €10,000 in the Spanish unit) is seeded by npm run setup");
  else {
    seed("seed-approval-rules.ts", []);
    say("ok", "purchase-list permissions and the demo approval rule");
  }
  if (args.includes("--with-pricing-demo")) {
    seed("tier-prices.ts", check ? [] : ["--yes"]);
    seed("customer-group-prices.ts", check ? [] : ["--yes"]);
  } else say("info", "pricing demos (tier prices, trade-member prices) skipped: add --with-pricing-demo");
}

function sanity() {
  heading("8. Content (Sanity, optional)");
  if (!filled("NEXT_SANITY_PROJECT_ID")) return say("info", "no Sanity project: no content pages or blog (see .env.example)");
  if (!filled("SANITY_API_WRITE_TOKEN")) return say("info", "Sanity configured; add SANITY_API_WRITE_TOKEN to load the demo blog");
  seed("sanity-content.ts", check ? [] : ["--yes"]);
}

async function main() {
  console.log(check ? "Forgeline setup check (read-only)" : "Forgeline setup");
  await envFile();
  const adminToken = await adminClient();
  const { sample, sellingStores } = await sampleData(adminToken);
  await storefrontClient(sellingStores);
  await runtimeClient();
  if (sample) {
    await demoUsers();
    featureSeeds();
  }
  sanity();

  heading(todo.length ? "Still to do:" : "Ready.");
  for (const item of todo) console.log(`  - ${item}`);
  if (!check || !todo.length) {
    console.log("\n  npm run dev, then open http://localhost:3000");
    if (sample) {
      console.log(`  Sign in with the password in ${DEMO_FILE}:`);
      for (const [email, role] of DEMO_ACCOUNTS) console.log(`    ${email.padEnd(26)} ${role}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(`\n FAIL  ${err instanceof SetupError ? err.message : (err?.body ?? err)}`);
    process.exitCode = 1;
  })
  .finally(() => rl?.close());
