"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmail, register, requestPasswordReset, resendVerification, resetPasswordAction } from "@/features/auth/actions";
import type { ForgotPasswordState, RegisterState, ResetPasswordState } from "@/features/auth/types";
import { FormGuardFields } from "@/components/ui/FormGuardFields";

const input = "min-h-11 rounded border border-gray-300 px-3 text-base font-normal";
const label = "flex flex-col gap-1 text-sm font-semibold";
const button = "min-h-11 rounded bg-orange-700 px-4 text-sm font-semibold text-white disabled:opacity-60";

function Alert({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      {error}
    </p>
  ) : null;
}

const passwordHint = <span className="text-xs font-normal text-gray-600">8 to 128 characters, with a letter and a number.</span>;

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, {} as RegisterState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormGuardFields />
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          First name
          <input
            name="firstName"
            required
            maxLength={60}
            autoComplete="given-name"
            defaultValue={state.values?.firstName}
            className={input}
          />
        </label>
        <label className={label}>
          Last name
          <input
            name="lastName"
            required
            maxLength={60}
            autoComplete="family-name"
            defaultValue={state.values?.lastName}
            className={input}
          />
        </label>
      </div>
      <label className={label}>
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={state.values?.email}
          className={input}
        />
      </label>
      <label className={label}>
        Password
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={input} />
        {passwordHint}
      </label>
      <label className={label}>
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <label htmlFor="terms" className="flex min-h-11 items-center gap-2 text-sm">
        <input id="terms" name="terms" type="checkbox" required className="h-5 w-5" />
        <span>
          I accept the{" "}
          <Link href="/pages/terms" target="_blank" className="text-orange-800">
            terms of sale
          </Link>
        </span>
      </label>
      <Alert error={state.error} />
      <button disabled={pending} className={button}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as ForgotPasswordState);
  if (state.sent) {
    return (
      <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        If an account exists for that email, we sent a link to reset the password. It works for 30 minutes.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormGuardFields />
      <label className={label}>
        Email
        <input name="email" type="email" required maxLength={254} autoComplete="email" className={input} />
      </label>
      <Alert error={state.error} />
      <button disabled={pending} className={button}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {} as ResetPasswordState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormGuardFields />
      <input type="hidden" name="token" value={token} />
      <label className={label}>
        New password
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={input} />
        {passwordHint}
      </label>
      <label className={label}>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className={input}
        />
      </label>
      <Alert error={state.error} />
      <button disabled={pending} className={button}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  return (
    <form action={confirmEmail} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="m-0 text-sm text-gray-700">Confirm that this email address belongs to you.</p>
      <button className={button}>Confirm my email</button>
    </form>
  );
}

export function ResendVerificationButton() {
  const [state, action, pending] = useActionState(resendVerification, {} as { sent?: boolean; error?: string });
  if (state.sent) return <span className="text-sm text-green-900">We sent a new link. Please check your inbox.</span>;
  return (
    <form action={action} className="inline">
      {state.error && <span className="mr-2 text-sm text-red-900">{state.error}</span>}
      <button disabled={pending} className="min-h-11 px-1 text-sm text-orange-800 underline underline-offset-2 disabled:opacity-60">
        {pending ? "Sending…" : "Send a new confirmation link"}
      </button>
    </form>
  );
}
