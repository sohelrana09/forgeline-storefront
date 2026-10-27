import "server-only";
import { apiRoot } from "@/lib/commercetools/client";
import { str } from "@/lib/predicate";
import { sendMail, siteUrl } from "@/lib/mailer";

// Account lifecycle that needs commercetools' customer tokens (password reset, email verification). Creating
// those tokens requires manage_customers, so the admin client does it, server-side only, for exactly the
// customer named; the token value only ever travels in an email link.

const RESET_TTL_MINUTES = 30;
const VERIFY_TTL_MINUTES = 24 * 60;

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

// Always "succeeds" from the caller's view, so the form never reveals whether an email has an account.
export async function startPasswordReset(email: string) {
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `lowercaseEmail=${str(email.toLowerCase())}`, limit: 1 } })
    .execute();
  const customer = body.results[0];
  if (!customer) return;
  const { body: token } = await apiRoot
    .customers()
    .passwordToken()
    // Only the newest link works: an older one that leaked (forwarded mail, shared inbox) stops working.
    .post({ body: { email: customer.email, ttlMinutes: RESET_TTL_MINUTES, invalidateOlderTokens: true } })
    .execute();
  await sendMail({
    to: customer.email,
    subject: "Reset your Ironline Supply password",
    text: `Someone asked to reset the password for your account. If that was you, open this link within ${RESET_TTL_MINUTES} minutes:\n${siteUrl()}/reset-password?token=${encodeURIComponent(token.value)}\n\nIf it wasn't you, ignore this email: your password stays the same.`,
  });
}

export type ResetResult = "ok" | "invalid";

export async function resetPassword(tokenValue: string, newPassword: string): Promise<ResetResult> {
  try {
    await apiRoot.customers().passwordReset().post({ body: { tokenValue, newPassword } }).execute();
    return "ok";
  } catch (err) {
    // An unknown, used or expired token: 400/404. Anything else is an outage, not the customer's fault.
    if (statusOf(err) === 400 || statusOf(err) === 404) return "invalid";
    throw err;
  }
}

export async function sendEmailVerification(customerId: string, email: string) {
  const { body: token } = await apiRoot
    .customers()
    .emailToken()
    .post({ body: { id: customerId, ttlMinutes: VERIFY_TTL_MINUTES } })
    .execute();
  await sendMail({
    to: email,
    subject: "Confirm your email for Ironline Supply",
    text: `Welcome to Ironline Supply. Please confirm your email address:\n${siteUrl()}/verify-email?token=${encodeURIComponent(token.value)}`,
  });
}

export async function verifyEmail(tokenValue: string): Promise<boolean> {
  try {
    await apiRoot.customers().emailConfirm().post({ body: { tokenValue } }).execute();
    return true;
  } catch (err) {
    if (statusOf(err) === 400 || statusOf(err) === 404) return false;
    throw err;
  }
}
