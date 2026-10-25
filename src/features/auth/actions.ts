"use server";

// Public endpoints: sign in and sign out.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { customerApiRoot } from "@/lib/commercetools/client";
import { requestCustomerToken, revokeToken, signUpCustomer } from "@/lib/commercetools/customer-token";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { after } from "next/server";
import {
  BU_COOKIE,
  GUEST_COOKIE,
  SESSION_COOKIE,
  cartCookie,
  cookieOptions,
  customerScopes,
  getGuest,
  getSession,
  saveSession,
  type Session,
} from "@/features/auth/session";
import { getBuyingContexts, getConsumerContext, getGuestContext } from "@/features/business-units/service";
import { contextsFor, pickContext } from "@/features/business-units/context";
import { mergeGuestCart } from "@/features/cart/service";
import type { ForgotPasswordState, LoginState, RegisterState, ResetPasswordState } from "@/features/auth/types";
import { resetPassword, sendEmailVerification, startPasswordReset, verifyEmail } from "@/features/auth/service";
import { NAME_PATTERN } from "@/features/account/utils";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  if (await throttled(email)) return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  const result = await signIn(email, password);
  if ("error" in result) return { ...result, email };
  redirect(await mergeGuestCartOnLogin(result));
}

const ipKey = async () => `ip:${await clientIp()}`;
const throttled = async (email: string) => tooManyAttempts(await ipKey()) || tooManyAttempts(`email:${email}`);

// Password flow with the narrowed scope list, then the encrypted session cookie. Shared by sign-in and sign-up.
async function signIn(email: string, password: string): Promise<Session | { error: string }> {
  const token = await requestCustomerToken(email, password, await customerScopes());
  if (!token.ok) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    return {
      error: token.reason === "credentials" ? "Email or password is incorrect." : "Sign-in is unavailable right now. Please try again later.",
    };
  }
  try {
    const { body: me } = await customerApiRoot(token.accessToken).me().get().execute();
    const session = { accessToken: token.accessToken, expiresAt: token.expiresAt, customerId: me.id, email: me.email, name: me.firstName };
    await saveSession(session);
    return session;
  } catch (err) {
    console.error("login: /me failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Sign-in is unavailable right now. Please try again later." };
  }
}

const PASSWORD_RULE = "Use 8 to 128 characters with at least one letter and one number.";
const strongEnough = (password: string) => password.length >= 8 && password.length <= 128 && /\p{L}/u.test(password) && /\d/.test(password);
const EMAIL = /^[^\s@"\\]{1,64}@[^\s@"\\]{1,190}\.[A-Za-z]{2,}$/;

// Public endpoint: consumer sign-up (B2C). Business accounts are set up by our sales team (company + roles).
export async function register(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { firstName, lastName, email };
  if (!NAME_PATTERN.test(firstName) || !/\p{L}/u.test(firstName) || !NAME_PATTERN.test(lastName) || !/\p{L}/u.test(lastName)) {
    return { error: "Enter your first and last name.", values };
  }
  if (!EMAIL.test(email)) return { error: "Enter a valid email address.", values };
  if (!strongEnough(password)) return { error: PASSWORD_RULE, values };
  if (password !== String(formData.get("confirmPassword") ?? "")) return { error: "The passwords don't match.", values };
  if (formData.get("terms") !== "on") return { error: "Please accept the terms of sale.", values };
  if (tooManyAttempts(`signup:${await ipKey()}`, 5)) return { error: "Too many sign-ups from your network. Please try again later.", values };

  const created = await signUpCustomer({ email, password, firstName, lastName });
  if (!created.ok) {
    return {
      error:
        created.reason === "exists"
          ? "There is already an account with this email. Sign in, or reset your password."
          : "Sign-up is unavailable right now. Please try again later.",
      values,
    };
  }
  await sendEmailVerification(created.customerId, email).catch((err) => console.error("verification email failed", err?.body ?? err));
  const session = await signIn(email, password);
  if ("error" in session) redirect("/login");
  redirect(await mergeGuestCartOnLogin(session));
}

