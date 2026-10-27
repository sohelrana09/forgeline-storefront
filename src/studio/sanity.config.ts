"use client";

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { STUDIO_PATH } from "@/lib/sanity/env";
import { schemaTypes } from "@/studio/schemaTypes";
import { resolve } from "@/studio/presentation";

// The Sanity Studio, embedded at /studio (src/app/studio). Editors sign in with their Sanity account. Content pages
// and the blog live here; CMS blocks (banners, widgets) stay in commercetools and the Merchant Center Content app.
// The project id and dataset come from the server (NEXT_SANITY_*), so the config is built from them at runtime.
export const studioConfig = (projectId: string, dataset: string) =>
  defineConfig({
    name: "ironline",
    title: "Ironline Supply content",
    projectId: projectId || "unset",
    dataset,
    basePath: STUDIO_PATH,
    plugins: [
      structureTool({
        structure: (S) =>
          S.list()
            .title("Content")
            .items([
              S.documentTypeListItem("page").title("Pages"),
              S.divider(),
              S.documentTypeListItem("post").title("Blog posts"),
              S.documentTypeListItem("blogCategory").title("Blog categories"),
              S.documentTypeListItem("author").title("Authors"),
            ]),
      }),
      // Same origin as the storefront: the preview pane loads it with draft mode on (src/app/api/draft-mode).
      presentationTool({ resolve, previewUrl: { initial: "/", previewMode: { enable: "/api/draft-mode/enable" } } }),
    ],
    schema: { types: schemaTypes },
  });
