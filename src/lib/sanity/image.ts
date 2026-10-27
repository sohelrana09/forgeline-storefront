import { createImageUrlBuilder, type SanityImageObject } from "@sanity/image-url";
import { sanityDataset, sanityProjectId } from "@/lib/sanity/env";

// Sanity image CDN URLs (cdn.sanity.io/images/<project>/<dataset>/…), cropped and hotspotted as set in the Studio.
// next/image resizes them further; this project's folder is allowed in next.config.ts.
const builder = createImageUrlBuilder({ projectId: sanityProjectId || "unset", dataset: sanityDataset });

export type SanityImage = Partial<SanityImageObject> & { alt?: string };

export const imageUrl = (source: SanityImage, width: number, height?: number) => {
  const image = builder
    .image(source as SanityImageObject)
    .width(width)
    .auto("format")
    .fit("crop");
  return (height ? image.height(height) : image).url();
};
