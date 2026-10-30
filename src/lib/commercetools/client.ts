import "server-only";
import { ClientBuilder } from "@commercetools/ts-client";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";
import { traceFetch } from "@/lib/commercetools/trace";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const projectKey = requireEnv("CTP_PROJECT_KEY");

// Two clients. The running storefront (inside Next) uses CTP_CLIENT_* with the scopes in CTP_SCOPES (RUNTIME_SCOPES in
// ./scopes). Scripts (tsx, outside Next) change catalog data and need more: they use CTP_ADMIN_CLIENT_* when set, with
// CTP_ADMIN_SCOPES or all of that client's scopes; without it, CTP_CLIENT_* with all of its scopes, as before.
const inScript = !process.env.NEXT_RUNTIME;
const adminScript = inScript && !!process.env.CTP_ADMIN_CLIENT_ID;
const scopesFrom = (value: string | undefined) => value?.split(" ").filter(Boolean);

const client = new ClientBuilder()
  .withProjectKey(projectKey)
  .withClientCredentialsFlow({
    host: requireEnv("CTP_AUTH_URL"),
    projectKey,
    credentials: adminScript
      ? { clientId: requireEnv("CTP_ADMIN_CLIENT_ID"), clientSecret: requireEnv("CTP_ADMIN_CLIENT_SECRET") }
      : { clientId: requireEnv("CTP_CLIENT_ID"), clientSecret: requireEnv("CTP_CLIENT_SECRET") },
    scopes: adminScript ? scopesFrom(process.env.CTP_ADMIN_SCOPES) : inScript ? undefined : scopesFrom(process.env.CTP_SCOPES),
    httpClient: traceFetch,
  })
  .withHttpMiddleware({
    host: requireEnv("CTP_API_URL"),
    httpClient: traceFetch,
  })
  .build();

// Server-only: uses the API client secret. Never import this from a client component.
export const apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });

// Requests made AS a logged-in customer (/me, /as-associate): commercetools enforces their associate permissions.
export function customerApiRoot(accessToken: string) {
  const customerClient = new ClientBuilder()
    .withProjectKey(projectKey)
    .withExistingTokenFlow(`Bearer ${accessToken}`, { force: true })
    .withHttpMiddleware({ host: requireEnv("CTP_API_URL"), httpClient: traceFetch })
    .build();
  return createApiBuilderFromCtpClient(customerClient).withProjectKey({ projectKey });
}

// B2B "as associate" requests (orders, approval flows, approval rules in one business unit), made by the admin client
// on behalf of an associate. commercetools enforces that associate's role permissions, but it trusts the ids in the
// URL: call this only with ids from the signed-in session (never from form data), after reading the resource with
// the customer's own token and a live permission check (hasPermissionNow).
export function asAssociate(associateId: string, businessUnitKey: string) {
  return apiRoot.asAssociate().withAssociateIdValue({ associateId }).inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey });
}
