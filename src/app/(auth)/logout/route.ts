import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { revokeToken } from "@/lib/commercetools/customer-token";
import { BU_COOKIE, GUEST_COOKIE, SESSION_COOKIE, getSession } from "@/features/auth/session";

// Reached when a session's (or guest's) token stops working (Server Components can't delete cookies themselves).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session) await revokeToken(session.accessToken);
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name === SESSION_COOKIE || c.name === GUEST_COOKIE || c.name === BU_COOKIE || c.name.startsWith("ct_cart_")) jar.delete(c.name);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
