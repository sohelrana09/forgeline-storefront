import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

// Leaves the preview: published content again.
export async function GET(request: NextRequest) {
  (await draftMode()).disable();
  return NextResponse.redirect(new URL("/", request.url));
}
