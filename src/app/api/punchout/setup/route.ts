import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { reportEvent } from "@/lib/error-report";
import { CxmlError, MAX_BYTES, errorResponse, parseSetupRequest, setupResponse } from "@/features/punchout/cxml";
import { punchoutEnabled, returnUrlAllowed, verifySecret } from "@/features/punchout/config";
import { findConfig, openSession } from "@/features/punchout/service";

// cXML PunchOutSetupRequest from the buyer's procurement system (server to server). Always answers cXML.
const xml = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!punchoutEnabled()) return new NextResponse(null, { status: 404 });
  const now = new Date().toISOString();
  if (await tooManyAttempts(`punchout-ip:${await clientIp()}`, 60)) return xml(errorResponse("", now, 429, "Too many requests"), 429);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return xml(errorResponse("", now, 413, "Request too large"), 413);
  let payloadId = "";
  try {
    const body = await request.text();
    const setup = parseSetupRequest(body);
    payloadId = setup.payloadId;
    // A wrong secret counts against the identity too, so guessing is slow from any number of addresses.
    if (await tooManyAttempts(`punchout-id:${setup.from.domain}:${setup.from.identity}`, 30)) throw new CxmlError("Too many requests", 403);
    const config = await findConfig(setup.from.domain, setup.from.identity);
    if (!config || !config.formats.includes("cxml") || !verifySecret(setup.sender.sharedSecret, config)) {
      throw new CxmlError("Unauthorized", 401);
    }
    if (!returnUrlAllowed(setup.browserFormPost, config.returnHosts)) throw new CxmlError("BrowserFormPost URL is not allowed", 403);
    const startUrl = await openSession({
      config,
      format: "cxml",
      returnUrl: setup.browserFormPost,
      buyerCookie: setup.buyerCookie,
      buyer: { domain: setup.from.domain, identity: setup.from.identity },
    });
    return xml(setupResponse(payloadId, now, startUrl));
  } catch (err) {
    if (err instanceof CxmlError) return xml(errorResponse(payloadId, now, err.status, err.message), err.status);
    reportEvent("punchout_setup_failed", err);
    return xml(errorResponse(payloadId, now, 500, "Internal error"), 500);
  }
}
