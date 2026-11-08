import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { reportEvent } from "@/lib/error-report";
import { esc } from "@/features/punchout/cxml";
import { punchoutEnabled } from "@/features/punchout/config";
import { PunchoutError, endPunchout, getPunchout, returnDocument } from "@/features/punchout/service";

// "Return cart": a page with one form that posts the cart to the procurement system's return URL (the browser does
// the post, as PunchOut requires). Its own CSP: no scripts at all, and forms may post to that one origin only (the
// base CSP is left off this path in next.config.ts). Without scripts the buyer presses the button once more.
const page = (title: string, body: string, csp: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
      `<style>body{font:16px system-ui,sans-serif;margin:0;padding:3rem 1rem;background:#f3f4f6;color:#1f2937}main{max-width:32rem;margin:auto;background:#fff;padding:2rem;border-radius:.5rem}button{font:inherit;background:#111827;color:#fff;border:0;border-radius:.375rem;padding:.75rem 1.25rem;cursor:pointer}a{color:#1d4ed8}</style></head>` +
      `<body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": csp,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );

const BASE = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'";

export async function POST(request: Request) {
  if (!punchoutEnabled()) return new NextResponse(null, { status: 404 });
  // Same-site form posts only (the session cookie is SameSite=Lax, this is a second check).
  if (request.headers.get("origin") !== new URL(siteUrl()).origin) return new NextResponse("Forbidden", { status: 403 });
  const session = await getPunchout();
  if (!session)
    return page(
      "Session ended",
      "<h1>Your PunchOut session has ended</h1><p>Please start again from your procurement system.</p>",
      `${BASE}; form-action 'none'`,
      410,
    );
  try {
    const doc = await returnDocument(session);
    await endPunchout();
    const target = new URL(doc.returnUrl);
    const inputs = doc.fields.map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("");
    return page(
      "Return your cart",
      `<h1>Return your cart</h1><p>${doc.lines} line${doc.lines === 1 ? "" : "s"} go back to your procurement system at <strong>${esc(target.hostname)}</strong>, where you complete the requisition.</p>` +
        `<form method="post" action="${esc(doc.returnUrl)}" ${session.oci?.target ? `target="${esc(session.oci.target)}"` : ""}>${inputs}<button type="submit">Return cart to ${esc(target.hostname)}</button></form>`,
      `${BASE}; form-action ${target.origin}`,
    );
  } catch (err) {
    if (err instanceof PunchoutError)
      return page("Session ended", `<h1>Can't return the cart</h1><p>${esc(err.message)}</p>`, `${BASE}; form-action 'none'`, 409);
    reportEvent("punchout_return_failed", err);
    return page(
      "Error",
      '<h1>Something went wrong</h1><p>Please try again.</p><p><a href="/punchout">Back to the cart</a></p>',
      `${BASE}; form-action 'none'`,
      500,
    );
  }
}
