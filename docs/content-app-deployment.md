# Content app in production (commercetools Connect)

The Merchant Center "Content" app (`cms-app/`) is hosted by **commercetools Connect** and registered in Merchant Center. Connect builds it from a GitHub repository at a Git tag, using `connect.yaml` in the repository root (the app folder's name, `cms-app`, must match `deployAs.name`).

## Status

| Step | State |
|---|---|
| App registered in Merchant Center (Organization settings > Custom Applications > Content), entry point `cms-content`, scopes View: `view_key_value_documents`, `view_products` / Manage: `manage_key_value_documents`, `manage_products`, menu Content > Blocks, Pages | Done, state **Draft**. Application ID `cmvns244e000201xf0kp953tg`. Application URL is a placeholder until step 3. |
| Production build from environment variables (`CUSTOM_APPLICATION_ID`, `APPLICATION_URL`, optional `STOREFRONT_URL`) | Done, tested locally |
| Repository on GitHub with a tag | **You** (I never commit or push) |
| Connector published (private, for ctwara) and deployed | After the push |
| Application URL updated, state Ready, installed for ctwara | After the deployment |

## 1. Push the repository (you)

1. Create a GitHub repository, push this project, and create a tag, for example `v1.0.0`. Every redeploy needs a new tag.
2. If the repository is private, give the GitHub user **connect-mu** read access (repository Settings > Collaborators).
3. Use the SSH URL, for example `git@github.com:<you>/<repo>.git`.

Only `connect.yaml` and `cms-app/` matter to Connect; the storefront is not deployed by it.

## 2. Publish and deploy the connector

Either way works:

- **Merchant Center (no extra credentials):** Organization settings > **Connect** > create an organization connector with the repository URL and tag, **Publish for private use** (project ctwara), then install it in ctwara with `CUSTOM_APPLICATION_ID = cmvns244e000201xf0kp953tg`, `ENTRY_POINT_URI_PATH = cms-content`, `CLOUD_IDENTIFIER = aws-us`, and `STOREFRONT_URL` once the storefront is public. When the installation is **Installed**, open it and copy the app's URL.
- **Script:** create an API client with `manage_connectors` and `manage_connectors_deployments`, put its ID and secret in the env file as `CONNECT_CLIENT_ID` / `CONNECT_CLIENT_SECRET`, then:

```bash
npm run ct:connect-content-app -- --repo git@github.com:<you>/<repo>.git --tag v1.0.0 --email <your email> --yes
```

It creates or updates the connector, publishes it for private use, deploys it (or redeploys with the new tag) and prints the app URL. Without `--yes` it only shows what it would do.

## 3. Finish in Merchant Center

Organization settings > Custom Applications > **Configure Custom Applications** > Content:
1. Set **Application URL** to the deployment URL from step 2.
2. Change the state from **Draft** to **Ready**.
3. **Install Custom Applications** > Content > install for project ctwara (or all projects).

The app then appears in the ctwara left menu as **Content** for every user whose team has its View permission (Manage to edit, upload and delete).

## Updating the app later

Change `cms-app/`, push, create a new tag, then run the script again with the new `--tag` (or update the connector's tag in Merchant Center and redeploy).

## Local development

```bash
npm --prefix cms-app start
```

Development needs none of the production variables: it serves on http://localhost:3001 and signs in with your Merchant Center account.
