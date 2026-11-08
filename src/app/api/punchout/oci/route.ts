import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { reportEvent } from "@/lib/error-report";
import { CxmlError } from "@/features/punchout/cxml";
import { punchoutEnabled, returnUrlAllowed, verifySecret } from "@/features/punchout/config";
import { parseOciSetup } from "@/features/punchout/oci";
import { findConfig, openSession } from "@/features/punchout/service";

// SAP OCI: the buyer's browser is sent here (GET or form POST) with HOOK_URL, USERNAME and PASSWORD. On success it goes
// straight on to the one-time start URL.
const OCI_DOMAIN = "OCI";

async function handle(params: URLSearchParams) {
  if (!punchoutEnabled()) return new NextResponse(null, { status: 404 });
  const text = (body: string, status: number) =>
    new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (await tooManyAttempts(`punchout-ip:${await clientIp()}`, 60)) return text("Too many requests", 429);
  const oci = parseOciSetup(params);
  try {
    if (!oci.username || !oci.hookUrl) throw new CxmlError("USERNAME and HOOK_URL are required");
    if (await tooManyAttempts(`punchout-id:${OCI_DOMAIN}:${oci.username}`, 30)) throw new CxmlError("Too many requests", 403);
    const config = await findConfig(OCI_DOMAIN, oci.username);
    if (!config || !config.formats.includes("oci") || !verifySecret(oci.password, config)) throw new CxmlError("Unauthorized", 401);
    if (!returnUrlAllowed(oci.hookUrl, config.returnHosts)) throw new CxmlError("HOOK_URL is not allowed", 403);
    const startUrl = await openSession({
      config,
      format: "oci",
      returnUrl: oci.hookUrl,
      buyerCookie: "",
      buyer: { domain: OCI_DOMAIN, identity: oci.username },
      oci: { target: oci.target, caller: oci.caller },
    });
    return NextResponse.redirect(startUrl, { status: 303, headers: { "Referrer-Policy": "no-referrer" } });
  } catch (err) {
    if (err instanceof CxmlError) return text(err.message, err.status);
    reportEvent("punchout_setup_failed", err);
    return text("Internal error", 500);
  }
}

export const GET = (request: Request) => handle(new URL(request.url).searchParams);

export async function POST(request: Request) {
  const form = await request.formData().catch(() => undefined);
  const params = new URLSearchParams();
  form?.forEach((v, k) => typeof v === "string" && params.append(k, v));
  return handle(params);
}
