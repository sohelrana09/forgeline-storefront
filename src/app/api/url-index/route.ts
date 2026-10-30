import { NextResponse, connection } from "next/server";
import { getUrlIndex } from "@/features/urls/service";

// The URL index (every catalog path and what it shows, plus the paths that redirect), for src/proxy.ts: redirects
// must be decided before a page starts streaming, or they turn into client-side redirects with status 200. Public
// data: every path in it is a public URL. Read from the cached index, answered per request.
export async function GET() {
  await connection();
  const { paths } = await getUrlIndex();
  return NextResponse.json([...paths], { headers: { "Cache-Control": "no-store" } });
}
