import { PERMISSIONS, entryPointUriPath } from './src/constants';

// Production values come from the environment. On commercetools Connect (connect.yaml in the repo root) the
// deployment's configuration supplies CUSTOM_APPLICATION_ID (and STOREFRONT_URL once the storefront is public),
// and Connect itself sets APPLICATION_URL. A production build without the first two fails.
const isProduction = process.env.NODE_ENV === 'production';
const required = (name, devValue) => {
  const value = process.env[name];
  if (value) return value;
  if (isProduction)
    throw new Error(`Set ${name} to build the Content app for production`);
  return devValue;
};
if (
  process.env.ENTRY_POINT_URI_PATH &&
  process.env.ENTRY_POINT_URI_PATH !== entryPointUriPath
) {
  throw new Error(
    `ENTRY_POINT_URI_PATH must be "${entryPointUriPath}" (src/constants.ts), the path registered in Merchant Center`
  );
}

/**
 * Merchant Center "Content" app: edits the storefront's CMS blocks and pages, stored as Custom Objects
 * (containers "cms-block" and "cms-page"). Custom Objects are called "key value documents" in OAuth scopes.
 *
 * @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomApplication}
 */
const config = {
  name: 'Content',
  entryPointUriPath,
  // ctwara is in AWS us-east-2, which Merchant Center calls "aws-us".
  cloudIdentifier: process.env.CLOUD_IDENTIFIER || 'aws-us',
  env: {
    development: {
      initialProjectKey: 'ctwara',
    },
    production: {
      // From Merchant Center: Organization settings > Custom Applications > Content (the app's ID).
      applicationId: required('CUSTOM_APPLICATION_ID', 'not-registered'),
      // Where the built app is served (the Connect deployment's URL).
      url: required('APPLICATION_URL', 'http://localhost:3001'),
    },
  },
  // The storefront whose cached guest pages are refreshed after each save (POST /api/revalidate via
  // /proxy/forward-to). Must be publicly reachable: the Merchant Center API calls it, not the browser.
  additionalEnv: {
    storefrontUrl:
      process.env.STOREFRONT_URL ??
      (isProduction ? '' : 'http://localhost:3000'),
  },
  // Products: the media library is the images of one hidden product (see src/constants.ts).
  oAuthScopes: {
    view: ['view_key_value_documents', 'view_products'],
    manage: ['manage_key_value_documents', 'manage_products'],
  },
  icon: '${path:@commercetools-frontend/assets/application-icons/files.svg}',
  mainMenuLink: {
    defaultLabel: 'Content',
    labelAllLocales: [],
    permissions: [PERMISSIONS.View],
  },
  submenuLinks: [
    {
      uriPath: 'blocks',
      defaultLabel: 'Blocks',
      labelAllLocales: [],
      permissions: [PERMISSIONS.View],
    },
    {
      uriPath: 'pages',
      defaultLabel: 'Pages',
      labelAllLocales: [],
      permissions: [PERMISSIONS.View],
    },
  ],
};

export default config;