// Public endpoint: always the same answer, so it can't be used to find out who has an account.
export async function requestPasswordReset(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  // Own counters (not the sign-in ones, so reset requests can't lock someone out of signing in), and the lookup
  // and email run after the response, so its timing doesn't tell whether the account exists.
  if (!tooManyAttempts(`reset-ip:${await clientIp()}`) && !tooManyAttempts(`reset:${email}`, 3)) {
    after(() => startPasswordReset(email).catch((err) => console.error("password reset failed", (err as { body?: unknown })?.body ?? err)));
  }
  return { sent: true };
}

// Public endpoint: set a new password with the token from the email link.
export async function resetPasswordAction(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(token)) return { error: "This reset link is not valid. Request a new one." };
  if (!strongEnough(password)) return { error: PASSWORD_RULE };
  if (password !== String(formData.get("confirmPassword") ?? "")) return { error: "The passwords don't match." };
  if (tooManyAttempts(await ipKey())) return { error: "Too many attempts. Please wait a few minutes and try again." };
  const result = await resetPassword(token, password).catch((err) => {
    console.error("password reset failed", (err as { body?: unknown })?.body ?? err);
    return "error" as const;
  });
  if (result === "invalid") return { error: "This reset link has expired or was already used. Request a new one." };
  if (result === "error") return { error: "Your password could not be changed right now. Please try again later." };
  redirect("/login?reset=1");
}

// Moves a guest cart into the buyer's cart for their selected unit; returns where sign-in should land.
// Best effort: sign-in never fails because of the merge, and a guest cart that couldn't be merged is kept.
async function mergeGuestCartOnLogin(session: Session): Promise<string> {
  const guest = await getGuest().catch(() => undefined);
  if (!guest?.cartId) return "/";
  const jar = await cookies();
  const contexts = contextsFor(await getBuyingContexts(), session.customerId);
  // Business buyers merge into their selected unit's cart; consumers into their personal cart (same B2C store).
  const context = contexts.length > 0 ? pickContext(contexts, jar.get(BU_COOKIE)?.value) : await getConsumerContext();
  if (!context.canOrder) return "/"; // nowhere to put the lines: keep the guest cart for a later guest visit

  try {
    const result = await mergeGuestCart(guest, await getGuestContext(), session, jar.get(cartCookie(context.businessUnitKey))?.value, context);
    jar.delete(GUEST_COOKIE); // first: once merged, a later sign-in must never merge the same lines again
    if (result.cart) jar.set(cartCookie(context.businessUnitKey), result.cart.id, cookieOptions);
    void revokeToken(guest.refreshToken, "refresh_token");
    if (result.merged === 0 && result.skipped.length === 0) return "/";
    const params = new URLSearchParams({ merged: String(result.merged) });
    if (result.skipped.length > 0) params.set("skipped", result.skipped.join(","));
    return `/cart?${params}`;
  } catch (err) {
    // Includes a redirect thrown by signOutOnAuthError for the guest token: sign-in still succeeds.
    console.error("guest cart merge failed", (err as { body?: unknown })?.body ?? err);
    return "/";
  }
}

export async function logout() {
  const session = await getSession();
  if (session) await revokeToken(session.accessToken);
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name === SESSION_COOKIE || c.name === GUEST_COOKIE || c.name === BU_COOKIE || c.name.startsWith("ct_cart_")) jar.delete(c.name);
  }
  redirect("/login");
}

// Public endpoint: confirms the email address with the token from the verification link (a button, not the GET).
export async function confirmEmail(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ok = /^[A-Za-z0-9_-]{10,200}$/.test(token) && !tooManyAttempts(await ipKey()) && (await verifyEmail(token).catch(() => false));
  redirect(`/account?email=${ok ? "verified" : "invalid"}`);
}

// Public endpoint: sends the signed-in customer a new verification link (at most 3 per 15 minutes).
export async function resendVerification(): Promise<{ sent?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (tooManyAttempts(`verify:${session.customerId}`, 3)) return { error: "We already sent a few links. Please check your inbox." };
  await sendEmailVerification(session.customerId, session.email).catch((err) => console.error("verification email failed", err?.body ?? err));
  return { sent: true };
}
