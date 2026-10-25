import { useCallback } from 'react';
import {
  buildApiUrl,
  executeHttpClientRequest,
} from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';

type TStorefrontEnvironment = { storefrontUrl: string };

// After a save or delete, asks the storefront to refresh its cached guest pages (POST /api/revalidate).
// The call goes through Merchant Center's /proxy/forward-to, which signs a short-lived token for the signed-in
// user; the storefront verifies it, so the app holds no secret. The content is already saved, so a failure only
// warns: guests then see the change within 5 minutes.
export const useStorefrontRefresh = () => {
  const storefrontUrl = useApplicationContext<string, TStorefrontEnvironment>(
    (context) => context.environment.storefrontUrl
  );
  return useCallback(async () => {
    // No public storefront configured (STOREFRONT_URL): content still shows within the cache time.
    if (!storefrontUrl) return;
    try {
      await executeHttpClientRequest(
        async (options: RequestInit) => {
          const res = await fetch(buildApiUrl('/proxy/forward-to'), {
            ...options,
            method: 'POST',
            body: JSON.stringify({ scope: 'content' }),
          });
          // A refusal (e.g. 401 from the storefront) must reach the warning below, not count as success.
          if (!res.ok)
            throw new Error(`Storefront refresh: HTTP ${res.status}`);
          return {
            data: await res.json().catch(() => undefined),
            statusCode: res.status,
            getHeader: (key: string) => res.headers.get(key),
          };
        },
        {
          forwardToConfig: {
            uri: `${storefrontUrl.replace(/\/$/, '')}/api/revalidate`,
            version: 'v2',
            // Sent on to the storefront (top-level headers stay with the Merchant Center API).
            headers: { 'Content-Type': 'application/json' },
          },
        }
      );
    } catch (error) {
      console.warn('Storefront refresh failed', error);
    }
  }, [storefrontUrl]);
};
