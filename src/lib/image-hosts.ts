// Where product pictures come from: the B2B sample data's bucket, and the folder of this project on the commercetools
// image CDN (product images uploaded in Merchant Center). The CDN host is shared by every commercetools project, so
// only the project's own folder is allowed. Set NEXT_PUBLIC_PRODUCT_IMAGES_URL to that folder, for example
// https://images.us-east-2.aws.commercetools.com/<folder id>/ (copy it from any uploaded image's URL). Read at build
// time: next.config.ts images.remotePatterns and the recently viewed list in the browser both use it. Pure, unit-tested.
export const SAMPLE_IMAGES_BASE = "https://storage.googleapis.com/merchant-center-europe/";

// The demo project's folder, used when nothing is set.
const DEMO_IMAGES_BASE = "https://images.us-east-2.aws.commercetools.com/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/";

// The folder as a URL prefix ending in "/". A value that isn't an https URL with a folder stops the build: an open
// pattern would make the image optimizer fetch from anywhere.
export function productImagesBase(value: string | undefined = process.env.NEXT_PUBLIC_PRODUCT_IMAGES_URL): string {
  const raw = value?.trim() || DEMO_IMAGES_BASE;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_PRODUCT_IMAGES_URL is not a URL: ${raw}`);
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (url.protocol !== "https:" || !path || url.search || url.hash)
    throw new Error(`NEXT_PUBLIC_PRODUCT_IMAGES_URL must be an https URL of your project's image folder: ${raw}`);
  return `${url.origin}${path}/`;
}

// For next.config.ts images.remotePatterns.
export function imagePattern(base: string): { protocol: "https"; hostname: string; pathname: string } {
  const url = new URL(base);
  return { protocol: "https", hostname: url.hostname, pathname: `${url.pathname}**` };
}
