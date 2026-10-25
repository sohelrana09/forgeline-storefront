// Where pictures in content may come from: this project's folder on the commercetools CDN (the CMS media library,
// see scripts/media-library.ts) and the sample data bucket. next.config.ts lets the image optimizer fetch exactly
// these. The Content app keeps the same list (cms-app/src/constants.ts).
export const MEDIA_SOURCES = [
  { host: "images.us-east-2.aws.commercetools.com", path: "/c189cfd4-9774-40b2-938c-3b62f7cfb6d5/" },
  { host: "storage.googleapis.com", path: "/merchant-center-europe/" },
] as const;

// Parsed, not a string prefix: "…/merchant-center-europe/../other-bucket/x.png" normalises to another folder.
export function isMediaUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      MEDIA_SOURCES.some((s) => u.hostname === s.host && u.pathname.startsWith(s.path))
    );
  } catch {
    return false;
  }
}
