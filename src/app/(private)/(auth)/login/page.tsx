import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { Message } from "@/components/ui/Message";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; email?: string }> }) {
  if (await getSession()) redirect("/");
  const { reset, email } = await searchParams;

  return (
    <AuthShell
      title="Customer login"
      aside={
        <div className="flex flex-col items-start gap-3 text-sm text-gray-700">
          <h2 className="m-0 text-lg font-semibold text-gray-900">New customers</h2>
          <p className="m-0">Creating an account has many benefits: check out faster, keep more than one address, and track your orders.</p>
          <p className="m-0 text-xs text-gray-600">Buying for a company? Our sales team sets up business accounts with company prices.</p>
          <Link
            href="/register"
            className="flex min-h-11 items-center rounded bg-orange-700 px-5 font-semibold text-white no-underline hover:bg-orange-800"
          >
            Create an account
          </Link>
        </div>
      }
    >
      <h2 className="mb-1 mt-0 text-lg font-semibold">Registered customers</h2>
      <p className="mb-4 mt-0 text-sm text-gray-600">If you have an account, sign in with your email address.</p>
      {reset === "1" && <Message type="success">Your password was changed. Sign in with the new password.</Message>}
      {email === "verified" && <Message type="success">Your email address is confirmed. Sign in to start shopping.</Message>}
      {email === "invalid" && (
        <Message type="error">This confirmation link has expired or was already used. Sign in to get a new one.</Message>
      )}
      <LoginForm />
      <p className="mb-0 mt-4 text-sm">
        <Link href="/forgot-password" className="text-orange-800">
          Forgot your password?
        </Link>
      </p>
    </AuthShell>
  );
}
