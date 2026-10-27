"use client";

import { useRouter } from "next/navigation";
import { VisualEditing } from "next-sanity/visual-editing";

// Click-to-edit overlays for the Studio's Presentation preview (draft mode only). Each edit in the Studio re-renders
// the page on the server, which reads the draft (src/lib/sanity/client.ts), so the preview follows as you type.
export function PreviewEditing() {
  const router = useRouter();
  return (
    <VisualEditing
      refresh={(payload) => {
        if (payload.source === "manual" || payload.source === "mutation") router.refresh();
        return Promise.resolve();
      }}
    />
  );
}
