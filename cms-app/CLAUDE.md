# CLAUDE.md (Merchant Center "Content" app)

A Merchant Center Custom Application that edits the storefront's CMS content: blocks (Custom Objects in container `cms-block`) and pages (`cms-page`). The storefront reads the same objects (`src/features/cms/` in the repo root).

## Commands (run in this folder)

```bash
cp .env.example .env # first run: local settings (git-ignored)
npm start            # dev server on http://localhost:3001 (signs in with your Merchant Center account); from the repo root: npm --prefix cms-app start
npm run typecheck
npm run lint         # eslint + prettier; `npx eslint . --fix` formats
npm run build        # production bundle: needs CUSTOM_APPLICATION_ID and APPLICATION_URL (optional STOREFRONT_URL) in the environment
```

## Structure

- `custom-application-config.mjs`: name, menu (Content › Blocks / Pages), OAuth scopes `view/manage_key_value_documents` (Custom Objects) and `view/manage_products` (media library), cloud `aws-us`, dev project `ctwara`.
- `src/constants.ts`: content model (containers, placements, styles, validation patterns). **Keep in sync with `src/features/cms/types.ts` and `scripts/sync-content.ts` in the storefront.**
- `src/hooks/use-cms-connector/`: GraphQL (`*.ctp.graphql`) + hooks: list, get, save (`createOrUpdateCustomObject` with `version` for optimistic locking), delete.
- `src/hooks/use-media-library/`: media library = images of the hidden product `cms-media-library`; `prepareImage` converts to JPEG/PNG/GIF ≤ 2400 px; upload goes through `/proxy/ctp/.../products/{id}/images`; `useMediaDelete` checks usage in blocks/pages, then `removeImage`.
- Deployment: commercetools Connect from the repo root's `connect.yaml` (this folder's name must stay `cms-app`); registered in Merchant Center with ID `cmvns244e000201xf0kp953tg`. Steps in `docs/content-app-deployment.md`.
- `src/components/media/` (`media-picker` dialog, `image-field`) and `src/components/markdown/markdown-editor` (toolbar, shortcuts, image insert, live preview with react-markdown).
- `src/components/cms/`: `cms-list` (table + routes), `cms-editor` (shared load/save/delete modal), `block-details`, `page-details`, `conversions.ts` (form ↔ JSON + validation).

## Conventions

- Editing requires the app's **Manage** permission (`PERMISSIONS.Manage`); View-only users get read-only forms.
- New items check the key first: `createOrUpdateCustomObject` without a version would overwrite an existing object.
- Stored JSON must stay identical in shape to `content/blocks/*.json` / `content/pages/*.json`, so the git sync and this app can both be used.
- After each save or delete, `use-storefront-refresh` asks the storefront to refresh its cached guest pages through `/proxy/forward-to` (`additionalEnv.storefrontUrl`, from `STOREFRONT_URL` at build time; must be publicly reachable). Failures only warn.
- UI text is plain English (no i18n messages yet).
- GraphQL result types are written by hand in the hooks; there is no codegen step.
