import { connection, NextResponse, type NextRequest } from "next/server";
import { hasCronSecret } from "@/lib/revalidate-auth";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { demoEnabled } from "@/features/demo/demo";
import { resetDemo } from "@/features/demo/service";
import { reportEvent } from "@/lib/error-report";

export const maxDuration = 120;

// Nightly demo reset (DEMO_MODE only; docs/features/demo-personas.md): puts the demo personas' carts, quotes,
// approvals, purchase lists, budgets and recurring orders back. Called by Vercel Cron with `Bearer <CRON_SECRET>`.
export async function GET(request: NextRequest) {
  await connection();
  if (!demoEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!hasCronSecret(request.headers.get("authorization"))) {
    if (await tooManyAttempts(`demo-reset:${await clientIp()}`, 20)) {
      return NextResponse.json({ error: "too many attempts" }, { status: 429 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await resetDemo({ dryRun: false });
    console.info("demo reset", result);
    return NextResponse.json(result, { status: result.failed ? 500 : 200 });
  } catch (err) {
    reportEvent("demo_reset_failed", err);
    return NextResponse.json({ error: "reset failed" }, { status: 500 });
  }
}
