import "server-only";
import { ClientBuilder } from "@commercetools/ts-client";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

export const projectKey = requireEnv("CTP_PROJECT_KEY");

const client = new ClientBuilder()
  .withProjectKey(projectKey)
  .withClientCredentialsFlow({
    host: requireEnv("CTP_AUTH_URL"),
    projectKey,
    credentials: {
      clientId: requireEnv("CTP_CLIENT_ID"),
      clientSecret: requireEnv("CTP_CLIENT_SECRET"),
    },
    scopes: process.env.CTP_SCOPES?.split(" ").filter(Boolean),
    httpClient: fetch,
  })
  .withHttpMiddleware({
    host: requireEnv("CTP_API_URL"),
    httpClient: fetch,
  })
  .build();

// Server-only: uses the API client secret. Never import this from a client component.
export const apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey });

// Requests made AS a logged-in customer (/me, /as-associate): commercetools enforces their associate permissions.
export function customerApiRoot(accessToken: string) {
  const customerClient = new ClientBuilder()
    .withProjectKey(projectKey)
    .withExistingTokenFlow(`Bearer ${accessToken}`, { force: true })
    .withHttpMiddleware({ host: requireEnv("CTP_API_URL"), httpClient: fetch })
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
