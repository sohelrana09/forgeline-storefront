import { NextResponse } from "next/server";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { punchoutEnabled } from "@/features/punchout/config";
import { redeemStart, savePunchout } from "@/features/punchout/service";

// The buyer's browser opens the start URL from the setup response once: the token is redeemed, the sealed session
// cookie set, and the browser moves on to /punchout (so the token never stays in the address bar or history).
export async function GET(request: Request) {
  if (!punchoutEnabled()) return new NextResponse(null, { status: 404 });
  const headers = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" };
  if (await tooManyAttempts(`punchout-start:${await clientIp()}`, 30))
    return new NextResponse("Too many requests", { status: 429, headers });
  const session = await redeemStart(new URL(request.url).searchParams.get("token") ?? "");
  if (!session)
    return new NextResponse("This PunchOut link has expired or was already used. Please start again from your procurement system.", {
      status: 410,
      headers,
    });
  await savePunchout(session);
  return NextResponse.redirect(`${siteUrl()}/punchout`, { status: 303, headers });
}
