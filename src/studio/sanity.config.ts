"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { STUDIO_PATH } from "@/lib/sanity/env";
import { schemaTypes } from "@/studio/schemaTypes";
import { resolve } from "@/studio/presentation";
import { storefrontUrl } from "@/studio/storefront";

// The Sanity Studio, embedded at /studio (src/app/studio). Editors sign in with their Sanity account. Content pages,
// blocks (banners, notices, featured products) and the blog live here.
// The project id and dataset come from the server (NEXT_SANITY_*), so the config is built from them at runtime.
// The same config also runs as a standalone Studio on its own domain (sanity.config.ts at the root, `sanity deploy`,
// docs/sanity-studio.md): then its base path is "/" and it previews the storefront at SANITY_STUDIO_STOREFRONT_URL.
export const studioConfig = (projectId: string, dataset: string, basePath = STUDIO_PATH) =>
  defineConfig({
    name: "ironline",
    title: "Ironline Supply content",
    projectId: projectId || "unset",
    dataset,
    basePath,
    plugins: [
      structureTool({
        structure: (S) =>
          S.list()
            .title("Content")
            .items([
              S.documentTypeListItem("page").title("Pages"),
              S.documentTypeListItem("cmsBlock").title("Blocks"),
              S.divider(),
              S.documentTypeListItem("post").title("Blog posts"),
              S.documentTypeListItem("blogCategory").title("Blog categories"),
              S.documentTypeListItem("author").title("Authors"),
            ]),
      }),
      // The preview pane loads the storefront with draft mode on (src/app/api/draft-mode): the same origin when
      // embedded, else the storefront's address.
      presentationTool({
        resolve,
        previewUrl: {
          ...(storefrontUrl && { origin: storefrontUrl }),
          initial: "/",
          previewMode: { enable: "/api/draft-mode/enable" },
        },
      }),
    ],
    schema: { types: schemaTypes },
  });
