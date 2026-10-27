import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { previewClient } from "@/lib/sanity/client";
import { sanityConfigured } from "@/lib/sanity/env";

// Turned on by the Studio's Presentation tool, which sends a short-lived secret that is checked against Sanity with
// the Viewer token. Only then does this browser get the draft-mode cookie (drafts, click-to-edit overlays).
export async function GET(request: Request) {
  if (!sanityConfigured || !process.env.SANITY_API_READ_TOKEN) return new Response("Preview is not set up", { status: 404 });
  return defineEnableDraftMode({ client: previewClient() }).GET(request);
}
