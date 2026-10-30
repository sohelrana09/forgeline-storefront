import { studioOrigin } from "@/lib/csp";

// Cross-origin reads for a Studio on its own domain (STUDIO_URL): its product and category pickers call
// /api/search/suggest and /api/catalog/categories. Public catalog data, read without cookies; only that one origin
// is allowed, and nothing when the Studio is embedded (same origin).
export function studioCors(request: Request): Record<string, string> {
  const allowed = studioOrigin(process.env.STUDIO_URL);
  if (!allowed || request.headers.get("origin") !== allowed) return {};
  return { "Access-Control-Allow-Origin": allowed, Vary: "Origin" };
}
