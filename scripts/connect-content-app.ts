// Deploys the Merchant Center "Content" app (cms-app/, see connect.yaml) on commercetools Connect, for this
// project only. Idempotent: creates or updates the connector, publishes it for private use, then creates or
// redeploys the deployment, and prints the app URL to enter in Merchant Center. Dry run unless --yes.
//   npm run ct:connect-content-app -- --repo git@github.com:<you>/<repo>.git --tag v1.0.0 --email you@example.com
//     [--storefront https://shop] [--yes]
// Needs an API client with manage_connectors and manage_connectors_deployments: CONNECT_CLIENT_ID/SECRET in .env
// (the admin client is used when they're absent; the default "admin" template doesn't include these scopes).
// Before: push the repository to GitHub and create the tag; a private repository must give the "connect-mu"
// GitHub user read access. Setup steps: docs/content-app-deployment.md.
import { projectKey, requireEnv } from "../src/lib/commercetools/client";

const CONNECTOR_KEY = "ironline-content-app";
const DEPLOYMENT_KEY = "ironline-content-app";
// Registered in Merchant Center (Organization settings > Custom Applications > Content). Not a secret.
const APPLICATION_ID = "cmvns244e000201xf0kp953tg";
const ENTRY_POINT = "cms-content";
const CLOUD_IDENTIFIER = "aws-us";

// e.g. https://api.us-east-2.aws.commercetools.com → us-east-2.aws
const region = new URL(requireEnv("CTP_API_URL")).hostname.replace(/^api\./, "").replace(/\.commercetools\.com$/, "");
const CONNECT_URL = `https://connect.${region}.commercetools.com`;

type Connector = {
  id: string;
  key: string;
  version: number;
  status?: string;
  hasChanges?: boolean;
  repository: { url: string; tag: string };
  publishingReport?: { entries?: { type: string; title: string; message?: string | null }[] } | null;
};
type Deployment = {
  id: string;
  key: string;
  version: number;
  status?: string;
  connector: { version: number; repository: { tag: string } };
  applications?: { applicationName: string; url?: string }[];
  details?: { build?: { report?: { entries?: { type: string; title: string; message?: string | null }[] } } };
};

