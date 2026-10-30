import { Studio } from "@/studio/Studio";
import { sanityDataset, sanityProjectId } from "@/lib/sanity/env";

// The embedded Sanity Studio (editors sign in with their Sanity account). Static: the Studio is a client app; the
// project settings are read here, at build time, and passed in (they aren't NEXT_PUBLIC_ variables).
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <Studio projectId={sanityProjectId} dataset={sanityDataset} />;
}
