"use server";

// Public endpoints for company administration. Each one: signed-in context, rate limit, input validation, then the
// service, which re-checks the associate's permission live in the selected unit.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireBusinessContext, requireShopContext } from "@/features/business-units/context";
import { CompanyError, INVITE_CODE, acceptInvitation, changeCompanyUserRoles, inviteCompanyUser, removeCompanyUser, updateCompanyProfile } from "@/features/company/service";
import { saveApprovalRule } from "@/features/company/approval-rules";
import { COMPANY_NAME_PATTERN, EMAIL_PATTERN } from "@/features/company/utils";
import type { CompanyActionState } from "@/features/company/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const roles = (formData: FormData) => formData.getAll("roles").map(String).slice(0, 10);

async function run(work: (ctx: Awaited<ReturnType<typeof requireBusinessContext>>) => Promise<void>, saved: string): Promise<CompanyActionState> {
  const current = await requireBusinessContext();
  if (tooManyAttempts(`company:${current.session.customerId}`, 30)) return { error: "Too many changes. Please wait a few minutes and try again." };
  try {
    await work(current);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof CompanyError) return { error: err.message };
    console.error("company update failed", (err as { body?: unknown })?.body ?? err);
    return { error: "The change could not be saved. Please try again." };
  }
  revalidatePath("/(shop)", "layout");
  return { saved };
}

export async function saveCompanyProfile(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const name = str(formData, "name");
  const contactEmail = str(formData, "contactEmail");
  if (!COMPANY_NAME_PATTERN.test(name)) return { error: "Enter a company name of 2 to 100 characters." };
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) return { error: "Enter a valid contact email, or leave it empty." };
  return run(({ context, session }) => updateCompanyProfile(context, session.customerId, name, contactEmail), "You saved the company profile.");
}

export async function addUser(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const email = str(formData, "email");
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter the user's email address." };
  // Not the same person over and over (each invitation is an email to them).
  const { context } = await requireBusinessContext();
  if (tooManyAttempts(`invite-send:${context.businessUnitKey}:${email.toLowerCase()}`, 3)) {
    return { error: `${email} was invited a few times already. Please wait a while before sending another invitation.` };
  }
  return run(
    ({ context, session }) => inviteCompanyUser(context, session.customerId, email, roles(formData)),
    `If ${email} has a customer account, they'll get an email invitation. They join once they accept it. No account yet? Ask our sales team to create one.`,
  );
}

// The invited customer accepts (signed in as that customer; consumers too, so this isn't a company page).
export async function acceptInvitationAction(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const code = str(formData, "code");
  if (!INVITE_CODE.test(code)) return { error: "This invitation link is not valid." };
  const { session } = await requireShopContext();
  if (tooManyAttempts(`invite:${session.customerId}`, 20)) return { error: "Too many attempts. Please wait a few minutes and try again." };
  try {
    await acceptInvitation(code, session.customerId);
  } catch (err) {
    if (err instanceof CompanyError) return { error: err.message };
    console.error("invitation accept failed", (err as { body?: unknown })?.body ?? err);
    return { error: "The invitation could not be accepted. Please try again." };
  }
  revalidatePath("/(shop)", "layout");
  redirect(`/account?joined=1`);
}

export async function changeUserRoles(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const customerId = str(formData, "customerId");
  if (!UUID.test(customerId)) return { error: "Unknown user." };
  return run(({ context, session }) => changeCompanyUserRoles(context, session.customerId, customerId, roles(formData)), "Roles saved.");
}

export async function removeUser(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const customerId = str(formData, "customerId");
  if (!UUID.test(customerId)) return { error: "Unknown user." };
  return run(({ context, session }) => removeCompanyUser(context, session.customerId, customerId), "User removed from the company.");
}

// Create or edit an approval rule. The amount must be a whole number in the unit's currency; roles are re-checked
// against the project's roles in the service, and the predicate is built there.
export async function saveApprovalRuleAction(_prev: CompanyActionState, formData: FormData): Promise<CompanyActionState> {
  const id = str(formData, "id");
  const version = Number(formData.get("version"));
  const name = str(formData, "name");
  const description = str(formData, "description");
  const amount = Number(str(formData, "amount").replace(/[\s,]/g, ""));
  if (id && (!UUID.test(id) || !Number.isInteger(version))) return { error: "Unknown rule." };
  if (name.length < 3 || name.length > 100) return { error: "Give the rule a name of 3 to 100 characters." };
  if (description.length > 500) return { error: "Keep the description under 500 characters." };
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) return { error: "Enter the order total as a whole amount, e.g. 10000." };
  const input = {
    ...(id && { id, version }),
    name,
    description,
    active: formData.get("active") === "on",
    amount,
    requesters: formData.getAll("requesters").map(String).slice(0, 10),
    approvers: formData.getAll("approvers").map(String).slice(0, 10),
  };
  const result = await run(async ({ context, session }) => {
    await saveApprovalRule(context, session.customerId, input);
  }, "Rule saved.");
  if (result.error) return result;
  redirect("/account/company/approval-rules?saved=1");
}
