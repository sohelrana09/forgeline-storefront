import { NextResponse, type NextRequest } from "next/server";
import { sessionWorks, signOut } from "@/features/auth/session";

// Reached when a session's (or guest's) token stops working (Server Components can't delete cookies themselves).
// A link or redirect from another site must not sign anyone out (logout CSRF): such a GET, while the session still
// works, gets a confirmation page whose button POSTs back here. A broken session is cleared at once whatever the
// origin (someone arriving from an email with an expired session). Our own redirects arrive as same-origin (or
// direct, "none") navigations; browsers without Sec-Fetch-Site (before 2023) count as direct.
const fromThisSite = (request: NextRequest) => ["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? "none");

export async function GET(request: NextRequest) {
  if (!fromThisSite(request) && (await sessionWorks())) return confirmPage();
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!fromThisSite(request) || (origin && origin !== request.nextUrl.origin)) return new NextResponse("Forbidden", { status: 403 });
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

function confirmPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Sign out</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#111827">
<h1 style="font-size:1.5rem">Sign out?</h1>
<p>Do you want to sign out of your account?</p>
<form method="post" action="/logout" style="display:flex;gap:.75rem">
<button style="min-height:2.75rem;padding:0 1.25rem;border:0;border-radius:.25rem;background:#c2410c;color:#fff;font-weight:600">Sign out</button>
<a href="/" style="min-height:2.75rem;display:inline-flex;align-items:center;padding:0 1.25rem;color:#111827">Back to the shop</a>
</form></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
