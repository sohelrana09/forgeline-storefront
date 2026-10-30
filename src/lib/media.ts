// This project's folder on Sanity's image CDN (next.config.ts allows the same folder).
export function isSanityImageUrl(url: unknown): url is string {
  const project = process.env.NEXT_SANITY_PROJECT_ID;
  if (typeof url !== "string" || !project) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "cdn.sanity.io" && !u.port && u.pathname.startsWith(`/images/${project}/`);
  } catch {
    return false;
  }
}
