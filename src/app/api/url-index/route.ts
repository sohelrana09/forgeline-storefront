import { NextResponse } from "next/server";
import { getUrlIndex } from "@/features/urls/service";

// The URL index (every catalog path and what it shows, plus the paths that redirect), for src/proxy.ts: redirects
// must be decided before a page starts streaming, or they turn into client-side redirects with status 200. Public
// data: every path in it is a public URL. Prerendered from the cached index and served from the CDN; it follows the
// index's lifetime and tags, so /api/revalidate refreshes it too.
export async function GET() {
  const { paths } = await getUrlIndex();
  return NextResponse.json([...paths]);
}
