// PunchOut connections (docs/features/punchout.md): one per business unit, Custom Object punchout-config/<unit key>.
//   npm run ct:punchout                          lists the connections (never secrets)
//   npm run ct:punchout -- --unit <key> --customer <email> --identity <id> [--domain NetworkID] --return-host <host>
//        [--return-host <host>] [--formats cxml,oci] [--supplier-domain DUNS] [--supplier-identity FORGELINE] [--yes]
//                                               creates or updates one (dry run without --yes)
//   npm run ct:punchout -- --remove <unit key> [--yes]
// The shared secret is read from PUNCHOUT_SHARED_SECRET in the environment (at least 16 characters) and stored only as a
// scrypt hash; it is never printed. Without it, an update keeps the stored hash. For OCI the identity is the USERNAME
// the SAP system sends, and the domain is OCI.
import { apiRoot } from "../src/lib/commercetools/client";
import { CONFIG_CONTAINER, hashSecret, newSalt, parseConfig, type Format, type PunchoutConfig } from "../src/features/punchout/config";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const one = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const all = (name: string) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1].toLowerCase()] : []));
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const co = (key: string) => apiRoot.customObjects().withContainerAndKey({ container: CONFIG_CONTAINER, key });

async function list() {
  const { body } = await apiRoot
    .customObjects()
    .withContainer({ container: CONFIG_CONTAINER })
    .get({ queryArgs: { limit: 100 } })
    .execute();
  if (body.results.length === 0) return console.log("No PunchOut connections.");
  for (const o of body.results) {
    const c = parseConfig(o.value);
    console.log(
      c
        ? `${o.key}: ${c.domain}/${c.identity} → customer ${c.customerId}, formats ${c.formats.join(",")}, returns to ${c.returnHosts.join(", ")}`
        : `${o.key}: invalid config`,
    );
  }
}

async function remove(unit: string) {
  const existing = await co(unit)
    .get()
    .execute()
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (!existing) return console.log(`= ${unit}: no connection`);
  if (!yes) return console.log(`- would remove the connection of ${unit}`);
  await co(unit)
    .delete({ queryArgs: { version: existing.body.version } })
    .execute();
  console.log(`- removed the connection of ${unit}`);
}

async function save() {
  const unit = one("--unit");
  const email = one("--customer");
  const identity = one("--identity");
  const hosts = all("--return-host");
  if (!unit || !email || !identity || hosts.length === 0) throw new Error("--unit, --customer, --identity and --return-host are required");
  const formats = (one("--formats") ?? "cxml").split(",").filter((f): f is Format => f === "cxml" || f === "oci");
  if (formats.length === 0) throw new Error("--formats takes cxml, oci or cxml,oci");
  await apiRoot.businessUnits().withKey({ key: unit }).get().execute();
  const { body: customers } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `email = "${email.replace(/["\\]/g, "")}"`, limit: 1 } })
    .execute();
  const customer = customers.results[0];
  if (!customer) throw new Error(`No customer ${email}`);
  const existing = await co(unit)
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  const previous = parseConfig(existing?.value);
  const secret = process.env.PUNCHOUT_SHARED_SECRET;
  if (secret !== undefined && secret.length < 16) throw new Error("PUNCHOUT_SHARED_SECRET needs at least 16 characters");
  if (!secret && !previous) throw new Error("Set PUNCHOUT_SHARED_SECRET in the environment for a new connection");
  const salt = secret ? newSalt() : previous!.salt;
  const config: PunchoutConfig = {
    unitKey: unit,
    domain: one("--domain") ?? (formats.includes("cxml") ? "NetworkID" : "OCI"),
    identity,
    customerId: customer.id,
    salt,
    secretHash: secret ? hashSecret(secret, salt) : previous!.secretHash,
    returnHosts: hosts,
    formats,
    supplier: { domain: one("--supplier-domain") ?? "DUNS", identity: one("--supplier-identity") ?? "FORGELINE" },
  };
  const what = `${config.domain}/${identity} → ${email}, formats ${formats.join(",")}, returns to ${hosts.join(", ")}${secret ? ", new secret" : ", secret kept"}`;
  if (!yes) return console.log(`${existing ? "~ would update" : "+ would create"} ${unit}: ${what}`);
  await apiRoot
    .customObjects()
    .post({ body: { container: CONFIG_CONTAINER, key: unit, value: config, ...(existing && { version: existing.version }) } })
    .execute();
  console.log(`${existing ? "~ updated" : "+ created"} ${unit}: ${what}`);
}

const run = one("--remove") ? remove(one("--remove")!) : one("--unit") ? save() : list();
run.catch((err) => {
  console.error((err as { body?: unknown })?.body ?? (err as Error).message);
  process.exit(1);
});