function arg(name: string) {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function token() {
  const id = process.env.CONNECT_CLIENT_ID ?? requireEnv("CTP_CLIENT_ID");
  const secret = process.env.CONNECT_CLIENT_SECRET ?? requireEnv("CTP_CLIENT_SECRET");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${requireEnv("CTP_AUTH_URL")}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: `manage_connectors:${projectKey} manage_connectors_deployments:${projectKey}`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Connect token failed (${res.status} ${body.error ?? ""}): create an API client with manage_connectors and manage_connectors_deployments and set CONNECT_CLIENT_ID/CONNECT_CLIENT_SECRET`,
    );
  }
  return body.access_token;
}

async function connect<T>(auth: string, method: string, path: string, body?: unknown): Promise<T | undefined> {
  const res = await fetch(`${CONNECT_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (res.status === 404 && method === "GET") return undefined;
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status}`), { body: data });
  return data as T;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const report = (entries?: { type: string; title: string; message?: string | null }[]) =>
  (entries ?? []).map((e) => `  ${e.type}: ${e.title}${e.message ? ` (${e.message})` : ""}`).join("\n");

async function main() {
  const repo = arg("--repo");
  const tag = arg("--tag");
  const storefront = arg("--storefront");
  const creatorEmail = arg("--email");
  const apply = process.argv.includes("--yes");
  const auth = await token();

  let connector = await connect<Connector>(auth, "GET", `/connectors/drafts/key=${CONNECTOR_KEY}`);
  console.log(
    connector
      ? `Connector ${CONNECTOR_KEY}: ${connector.repository.url} @ ${connector.repository.tag} (${connector.status ?? "?"})`
      : `No connector "${CONNECTOR_KEY}" yet.`,
  );
  const deployment = await connect<Deployment>(auth, "GET", `/${projectKey}/deployments/key=${DEPLOYMENT_KEY}`);
  console.log(
    deployment
      ? `Deployment ${DEPLOYMENT_KEY}: ${deployment.status ?? "?"} (tag ${deployment.connector.repository.tag}) ${deployment.applications?.map((a) => a.url).join(" ") ?? ""}`
      : `No deployment "${DEPLOYMENT_KEY}" yet.`,
  );
  if (!repo || !tag || (!connector && !creatorEmail)) {
    console.log("Pass --repo <git SSH URL> --tag <tag> (--email <creator email> for a new connector) and --yes to create or update them.");
    return;
  }
  if (!apply) {
    console.log(
      `Would ${connector ? "update" : "create"} the connector at ${repo} @ ${tag}, publish it for ${projectKey}, and deploy it. Re-run with --yes.`,
    );
    return;
  }

  // 1. Connector (organization level, private to this project).
  if (!connector) {
    connector = await connect<Connector>(auth, "POST", "/connectors/drafts", {
      key: CONNECTOR_KEY,
      name: "Ironline Content app",
      description: "Merchant Center app for the Ironline storefront's CMS: banners, blocks, pages, media library.",
      creator: { email: creatorEmail },
      repository: { url: repo, tag },
      privateProjects: [projectKey],
      supportedRegions: [region],
    });
    console.log(`+ connector ${CONNECTOR_KEY}`);
  } else if (connector.repository.url !== repo || connector.repository.tag !== tag) {
    connector = await connect<Connector>(auth, "POST", `/connectors/drafts/key=${CONNECTOR_KEY}`, {
      version: connector.version,
      actions: [{ action: "setRepository", url: repo, tag }],
    });
    console.log(`~ connector ${CONNECTOR_KEY}: ${repo} @ ${tag}`);
  }

  // 2. Publish for private use (no certification) and wait until Connect has built and checked it.
  if (connector!.hasChanges !== false || connector!.status !== "Published") {
    connector = await connect<Connector>(auth, "POST", `/connectors/drafts/key=${CONNECTOR_KEY}`, {
      version: connector!.version,
      actions: [{ action: "publish", certification: false }],
    });
    console.log("~ publishing (Connect checks the repository; this takes a few minutes)");
  }
  for (let i = 0; i < 60 && connector!.status !== "Published"; i++) {
    if (connector!.status === "Failed") throw new Error(`Publishing failed:\n${report(connector!.publishingReport?.entries)}`);
    await wait(15_000);
    connector = await connect<Connector>(auth, "GET", `/connectors/drafts/key=${CONNECTOR_KEY}`);
    console.log(`  connector status: ${connector!.status}`);
  }
  if (connector!.status !== "Published") throw new Error("The connector isn't published yet; run again later.");

  // 3. Deploy (or redeploy with the newly published version).
  const configurations = [
    {
      applicationName: "cms-app",
      standardConfiguration: [
        { key: "CUSTOM_APPLICATION_ID", value: APPLICATION_ID },
        { key: "ENTRY_POINT_URI_PATH", value: ENTRY_POINT },
        { key: "CLOUD_IDENTIFIER", value: CLOUD_IDENTIFIER },
        ...(storefront ? [{ key: "STOREFRONT_URL", value: storefront }] : []),
      ],
    },
  ];
  let current = deployment
    ? await connect<Deployment>(auth, "POST", `/${projectKey}/deployments/key=${DEPLOYMENT_KEY}`, {
        version: deployment.version,
        actions: [{ action: "redeploy", updateConnector: true, configurationValues: configurations }],
      })
    : await connect<Deployment>(auth, "POST", `/${projectKey}/deployments`, {
        key: DEPLOYMENT_KEY,
        connector: { key: CONNECTOR_KEY, version: connector!.version },
        region,
        configurations,
      });
  console.log(deployment ? "~ redeploying" : "+ deploying");
  for (let i = 0; i < 80 && current!.status !== "Deployed" && current!.status !== "Failed"; i++) {
    await wait(15_000);
    current = await connect<Deployment>(auth, "GET", `/${projectKey}/deployments/key=${DEPLOYMENT_KEY}`);
    console.log(`  deployment status: ${current!.status}`);
  }
  if (current!.status !== "Deployed")
    throw new Error(`Deployment ${current!.status}:\n${report(current!.details?.build?.report?.entries)}`);
  const url = current!.applications?.find((a) => a.applicationName === "cms-app")?.url;
  console.log(`Deployed. App URL: ${url}`);
  console.log(
    "Next: Merchant Center > Organization settings > Custom Applications > Content: set Application URL to it, change the state to Ready, install it for ctwara.",
  );
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
